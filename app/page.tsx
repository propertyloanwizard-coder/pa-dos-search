'use client'

import { useState } from 'react'

interface Entity {
  entity_name: string
  entity_id: string | null
  filing_date: string
  status: string
  entity_type: string
  county: string
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Entity[]>([])
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setResults([])

    try {
      const res = await fetch('/api/search-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Search failed')
        return
      }

      if (data.result_count === 0) {
        setError('No results found')
        return
      }

      setResults(data.results)
    } catch {
      setError('Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: 4 }}>PA DOS Entity Search</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Search Pennsylvania Department of State business entities</p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Company name..."
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: 16,
            border: '1px solid #ccc',
            borderRadius: 6,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: 16,
            background: loading ? '#999' : '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <p style={{ color: '#d32f2f', padding: '8px 0' }}>{error}</p>
      )}

      {results.length > 0 && (
        <>
          <p style={{ color: '#444', marginBottom: 8 }}>{results.length} result(s)</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Name</th>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd' }}>ID</th>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Filed</th>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Status</th>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Type</th>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd' }}>County</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.entity_id || i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 12px' }}>{r.entity_name}</td>
                    <td style={{ padding: '8px 12px' }}>{r.entity_id}</td>
                    <td style={{ padding: '8px 12px' }}>{r.filing_date}</td>
                    <td style={{ padding: '8px 12px' }}>{r.status}</td>
                    <td style={{ padding: '8px 12px' }}>{r.entity_type}</td>
                    <td style={{ padding: '8px 12px' }}>{r.county}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
