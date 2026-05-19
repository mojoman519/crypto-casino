use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("REPLACE_WITH_YOUR_PROGRAM_ID");

/// NeonBet Casino — Solana Anchor Program
/// Handles USDC deposits, withdrawals, and provably-fair game settlement.

#[program]
pub mod neon_bet_casino {
    use super::*;

    /// Initialize the house vault and config.
    pub fn initialize(ctx: Context<Initialize>, house_edge_bp: u16) -> Result<()> {
        require!(house_edge_bp <= 1000, CasinoError::InvalidHouseEdge); // max 10%
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.vault = ctx.accounts.vault.key();
        config.house_edge_bp = house_edge_bp;
        config.total_wagered = 0;
        config.total_payout = 0;
        config.paused = false;
        Ok(())
    }

    /// Deposit USDC from a user's token account into the vault.
    /// Credits the UserAccount balance.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, CasinoError::Paused);
        require!(amount >= 1_000_000, CasinoError::BelowMinimum); // $1 USDC (6 dec)

        // Transfer from user ATA → vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        let user_account = &mut ctx.accounts.user_account;
        user_account.balance = user_account.balance.checked_add(amount)
            .ok_or(CasinoError::Overflow)?;
        user_account.total_deposited = user_account.total_deposited.checked_add(amount)
            .ok_or(CasinoError::Overflow)?;

        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            amount,
            balance: user_account.balance,
        });
        Ok(())
    }

    /// Withdraw USDC from vault to user's token account.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, CasinoError::Paused);
        require!(amount >= 10_000_000, CasinoError::BelowMinimum); // min $10

        let user_account = &mut ctx.accounts.user_account;
        require!(user_account.balance >= amount, CasinoError::InsufficientBalance);

        user_account.balance = user_account.balance.checked_sub(amount)
            .ok_or(CasinoError::Overflow)?;

        // Transfer vault → user ATA (using PDA authority)
        let config_key = ctx.accounts.config.key();
        let seeds = &[b"vault_authority", config_key.as_ref(), &[ctx.bumps.vault_authority]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            amount,
            balance: user_account.balance,
        });
        Ok(())
    }

    /// Settle a game result. Called by the house authority (backend signer).
    /// The authority provides the game outcome after HMAC-SHA256 verification off-chain.
    pub fn settle_game(
        ctx: Context<SettleGame>,
        game_id: [u8; 32],
        bet_amount: u64,
        win_amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, CasinoError::Paused);

        let game_record = &mut ctx.accounts.game_record;
        require!(!game_record.settled, CasinoError::AlreadySettled);

        let user_account = &mut ctx.accounts.user_account;
        require!(user_account.balance >= bet_amount, CasinoError::InsufficientBalance);

        // Validate house edge
        let max_payout = bet_amount
            .checked_mul(2).ok_or(CasinoError::Overflow)?
            .checked_mul((10_000 - ctx.accounts.config.house_edge_bp as u64) as u64)
            .ok_or(CasinoError::Overflow)?
            .checked_div(10_000).ok_or(CasinoError::Overflow)?;
        require!(win_amount <= max_payout, CasinoError::InvalidPayout);

        // Debit bet, credit win
        user_account.balance = user_account.balance.checked_sub(bet_amount)
            .ok_or(CasinoError::Overflow)?;
        if win_amount > 0 {
            user_account.balance = user_account.balance.checked_add(win_amount)
                .ok_or(CasinoError::Overflow)?;
            user_account.total_won = user_account.total_won.checked_add(win_amount)
                .ok_or(CasinoError::Overflow)?;
        }
        user_account.total_wagered = user_account.total_wagered.checked_add(bet_amount)
            .ok_or(CasinoError::Overflow)?;
        user_account.games_played += 1;

        let config = &mut ctx.accounts.config;
        config.total_wagered = config.total_wagered.checked_add(bet_amount).ok_or(CasinoError::Overflow)?;
        config.total_payout = config.total_payout.checked_add(win_amount).ok_or(CasinoError::Overflow)?;

        game_record.game_id = game_id;
        game_record.user = ctx.accounts.user.key();
        game_record.bet_amount = bet_amount;
        game_record.win_amount = win_amount;
        game_record.settled = true;
        game_record.timestamp = Clock::get()?.unix_timestamp;

        emit!(GameSettledEvent {
            game_id,
            user: ctx.accounts.user.key(),
            bet_amount,
            win_amount,
            won: win_amount > 0,
        });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + CasinoConfig::SPACE, seeds = [b"casino_config"], bump)]
    pub config: Account<'info, CasinoConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(seeds = [b"casino_config"], bump)]
    pub config: Account<'info, CasinoConfig>,
    #[account(init_if_needed, payer = user, space = 8 + UserAccount::SPACE, seeds = [b"user", user.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [b"casino_config"], bump)]
    pub config: Account<'info, CasinoConfig>,
    #[account(mut, seeds = [b"user", user.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: PDA that owns the vault
    #[account(seeds = [b"vault_authority", config.key().as_ref()], bump)]
    pub vault_authority: AccountInfo<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct SettleGame<'info> {
    #[account(mut, seeds = [b"casino_config"], bump)]
    pub config: Account<'info, CasinoConfig>,
    #[account(mut, seeds = [b"user", user.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(init, payer = authority, space = 8 + GameRecord::SPACE, seeds = [b"game", &game_id], bump)]
    pub game_record: Account<'info, GameRecord>,
    /// CHECK: user being settled for
    pub user: AccountInfo<'info>,
    #[account(mut, constraint = authority.key() == config.authority @ CasinoError::Unauthorized)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── State Accounts ──────────────────────────────────────────────────────────

#[account]
pub struct CasinoConfig {
    pub authority: Pubkey,
    pub vault: Pubkey,
    pub house_edge_bp: u16,
    pub total_wagered: u64,
    pub total_payout: u64,
    pub paused: bool,
}
impl CasinoConfig { const SPACE: usize = 32 + 32 + 2 + 8 + 8 + 1; }

#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub total_deposited: u64,
    pub total_wagered: u64,
    pub total_won: u64,
    pub games_played: u64,
}
impl UserAccount { const SPACE: usize = 32 + 8 + 8 + 8 + 8 + 8; }

#[account]
pub struct GameRecord {
    pub game_id: [u8; 32],
    pub user: Pubkey,
    pub bet_amount: u64,
    pub win_amount: u64,
    pub settled: bool,
    pub timestamp: i64,
}
impl GameRecord { const SPACE: usize = 32 + 32 + 8 + 8 + 1 + 8; }

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct DepositEvent { pub user: Pubkey, pub amount: u64, pub balance: u64 }

#[event]
pub struct WithdrawEvent { pub user: Pubkey, pub amount: u64, pub balance: u64 }

#[event]
pub struct GameSettledEvent {
    pub game_id: [u8; 32],
    pub user: Pubkey,
    pub bet_amount: u64,
    pub win_amount: u64,
    pub won: bool,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum CasinoError {
    #[msg("Insufficient balance")] InsufficientBalance,
    #[msg("Amount below minimum")] BelowMinimum,
    #[msg("Game already settled")] AlreadySettled,
    #[msg("Invalid payout amount")] InvalidPayout,
    #[msg("Invalid house edge")] InvalidHouseEdge,
    #[msg("Arithmetic overflow")] Overflow,
    #[msg("Casino is paused")] Paused,
    #[msg("Unauthorized")] Unauthorized,
}
