import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aylpplunqenhixzxpfhp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@pabusinesscompliancegroup.com'

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
    const searchUrl = process.env.SEARCH_API_URL || 'https://pa-dos-search.vercel.app/api/search-entity'
      
    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: entityName }),
    })

    let validationResult: any = { status: 'error', message: 'Search failed', code: searchRes.status }
    
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
        const updateBody = {
            validation_status: validationResult.status,
            validation_result: {
                matched_entity: match,
                validation_status: validationResult.status
            },
            entity_id: validationResult.entity_id,
            entity_type: validationResult.entity_type,
            county: validationResult.county
        }

        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/filing_requests?id=eq.${recordId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updateBody)
        })
      } else {
        validationResult = { status: 'not_found', message: 'No exact match found' }
      }
    }

    // 3. Send email notification via Resend
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'PA Business Compliance <onboarding@resend.dev>',
          to: NOTIFY_EMAIL,
          subject: `Filing Validated: ${entityName}`,
          html: `
            <h2>🏛️ New Filing Request Validated</h2>
            <p><strong>Entity:</strong> ${entityName}</p>
            <p><strong>Status:</strong> ${validationResult.status.toUpperCase()}</p>
            <p><strong>Entity ID:</strong> ${validationResult.entity_id || 'N/A'}</p>
            <p><strong>Type:</strong> ${validationResult.entity_type || 'N/A'}</p>
            <p><strong>County:</strong> ${validationResult.county || 'N/A'}</p>
            <p><a href="https://file.dos.pa.gov">File Annual Report →</a></p>
          `,
        }),
      })
    }

    return NextResponse.json({ success: true, validation: validationResult })
  } catch (error: any) {
    console.error('Filing webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
