-- P0-C: Supabase ortamının migration'ların dayandığı parçalarını boş bir Postgres'te taklit eder (yalnız test).
-- Roller, şemalar ve Supabase'in public şemasında anon/authenticated'a verdiği varsayılan yetkiler canlıdakiyle aynı
-- kurulur; böylece yetki kaldıran migration'ların gerçekten işe yaradığı sınanır.
do $$ begin  -- roller kümede ortak; yerelde ikinci koşuda zaten vardır
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
do $$ begin execute format('alter database %I set search_path = "$user", public, extensions', current_database()); end $$;
