import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

const HOUSE_WALLET = process.env.NEXT_PUBLIC_HOUSE_WALLET_SOL!
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET
const LAMPORTS_PER_SOL = 1_000_000_000

interface NativeTransfer {
  fromUserAccount: string
  toUserAccount: string
  amount: number // lamports
}

interface HeliusEvent {
  signature: string
  type: string
  timestamp: number
  nativeTransfers?: NativeTransfer[]
}

async function creditDeposit(
  fromAddress: string,
  solAmount: number,
  txSignature: string
): Promise<{ credited: boolean; reason: string }> {
  // Find user by their registered Solana wallet address
  const wallet = await db.wallet.findFirst({
    where: { address: fromAddress, chain: 'SOLANA' },
    include: { user: true },
  })

  if (!wallet) {
    return { credited: false, reason: `No user registered for wallet ${fromAddress}` }
  }

  // Idempotency — don't credit the same tx twice
  const existing = await db.transaction.findFirst({
    where: { txHash: txSignature },
  })
  if (existing) {
    return { credited: false, reason: 'Already processed' }
  }

  const userId = wallet.userId

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { solBalance: { increment: solAmount } },
    }),
    db.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount: solAmount,
        currency: 'SOL',
        chain: 'SOLANA',
        txHash: txSignature,
        status: 'CONFIRMED',
        note: `SOL deposit from ${fromAddress}`,
      },
    }),
    db.auditLog.create({
      data: {
        userId,
        action: 'SOL_DEPOSIT',
        severity: 'INFO',
        data: { solAmount, txSignature, fromAddress } as Prisma.InputJsonValue,
      },
    }),
  ])

  return { credited: true, reason: `Credited ${solAmount} SOL to user ${wallet.user.username}` }
}

export async function POST(req: NextRequest) {
  try {
    // Verify the webhook secret Helius sends in the Authorization header
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const events: HeliusEvent[] = await req.json()

    const results: string[] = []

    for (const event of events) {
      if (!event.nativeTransfers) continue

      for (const transfer of event.nativeTransfers) {
        // Only care about transfers TO our house wallet
        if (transfer.toUserAccount !== HOUSE_WALLET) continue

        const solAmount = transfer.amount / LAMPORTS_PER_SOL
        if (solAmount < 0.001) continue // ignore dust

        const result = await creditDeposit(transfer.fromUserAccount, solAmount, event.signature)
        results.push(result.reason)
      }
    }

    return NextResponse.json({ success: true, processed: results })
  } catch (err) {
    console.error('[webhooks/helius]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
