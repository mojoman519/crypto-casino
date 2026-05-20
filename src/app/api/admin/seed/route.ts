import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { auditLog } from '@/lib/audit-logger'

const ADMIN_USERNAME = 'gorilla_admin'
const HOUSE_WALLET_SOL = process.env.NEXT_PUBLIC_HOUSE_WALLET_SOL

// One-time admin account creation.
// Protected by ADMIN_SECRET env var — never expose this route's response publicly.
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()

    // Must provide the ADMIN_SECRET from Vercel env vars
    const expectedSecret = process.env.ADMIN_SECRET
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ success: false, error: 'Invalid secret' }, { status: 403 })
    }

    // ADMIN_PASSWORD must be set in Vercel env vars — never hardcoded
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword || adminPassword.length < 12) {
      return NextResponse.json({
        success: false,
        error: 'ADMIN_PASSWORD env var is missing or too short (min 12 characters)',
      }, { status: 400 })
    }

    const passwordHash = await hashPassword(adminPassword)

    // Upsert — safe to call again if account already exists
    const admin = await db.user.upsert({
      where: { username: ADMIN_USERNAME },
      create: {
        username: ADMIN_USERNAME,
        passwordHash,
        role: 'ADMIN',
        neonCoins: 0,
        balance: 0,
        isVerified: true,
        referralCode: `ADMIN_${Date.now()}`,
      },
      update: {
        passwordHash,
        role: 'ADMIN',
        isVerified: true,
      },
    })

    // Link house SOL wallet if configured
    if (HOUSE_WALLET_SOL) {
      await db.wallet.upsert({
        where: { chain_address: { chain: 'SOLANA', address: HOUSE_WALLET_SOL } },
        create: { userId: admin.id, chain: 'SOLANA', address: HOUSE_WALLET_SOL, isDefault: true },
        update: { userId: admin.id, isDefault: true },
      })
    }

    auditLog({
      userId: admin.id,
      username: ADMIN_USERNAME,
      action: 'ADMIN_CONFIG_CHANGE',
      severity: 'ALERT',
      data: { event: 'admin_account_seeded', walletLinked: !!HOUSE_WALLET_SOL },
    })

    return NextResponse.json({
      success: true,
      message: `Admin account "${ADMIN_USERNAME}" created successfully.`,
      walletLinked: HOUSE_WALLET_SOL ? `House wallet ${HOUSE_WALLET_SOL.slice(0, 8)}...linked` : 'No house wallet configured',
    })
  } catch (err) {
    console.error('[admin/seed]', err)
    return NextResponse.json({ success: false, error: 'Failed to create admin account' }, { status: 500 })
  }
}
