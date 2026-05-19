import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const MIN_WITHDRAW = 10
const MAX_WITHDRAW = 50_000
const WITHDRAW_FEE = 0.02 // 2%

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { amount, address } = await req.json()

    if (typeof amount !== 'number' || amount < MIN_WITHDRAW || amount > MAX_WITHDRAW) {
      return NextResponse.json({ success: false, error: `Withdrawal must be $${MIN_WITHDRAW}–$${MAX_WITHDRAW}` }, { status: 400 })
    }

    if (!address || address.length < 20) {
      return NextResponse.json({ success: false, error: 'Invalid withdrawal address' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    if (user.balance < amount) return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 })

    const fee = amount * WITHDRAW_FEE
    const netAmount = amount - fee

    const [transaction, updatedUser] = await db.$transaction([
      db.transaction.create({
        data: {
          userId: user.id,
          type: 'WITHDRAWAL',
          amount: netAmount,
          status: 'PENDING',
          note: `Withdrawal to ${address.slice(0, 8)}...${address.slice(-4)}`,
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: { balance: { decrement: amount } },
      }),
    ])

    // In production: trigger actual blockchain transfer here
    // await sendOnChainTransaction(address, netAmount)

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transaction.id,
        amount: netAmount,
        fee,
        newBalance: updatedUser.balance,
        status: 'PENDING',
        estimatedTime: '< 24 hours',
      },
    })
  } catch (err) {
    console.error('[wallet/withdraw]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
