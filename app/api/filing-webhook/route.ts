import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aylpplunqenhixzxpfhp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

export async function POST(req: NextRequest) {
  if (!SUPABASE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    
    // Supabase sends an object with type, table, record, etc.
    const { record } = body
    if (!record || !record.entity_name) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const entityName = record.entity_name
    const recordId = record.id

    // 1. Validate entity via our search API
    // We construct the URL using VERCEL_URL if available, or fallback to the known deployment URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://pa-dos-search.vercel.app'
      
    const searchRes = await fetch(`${baseUrl}/api/search-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: entityName }),
    })

    let validationResult: any = { status: 'error', message: 'Search failed' }
    
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const results = searchData.results || []
      
      // Find exact or close match
      const match = results.find((r: any) => 
        r.entity_name.toLowerCase() === entityName.toLowerCase() || 
        entityName.toLowerCase().includes(r.entity_name.toLowerCase()) ||
        r.entity_name.toLowerCase().includes(entityName.toLowerCase())
      )

      if (match) {
        const isActive = match.status?.toLowerCase().includes('active')
        validationResult = {
          status: isActive ? 'active' : 'inactive',
          entity_id: match.entity_id,
          entity_type: match.entity_type,
          county: match.county,
          match_name: match.entity_name
        }

        // 2. Update Supabase with validation results
        // We need to stringify the object for the JSONB column
        const resultJson = JSON.stringify({
            matched_entity: match,
            validation_status: validationResult.status
        })

        await fetch(`${SUPABASE_URL}/rest/v1/filing_requests?id=eq.${recordId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            validation_status: validationResult.status,
            validation_result: resultJson,
            entity_id: validationResult.entity_id,
            entity_type: validationResult.entity_type,
            county: validationResult.county
          })
        })
      } else {
        validationResult = { status: 'not_found', message: 'No exact match found' }
      }
    }

    // 3. Notify via Discord (if webhook configured)
    if (DISCORD_WEBHOOK_URL) {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🏛️ **New Filing Request Validated**\n\n**Entity:** ${entityName}\n**Status:** ${validationResult.status.toUpperCase()}\n**Entity ID:** ${validationResult.entity_id || 'N/A'}\n**Type:** ${validationResult.entity_type || 'N/A'}\n**County:** ${validationResult.county || 'N/A'}`
        })
      })
    }

    return NextResponse.json({ success: true, validation: validationResult })
  } catch (error: any) {
    console.error('Filing webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
