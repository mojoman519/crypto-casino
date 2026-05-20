import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const HOUSE_WALLET = process.env.NEXT_PUBLIC_HOUSE_WALLET_SOL!
const HELIUS_API_KEY = process.env.HELIUS_API_KEY!
const LAMPORTS_PER_SOL = 1_000_000_000

function adminAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('casino_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/deposits — scan house wallet tx history and credit any unprocessed deposits
export async function GET(req: NextRequest) {
  if (!adminAuth(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    // Fetch last 100 transactions to/from the house wallet via Helius API
    const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${HOUSE_WALLET}/transactions/?api-key=${HELIUS_API_KEY}&limit=100`
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Helius API error' }, { status: 502 })
    }

    const txs: Array<{
      signature: string
      type: string
      timestamp: number
      nativeTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>
    }> = await res.json()

    const credited: string[] = []
    const skipped: string[] = []

    for (const tx of txs) {
      if (!tx.nativeTransfers) continue

      for (const transfer of tx.nativeTransfers) {
        if (transfer.toUserAccount !== HOUSE_WALLET) continue

        const solAmount = transfer.amount / LAMPORTS_PER_SOL
        if (solAmount < 0.001) continue

        // Idempotency check
        const exists = await db.transaction.findFirst({ where: { txHash: tx.signature } })
        if (exists) {
          skipped.push(tx.signature)
          continue
        }

        // Match sender to a registered user
        const wallet = await db.wallet.findFirst({
          where: { address: transfer.fromUserAccount, chain: 'SOLANA' },
          include: { user: { select: { id: true, username: true } } },
        })

        if (!wallet) {
          skipped.push(`${tx.signature} (unknown wallet ${transfer.fromUserAccount})`)
          continue
        }

        await db.$transaction([
          db.user.update({
            where: { id: wallet.userId },
            data: { solBalance: { increment: solAmount } },
          }),
          db.transaction.create({
            data: {
              userId: wallet.userId,
              type: 'DEPOSIT',
              amount: solAmount,
              currency: 'SOL',
              chain: 'SOLANA',
              txHash: tx.signature,
              status: 'CONFIRMED',
              note: `SOL deposit (recovered scan) from ${transfer.fromUserAccount}`,
            },
          }),
          db.auditLog.create({
            data: {
              userId: wallet.userId,
              action: 'SOL_DEPOSIT',
              severity: 'INFO',
              data: {
                solAmount,
                txSignature: tx.signature,
                fromAddress: transfer.fromUserAccount,
                source: 'admin_scan',
              } as Prisma.InputJsonValue,
            },
          }),
        ])

        credited.push(`${tx.signature} → ${wallet.user.username} +${solAmount} SOL`)
      }
    }

    return NextResponse.json({
      success: true,
      data: { creditedCount: credited.length, skippedCount: skipped.length, credited, skipped },
    })
  } catch (err) {
    console.error('[admin/deposits]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
