-- Card D1. The five tables of docs/contracts.md, section 3.
--
-- Access rule of the contract:
--   * the browser key (roles anon, authenticated) reads products, prices and pharmacies only;
--   * every write, and every read of quotes and product_sources, goes through the server key
--     (role service_role, which bypasses row level security).

create table public.pharmacies (
  id text primary key,
  name text not null,
  wallet text
);

create table public.products (
  id text primary key,
  name text not null,
  active_ingredient text not null,
  dose text not null,
  quantity integer not null check (quantity > 0),
  requires_prescription boolean not null default true,
  is_bioequivalent boolean not null default false,
  aliases text[] not null default '{}'
);

create table public.product_sources (
  product_id text not null references public.products (id) on delete cascade,
  pharmacy text not null references public.pharmacies (id),
  url text not null,
  primary key (product_id, pharmacy)
);

-- Latest reading only: one row per product and pharmacy.
create table public.prices (
  product_id text not null references public.products (id) on delete cascade,
  pharmacy text not null references public.pharmacies (id),
  price integer not null check (price > 0),
  in_stock boolean not null,
  read_at timestamptz not null,
  primary key (product_id, pharmacy)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  policy text not null,
  product_id text not null references public.products (id),
  pharmacy text not null references public.pharmacies (id),
  price integer not null check (price > 0),
  read_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  signature text
);

-- Row level security on every table. A table with no policy is closed to the browser key.
alter table public.pharmacies enable row level security;
alter table public.products enable row level security;
alter table public.product_sources enable row level security;
alter table public.prices enable row level security;
alter table public.quotes enable row level security;

create policy pharmacies_public_read on public.pharmacies
  for select to anon, authenticated using (true);

create policy products_public_read on public.products
  for select to anon, authenticated using (true);

create policy prices_public_read on public.prices
  for select to anon, authenticated using (true);

-- Privileges, stated instead of left to the project defaults.
revoke all on public.pharmacies, public.products, public.product_sources, public.prices, public.quotes
  from anon, authenticated;

grant select on public.pharmacies, public.products, public.prices
  to anon, authenticated;

grant all on public.pharmacies, public.products, public.product_sources, public.prices, public.quotes
  to service_role;

-- Reference data: the three pharmacy chains. Their devnet addresses are filled in later.
insert into public.pharmacies (id, name) values
  ('cruzverde', 'Cruz Verde'),
  ('ahumada', 'Farmacias Ahumada'),
  ('salcobrand', 'Salcobrand');
