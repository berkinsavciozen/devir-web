-- W5 (0.27.0, N23/N24): gerçek alt görev. Bir adım aynı akıştaki başka bir adımın alt görevi olabilir (tek düzey).
-- ust_adim: üst adımın numarası (adim.no, aynı akış). null: ana görev. Yalnız ekler; var olan veri değişmez.
-- Sıra: bu migration 0.27.0 kodundan ÖNCE uygulanır (eski kod sütunu görmez, etkilenmez).

alter table public.adim add column if not exists ust_adim integer;
alter table public.adim drop constraint if exists adim_ust_adim_kendi;
alter table public.adim add constraint adim_ust_adim_kendi check (ust_adim is null or ust_adim <> no);
create index if not exists adim_akis_ust_adim on public.adim (akis_id, ust_adim) where ust_adim is not null;
comment on column public.adim.ust_adim is 'Alt görevse üst adımın numarası (aynı akış). Tek düzey: alt görevin alt görevi olmaz (sunucu denetler).';

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261025140000_w5_alt_gorev'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;
grant execute on function public.devir_sema() to service_role;

-- Geri alma:
-- drop index if exists public.adim_akis_ust_adim;
-- alter table public.adim drop constraint if exists adim_ust_adim_kendi, drop column if exists ust_adim;
-- create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261023180000_s2_karar_cikti_alanlari'::text $$;
