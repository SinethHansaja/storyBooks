-- =====================================================================
-- Once Upon a Page — Supabase schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- profiles (one per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- books ----------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  author text not null,
  illustrator text,
  description text default '',
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2),
  age_min int not null default 0,
  age_max int not null default 12,
  category text not null,
  tags text[] not null default '{}',
  format text not null default 'Hardcover',
  pages int,
  stock int not null default 0,
  cover_url text,
  emoji text default '📖',
  palette int default 0,
  featured boolean not null default false,
  published boolean not null default true,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- reviews ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now()
);

create or replace function public.update_book_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.books b set
    rating_count = (select count(*) from public.reviews r where r.book_id = new.book_id),
    rating_avg   = (select coalesce(avg(rating),0) from public.reviews r where r.book_id = new.book_id)
  where b.id = new.book_id;
  return new;
end $$;
drop trigger if exists reviews_rating on public.reviews;
create trigger reviews_rating after insert on public.reviews for each row execute function public.update_book_rating();

-- ---------- coupons ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percent','fixed')),
  value numeric(12,2) not null,
  min_subtotal numeric(12,2) not null default 0,
  active boolean not null default true,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- settings (single row) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);
insert into public.settings (id, data) values (1, '{
  "store_name": "Once Upon a Page",
  "tagline": "Magical storybooks for little dreamers",
  "shipping_flat": 450,
  "free_shipping_over": 7500,
  "contact_email": "hello@example.com",
  "contact_phone": "+94 77 000 0000",
  "announcement": "✨ Free delivery island-wide on orders over LKR 7,500 ✨",
  "cod_enabled": true,
  "bank_transfer_enabled": true,
  "bank_details": "Bank: \nAccount name: \nAccount no: \nBranch: ",
  "online_payment_enabled": false
}') on conflict (id) do nothing;

-- ---------- orders ----------
create sequence if not exists public.order_number_seq start 1001;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null default nextval('public.order_number_seq') unique,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text not null,
  phone text,
  address jsonb,
  items jsonb not null,
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  coupon_code text,
  payment_method text not null default 'cod',
  payment_status text not null default 'pending',
  payment_ref text,
  status text not null default 'pending',
  notes text default '',
  created_at timestamptz not null default now()
);

-- ---------- analytics events ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  session_id text not null,
  user_id uuid,
  path text,
  book_id uuid,
  meta jsonb not null default '{}',
  device text,
  referrer text,
  created_at timestamptz not null default now()
);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_session_idx on public.events (session_id);
create index if not exists orders_created_idx on public.orders (created_at);

-- =====================================================================
-- Secure server-side functions
-- =====================================================================

-- Coupon lookup without exposing the coupons table to the public
create or replace function public.validate_coupon(coupon_code text) returns public.coupons
language sql stable security definer set search_path = public as $$
  select * from public.coupons where upper(code) = upper(coupon_code) and active limit 1;
$$;

-- Place an order: re-prices every line from the books table, applies the
-- coupon + delivery rules from settings, checks & decrements stock.
create or replace function public.place_order(payload jsonb) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; b public.books; s jsonb; c public.coupons;
  items jsonb := '[]'; sub numeric := 0; disc numeric := 0; ship numeric := 0;
  needs_ship boolean := false; q int; o public.orders;
