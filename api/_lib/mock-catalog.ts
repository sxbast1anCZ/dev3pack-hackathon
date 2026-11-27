import type { Offer, Product } from './contract.js'

// Simulated data, taken from the example responses of docs/contracts.md. Card A6 replaces it with
// the products and prices tables. Nothing here is a real reading of a pharmacy.

export interface MockEntry {
  product: Product
  aliases: string[]
  offers: Offer[]
}

export const MOCK_CATALOG: MockEntry[] = [
  {
    product: {
      id: 'losartan-50mg-30',
      name: 'Losartán 50 mg, 30 comprimidos',
      requires_prescription: true,
      is_bioequivalent: true,
    },
    aliases: ['losartan'],
    offers: [
      { pharmacy: 'salcobrand', price: 2599, in_stock: true, read_minutes_ago: 10, url: 'https://salcobrand.cl/' },
      { pharmacy: 'cruzverde', price: 2690, in_stock: true, read_minutes_ago: 10, url: 'https://www.cruzverde.cl/' },
      { pharmacy: 'ahumada', price: 1799, in_stock: false, read_minutes_ago: 12, url: 'https://www.farmaciasahumada.cl/' },
    ],
  },
]

// Lower case, without accents, so "Losartán" and "losartan" match.
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function findMockProduct(query: string): MockEntry | undefined {
  const q = normalize(query)
  return MOCK_CATALOG.find((entry) => entry.aliases.some((alias) => q.includes(normalize(alias))))
}

export function findMockProductById(id: string): MockEntry | undefined {
  return MOCK_CATALOG.find((entry) => entry.product.id === id)
}
