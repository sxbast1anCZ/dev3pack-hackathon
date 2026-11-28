import { MemoryQuoteStore, setQuoteStore } from '../_lib/quotes.js'

export const TEST_SECRET = 'test-secret-value'

// Builds the request ElevenLabs sends to a webhook tool.
export function toolRequest(body: unknown, secret: string | null = TEST_SECRET): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers['x-agent-secret'] = secret
  return new Request('http://localhost/api/tools/test', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

export function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const before = process.env.AGENT_TOOL_SECRET
  process.env.AGENT_TOOL_SECRET = TEST_SECRET
  return fn().finally(() => {
    if (before === undefined) delete process.env.AGENT_TOOL_SECRET
    else process.env.AGENT_TOOL_SECRET = before
  })
}

// Each test gets a fresh in-memory quote store instead of Supabase.
export function withMemoryQuotes(): MemoryQuoteStore {
  const store = new MemoryQuoteStore()
  setQuoteStore(store)
  return store
}
