# Hackathon requirements

What the Dev3pack Global Hackathon asks, in one page. Read this before proposing scope.

Sources, read on 2026-11-27: the member dashboard (tracks, schedule, resources), the public FAQ
(`hack.dev3pack.xyz/faq`) and the ChileDAO method (`github.com/GonzaloCamps/metodo-hackathon-chiledao`).
If the dashboard and this file disagree, the dashboard wins: fix this file.

## Dates (Chile time, UTC-3)

| When | What |
| --- | --- |
| Fri 27 Nov, 12:00 | Kick-off |
| Sat 28 Nov, 10:00 to 12:00 | Project feedback session (online) |
| **Sun 29 Nov, 04:00** | **Submissions close.** The form locks and judging starts |
| Sun 29 Nov, 12:00 | Closing ceremony and winners |
| Tue 1 Dec, 10:00 | Global demo day |

The form can be saved as a draft and edited until the close.

## Mandatory to submit

- The address of our own Solana program, written in Rust, deployed at least to devnet.
- A public GitHub repository. A private repository cannot be reviewed and the project is eliminated.
- A demo video under 3 minutes that shows the product working (a real demo, not slides). A longer
  video is not eligible for prizes.

## Main track: Best App Overall on Solana (2,500 / 1,500 / 1,000 USDC)

- A unique Solana program in Rust (Anchor, Pinocchio, Quasar or plain Rust), deployed at least to devnet.
- Program addresses (devnet or mainnet) written in the README.
- Public repository with a README and setup instructions.
- Demo video under 3 minutes **and a live demo link**.
- Bonus: unique code with consistent and considerable use of Solana libraries and SDKs.

The Chile local track (500 USDC, top 1) is judged with the same criteria.

## How it is judged

- Two stages, two rubrics (product and technical). Stage 1 scores every submission and keeps the top
  100. Stage 2 inspects the code, checks founder-market fit and verifies the live demo.
- Signals named by the organizers: eligibility, product clarity, real-world impact, demo quality,
  deployment, repository quality, depth of Solana and SDK use.
- **Judges are local people and an AI.** The AI reads the README and then checks the technical
  integration in the code, to confirm the project does what it says. Each project gets a report.
- **It must be a real app where the user does something.** Submitting only a landing page is
  eliminatory. The app must be published (Vercel, Netlify or similar).
- The organizers recommend **one focus**. Several tracks are allowed, but each partner has its own
  requirements and they are checked.

## What this means for us

- The README is a deliverable, not an afterthought. It is written for a reader that will open the
  files it names. Keep it current in every pull request that changes behaviour.
- A judge must be able to open the live link and complete the main flow without help, without real
  funds and without special hardware.
- An integration only counts if it runs in the code. Never write "uses X" in the README before it works.
- One main flow of 3 to 5 steps and one main on-chain action. Every extra account or instruction is
  one more thing that can fail.
- Solana must do work that a normal database cannot. Test: if the app is the same after removing
  the chain, the chain is decoration.

## Partner tracks we target

For each track marked in the form we must explain how it is integrated and name the file.

| Track | Prize | Requirement |
| --- | --- | --- |
| Best Agentic App on Solana | 250 USDC | AI and Solana each do real work |
| Firecrawl | 3 months of Growth plan per member | Integrate Firecrawl and/or Firecrawl Alexandria in the product or workflow |
| ElevenLabs | 3 months of Scale tier per member | Use one integration path: speech, transcription, agents, and others |
| Supabase | Credits per member | Use Supabase |

Not targeted: Best DeFi App, Pollar, Byte and Solana Mobile. Solana Mobile requires a native
Android app started from an official template, with a working Mobile Wallet Adapter flow that
judges run from an installable APK; wrapped web apps and PWAs are rejected.

## Rules

- Open source is mandatory.
- AI tools and templates are allowed if the project is ours and we can explain it.
- Forking another team's project and submitting it is disqualifying.
- Earlier code of our own is allowed only if it is Solana-related, and the README must say what
  existed before and what was built during the hackathon.
- Teams of 1 to 4.
- Everything runs on devnet with test SOL. No real funds.

## The submission form

Five steps: Project, Images, Links and video, Team, Review and submit.

- Project name (up to 50 characters), one-liner (up to 120), description (up to 300 words),
  optional category, program address, hub.
- Screenshots, logo and banner.
- Demo video link (public), repository link, live demo link.
- Per partner track: how it is integrated and in which file.

Before submitting, open every link in a private window to confirm it is public.
