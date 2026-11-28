const clpFormat = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export function pesos(amount: number | bigint): string {
  return clpFormat.format(amount)
}

export function dateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function periodLabel(seconds: number): string {
  if (seconds >= 86400 && seconds % 86400 === 0) {
    const days = seconds / 86400
    return days === 1 ? '1 día' : `${days} días`
  }
  if (seconds >= 3600 && seconds < 86400 && seconds % 3600 === 0) {
    const hours = seconds / 3600
    return hours === 1 ? '1 hora' : `${hours} horas`
  }
  if (seconds >= 60 && seconds < 3600 && seconds % 60 === 0) {
    const minutes = seconds / 60
    return minutes === 1 ? '1 minuto' : `${minutes} minutos`
  }
  return seconds === 1 ? '1 segundo' : `${seconds} segundos`
}

export function shortAddress(base58: string): string {
  if (base58.length <= 9) return base58
  return `${base58.slice(0, 4)}…${base58.slice(-4)}`
}

export function explorerAddressUrl(base58: string): string {
  return `https://explorer.solana.com/address/${base58}?cluster=devnet`
}

export function periodNow(seconds: number): string {
  if (seconds === 3600) return 'esta hora'
  if (seconds === 86400) return 'hoy'
  if (seconds === 604800) return 'esta semana'
  if (seconds === 2592000) return 'este mes'
  return 'en este período'
}
