# Remedio Seguro: product design

Approved by Sebastián on 2026-11-27. Interfaces: `docs/contracts.md`. Tasks: `docs/agent-handoff.md`.

## Intent

For families who help an older person buy their medicines, Remedio Seguro is a voice agent that
compares pharmacy prices and pays inside limits the family sets on Solana, instead of handing over
a card blindly or buying on the person's behalf.

**Why it matters.** Older people overpay, struggle with apps and are a frequent target of scams.
Their families want to help without giving up control.

**Why Solana.** The program enforces the limits. If the AI is fooled or manipulated, it still
cannot pay outside the policy. Without the chain, the family would have to trust our server.

**What it is not.** It is not medicine traceability: what is recorded is purchases, not boxes or
batches. It is not a delivery service: no medicine is shipped.

## Users

- **The family member** sets up the policy from the web with a wallet, and watches the purchases.
- **The older person** only talks. No wallet, no password, no typing.
- **The judge** uses a guest mode: a policy that is already funded, and a read-only view of it.

## Main flow

1. The family creates a policy: period budget, cap per purchase, allowed pharmacies and allowed
   medicines. It deposits the funds in the vault.
2. The older person says what they need: "Necesito mi losartán de 50".
3. The agent looks up prices in three pharmacy chains and proposes one, saying how long ago the
   price was read.
4. The person confirms by voice. The agent pays; the program checks every rule. If a rule fails,
   the transaction fails and the agent explains why in plain words.
5. The family sees each purchase, read from the chain, and can pause or close the policy.

## Goals

- A judge completes steps 2 to 4 from the live link by talking, with no wallet and no funds.
- A rejection is visible: a request over the cap or outside the lists is refused by the program.
- Every integration we name runs in the code: the program, Firecrawl, ElevenLabs, Supabase.

## Non-goals

- Shipping the medicine, paying real pharmacies, validating prescriptions.
- Changing a policy after it is created, several people per family, notifications.
- Free search of any medicine: only a fixed catalog of about 10.
- Solana Mobile, NFC, our own token (the first improvement if time is left).

## Anti-goals

- The agent never gives medical advice, never suggests a dose, never swaps the medicine for
  another one. If a bioequivalent exists it may say so, and nothing more.
- The agent never proposes a product that is out of stock.
- Nothing in the README or the app claims a real purchase, real privacy or a validated prescription.

## Constraints

- Deadline: Sunday 2026-11-29, 04:00 (Chile time). Four developers.
- Devnet only. The repository is public.
- The main track requires our own Rust program on devnet, a live demo and a video under 3 minutes.

## Approaches

**The idea.** Four ideas were considered earlier and "a tag that talks" was chosen. A gap analysis
by Ruben found it weak where the judges look hardest: the on-chain record could be called
decoration, voice was only justified for one kind of user, and Firecrawl had no reliable sources.
Remedio Seguro is a variant of the "voice shopper with on-chain spending limits" that was rejected
as a crowded category. It is taken up again because the user changes the case: for an older person
voice is the interface, the family is a real second party that sets the rules, and Chilean pharmacy
prices are public, change, and can be read live. The category is still crowded; the difference must
be stated in the first line of the pitch.

**How payments settle.**

| Option | Trade-off |
| --- | --- |
| Devnet SOL at a fixed rate (1 peso = 1,000 lamports). **Chosen for the first flow** | Fewest moving parts: no mint, no token accounts, no faucet. Less realistic than a stablecoin |
| Our own SPL token | Reads like pesos, shows more of the Solana SDK. Needs a mint, token accounts, a faucet for families and a token transfer signed by the vault |
| Devnet USDC | Most realistic. Depends on an external faucet |

Ruben, who owns the program, confirms or changes this choice before coding it.

**Where the purchase history lives.** In the policy account, as its last 10 purchases, instead of
indexing transactions. One read gives the policy and its history.

**How prices reach the agent.** From a cache, with the time each price was read. Firecrawl refreshes
the catalog in a separate job, and re-reads a single product when its price is stale. Reading three
sites live inside a voice turn is too slow.

## Components

| Part | Job | Lane |
| --- | --- | --- |
| Program `remedio_seguro` (Rust, Anchor, devnet) | Vault and policy. Checks every rule before paying. Keeps the last 10 purchases | `program` |
| Voice agent (ElevenLabs) | Understands the request, reads prices, proposes, and pays only after a spoken yes | `agent` |
| Backend tools (`api/`) | The three tools the agent calls. Holds the agent key and signs the payment | `agent` |
| Web app | Family screen, older person's screen, guest mode, read-only policy view | `web` |
| Catalog and prices (Supabase, Firecrawl) | About 10 medicines in three chains, refreshed with Firecrawl | `data` |

## Limits we state openly

- **The purchase is simulated.** Payment goes to a devnet address we control, one per chain.
- **The chain cannot check that a price is real.** Prices come from our scraper. The policy bounds
  the damage, and each payment stores a hash of its quote so the family can audit it.
- **The list of medicines on-chain is obfuscated, not private.** Products are stored as hashes; with
  a small catalog they can be guessed. The demo uses fictional people.
- **The agent does not validate prescriptions.** The list the family builds stands in for it.
- **Anyone with the older person's link can spend inside the limits.** That is the design.
- **The model could call the payment tool without a clear yes.** The tool only accepts a quote that
  was just proposed; the policy bounds the rest.

## The demo

1. Guest mode. Ask for a medicine on the list. The agent compares and proposes; say yes; the
   payment shows with its explorer link.
2. Ask for something outside the list, or over the cap. The program rejects it and the agent says why.
3. Open the read-only policy view: limits, amount spent and the purchases, read from the chain.

## If time runs short

Cut in this order: the third pharmacy chain; the screen that creates a policy (create it with a
script and use the guest policy); the pause and close buttons. Never cut: voice, price comparison,
payment checked by the program, and one visible rejection.

## Not verified yet

- Firecrawl against the three chains. The pages returned results in a browser on 2026-11-27; Cruz
  Verde took more than 6 seconds.
- How many ElevenLabs credits one minute of conversation costs.
- Whether an identical project exists in earlier Solana hackathons.
- That the saving between chains is visible for the demo medicines. In the one sample checked
  (losartan), the large difference was between brand and bioequivalent, not between chains.
