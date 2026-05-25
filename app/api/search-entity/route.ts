import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30 // Vercel serverless timeout

export async function POST(req: NextRequest) {
  const body = await req.json()
  const searchQuery = body.query?.trim() || body.name?.trim()

  if (!searchQuery) {
    return NextResponse.json(
      { error: 'Missing query or name parameter' },
      { status: 400 }
    )
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    return NextResponse.json(
      { error: 'FIRECRAWL_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://file.dos.pa.gov/search/business',
        formats: ['markdown'],
        waitFor: 3000,
        onlyMainContent: true,
        actions: [
          { type: 'wait', milliseconds: 3000 },
          { type: 'write', selector: "input[placeholder*='Search']", text: searchQuery.trim() },
          { type: 'wait', milliseconds: 1000 },
          { type: 'press', key: 'Enter' },
          { type: 'wait', milliseconds: 5000 },
        ],
      }),
    })

    if (!firecrawlRes.ok) {
      const errText = await firecrawlRes.text()
      return NextResponse.json(
        { error: 'Firecrawl request failed', details: errText },
        { status: 502 }
      )
    }

    const data = await firecrawlRes.json()
    const markdown = data?.data?.markdown || data?.markdown || ''

    if (!markdown || markdown.includes('Just a moment') || markdown.includes('security verification')) {
      return NextResponse.json(
        { error: 'Blocked by Cloudflare challenge', results: [] },
        { status: 403 }
      )
    }

    // Parse the markdown table
    const lines = markdown.split('\n').filter(l => l.includes('|'))
    const results: any[] = []

    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split('|').map(c => c.trim()).filter(Boolean)
      if (cols.length >= 6) {
        // Extract entity ID from the name column: "Entity Name (1234567)Click to expand"
        const nameMatch = cols[0].match(/^(.+?)\s*\((\d+)\)/)
        results.push({
          entity_name: nameMatch ? nameMatch[1].trim() : cols[0].replace(/Click to expand/g, '').trim(),
          entity_id: nameMatch ? nameMatch[2] : null,
          filing_date: cols[1] || null,
          status: cols[2] || null,
          entity_type: cols[3] || null,
          county: cols[4] || null,
          // Include both formats for frontend compatibility
          entityType: cols[3] || null,
          formationDate: cols[1] || null,
          formation_date: cols[1] || null,
        })
      }
    }

    return NextResponse.json({
      query: searchQuery,
      result_count: results.length,
      results,
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}
