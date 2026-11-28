import { setCatalogSource, type CatalogData } from '../_lib/catalog.js'

// A small catalog with the shape of the products, product_sources and prices tables. Products and
// aliases come from data/catalog.json; prices and read times are fixed for the tests.
export const READ_AT = '2026-11-28T11:50:00.000Z'

export const CATALOG: CatalogData = {
  products: [
    {
      id: 'losartan-50mg-30',
      name: 'Losartán 50 mg, 30 comprimidos',
      active_ingredient: 'losartan',
      dose: '50 mg',
      quantity: 30,
      requires_prescription: true,
      is_bioequivalent: true,
      aliases: ['losartán', 'losartan', 'losartán de 50', 'losartan de 50', 'losartán potásico'],
    },
    {
      id: 'corodin-50mg-30',
      name: 'Corodin 50 mg, 30 comprimidos',
      active_ingredient: 'losartan',
      dose: '50 mg',
      quantity: 30,
      requires_prescription: true,
      is_bioequivalent: true,
      aliases: ['corodin', 'corodín', 'corodin de 50'],
    },
    {
      id: 'amlodipino-5mg-30',
      name: 'Amlodipino 5 mg, 30 comprimidos',
      active_ingredient: 'amlodipino',
      dose: '5 mg',
      quantity: 30,
      requires_prescription: true,
      is_bioequivalent: true,
      aliases: ['amlodipino', 'amlodipino de 5'],
    },
  ],
  sources: [
    { product_id: 'losartan-50mg-30', pharmacy: 'salcobrand', url: 'https://salcobrand.cl/products/losartan' },
    { product_id: 'losartan-50mg-30', pharmacy: 'cruzverde', url: 'https://www.cruzverde.cl/losartan' },
    { product_id: 'losartan-50mg-30', pharmacy: 'ahumada', url: 'https://www.farmaciasahumada.cl/losartan' },
    { product_id: 'corodin-50mg-30', pharmacy: 'salcobrand', url: 'https://salcobrand.cl/products/corodin' },
    { product_id: 'amlodipino-5mg-30', pharmacy: 'cruzverde', url: 'https://www.cruzverde.cl/amlodipino' },
  ],
  prices: [
    { product_id: 'losartan-50mg-30', pharmacy: 'salcobrand', price: 2599, in_stock: true, read_at: READ_AT },
    { product_id: 'losartan-50mg-30', pharmacy: 'cruzverde', price: 2690, in_stock: true, read_at: READ_AT },
    { product_id: 'losartan-50mg-30', pharmacy: 'ahumada', price: 1799, in_stock: false, read_at: '2026-11-28T11:48:00.000Z' },
    { product_id: 'corodin-50mg-30', pharmacy: 'salcobrand', price: 25343, in_stock: true, read_at: READ_AT },
    { product_id: 'amlodipino-5mg-30', pharmacy: 'cruzverde', price: 1990, in_stock: true, read_at: READ_AT },
  ],
}

export function withMemoryCatalog(data: CatalogData = CATALOG): void {
  setCatalogSource(async () => structuredClone(data))
}
