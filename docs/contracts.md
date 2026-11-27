# Contracts between lanes

What each lane can assume about the others. With this file, `agent` and `web` start with simulated
data and do not wait for `program`.

A contract changes first, in its own small pull request, and then the code follows. If the code and
this file disagree, this file is right until it is changed on purpose.

Design: `docs/superpowers/specs/2026-11-27-remedio-seguro-design.md`.

## Repository layout

Each lane creates and edits only its own directories.

| Directory | Lane | Content |
| --- | --- | --- |
| `program/` | `program` | Anchor workspace |
| `idl/` | `program` | `remedio_seguro.json`, committed after every deploy. `agent` and `web` import it |
| `api/` | `agent` | Vercel functions: the agent's tools |
| `app/` | `web` | Vite, React and TypeScript app |
| `supabase/`, `data/` | `data` | Migrations, catalog seed, price refresh |
| Root config (`package.json`, `vercel.json`) | `web` | Created once in the scaffold task |

## 1. Program `remedio_seguro`

Rust with Anchor, deployed to devnet. The program id is written in `README.md` and `.env.example`
after the first deploy. The CLI and the TypeScript client use the same Anchor version.

### Units

- Amounts are whole Chilean pesos, as `u64`.
- Payment is in devnet SOL: `LAMPORTS_PER_PESO = 1_000`. A purchase of 2,599 pesos moves
  2,599,000 lamports. (Proposed; Ruben confirms. See `docs/decisions.md`.)

### Limits

`MAX_PHARMACIES = 3`, `MAX_PRODUCTS = 10`, `HISTORY_LEN = 10`.

### Account `Policy`

PDA with seeds `["policy", family, policy_seed as u64 little-endian]`. It is also the vault: it
holds the lamports.

| Field | Type | Meaning |
| --- | --- | --- |
| `family` | `Pubkey` | Who created it; the only one who can pause or close |
| `agent` | `Pubkey` | The only key that can pay |
| `policy_seed` | `u64` | Lets one family have several policies |
| `per_purchase_cap` | `u64` | Maximum pesos in one purchase |
| `period_budget` | `u64` | Maximum pesos in one period |
| `period_seconds` | `i64` | Length of a period |
| `period_start` | `i64` | Unix time when the current period started |
| `spent_in_period` | `u64` | Pesos spent in the current period |
| `paused` | `bool` | When true, every payment fails |
| `pharmacies` | `[Pubkey; 3]` | Allowed destinations. Unused slots hold the default key |
| `products` | `[[u8; 32]; 10]` | Allowed product hashes. Unused slots hold zeros |
| `history` | `[Purchase; 10]` | The last 10 purchases, as a ring |
| `purchase_count` | `u32` | Total purchases; `purchase_count % 10` is the next slot |
| `bump` | `u8` | PDA bump |

`Purchase`: `amount: u64`, `pharmacy_index: u8`, `product_index: u8`, `timestamp: i64`,
`quote_hash: [u8; 32]`.

### Product hash

`sha256` of the product id as UTF-8, for example `sha256("losartan-50mg-30")`. Product ids are the
`id` column of the `products` table. This is obfuscation, not privacy.

### Instructions

| Instruction | Signer | Arguments | Effect |
| --- | --- | --- | --- |
| `create_policy` | `family` | `policy_seed`, `agent`, `per_purchase_cap`, `period_budget`, `period_seconds`, `pharmacies: Vec<Pubkey>`, `products: Vec<[u8; 32]>`, `deposit_pesos` | Creates the policy, sets `period_start` to now, moves the deposit from `family` to the policy |
| `agent_pay` | `agent` | `amount`, `product: [u8; 32]`, `quote_hash: [u8; 32]` | Checks every rule, moves the lamports to the `pharmacy` account, records the purchase |
| `set_paused` | `family` | `paused: bool` | Pauses or resumes |
| `close_policy` | `family` | none | Closes the account and returns all lamports to `family` |

Accounts of `agent_pay`: `agent` (signer, pays the fee), `policy` (writable), `pharmacy` (writable).

To top up a policy, send SOL to its address with a normal transfer. No instruction is needed.

### Rules of `agent_pay`, in this order

| Check | Error |
| --- | --- |
| The policy is not paused | `Paused` |
| The signer is `policy.agent` | `UnauthorizedAgent` |
| `pharmacy` is in `policy.pharmacies` | `PharmacyNotAllowed` |
| `product` is in `policy.products` | `ProductNotAllowed` |
| `amount` is greater than zero | `ZeroAmount` |
| `amount <= per_purchase_cap` | `OverPurchaseCap` |
| If `now >= period_start + period_seconds`: `period_start = now`, `spent_in_period = 0`. Then `spent_in_period + amount <= period_budget` | `OverPeriodBudget` |
| After paying, the policy still holds its rent-exempt minimum | `InsufficientVault` |

`create_policy` fails with `TooManyPharmacies`, `TooManyProducts` or `InvalidPeriod`
(`period_seconds <= 0`).

Error names are part of the contract: the backend returns them and the voice agent turns each one
into a sentence.

## 2. Agent tools (`api/`)

Vercel functions called by the ElevenLabs agent as webhook tools.

### Rules for every call

- `POST`, JSON body, JSON response.
- Header `x-agent-secret` must equal `AGENT_TOOL_SECRET`. Otherwise `401`.
- A business refusal is a `200` with `"ok": false` and a `reason`, so the agent can read it. `4xx`
  is only for a bad secret or a malformed body.
