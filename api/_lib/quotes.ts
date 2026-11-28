import type { SupabaseClient } from '@supabase/supabase-js'
import { QUOTE_TTL_SECONDS, type PharmacyId } from './contract.js'
import { serverDb } from './db.js'

// Quotes (card A3): a quote is created by propose_purchase, expires after QUOTE_TTL_SECONDS, and
// can be used once. confirm_purchase claims it before anything is sent, so it can never pay twice.
// Table: quotes (docs/contracts.md, section 3). Only the server key reads or writes it.

export interface Quote {
  id: string
  policy: string
  product_id: string
  pharmacy: PharmacyId
  price: number
  read_at: string
  created_at: string
  expires_at: string
  used_at: string | null
  signature: string | null
}

export interface NewQuote {
  policy: string
  product_id: string
  pharmacy: PharmacyId
  price: number
  read_at: string
}

export type ClaimResult =
  | { ok: true; quote: Quote }
  | { ok: false; reason: 'QUOTE_NOT_FOUND' | 'QUOTE_EXPIRED' | 'QUOTE_ALREADY_USED' }

export interface QuoteStore {
  create(quote: NewQuote, now: Date): Promise<Quote>
  // Marks the quote used, only if it exists, is unused and has not expired. Atomic.
  claim(id: string, now: Date): Promise<ClaimResult>
  setSignature(id: string, signature: string): Promise<void>
}

// Why a claim failed, once the atomic update matched no row.
function refusal(existing: Pick<Quote, 'used_at' | 'expires_at'> | null, now: Date): ClaimResult {
  if (!existing) return { ok: false, reason: 'QUOTE_NOT_FOUND' }
  if (existing.used_at !== null) return { ok: false, reason: 'QUOTE_ALREADY_USED' }
  if (new Date(existing.expires_at) <= now) return { ok: false, reason: 'QUOTE_EXPIRED' }
  // The row became claimable between the two reads: treat it as used by a concurrent claim.
  return { ok: false, reason: 'QUOTE_ALREADY_USED' }
}

export function expiresAt(now: Date): string {
  return new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000).toISOString()
}

export class SupabaseQuoteStore implements QuoteStore {
  constructor(private readonly db: SupabaseClient) {}

  async create(quote: NewQuote, now: Date): Promise<Quote> {
    const { data, error } = await this.db
      .from('quotes')
      .insert({ ...quote, created_at: now.toISOString(), expires_at: expiresAt(now) })
      .select()
      .single()
    if (error) throw new Error(`quotes insert failed: ${error.message}`)
    return data as Quote
  }

  async claim(id: string, now: Date): Promise<ClaimResult> {
    // One UPDATE ... WHERE used_at IS NULL AND expires_at > now RETURNING *: only one caller wins.
    const { data, error } = await this.db
      .from('quotes')
      .update({ used_at: now.toISOString() })
      .eq('id', id)
      .is('used_at', null)
      .gt('expires_at', now.toISOString())
      .select()
      .maybeSingle()
    if (error) throw new Error(`quotes claim failed: ${error.message}`)
    if (data) return { ok: true, quote: data as Quote }

    const found = await this.db.from('quotes').select('used_at, expires_at').eq('id', id).maybeSingle()
    if (found.error) throw new Error(`quotes read failed: ${found.error.message}`)
    return refusal(found.data, now)
  }

  async setSignature(id: string, signature: string): Promise<void> {
    const { error } = await this.db.from('quotes').update({ signature }).eq('id', id)
    if (error) throw new Error(`quotes signature update failed: ${error.message}`)
  }
}

// Same rules as the table, in memory. Used by the tests.
export class MemoryQuoteStore implements QuoteStore {
  readonly rows = new Map<string, Quote>()

  async create(quote: NewQuote, now: Date): Promise<Quote> {
    const row: Quote = {
      ...quote,
      id: crypto.randomUUID(),
      created_at: now.toISOString(),
      expires_at: expiresAt(now),
      used_at: null,
      signature: null,
    }
    this.rows.set(row.id, row)
    return { ...row }
  }

  async claim(id: string, now: Date): Promise<ClaimResult> {
    const row = this.rows.get(id)
    if (row && row.used_at === null && new Date(row.expires_at) > now) {
      row.used_at = now.toISOString()
      return { ok: true, quote: { ...row } }
    }
    return refusal(row ?? null, now)
  }

  async setSignature(id: string, signature: string): Promise<void> {
    const row = this.rows.get(id)
    if (row) row.signature = signature
  }
}

let store: QuoteStore | undefined

// The store the tools use. Created on first use, so a deployment without Supabase settings fails
// on the first call (500) instead of silently keeping quotes nowhere.
export function quoteStore(): QuoteStore {
  if (!store) store = new SupabaseQuoteStore(serverDb())
  return store
}

// Tests replace the store, and the clock, through these.
export function setQuoteStore(next: QuoteStore | undefined): void {
  store = next
}

export let now = (): Date => new Date()
export function setClock(next: () => Date): void {
  now = next
}
