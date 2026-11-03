-- 0.29.0 (3 Kas, AI yapsın): agent adımı hazır olunca kişinin kendi Claude rutini API tetiğiyle başlatılır.
-- Yalnız ekler; var olan veri değişmez. Bu migration 0.29.0 kodundan ÖNCE uygulanır.

-- 1) adımda AI yapsın işareti ve durumu
alter table public.adim add column if not exists oto boolean not null default false;
alter table public.adim add column if not exists oto_tarih_bekle boolean not null default false;
alter table public.adim add column if not exists oto_durum text check (oto_durum in ('tetiklendi','bakilacak','hata'));
alter table public.adim add column if not exists oto_deneme int not null default 0;
alter table public.adim add column if not exists oto_at timestamptz;
alter table public.adim add column if not exists oto_oturum text;
comment on column public.adim.oto is 'AI yapsın: agent adımı hazır olunca agent_sahibi''nin Claude rutini tetiklenir.';
comment on column public.adim.oto_durum is 'boş: bekliyor · tetiklendi: rutin başladı · bakilacak: çıktı yazıldı, sahibi onaylayacak · hata: başlatılamadı (adım engelli)';
create index if not exists adim_oto_hazir on public.adim (durum) where oto;

-- 2) kişinin rutin tetikleri: agent adı başına bir tetik; jeton DEVIR_BAGLANTI_ANAHTARI ile AES-GCM şifreli
create table if not exists public.agent_tetik (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  uye_id uuid references public.uye(id) on delete cascade,
  kisi text not null,
  kisi_norm text not null,
  ad text not null,
  url text not null,
  jeton text not null,
  aktif boolean not null default true,
  son_tetik_at timestamptz,
  son_hata text,
  created_at timestamptz not null default now()
);
create index if not exists agent_tetik_kisi on public.agent_tetik (ws_id, kisi_norm) where aktif;
create index if not exists agent_tetik_uye on public.agent_tetik (uye_id);
comment on table public.agent_tetik is 'AI yapsın: kişinin Claude rutini API tetiği (adres + şifreli jeton). Jeton bir daha gösterilmez; kaldırılınca silinir.';
alter table public.agent_tetik enable row level security;

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261103180000_s029_ai_yapsin'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;
