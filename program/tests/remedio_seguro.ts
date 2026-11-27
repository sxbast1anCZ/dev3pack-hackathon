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

// "confirmed" avoids "Blockhash not found" on a freshly started validator.
const env = anchor.AnchorProvider.env();
const provider = new anchor.AnchorProvider(env.connection, env.wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);

describe("remedio_seguro", () => {
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

  const expectAnchorError = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
      expect.fail(`expected ${code}`);
    } catch (err) {
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect((err as anchor.AnchorError).error.errorCode.code).to.equal(code);
    }
  };

  it("lets only the family pause", async () => {
    const stranger = Keypair.generate();
    await expectAnchorError(
      program.methods
        .setPaused(true)
        .accountsPartial({ family: stranger.publicKey, policy })
        .signers([stranger])
        .rpc(),
      "ConstraintHasOne"
    );
    const state = await program.account.policy.fetch(policy);
    expect(state.paused).to.equal(false);
  });

  it("refuses payment with Paused while paused, and pays after resuming", async () => {
    await program.methods
      .setPaused(true)
      .accountsPartial({ family, policy })
      .rpc();
    await expectAnchorError(
      program.methods
        .agentPay(new BN(1_000), product, sha256("quote-3"))
        .accountsPartial({ agent: agent.publicKey, policy, pharmacy })
        .signers([agent])
        .rpc(),
      "Paused"
    );

    await program.methods
      .setPaused(false)
      .accountsPartial({ family, policy })
      .rpc();
    await program.methods
      .agentPay(new BN(1_000), product, sha256("quote-4"))
      .accountsPartial({ agent: agent.publicKey, policy, pharmacy })
      .signers([agent])
      .rpc();
    const state = await program.account.policy.fetch(policy);
    expect(state.spentInPeriod.toNumber()).to.equal(3_599);
  });

  it("lets only the family close", async () => {
    const stranger = Keypair.generate();
    await expectAnchorError(
      program.methods
        .closePolicy()
        .accountsPartial({ family: stranger.publicKey, policy })
        .signers([stranger])
        .rpc(),
      "ConstraintHasOne"
    );
    expect(await provider.connection.getAccountInfo(policy)).to.not.equal(null);
  });

  it("closes the policy and returns every lamport to the family", async () => {
    const vault = await provider.connection.getBalance(policy);
    const before = await provider.connection.getBalance(family);
    const sig = await program.methods
      .closePolicy()
      .accountsPartial({ family, policy })
      .rpc({ commitment: "confirmed" });
    const tx = await provider.connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const after = await provider.connection.getBalance(family, "confirmed");

    expect(after - before).to.equal(vault - tx!.meta!.fee);
    expect(await provider.connection.getAccountInfo(policy, "confirmed")).to.equal(
      null
    );
  });
});

