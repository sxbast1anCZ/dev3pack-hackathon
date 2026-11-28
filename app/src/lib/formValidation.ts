import { errorSentence } from './errors'

export interface PolicyForm {
  capPesos: number
  budgetPesos: number
  periodSeconds: number
  depositPesos: number
  pharmacyWallets: string[]
  productIds: string[]
}

export function parsePesos(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  if (digits.length === 0) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

export function validateForm(f: PolicyForm): string | null {
  if (!Number.isInteger(f.capPesos) || f.capPesos <= 0) {
    return 'El tope por compra tiene que ser mayor que cero.'
  }
  if (!Number.isInteger(f.budgetPesos) || f.budgetPesos < f.capPesos) {
    return 'El presupuesto tiene que ser al menos igual al tope por compra.'
  }
  if (!Number.isInteger(f.depositPesos) || f.depositPesos < 0) {
    return 'El depósito no es válido.'
  }
  if (f.pharmacyWallets.length === 0) {
    return 'Elige al menos una farmacia.'
  }
  if (f.pharmacyWallets.length > 3) {
    return errorSentence('TooManyPharmacies')
  }
  if (f.productIds.length === 0) {
    return 'Elige al menos un medicamento.'
  }
  if (f.productIds.length > 10) {
    return errorSentence('TooManyProducts')
  }
  return null
}
