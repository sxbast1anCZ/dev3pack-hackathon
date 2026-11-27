// Live check of V1 on devnet: a valid payment succeeds and one over the cap
// fails with OverPurchaseCap.
//
// Run from program/ after `anchor build`:
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=~/.config/solana/id.json \
//   yarn run ts-node -P ./tsconfig.json scripts/smoke-devnet.ts
//
// The deploy wallet is the family. The agent and the pharmacy are temporary
// keypairs that live only in memory. No airdrop: the agent is funded with a
// transfer from the family.
import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import { createHash, randomBytes } from "crypto";
import { RemedioSeguro } from "../target/types/remedio_seguro";
import idl from "../target/idl/remedio_seguro.json";

const { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } =
  anchor.web3;

const LAMPORTS_PER_PESO = 1_000;
const sha256 = (s: string): number[] => [
  ...createHash("sha256").update(s, "utf8").digest(),
];

async function main() {
  const env = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(env.connection, env.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new Program<RemedioSeguro>(idl as RemedioSeguro, provider);
  const connection = provider.connection;
  const family = provider.wallet.publicKey;

  const agent = Keypair.generate();
  const pharmacy = Keypair.generate().publicKey;
  const product = sha256("losartan-50mg-30");
  const policySeed = new BN(randomBytes(8), "le");
  const [policy] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("policy"),
      family.toBuffer(),
      policySeed.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  console.log("program:", program.programId.toBase58());
  console.log("policy: ", policy.toBase58());

  await provider.sendAndConfirm(
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: family,
        toPubkey: agent.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      })
    )
  );

  const createSig = await program.methods
    .createPolicy(
      policySeed,
      agent.publicKey,
      new BN(15_000),
      new BN(40_000),
      new BN(30 * 24 * 60 * 60),
      [pharmacy],
      [product],
      new BN(50_000)
    )
    .accountsPartial({ family, policy, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("create_policy signature:", createSig);

  const before = await connection.getBalance(pharmacy);
  const paySig = await program.methods
    .agentPay(new BN(2_599), product, sha256("smoke-quote-1"))
    .accountsPartial({ agent: agent.publicKey, policy, pharmacy })
    .signers([agent])
    .rpc();
  const after = await connection.getBalance(pharmacy, "confirmed");
  const state = await program.account.policy.fetch(policy, "confirmed");
  console.log("agent_pay 2599 signature:", paySig);
  console.log(
    `pharmacy received ${after - before} lamports, spent_in_period ${state.spentInPeriod}`
  );
  if (after - before !== 2_599 * LAMPORTS_PER_PESO) {
    throw new Error("pharmacy did not receive 2,599,000 lamports");
  }

  try {
    await program.methods
      .agentPay(new BN(15_001), product, sha256("smoke-quote-2"))
      .accountsPartial({ agent: agent.publicKey, policy, pharmacy })
      .signers([agent])
      .rpc();
    throw new Error("agent_pay over the cap succeeded");
  } catch (err) {
    if (!(err instanceof anchor.AnchorError)) throw err;
    console.log("agent_pay 15001 error:", err.error.errorCode.code);
    if (err.error.errorCode.code !== "OverPurchaseCap") throw err;
  }
  console.log("V1 passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
