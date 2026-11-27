# Decision record

One entry per decision, newest last. Never edit an old entry: if a decision changes, add a new one
that names the old one. An idea that is discussed and not adopted is recorded as **Rejected** or
**Postponed**, with the reason.

Format: date (Chile), title, state, who agreed, what and why.

---

## 2026-11-27. Product idea: a tag that talks

**State:** Agreed. **Who:** Sebastián.

A producer or seller registers a physical object on Solana and attaches a tag to it. The person who
receives the object reads the tag and asks a voice agent about it: whether it is authentic, who
issued it, whether there are alerts or recalls. The agent reads the chain and the live web, answers
out loud, and records on Solana the evidence of what it found.

Why this one: it is the only idea considered where the on-chain program, the web data, the voice
and the phone each do necessary work. The others considered were a fake-discount detector (weak use
of a phone), a voice shopper with on-chain spending limits (crowded category, many integrations)
and visit stamps with a voice guide (lower impact).

**Open:** the kind of object and the concrete user. They must come from a world where the team has
experience or contacts, because judges check founder-market fit.

## 2026-11-27. Tracks we target

**State:** Agreed. **Who:** Sebastián.

Main track, Best Agentic App, Firecrawl, ElevenLabs, Supabase and the Chile local track. Solana
Mobile is a stretch goal: one team member has an NFC reader/writer for a live test.

Risk noted: the organizers recommend one focus, and each partner checks its own requirements.
Firecrawl and ElevenLabs stay because they are inside the single main flow. If time runs short,
tracks are dropped in this order: Solana Mobile, Supabase, Agentic. The main track is never traded
for a partner track.

## 2026-11-27. Program in Rust; the agent's model through a hosted API

**State:** Agreed. **Who:** Sebastián.

The on-chain program is written in Rust. The agent uses a hosted model through an API; the team has
ElevenLabs credits (150k) and other credits it can claim.

**Open:** whether the model runs inside the ElevenLabs agent platform or through a separate API. It
depends on how fast voice sessions spend the credits, which is not measured yet.

## 2026-11-27. Web first, Android later

**State:** Proposed by the agent, not objected. **Who:** Sebastián.

The first version is a web app in React, published from `main`, because the main track asks for a
live demo link. The client logic lives in a shared package so an Android port can reuse it. On the
web the tag is a QR code or a typed code; NFC replaces only the reading step on Android.

Note: Solana Mobile does not accept wrapped web apps. A port means a native app from the official
template.

## 2026-11-27. How we work

**State:** Agreed. **Who:** Sebastián.

- `main` is always demoable; `dev` is integration; one branch and one pull request per task.
- The team is Sebastián, Ruben, Victor and Luciano. Sebastián orchestrates: writes the task cards,
  reviews and merges. Each developer takes a card with their own agent. Lanes are not assigned yet.
- The repository is in English; the user interface is in Spanish (Chile).
- Rules in `AGENTS.md`, mechanics in `CONTRIBUTING.md`.

Taken from two earlier projects of the team: task cards per lane, a contracts document and review
before merge (NASA Space Apps 2026); a shared `AGENTS.md`, an integration branch, a decision record
and CI checks for commit format and secrets (Kuntur AI).

## 2026-11-27. Practices added from the ChileDAO method and the organizers' sessions

**State:** Agreed. **Who:** Sebastián.

- The README is written for the judging AI: complete, with a diagram, the program addresses, and
  for each partner track the file where the integration lives.
- The live demo is published from the first day, and a judge must finish the main flow without a
  wallet setup of their own if the design allows it.
- One main flow of 3 to 5 steps and one main on-chain action. The first program has the minimum
  number of accounts and instructions; more are added only when the flow works end to end.
- A minimal submission (program address, public repository, video) is saved in the form early and
  improved until the close.
- The idea is scored with the seven-criterion rubric of the method before the design is frozen,
  and checked against earlier submissions for similar projects.
- Devnet hygiene: a separate test wallet per developer, test SOL requested early, the program
  keypair never committed, and the admin instruction called by us before the address is published.

**Not adopted:** NoahAI as the builder. The team builds with its own agents. The method's own point
stands: plan first, then build from a closed specification.

## 2026-11-27. Product idea changed to Remedio Seguro

**State:** Agreed. **Who:** Sebastián, on a proposal by Ruben. Replaces "Product idea: a tag that
talks".

A voice agent buys medicines for an older person, inside spending limits that the family sets on
Solana. Design: `docs/superpowers/specs/2026-11-27-remedio-seguro-design.md`.

Why the tag was dropped: a gap analysis by Ruben found that its on-chain record could be called
decoration, that voice was justified for only one kind of user, and that Firecrawl had no reliable
sources to read.

This idea is a variant of the "voice shopper with on-chain spending limits" that an earlier entry
rejected as a crowded category. It is taken up again because the user changes the case: for an
older person voice is the interface, the family is a second party that sets the rules, and Chilean
pharmacy prices are public and can be read live. The category is still crowded: the difference goes
in the first line of the pitch.

It is not medicine traceability. What is recorded on-chain is purchases.

## 2026-11-27. Tracks, revised

**State:** Agreed. **Who:** Sebastián. Replaces "Tracks we target".

Main track, Chile local track, Best Agentic App, Firecrawl, ElevenLabs and Supabase. Solana Mobile
and NFC are dropped: there is no physical tag any more. This also ends "Web first, Android later":
there is no Android port.

## 2026-11-27. Lanes and owners

**State:** Agreed. **Who:** Sebastián.

| Lane | Owner |
| --- | --- |
| `program` | Ruben |
| `agent` | Victor |
| `web` | Open: whoever takes it first |
| `data`, plus orchestration, review and merge | Sebastián |

Sebastián also codes. He takes `data` because it is off the critical path of the first flow and
survives interruptions for review. Claude, in Sebastián's session, writes the repository documents
and reviews each pull request before it is merged.

Risk: `web` has no owner and the first task of that lane (scaffold and publish) unblocks `agent`.
If nobody has taken it by 19:30 on Friday, Victor does that first task.

## 2026-11-27. Payments settle in devnet SOL at a fixed rate

**State:** Proposed by the agent. Ruben confirms or changes it before coding.

The first flow pays in devnet SOL at 1 peso = 1,000 lamports. No mint, no token accounts, no faucet
for families. Our own SPL token is the first improvement if time is left.

## 2026-11-27. Scope decisions that close known gaps

**State:** Agreed. **Who:** Sebastián.

- Four instructions: `create_policy`, `agent_pay`, `set_paused`, `close_policy`. No `update_policy`.
- Allowed medicines are stored on-chain as hashes, and the demo uses fictional people. This is
  obfuscation, not privacy, and the README says so.
- The policy account keeps its last 10 purchases, so the history is read from the chain in one call.
- Each payment stores a hash of its quote (price, source, read time). The chain cannot check that
  a price is real; this lets the family audit it.
- The budget period is configurable, so the guest policy renews itself.
- Every tool call from the voice agent carries a shared secret. A quote works once and expires in
  5 minutes.
- Prices are read from a cache that states its age. Firecrawl refreshes a fixed catalog of about 10
  medicines; there is no free search.
- The demo and the video include a rejection by the program.
- The agent gives no medical advice, suggests no dose, swaps no medicine and proposes nothing out
  of stock.

## 2026-11-27. Payment unit confirmed: devnet SOL, 1 peso = 1,000 lamports

**State:** Agreed. **Who:** Ruben. Confirms "Payments settle in devnet SOL at a fixed rate".

The program pays in devnet SOL with `LAMPORTS_PER_PESO = 1_000`. No SPL token in the first flow.
