import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import { createHash } from "crypto";
import { expect } from "chai";
import { RemedioSeguro } from "../target/types/remedio_seguro";

const { Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } = anchor.web3;

const LAMPORTS_PER_PESO = 1_000;
const sha256 = (s: string): number[] => [
  ...createHash("sha256").update(s, "utf8").digest(),
];

describe("remedio_seguro", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.remedioSeguro as Program<RemedioSeguro>;
  const family = provider.wallet.publicKey;

  const agent = Keypair.generate();
  const pharmacy = Keypair.generate().publicKey;
  const product = sha256("losartan-50mg-30");
  const policySeed = new BN(1);
  const [policy] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("policy"),
      family.toBuffer(),
      policySeed.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  before(async () => {
    const sig = await provider.connection.requestAirdrop(
      agent.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  });

  it("creates a policy and pays a valid purchase", async () => {
    await program.methods
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

    const before = await provider.connection.getBalance(pharmacy);
    await program.methods
      .agentPay(new BN(2_599), product, sha256("quote-1"))
      .accountsPartial({ agent: agent.publicKey, policy, pharmacy })
      .signers([agent])
      .rpc();
    const after = await provider.connection.getBalance(pharmacy);

    expect(after - before).to.equal(2_599 * LAMPORTS_PER_PESO);
    const state = await program.account.policy.fetch(policy);
    expect(state.spentInPeriod.toNumber()).to.equal(2_599);
    expect(state.history[0].amount.toNumber()).to.equal(2_599);
    expect(state.purchaseCount).to.equal(1);
  });

  it("rejects a purchase over the cap with OverPurchaseCap", async () => {
    try {
      await program.methods
        .agentPay(new BN(15_001), product, sha256("quote-2"))
        .accountsPartial({ agent: agent.publicKey, policy, pharmacy })
        .signers([agent])
        .rpc();
      expect.fail("agent_pay over the cap should fail");
    } catch (err) {
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect((err as anchor.AnchorError).error.errorCode.code).to.equal(
        "OverPurchaseCap"
      );
    }
  });
});
