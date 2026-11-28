import { AnchorProvider, BN, Program, web3, type Idl } from '@anchor-lang/core'
import idl from '../../../idl/remedio_seguro.json'
import type { PolicyForm } from './formValidation'
import type { PhantomProvider } from './phantom'
import { connection, readProgram } from './policy'

// Measured on 2026-11-27: a Policy account holds 5,943,600 lamports of rent. Returned on close.
export const POLICY_RENT_TEXT = '≈ 0,006 SOL'

export function familyProgram(phantom: PhantomProvider): Program<Idl> {
  return new Program(
    idl as Idl,
    new AnchorProvider(
      connection,
      {
        publicKey: phantom.publicKey!,
        signTransaction: (t: web3.Transaction | web3.VersionedTransaction) =>
          phantom.signTransaction(t),
        signAllTransactions: (ts: Array<web3.Transaction | web3.VersionedTransaction>) =>
          phantom.signAllTransactions(ts),
      } as never,
      { commitment: 'confirmed' },
    ),
  )
}

export function policyAddress(family: web3.PublicKey, seed: BN): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('policy'),
      family.toBytes(),
      seed.toArrayLike(Uint8Array as never, 'le', 8),
    ],
    new web3.PublicKey(idl.address),
  )[0]
}

export async function createPolicy(
  program: Program<Idl>,
  family: web3.PublicKey,
  agent: web3.PublicKey,
  form: PolicyForm,
  productHashes: number[][],
): Promise<string> {
  const seed = new BN(Array.from(crypto.getRandomValues(new Uint8Array(8))), 'le')
  const policy = policyAddress(family, seed)

  // The IDL has no generated method types, so this cast is required.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (program.methods as any)
    .createPolicy(
      seed,
      agent,
      new BN(form.capPesos),
      new BN(form.budgetPesos),
      new BN(form.periodSeconds),
      form.pharmacyWallets.map((w) => new web3.PublicKey(w)),
      productHashes,
      new BN(form.depositPesos),
    )
    .accountsPartial({
      family,
      policy,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc()

  return policy.toBase58()
}

export async function setPaused(
  program: Program<Idl>,
  family: web3.PublicKey,
  policy: web3.PublicKey,
  paused: boolean,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (program.methods as any).setPaused(paused).accountsPartial({ family, policy }).rpc()
}

export async function closePolicy(
  program: Program<Idl>,
  family: web3.PublicKey,
  policy: web3.PublicKey,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (program.methods as any).closePolicy().accountsPartial({ family, policy }).rpc()
}

export async function listFamilyPolicies(family: web3.PublicKey): Promise<string[]> {
  // Offset 8: Anchor account discriminator is 8 bytes and `family` is the first field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (await (readProgram.account as any).policy.all([
    { memcmp: { offset: 8, bytes: family.toBase58() } },
  ])) as Array<{ publicKey: web3.PublicKey }>
  return accounts.map((a) => a.publicKey.toBase58())
}
