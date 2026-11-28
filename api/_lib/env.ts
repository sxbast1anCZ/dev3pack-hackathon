// Reads a required environment variable. A missing value fails loudly: a silent default would
// let a misconfigured deployment accept calls it should refuse.
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new MissingEnvError(name)
  return value
}

export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing environment variable ${variable}`)
  }
}
