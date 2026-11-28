export interface SavingsInput {
  purchases: { amount: number; productId: string | null; pharmacyId: string | null }[]
  prices: { productId: string; pharmacy: string; price: number; inStock: boolean }[]
}

export function estimateSavings(input: SavingsInput): {
  total: number
  perPurchase: (number | null)[]
  counted: number
} {
  let total = 0
  let counted = 0

  const perPurchase = input.purchases.map((purchase) => {
    if (!purchase.productId || !purchase.pharmacyId) return null

    const others = input.prices.filter(
      (price) =>
        price.productId === purchase.productId &&
        price.pharmacy !== purchase.pharmacyId &&
        price.inStock,
    )
    if (others.length === 0) return null

    let next = others[0].price
    for (const candidate of others) {
      if (candidate.price < next) next = candidate.price
    }

    const diff = next - purchase.amount
    if (diff <= 0) return null

    total += diff
    counted += 1
    return diff
  })

  return { total, perPurchase, counted }
}