- `policy` is the policy address in base58. In ElevenLabs it is bound to the conversation's dynamic
  variable `policy`. The model never writes it.

### `search_prices`

`POST /api/tools/search-prices`

```json
{ "policy": "<base58>", "query": "losartán de 50" }
```

```json
{
  "ok": true,
  "product": {
    "id": "losartan-50mg-30",
    "name": "Losartán 50 mg, 30 comprimidos",
    "requires_prescription": true,
    "is_bioequivalent": true
  },
  "allowed_by_policy": true,
  "bioequivalent_available": false,
  "offers": [
    { "pharmacy": "salcobrand", "price": 2599, "in_stock": true, "read_minutes_ago": 10, "url": "https://..." },
    { "pharmacy": "cruzverde", "price": 2690, "in_stock": true, "read_minutes_ago": 10, "url": "https://..." },
    { "pharmacy": "ahumada", "price": 1799, "in_stock": false, "read_minutes_ago": 12, "url": "https://..." }
  ]
}
```

Not in the catalog: `{ "ok": false, "reason": "PRODUCT_NOT_IN_CATALOG" }`.

`offers` is sorted by price. `bioequivalent_available` is true when the product is a brand and the
catalog has a bioequivalent of the same active ingredient, dose and quantity.

### `propose_purchase`

`POST /api/tools/propose-purchase`

```json
{ "policy": "<base58>", "product_id": "losartan-50mg-30", "pharmacy": "salcobrand" }
```

```json
{
  "ok": true,
  "quote_id": "<uuid>",
  "product_id": "losartan-50mg-30",
  "pharmacy": "salcobrand",
  "price": 2599,
  "expires_in_seconds": 300,
  "within_policy": true,
  "policy_reason": null
}
```

The backend reads the policy from the chain and sets `within_policy`. When false, `policy_reason`
is one of the program's error names. Refusals: `PRODUCT_NOT_IN_CATALOG`, `OUT_OF_STOCK`,
`PRICE_UNAVAILABLE`.

### `confirm_purchase`

`POST /api/tools/confirm-purchase`

```json
{ "quote_id": "<uuid>" }
```

```json
{ "ok": true, "signature": "<tx signature>", "explorer_url": "https://explorer.solana.com/tx/<signature>?cluster=devnet", "price": 2599, "pharmacy": "salcobrand" }
```

Refusals: `QUOTE_NOT_FOUND`, `QUOTE_EXPIRED`, `QUOTE_ALREADY_USED`, or a program error name such as
`OverPurchaseCap`.

The backend signs `agent_pay` with the agent key. A quote is marked used before the transaction is
sent, so it can never pay twice.

### Quote hash

`sha256` of `"<quote_id>|<product_id>|<pharmacy>|<price>|<read_at in ISO 8601 UTC>"`.

### Pharmacy ids

`cruzverde`, `ahumada`, `salcobrand`. Each has one devnet address, in the `pharmacies` table.

## 3. Database (Supabase)

| Table | Columns |
| --- | --- |
| `products` | `id text` (primary key, for example `losartan-50mg-30`), `name text`, `active_ingredient text`, `dose text`, `quantity int`, `requires_prescription bool`, `is_bioequivalent bool`, `aliases text[]` (spoken forms, for matching) |
| `product_sources` | `product_id`, `pharmacy`, `url text`. Primary key: both |
| `prices` | `product_id`, `pharmacy`, `price int`, `in_stock bool`, `read_at timestamptz`. Primary key: both. Latest reading only |
| `quotes` | `id uuid`, `policy text`, `product_id`, `pharmacy`, `price int`, `read_at`, `created_at`, `expires_at`, `used_at` (null until used), `signature text` (null until paid) |
| `pharmacies` | `id text`, `name text`, `wallet text` |

- **Price rule:** the price any person pays online, without a club or an agreement.
- **Access:** the browser key reads `products`, `prices` and `pharmacies` only. Every write, and
  every read of `quotes`, goes through the server key.
- A reading that returns nothing, or a price far from the last one, raises an alert and does not
  overwrite the stored price.

## 4. Web and voice

- The older person's page receives the policy address in its URL and starts the ElevenLabs
  conversation with the dynamic variable `policy` set to it.
- Guest mode uses the address in `GUEST_POLICY`.
- The family screen and the read-only view read the `Policy` account from the chain with the IDL.
  Explorer links for purchases come from the `signature` that `confirm_purchase` returns.
- All text is Spanish (Chile), with no crypto words on the older person's page.

## 5. Environment variables

Names only. Values travel by the team chat, never by git.

| Variable | Used by | Secret |
| --- | --- | --- |
| `SOLANA_RPC_URL`, `PROGRAM_ID`, `GUEST_POLICY` | `api`, `app` | No |
| `AGENT_KEYPAIR` | `api` | **Yes.** The key that signs payments |
| `AGENT_TOOL_SECRET` | `api`, ElevenLabs tool config | **Yes** |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `api`, `app` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `api`, `data` | **Yes** |
| `FIRECRAWL_API_KEY` | `data`, `api` | **Yes** |
| `ELEVENLABS_API_KEY` | `api` | **Yes** |
| `ELEVENLABS_AGENT_ID` | `app` | No |

Variables the browser needs carry the `VITE_` prefix. A secret never gets that prefix.

## 6. Working before the other lane is ready

- `agent` returns the example responses above until `prices` and the program exist.
- `web` calls those same endpoints, and shows a fixed `Policy` until the IDL is committed.
- `program` needs nothing from the others.
- `data` needs nothing from the others.
