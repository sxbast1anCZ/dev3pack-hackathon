import { web3 } from '@anchor-lang/core'

export interface PhantomProvider {
  isPhantom?: boolean
  publicKey: web3.PublicKey | null
  connect(): Promise<{ publicKey: web3.PublicKey }>
  disconnect(): Promise<void>
  signTransaction<T extends web3.Transaction | web3.VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends web3.Transaction | web3.VersionedTransaction>(txs: T[]): Promise<T[]>
}

export function getPhantom(): PhantomProvider | null {
  const p = (window as unknown as { phantom?: { solana?: PhantomProvider } }).phantom?.solana
  return p?.isPhantom ? p : null
}
