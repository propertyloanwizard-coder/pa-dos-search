export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
      <h1>PA DOS Entity Search API</h1>
      <p>Endpoint: <code>/api/search-entity?q=Company+Name</code></p>
      <p>Search Pennsylvania Department of State business entities.</p>
      <p><em>Add FIRECRAWL_API_KEY in Vercel environment variables to activate.</em></p>
    </div>
  )
}
