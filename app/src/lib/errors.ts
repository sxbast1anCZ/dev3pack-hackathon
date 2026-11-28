const ERROR_SENTENCES: Record<string, string> = {
  Paused: 'La familia pausó las compras por ahora.',
  UnauthorizedAgent: 'Este asistente no está autorizado para comprar con esta política.',
  PharmacyNotAllowed: 'Esa farmacia no está entre las que eligió la familia.',
  ProductNotAllowed: 'Ese remedio no está en la lista que aprobó la familia.',
  ZeroAmount: 'El monto de la compra no es válido.',
  OverPurchaseCap: 'La compra supera el tope por compra que puso la familia.',
  OverPeriodBudget: 'Ya se usó el presupuesto de este período.',
  InsufficientVault: 'No quedan fondos suficientes. Hay que pedirle a la familia que agregue.',
  TooManyPharmacies: 'Se pueden elegir hasta 3 farmacias.',
  TooManyProducts: 'Se pueden elegir hasta 10 medicamentos.',
  InvalidPeriod: 'El período tiene que ser mayor que cero.',
  PRODUCT_NOT_IN_CATALOG: 'Ese remedio no está en nuestro catálogo.',
  OUT_OF_STOCK: 'No hay stock de ese remedio en esa farmacia.',
  PRICE_UNAVAILABLE: 'No tenemos un precio reciente para ese remedio.',
  QUOTE_NOT_FOUND: 'No encontré esa propuesta. Pidámosla de nuevo.',
  QUOTE_EXPIRED: 'La propuesta venció. Pidámosla de nuevo.',
  QUOTE_ALREADY_USED: 'Esa compra ya se hizo.',
  ConstraintHasOne: 'Solo la familia que creó la política puede hacer esto.',
}

const FALLBACK_ERROR = 'No se pudo completar. Inténtalo de nuevo.'

export function errorSentence(code: string): string {
  return ERROR_SENTENCES[code] ?? FALLBACK_ERROR
}
