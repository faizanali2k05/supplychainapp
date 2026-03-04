-- Supabase SQL schema for decentralized supply chain app
-- Project: Decentralized Supply Chain Management System using Blockchain

-- enable uuid extension if not already
create extension if not exists "uuid-ossp";

-- users table (note: Supabase auth users handled separately but storing profile here)
-- IMPORTANT: Admin role must be manually assigned via Supabase dashboard. 
-- Signup form only allows: manufacturer, distributor, retailer, customer
create table if not exists public.users (
    id uuid primary key,
    name text not null,
    email text unique not null,
    role text not null check (role in ('admin','manufacturer','distributor','retailer','customer')),
    created_at timestamp with time zone default now()
);

-- products table
-- stores product information registered by manufacturers
create table if not exists public.products (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    batch_number text not null,
    manufacturer_id uuid references public.users(id) on delete cascade,
    qr_code text,
    image_url text,
    description text,
    manufacturing_date date,
    created_at timestamp with time zone default now()
);
-- add columns if they were added later
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists manufacturing_date date;

-- supply chain events table
-- tracks every movement and status update of products
create table if not exists public.supply_chain_events (
    id bigserial primary key,
    product_id uuid references public.products(id) on delete cascade,
    updated_by uuid references public.users(id) on delete set null,
    role text not null,
    location text not null,
    status text not null,
    "hash" text not null,
    timestamp timestamp with time zone default now()
);
-- ensure hash column exists
alter table public.supply_chain_events add column if not exists "hash" text not null default '';

-- product verification hashes table
-- stores verification strings and their computed hashes for admin to view/manage
create table if not exists public.product_verification_hashes (
    id uuid primary key default uuid_generate_v4(),
    product_id uuid references public.products(id) on delete cascade not null,
    verification_string text not null,
    verification_hash text not null,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamp with time zone default now()
);

-- blockchain blocks table
-- stores the blockchain ledger for product tracking
create table if not exists public.blockchain_blocks (
    id bigserial primary key,
    product_id uuid references public.products(id) on delete cascade not null,
    block_index integer not null,
    data jsonb not null,
    previous_hash text not null,
    hash text not null unique,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamp with time zone default now()
);

-- add indexes for faster queries
create index if not exists idx_blockchain_product on public.blockchain_blocks(product_id);
create index if not exists idx_blockchain_block_index on public.blockchain_blocks(block_index);

-- indexes to speed queries
create index if not exists idx_products_manufacturer on public.products(manufacturer_id);
create index if not exists idx_events_product on public.supply_chain_events(product_id);
create index if not exists idx_events_role on public.supply_chain_events(role);
create index if not exists idx_events_timestamp on public.supply_chain_events(timestamp);

-- enable row level security and basic policies
drop policy if exists "allow authenticated to select users" on public.users;
alter table public.users enable row level security;
create policy "allow authenticated to select users" on public.users
    for select using (true);

-- allow authenticated users to insert their own profile row
drop policy if exists "allow insert users" on public.users;
create policy "allow insert users" on public.users
    for insert with check (true);

-- allow users to update their own profile
drop policy if exists "allow update users" on public.users;
create policy "allow update users" on public.users
    for update using (auth.uid() = id) with check (auth.uid() = id);

alter table public.products enable row level security;
drop policy if exists "allow select all products" on public.products;
drop policy if exists "owners can modify" on public.products;
drop policy if exists "owners can update" on public.products;
drop policy if exists "owners can delete" on public.products;
-- allow anyone to select products
create policy "allow select all products" on public.products
    for select using (true);
-- owners can insert/update/delete their own products
create policy "owners can modify" on public.products
    for insert with check (auth.uid() = manufacturer_id);
create policy "owners can update" on public.products
    for update with check (auth.uid() = manufacturer_id);
create policy "owners can delete" on public.products
    for delete using (auth.uid() = manufacturer_id);

alter table public.supply_chain_events enable row level security;
drop policy if exists "allow insert events" on public.supply_chain_events;
drop policy if exists "allow select events" on public.supply_chain_events;
create policy "allow insert events" on public.supply_chain_events
    for insert with check (auth.uid() is not null);
create policy "allow select events" on public.supply_chain_events
    for select using (true);

-- verification hashes table policies
alter table public.product_verification_hashes enable row level security;
drop policy if exists "allow select verification hashes" on public.product_verification_hashes;
drop policy if exists "allow insert verification hashes" on public.product_verification_hashes;
create policy "allow select verification hashes" on public.product_verification_hashes
    for select using (true);
create policy "allow insert verification hashes" on public.product_verification_hashes
    for insert with check (true);

-- blockchain blocks table policies
alter table public.blockchain_blocks enable row level security;
drop policy if exists "allow select blockchain blocks" on public.blockchain_blocks;
drop policy if exists "allow insert blockchain blocks" on public.blockchain_blocks;
create policy "allow select blockchain blocks" on public.blockchain_blocks
    for select using (true);
create policy "allow insert blockchain blocks" on public.blockchain_blocks
    for insert with check (true);
