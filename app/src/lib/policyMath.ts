export interface PurchaseRow {
  amount: number
  pharmacyIndex: number
  productIndex: number
  timestamp: number
}

const HISTORY_LEN = 10

// Newest first. history is the ring of 10; purchaseCount is the total ever made.
export function recentPurchases(history: PurchaseRow[], purchaseCount: number): PurchaseRow[] {
  const count = Math.min(purchaseCount, HISTORY_LEN)
  const rows: PurchaseRow[] = []
  for (let k = 0; k < count; k += 1) {
    const idx = (purchaseCount - 1 - k) % HISTORY_LEN
    rows.push(history[idx])
  }
  return rows
}

export function periodState(
  periodStart: number,
  periodSeconds: number,
  spent: number,
  nowSeconds: number,
): { ended: boolean; spent: number; renewsAt: number } {
  const renewsAt = periodStart + periodSeconds
  const ended = nowSeconds >= renewsAt
  return {
    ended,
    spent: ended ? 0 : spent,
    renewsAt,
  }
}
