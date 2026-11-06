-- 0.34.0 (6 Kas, uçtan uca test düzeltmeleri K1/K2/K5): agent ile rutin ayrı kayıt, rutin hangi agent'lara çalışır açıkça yazılır.
-- Yalnız ekler ve bir veri taşıması; silme yok. Bu migration 0.34.0 kodundan ÖNCE uygulanır. Geri alma en altta.

-- K1: rutinin çalıştığı agent'lar. null = kişinin tüm agent'ları.
alter table public.agent_tetik add column if not exists agentlar text[];
comment on column public.agent_tetik.agentlar is 'Rutinin iş aldığı agent adları; null = sahibinin tüm agent''ları (0.34.0)';

-- K1/K4/K5: agent kaydı kisi tablosunda (tip agent). destek = desteklediği kişi, renk = kişi/agent rengi, gizli_at = kaldırıldı.
alter table public.kisi add column if not exists destek text;
alter table public.kisi add column if not exists renk text check (renk is null or renk ~ '^#[0-9A-Fa-f]{6}$');
alter table public.kisi add column if not exists gizli_at timestamptz;
comment on column public.kisi.destek is 'Agent kaydında desteklediği kişinin adı';
comment on column public.kisi.renk is 'Haritada kişi/agent rengi (#RRGGBB); null = otomatik';
comment on column public.kisi.gizli_at is 'Agent kaldırıldı (listeden gizli; açık işi varsa görünür kalır)';

-- K2: eski rutinler. Rutin adı kişinin bir agent adımının sahibiyle aynıysa yalnız o agent'a, değilse tüm agent'lara (null) çalışır.
update public.agent_tetik t set agentlar = array[t.ad]
where t.agentlar is null and t.ad is not null and exists (
  select 1 from public.adim s join public.akis a on a.id = s.akis_id
  where a.sahip_id = t.ws_id and s.sahip_tip = 'agent'
    and public.devir_norm(s.sahip) = public.devir_norm(t.ad)
    and public.devir_norm(coalesce(s.agent_sahibi, '')) = t.kisi_norm
);

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261106160000_s034_agent_rutin'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;

-- Geri alma (gerekirse, 0.33.2 koduna dönerken):
-- alter table public.agent_tetik drop column agentlar;
-- alter table public.kisi drop column destek, drop column renk, drop column gizli_at;
-- create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261105140000_s033_yurutme'::text $$;
