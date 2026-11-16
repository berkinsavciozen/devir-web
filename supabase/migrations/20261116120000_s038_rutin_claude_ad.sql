-- 0.38.0 (16 Kas, agent/rutin tek sayfa K4): rutinin Claude'daki adı ayrı sütunda (yalnız gösterim; eşleşme Devir'deki ad ile).
-- Yalnız ekleme; silme ya da veri taşıması yok. Bu migration 0.38.0 kodundan ÖNCE uygulanır. Geri alma en altta.

alter table public.agent_tetik add column if not exists claude_ad text check (claude_ad is null or length(claude_ad) <= 80);
comment on column public.agent_tetik.claude_ad is 'Rutinin claude.ai Routines listesindeki adı (gösterim); null = bilinmiyor (0.38.0)';

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261116120000_s038_rutin_claude_ad'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;

-- Geri alma (gerekirse, 0.37.0 koduna dönerken):
-- alter table public.agent_tetik drop column claude_ad;
-- create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261106160000_s034_agent_rutin'::text $$;
