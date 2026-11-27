// Creates the guest-mode policy on devnet, or tops it up if it already exists.
// Safe to run again: the policy address is fixed by GUEST_POLICY_SEED.
//
// Run from program/ after `anchor build` (the script loads target/idl):
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=~/.config/solana/id.json \
//   GUEST_AGENT=<agent public key> \
//   GUEST_PHARMACIES=<cruzverde>,<ahumada>,<salcobrand> \
//   GUEST_CATALOG=../data/catalog.json \
//   yarn run ts-node -P ./tsconfig.json scripts/guest-policy.ts
//
// Inputs (environment variables):
//   GUEST_AGENT        Public key of AGENT_KEYPAIR. Only the public key.
//   GUEST_PHARMACIES   Comma-separated devnet addresses from the `pharmacies`
//                      table, at most 3.
//   GUEST_PRODUCTS     Comma-separated product ids, at most 10. Or:
//   GUEST_CATALOG      Path to a catalog JSON with `products[].id`.
//   GUEST_POLICY_SEED  Fixed policy seed. Default 1.
//   GUEST_CAP          Pesos per purchase. Default 15000.
//   GUEST_BUDGET       Pesos per period. Default 60000.
//   GUEST_PERIOD       Seconds per period. Default 3600 (one hour), so the
//                      budget renews during the judges' evaluation.
//   GUEST_DEPOSIT      Pesos deposited on creation. Default 500000 (0.5 SOL).
//   GUEST_TOP_UP       Pesos sent when the policy already exists. Default 200000.
//
// The deploy wallet is the family. A policy cannot be edited after it is
// created (the contract has no update_policy), so if it exists with other
// rules the script stops instead of topping it up.
import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { RemedioSeguro } from "../target/types/remedio_seguro";
import idl from "../target/idl/remedio_seguro.json";

const { PublicKey, SystemProgram, Transaction } = anchor.web3;

const LAMPORTS_PER_PESO = 1_000;
const MAX_PHARMACIES = 3;
const MAX_PRODUCTS = 10;

const sha256 = (s: string): number[] => [
  ...createHash("sha256").update(s, "utf8").digest(),
];
const hex = (b: number[]) => Buffer.from(b).toString("hex");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pesos(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number of pesos`);
  }
  return value;
}

function productIds(): string[] {
  if (process.env.GUEST_PRODUCTS) return list(process.env.GUEST_PRODUCTS);
  const catalog = JSON.parse(readFileSync(required("GUEST_CATALOG"), "utf8"));
  return (catalog.products as { id: string }[]).map((p) => p.id);
}

async function main() {
  const agent = new PublicKey(required("GUEST_AGENT"));
  const pharmacies = list(required("GUEST_PHARMACIES")).map((a) => new PublicKey(a));
  const products = productIds();
  if (pharmacies.length === 0 || pharmacies.length > MAX_PHARMACIES) {
    throw new Error(`GUEST_PHARMACIES needs 1 to ${MAX_PHARMACIES} addresses`);
  }
  if (products.length === 0 || products.length > MAX_PRODUCTS) {
    throw new Error(`the policy needs 1 to ${MAX_PRODUCTS} products`);
  }
  const productHashes = products.map(sha256);

  const seed = new BN(pesos("GUEST_POLICY_SEED", 1));
  const cap = pesos("GUEST_CAP", 15_000);
  const budget = pesos("GUEST_BUDGET", 60_000);
  const period = pesos("GUEST_PERIOD", 3_600);
  const deposit = pesos("GUEST_DEPOSIT", 500_000);
  const topUp = pesos("GUEST_TOP_UP", 200_000);

  const env = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(env.connection, env.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new Program<RemedioSeguro>(idl as RemedioSeguro, provider);
  const family = provider.wallet.publicKey;

  const [policy] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), family.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  console.log("program:", program.programId.toBase58());
  console.log("family: ", family.toBase58());
  console.log("policy: ", policy.toBase58());

  const existing = await program.account.policy.fetchNullable(policy);
  if (existing === null) {
    const sig = await program.methods
      .createPolicy(
        seed,
        agent,
        new BN(cap),
        new BN(budget),
        new BN(period),
        pharmacies,
        productHashes,
        new BN(deposit)
      )
      .accountsPartial({ family, policy, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`created with a deposit of ${deposit} pesos: ${sig}`);
  } else {
    const want = {
      agent: agent.toBase58(),
      pharmacies: pharmacies.map((p) => p.toBase58()).sort(),
      products: productHashes.map(hex).sort(),
    };
    const have = {
      agent: existing.agent.toBase58(),
      pharmacies: existing.pharmacies
        .map((p) => p.toBase58())
        .filter((p) => p !== PublicKey.default.toBase58())
        .sort(),
      products: existing.products
        .map(hex)
        .filter((h) => h !== "00".repeat(32))
        .sort(),
    };
    if (JSON.stringify(want) !== JSON.stringify(have)) {
      console.error("on chain:", have);
      console.error("asked:   ", want);
      throw new Error(
        "the policy exists with other rules and cannot be edited; use another GUEST_POLICY_SEED"
      );
    }
    if (topUp > 0) {
      const sig = await provider.sendAndConfirm(
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: family,
            toPubkey: policy,
            lamports: topUp * LAMPORTS_PER_PESO,
          })
        )
      );
      console.log(`already existed, topped up with ${topUp} pesos: ${sig}`);
    } else {
      console.log("already existed, no top-up asked");
    }
  }

  const state = await program.account.policy.fetch(policy);
  const vault = await provider.connection.getBalance(policy);
  console.log(
    `paused ${state.paused}, cap ${state.perPurchaseCap}, budget ${state.periodBudget} ` +
      `every ${state.periodSeconds} s, spent ${state.spentInPeriod}, ` +
      `vault ${vault} lamports (${Math.floor(vault / LAMPORTS_PER_PESO)} pesos with rent)`
  );
  console.log(`GUEST_POLICY=${policy.toBase58()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
