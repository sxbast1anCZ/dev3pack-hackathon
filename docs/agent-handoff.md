# Agent handoff: context and task cards

For any coding agent that starts work here with no earlier conversation. Written on 2026-11-27.
Deadline: Sunday 2026-11-29, 04:00 (Chile time).

Read this file first. Each card is written so one agent can take it without asking, and so two
agents do not edit the same files.

## 1. The project in five lines

- Remedio Seguro: a voice agent buys medicines for an older person, inside spending limits that the
  family sets on Solana.
- The program enforces the limits. If the AI is fooled, it still cannot pay outside the policy.
- Design: `docs/superpowers/specs/2026-11-27-remedio-seguro-design.md`.
- Interfaces between lanes: `docs/contracts.md`. Follow it exactly; do not invent fields.
- Nothing is built yet.

## 2. Rules

`AGENTS.md` has them all. The ones that bite most:

1. Devnet only. Never commit a secret; the repository is public.
2. Edit only the directories of your lane (`docs/contracts.md`, "Repository layout").
3. One branch and one pull request per card, to `dev`. Sebastián merges after the review comment.
4. If you need something the contract does not give you, stop and ask. The contract changes first.
5. Build only what the card says. No extra instructions, fields, endpoints, tables or screens.
6. Never write that something works before it runs.

## 3. Owners

| Lane | Owner | Directories |
| --- | --- | --- |
| `program` | Ruben | `program/`, `idl/` |
| `agent` | Victor | `api/` |
| `web` | Open | `app/`, root config |
| `data` | Sebastián | `supabase/`, `data/` |

`web` has no owner yet. Card W1 unblocks `agent`: if nobody has taken it by 19:30 on Friday, Victor
does W1.

## 4. Tonight: four validations

These are the four assumptions that can sink the plan. Each is the first card of its lane. If one
fails, say so in the team chat at once: the scope changes before anyone builds on it.

| Validation | Card | Proves |
| --- | --- | --- |
| V1 | P1 | The vault pays on devnet, and refuses a payment over the cap |
| V2 | A1 | Voice calls our tool and reads the answer aloud |
| V3 | D2 | Firecrawl reads price and stock in the three chains |
| V4 | W1 | The app and `api/` are published |

## 5. Task cards

Order inside a lane is the order of the list. "Needs" names the cards that must be merged first.

### Everyone, now

**T0. A devnet wallet with test SOL.** Separate from any personal wallet. At least 2 SOL from
`faucet.solana.com`, signed in with GitHub. Steps: `docs/team-setup.md`. The faucet saturates
during the hackathon: do it before anything else.

### Lane `program` (Ruben)

**P1. Toolchain, and the vault paying on devnet (V1).**
- What: install Rust, the Solana CLI and Anchor (`docs/team-setup.md`). Create the Anchor workspace
  in `program/`. Write `create_policy` and `agent_pay` as the contract defines them. Deploy to devnet.