describe("remedio_seguro rejections", () => {
  const program = anchor.workspace.remedioSeguro as Program<RemedioSeguro>;
  const family = provider.wallet.publicKey;

  const agent = Keypair.generate();
  const pharmacy = Keypair.generate().publicKey;
  const product = sha256("losartan-50mg-30");
  const DAY = 24 * 60 * 60;
  let nextSeed = 100;

  type PolicyOptions = {
    cap?: number;
    budget?: number;
    period?: number;
    pharmacies?: anchor.web3.PublicKey[];
    products?: number[][];
    deposit?: number;
  };

  const policyAddress = (seed: BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), family.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

  const createPolicy = (o: PolicyOptions = {}) => {
    const seed = new BN(nextSeed++);
    const policy = policyAddress(seed);
    const tx = program.methods
      .createPolicy(
        seed,
        agent.publicKey,
        new BN(o.cap ?? 15_000),
        new BN(o.budget ?? 40_000),
        new BN(o.period ?? 30 * DAY),
        o.pharmacies ?? [pharmacy],
        o.products ?? [product],
        new BN(o.deposit ?? 50_000)
      )
      .accountsPartial({ family, policy, systemProgram: SystemProgram.programId })
      .rpc();
    return { policy, tx };
  };

  const newPolicy = async (o: PolicyOptions = {}) => {
    const { policy, tx } = createPolicy(o);
    await tx;
    return policy;
  };

  const pay = (
    policy: anchor.web3.PublicKey,
    amount: number,
    opts: {
      signer?: anchor.web3.Keypair;
      to?: anchor.web3.PublicKey;
      product?: number[];
    } = {}
  ) => {
    const signer = opts.signer ?? agent;
    return program.methods
      .agentPay(new BN(amount), opts.product ?? product, sha256(`quote-${amount}`))
      .accountsPartial({
        agent: signer.publicKey,
        policy,
        pharmacy: opts.to ?? pharmacy,
      })
      .signers([signer])
      .rpc();
  };

  const expectError = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
    } catch (err) {
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect((err as anchor.AnchorError).error.errorCode.code).to.equal(code);
      return;
    }
    expect.fail(`expected ${code}`);
  };

  it("refuses a signer that is not the agent with UnauthorizedAgent", async () => {
    const policy = await newPolicy();
    await expectError(pay(policy, 1_000, { signer: Keypair.generate() }), "UnauthorizedAgent");
  });

  it("refuses a pharmacy outside the list with PharmacyNotAllowed", async () => {
    const policy = await newPolicy();
    await expectError(
      pay(policy, 1_000, { to: Keypair.generate().publicKey }),
      "PharmacyNotAllowed"
    );
  });

  it("refuses the default key as pharmacy, though empty slots hold it", async () => {
    // The default key is the System Program id. The runtime demotes it to
    // read-only, so Anchor refuses it with ConstraintMut before the handler.
    // The handler also skips default slots, as a second guard.
    const policy = await newPolicy();
    await expectError(pay(policy, 1_000, { to: PublicKey.default }), "ConstraintMut");
  });

  it("refuses a product outside the list with ProductNotAllowed", async () => {
    const policy = await newPolicy();
    await expectError(
      pay(policy, 1_000, { product: sha256("not-in-the-policy") }),
      "ProductNotAllowed"
    );
  });

  it("refuses the zero product hash, though empty slots hold it", async () => {
    const policy = await newPolicy();
    await expectError(
      pay(policy, 1_000, { product: new Array(32).fill(0) }),
      "ProductNotAllowed"
    );
  });

  it("refuses an amount of zero with ZeroAmount", async () => {
    const policy = await newPolicy();
    await expectError(pay(policy, 0), "ZeroAmount");
  });

  it("refuses an amount over the cap with OverPurchaseCap", async () => {
    const policy = await newPolicy();
    await expectError(pay(policy, 15_001), "OverPurchaseCap");
  });

  it("refuses purchases that together pass the budget with OverPeriodBudget", async () => {
    const policy = await newPolicy({ budget: 20_000 });
    await pay(policy, 15_000);
    await expectError(pay(policy, 5_001), "OverPeriodBudget");
    const state = await program.account.policy.fetch(policy);
    expect(state.spentInPeriod.toNumber()).to.equal(15_000);
  });

  it("refuses a payment that leaves the vault under rent with InsufficientVault", async () => {
    const policy = await newPolicy({ deposit: 1 });
    await expectError(pay(policy, 2), "InsufficientVault");
  });

  // Needs a validator whose clock follows real time: run the suite with
  // `anchor test --validator legacy`. Surfpool, the default, runs its clock
  // ahead, so a short period ends before the second purchase.
  it("resets the period budget once the period ends", async () => {
    const policy = await newPolicy({ budget: 1_000, cap: 1_000, period: 5 });
    await pay(policy, 1_000);
    await expectError(pay(policy, 1), "OverPeriodBudget");
    const first = await program.account.policy.fetch(policy);

    await new Promise((r) => setTimeout(r, 6_000));
    await pay(policy, 999);
    const state = await program.account.policy.fetch(policy);
    expect(state.spentInPeriod.toNumber()).to.equal(999);
    expect(state.periodStart.toNumber()).to.be.greaterThan(first.periodStart.toNumber());
    expect(state.purchaseCount).to.equal(2);
  });

  it("refuses 4 pharmacies with TooManyPharmacies", async () => {
    const pharmacies = [0, 1, 2, 3].map(() => Keypair.generate().publicKey);
    await expectError(createPolicy({ pharmacies }).tx, "TooManyPharmacies");
  });

  it("refuses 11 products with TooManyProducts", async () => {
    const products = Array.from({ length: 11 }, (_, i) => sha256(`product-${i}`));
    await expectError(createPolicy({ products }).tx, "TooManyProducts");
  });

  it("refuses a period of zero seconds with InvalidPeriod", async () => {
    await expectError(createPolicy({ period: 0 }).tx, "InvalidPeriod");
  });
});
