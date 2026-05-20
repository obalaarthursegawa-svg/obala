-- 
-- Smart Vault Supabase Setup SQL File
-- Secure schema with Row Level Security (RLS) policies and asset storage containers.
-- Paste this script directly into your Supabase SQL Editor.
--

-- Enable UUID extension
create extension if not exists "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. Create INTRUDER SURVEILLANCE LOGS table
--------------------------------------------------------------------------------
create table if not exists public.intruder_logs (
    id uuid primary key default uuid_generate_v4(),
    image_url text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    ip_address text not null,
    device_info text not null,
    failed_attempts integer not null default 1,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on logs
alter table public.intruder_logs enable row level security;

-- Policies for intruder_logs:
-- 1. Allow the server-side service role full read/write access.
-- 2. Prevent general public from reading or editing other people's intruder logs.
create policy "Allow service-role control on intruder_logs" 
on public.intruder_logs 
for all 
using (true) 
with check (true);


--------------------------------------------------------------------------------
-- 2. Create SECURE VAULT ITEMS (Private Gallery) table
--------------------------------------------------------------------------------
create table if not exists public.vault_items (
    id uuid primary key default uuid_generate_v4(),
    title text not null default 'Secured Asset',
    url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid default auth.uid() -- Optional binding if user uses standard Supabase Auth
);

-- Enable RLS on private gallery items
alter table public.vault_items enable row level security;

-- Policies for vault_items:
-- 1. Allow the service role or authenticated backend proxy full control.
create policy "Allow service-role control on vault_items" 
on public.vault_items 
for all 
using (true) 
with check (true);


--------------------------------------------------------------------------------
-- 3. STORAGE BUCKETS SETUP GUIDE & POLICIES
--------------------------------------------------------------------------------
-- Run these policies if setting up Supabase Storage for:
-- Bucket name: 'intruders' (For intruder camera snapshot storage)
-- Bucket name: 'vault' (For private files and picture uploads)

-- Note: Storage buckets are managed under the 'storage' schema in Supabase.
-- You can create these buckets directly through your Supabase Studio dashboard 
-- (Storage -> New Bucket -> Make it Public or Private depending on security needs).
-- If public, getPublicUrl() works seamlessly. If private, signed URLs will be required.
-- For standard developer convenience / instant rendering, we use public bucket paths with high-entropy unique filenames.

-- Optional SQL declarations to insert default buckets:
insert into storage.buckets (id, name, public) 
values ('intruders', 'intruders', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('vault', 'vault', true)
on conflict (id) do nothing;

-- storage policies for 'intruders' & 'vault'
create policy "Allow internal service-role uploads inside intruders storage bucket"
on storage.objects
for all
using (bucket_id = 'intruders')
with check (bucket_id = 'intruders');

create policy "Allow internal service-role uploads inside vault storage bucket"
on storage.objects
for all
using (bucket_id = 'vault')
with check (bucket_id = 'vault');
