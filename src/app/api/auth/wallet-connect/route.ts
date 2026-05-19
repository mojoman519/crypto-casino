import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  try {
    const { chain, address, signature, message } = await req.json()

    if (!chain || !address || !signature || !message) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // TODO: Verify signature cryptographically
    // For Solana: use @solana/web3.js nacl.sign.detached.verify
    // For Ethereum: use ethers.verifyMessage(message, signature) === address

    // Find or create wallet
    let wallet = await db.wallet.findUnique({
      where: { chain_address: { chain, address } },
      include: { user: { include: { wallets: true } } },
    })

    let user = wallet?.user ?? null

    if (!user) {
      // Auto-register with wallet address as username
      const shortAddr = address.slice(0, 8)
      const username = `user_${shortAddr}`.toLowerCase()

      user = await db.user.create({
        data: {
          username,
          referralCode: nanoid(8),
          balance: 100,
          wallets: {
            create: { chain, address, isDefault: true },
          },
        },
        include: { wallets: true },
      })
    } else if (!wallet) {
      await db.wallet.create({
        data: { userId: user.id, chain, address },
      })
    }

    await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })

    const token = signToken({ userId: user.id, username: user.username, role: user.role })

    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS)

    const { passwordHash: _, ...safeUser } = user as typeof user & { passwordHash?: string }
    return NextResponse.json({ success: true, data: { user: safeUser, token } })
  } catch (err) {
    console.error('[auth/wallet-connect]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
