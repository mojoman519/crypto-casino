import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { amount, currency, chain, txHash } = await req.json()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    if (amount > 100_000) {
      return NextResponse.json({ success: false, error: 'Maximum deposit is $100,000' }, { status: 400 })
    }

    // In production: verify txHash on-chain before crediting
    // This is a simplified version for development

    const [transaction, updatedUser] = await db.$transaction([
      db.transaction.create({
        data: {
          userId: payload.userId,
          type: 'DEPOSIT',
          amount,
          currency: currency || 'USDC',
          chain: chain || 'SOLANA',
          txHash: txHash || null,
          status: 'CONFIRMED',
        },
      }),
      db.user.update({
        where: { id: payload.userId },
        data: { balance: { increment: amount } },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transaction.id,
        amount,
        newBalance: updatedUser.balance,
      },
    })
  } catch (err) {
    console.error('[wallet/deposit]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
