import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('casino_token')?.value
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const address = searchParams.get('address')
    if (!address) return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 })

    const heliusKey = process.env.HELIUS_API_KEY
    if (!heliusKey) {
      // Fallback: return empty array if no API key
      return NextResponse.json({ success: true, data: [] })
    }

    // Use Helius Digital Asset Standard API to fetch NFTs
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${address}/nfts?api-key=${heliusKey}&limit=50`,
      { next: { revalidate: 300 } }
    )

    if (!res.ok) {
      return NextResponse.json({ success: true, data: [] })
    }

    const nfts = await res.json()

    // Extract image URLs and names
    const parsed = (Array.isArray(nfts) ? nfts : nfts.nfts ?? [])
      .filter((n: Record<string, unknown>) => n.content && (n.content as Record<string, unknown>).links)
      .map((n: Record<string, unknown>) => {
        const content = n.content as Record<string, unknown>
        const links = content.links as Record<string, string>
        const metadata = content.metadata as Record<string, string>
        return {
          mint: n.id as string,
          name: metadata?.name ?? 'Unknown NFT',
          image: links?.image ?? links?.animation_url ?? null,
          collection: (n.grouping as { collection_metadata?: { name?: string } }[])?.[0]?.collection_metadata?.name ?? null,
        }
      })
      .filter((n: { image: string | null }) => n.image)
      .slice(0, 24)

    return NextResponse.json({ success: true, data: parsed })
  } catch (err) {
    console.error('[profile/nfts]', err)
    return NextResponse.json({ success: true, data: [] })
  }
}
