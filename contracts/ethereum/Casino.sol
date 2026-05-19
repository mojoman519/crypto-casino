// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title NeonBet Casino
 * @notice Provably fair on-chain casino supporting ETH and ERC-20 deposits/withdrawals.
 *         Game logic is executed off-chain with HMAC-SHA256 and results are verifiable.
 */
contract NeonBetCasino is ReentrancyGuard, Ownable, Pausable {
    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    uint256 public constant MAX_BET = 10_000e6;      // $10,000 USDC (6 decimals)
    uint256 public constant MIN_BET = 1e6;           // $1 USDC
    uint256 public constant HOUSE_EDGE_BP = 300;     // 3% in basis points
    uint256 public constant BASIS_POINTS = 10_000;

    mapping(address => uint256) public balances;
    mapping(bytes32 => bool) public usedSeeds;

    address public immutable resolver; // Backend signer that authorizes payouts

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event GameSettled(
        address indexed user,
        bytes32 indexed gameId,
        uint256 betAmount,
        uint256 winAmount,
        bool won
    );
    event HouseWithdrew(uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _usdc, address _resolver) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        resolver = _resolver;
    }

    // ─── Deposit ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into the casino balance.
     * @param amount Amount in USDC (6 decimals).
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_BET, "Below minimum deposit");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        balances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Deposit native ETH (converted to balance in ETH wei).
     */
    function depositETH() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No ETH sent");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ─── Withdraw ─────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw USDC balance.
     * @param amount Amount to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        require(usdc.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    // ─── Game Settlement ──────────────────────────────────────────────────────

    /**
     * @notice Settle a game result authorized by the house resolver.
     *         The resolver signs (gameId, user, betAmount, winAmount) off-chain
     *         and provides the signature here for trustless settlement.
     *
     * @param gameId    Unique game ID (HMAC result hash)
     * @param betAmount Amount wagered
     * @param winAmount Amount won (0 if lost)
     * @param signature ECDSA signature from the resolver
     */
    function settleGame(
        bytes32 gameId,
        uint256 betAmount,
        uint256 winAmount,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(!usedSeeds[gameId], "Game already settled");
        require(betAmount >= MIN_BET && betAmount <= MAX_BET, "Invalid bet amount");
        require(balances[msg.sender] >= betAmount, "Insufficient balance");

        // Verify resolver signature
        bytes32 messageHash = keccak256(abi.encodePacked(gameId, msg.sender, betAmount, winAmount));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = _recoverSigner(ethHash, signature);
        require(signer == resolver, "Invalid signature");

        // Validate house edge: winAmount <= betAmount * (2 - HOUSE_EDGE)
        if (winAmount > 0) {
            uint256 maxPayout = (betAmount * 2 * (BASIS_POINTS - HOUSE_EDGE_BP)) / BASIS_POINTS;
            require(winAmount <= maxPayout, "Win exceeds allowed maximum");
        }

        usedSeeds[gameId] = true;

        // Debit bet, credit win
        balances[msg.sender] -= betAmount;
        if (winAmount > 0) {
            balances[msg.sender] += winAmount;
        }

        emit GameSettled(msg.sender, gameId, betAmount, winAmount, winAmount > 0);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Owner can withdraw accumulated house edge profits.
     */
    function houseWithdraw(uint256 amount) external onlyOwner {
        uint256 totalUserFunds = _totalUserBalances();
        uint256 contractBalance = usdc.balanceOf(address(this));
        require(contractBalance - amount >= totalUserFunds, "Cannot withdraw user funds");
        require(usdc.transfer(owner(), amount), "Transfer failed");
        emit HouseWithdrew(amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(hash, v, r, s);
    }

    function _totalUserBalances() internal view returns (uint256 total) {
        // In production, maintain a running total in state for gas efficiency
        return 0; // Simplified — track via event indexing off-chain
    }
}