begin
  select data into s from public.settings where id = 1;
  if jsonb_array_length(payload->'items') = 0 then raise exception 'Your basket is empty'; end if;

  for it in select * from jsonb_array_elements(payload->'items') loop
    q := greatest(1, (it->>'qty')::int);
    select * into b from public.books where id = (it->>'book_id')::uuid and published for update;
    if not found then raise exception 'A book in your basket is no longer available'; end if;
    if b.format <> 'eBook' then
      needs_ship := true;
      if b.stock < q then raise exception 'Sorry, only % left of "%"', b.stock, b.title; end if;
      update public.books set stock = stock - q where id = b.id;
    else q := 1; end if;
    items := items || jsonb_build_object('book_id', b.id, 'title', b.title, 'price', b.price, 'qty', q);
    sub := sub + b.price * q;
  end loop;

  if coalesce(payload->>'coupon_code','') <> '' then
    select * into c from public.coupons where upper(code) = upper(payload->>'coupon_code') and active;
    if found and sub >= c.min_subtotal then
      disc := case when c.type = 'percent' then round(sub * c.value / 100, 2) else least(sub, c.value) end;
      update public.coupons set uses = uses + 1 where id = c.id;
    else c := null; end if;
  end if;

  if needs_ship then
    ship := case when coalesce((s->>'free_shipping_over')::numeric,0) > 0
                  and (sub - disc) >= (s->>'free_shipping_over')::numeric then 0
                 else coalesce((s->>'shipping_flat')::numeric, 0) end;
  end if;

  insert into public.orders (user_id, email, name, phone, address, items, subtotal, discount, shipping, total,
                             coupon_code, payment_method, payment_status, status, notes)
  values (auth.uid(), lower(payload->>'email'), payload->>'name', payload->>'phone',
          case when needs_ship then payload->'address' else null end,
          items, sub, disc, ship, greatest(0, sub - disc + ship),
          c.code, coalesce(payload->>'payment_method','cod'), 'pending', 'pending', coalesce(payload->>'notes',''))
  returning * into o;
  return o;
end $$;

-- Order lookup for the confirmation page (UUIDs are unguessable)
create or replace function public.get_order(order_id uuid) returns public.orders
language sql stable security definer set search_path = public as $$
  select * from public.orders where id = order_id;
$$;

grant execute on function public.validate_coupon(text) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.books    enable row level security;
alter table public.reviews  enable row level security;
alter table public.coupons  enable row level security;
alter table public.settings enable row level security;
alter table public.orders   enable row level security;
alter table public.events   enable row level security;

-- profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for update using (public.is_admin());

-- books: everyone reads published, admins do everything
drop policy if exists "read books" on public.books;
create policy "read books" on public.books for select using (published or public.is_admin());
drop policy if exists "admin write books" on public.books;
create policy "admin write books" on public.books for all using (public.is_admin()) with check (public.is_admin());

-- reviews: public read, signed-in users write their own
drop policy if exists "read reviews" on public.reviews;
create policy "read reviews" on public.reviews for select using (true);
drop policy if exists "write own review" on public.reviews;
create policy "write own review" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "admin delete reviews" on public.reviews;
create policy "admin delete reviews" on public.reviews for delete using (public.is_admin());

-- coupons: admin only (shoppers use validate_coupon())
drop policy if exists "admin coupons" on public.coupons;
create policy "admin coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- settings: public read, admin write
drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select using (true);
drop policy if exists "admin settings" on public.settings;
create policy "admin settings" on public.settings for update using (public.is_admin());

-- orders: customers see their own; admins see & update all; inserts via place_order()
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update using (public.is_admin());

-- events: anyone may insert (anonymous analytics), only admins read
drop policy if exists "insert events" on public.events;
create policy "insert events" on public.events for insert with check (true);
drop policy if exists "admin read events" on public.events;
create policy "admin read events" on public.events for select using (public.is_admin());

-- =====================================================================
-- Realtime (live activity feed) + Storage (book covers)
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public) values ('book-covers', 'book-covers', true)
  on conflict (id) do nothing;

drop policy if exists "public read covers" on storage.objects;
create policy "public read covers" on storage.objects for select using (bucket_id = 'book-covers');
drop policy if exists "admin upload covers" on storage.objects;
create policy "admin upload covers" on storage.objects for insert with check (bucket_id = 'book-covers' and public.is_admin());
drop policy if exists "admin delete covers" on storage.objects;
create policy "admin delete covers" on storage.objects for delete using (bucket_id = 'book-covers' and public.is_admin());

-- =====================================================================
-- After signing up on your site, make yourself admin:
--   update public.profiles set role = 'admin' where email = 'you@yourmail.com';
-- =====================================================================