- Before coding: confirm or change the payment unit (`docs/decisions.md`, "Payments settle in
  devnet SOL"). If it changes, the contract changes first.
- Done when: the program is on devnet; a valid payment succeeds and one over the cap fails with
  `OverPurchaseCap`; the program id is in `README.md` and `.env.example`; `idl/remedio_seguro.json`
  is committed.
- Fallback: if nothing compiles by 21:00, build and deploy from Solana Playground (`beta.solpg.io`)
  and keep the source in `program/`.
- Do not: add accounts or instructions the contract does not list. Do not commit a keypair.

**P2. One test per rejection.** Needs P1.
- What: tests for `Paused`, `UnauthorizedAgent`, `PharmacyNotAllowed`, `ProductNotAllowed`,
  `ZeroAmount`, `OverPurchaseCap`, `OverPeriodBudget`, `InsufficientVault`, and for the period
  reset (a short `period_seconds`).
- Done when: the tests pass, and the CI workflow runs them.

**P3. Pause and close.** Needs P1.
- What: `set_paused` and `close_policy`, with tests: only the family can call them; a paused policy
  refuses payment; closing returns the lamports.
- Done when: deployed, tests pass, the IDL is committed again.

**P4. The guest policy.** Needs P1.
- What: a script in `program/` that creates a policy for guest mode: a short period, a large
  deposit, the three pharmacy addresses and the catalog's product hashes.
- Done when: the address is in `.env.example` as `GUEST_POLICY`, and the script can run again to
  top it up.

### Lane `agent` (Victor)

**A1. Voice calling our tool (V2).** Needs W1.
- What: an ElevenLabs agent that speaks Spanish, with one webhook tool that calls a function in
  `api/` and reads the answer aloud. The call carries `x-agent-secret`; the function returns `401`
  without it.
- Done when: it works against the published URL, and you wrote in the pull request how many
  credits one minute of conversation cost.
- Note: ElevenLabs calls the tool from the internet. Test against the Vercel preview, or a tunnel.

**A2. The three tools, with simulated answers.** Needs A1.
- What: `search-prices`, `propose-purchase` and `confirm-purchase`, returning the example
  responses of the contract. Configure the three tools in ElevenLabs, with `policy` bound to the
  dynamic variable.
- Done when: a whole conversation runs: ask, hear the comparison, say yes, hear a result.

**A3. Quotes that work once.** Needs A2, D1.
- What: `propose-purchase` stores a quote that expires in 5 minutes; `confirm-purchase` refuses a
  missing, expired or used quote, and marks it used before sending anything.
- Done when: a test shows each refusal, and a quote cannot be confirmed twice.

**A4. The prompt and its safety rules.** Needs A2.
- What: the system prompt. The agent speaks plainly to an older person; reads prices and how old
  they are; asks for a clear yes before `confirm_purchase`; turns each program error into one
  sentence. It gives no medical advice, suggests no dose, never swaps the medicine, and never
  proposes a product out of stock. If a bioequivalent exists it may say so, and nothing more.
- Done when: the prompt is in the repository, and you tried to make the agent break each rule and
  wrote what happened.

**A5. Paying for real.** Needs A3, P1.
- What: `confirm-purchase` signs `agent_pay` with `AGENT_KEYPAIR` and returns the signature and the
  explorer link. `propose-purchase` reads the policy from the chain to set `within_policy`.
- Done when: a spoken yes produces a transaction on devnet, and a request over the cap comes back
  as `OverPurchaseCap` and the agent explains it.
- Do not: put the agent key anywhere but the Vercel environment.

**A6. Real prices.** Needs A2, D3.
- What: `search-prices` reads `products` and `prices`, matches the spoken request with `aliases`,
  and fills `read_minutes_ago`.
- Done when: the agent quotes a price that is in the table, with its age.

### Lane `web` (open)

**W1. Scaffold and publish (V4).**
- What: one pull request with the root config, `app/` (Vite, React, TypeScript) and `api/` with
  one function that answers. Publish on Vercel from `dev`. Do not create `program/`, `idl/`,
  `supabase/` or `data/`.
- Done when: the app and the function answer at a public URL, and the URL is in `README.md`.

**W2. The older person's page.** Needs W1.
- What: one large button to talk, the proposal in large type, and the result with its explorer
  link. It takes the policy address from the URL and passes it to the conversation.
- Done when: it works on a phone, against the tools of A2.
- Do not: show a wallet, an address or a crypto word on this page.

**W3. Guest mode and the read-only policy view.** Needs W2.
- What: guest mode opens the older person's page with `GUEST_POLICY`. The read-only view shows the
  limits, the amount spent and the last purchases.
- Done when: it shows a fixed policy first, and the real `Policy` account once `idl/` exists.

**W4. The family screen.** Needs W3, P1.
- What: connect Phantom on devnet; create a policy (budget, cap, pharmacies, medicines from the
  catalog, deposit); see it; pause and close (after P3).
- Done when: a policy created here is the one the agent pays from.

### Lane `data` (Sebastián)

**D1. The Supabase project and its tables.**
- What: the shared project and the five tables of the contract, as migrations in `supabase/`, with
  the access rule of the contract.
- Done when: the browser key can read `prices` and cannot read `quotes`.

**D2. Firecrawl reads the three chains (V3).**
- What: read price and stock of one product page in Cruz Verde, Ahumada and Salcobrand with
  Firecrawl. Cruz Verde loads its results late: wait for them.
- Done when: three rows are in `prices`. If a chain cannot be read, say so: we ship with two.

**D3. The catalog.** Needs D1, D2.
- What: about 10 medicines in `products`, each with its product URL per chain in
  `product_sources`, matched by hand: same active ingredient, dose and quantity. Fill `aliases`.
- Done when: every product has at least two chains.

**D4. The refresh job.** Needs D3.
- What: re-read the catalog with Firecrawl on a schedule, and re-read one product on demand with a
  time limit. An empty reading, or a price far from the last one, raises an alert and does not
  overwrite the stored price.
- Done when: `read_at` moves on its own, and a broken page does not erase a price.

**D5. The demo medicines.** Needs D4.
- What: choose, from the data, the two or three medicines the demo and the video use.
- Done when: the choice and its prices are in the pull request.

## 6. Order of work

| When (Chile) | What must be true |
| --- | --- |
| Fri 21:00 | These documents are merged into `dev`. Everyone has T0 done |
| Fri 24:00 | V1 to V4 pass. Anything that fails is reported |
| Sat 10:00 | A thin flow works end to end, for the feedback session: voice, proposal, yes, payment on devnet, shown on the web |
| Sat 14:00 | Rejections, pause, guest mode and the read-only view |
| Sat 16:00 | A minimal submission is saved in the form |
| Sat 22:00 | Feature freeze |
| Sun 04:00 | The form locks |

Full checklist: `docs/submission/checklist.md`.

## 7. If time runs short

Cut in this order: the third pharmacy chain; card W4 (create the policy with the script of P4);
the pause and close buttons. Never cut: voice, price comparison, payment checked by the program,
one visible rejection.
