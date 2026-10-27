-- 0.28.0 (27 Eki arayüz planı, P3 + P7 + P8 sunucu): agent sahibi, referans ve onay listesi, agent bağlantıları,
-- kişi başı aylık yapay zekâ kullanımı. Yalnız ekler; var olan veri değişmez.
-- Sıra: bu migration 0.28.0 kodundan ÖNCE uygulanır (eski kod yeni sütun ve tabloları görmez, etkilenmez).

-- 1) agent sahibi: agent'ın adımını kimin agent'ı yürütüyor (kişi adı). Haritada gemi o kişinin rengini alır.
alter table public.adim add column if not exists agent_sahibi text;
comment on column public.adim.agent_sahibi is 'Agent adımında agent''ın sahibi (kişi adı). Agent ilk yazdığında bağlantının kişisi yazılır; devir_adim_guncelle agent_sahibi ile değişir.';

-- 2) referans bağlantısı (karar 4.B): üye başına bir kod
create table if not exists public.referans (
  kod text primary key,
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  uye_id uuid not null unique references public.uye(id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.referans is 'Kişiye özel Devir referans bağlantısı: <web>/katil/<kod>.';
create index if not exists referans_ws on public.referans (ws_id);
alter table public.referans enable row level security;

-- 3) onay listesi: referansla gelen kişi açık kayıt kapalıyken burada bekler; onaylanınca kendi çalışma alanını açar
create table if not exists public.bekleme (
  id uuid primary key default gen_random_uuid(),
  eposta text not null unique,
  auth_id uuid references auth.users(id) on delete set null,
  ad text,
  referans_kod text references public.referans(kod) on delete set null,
  referans_ws uuid references public.kullanici(id) on delete set null,
  referans_uye_id uuid references public.uye(id) on delete set null,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','onaylandi','reddedildi','katildi')),
  karar_at timestamptz,
  karar_veren text,
  katildi_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bekleme_referans_ws on public.bekleme (referans_ws);
create index if not exists bekleme_auth on public.bekleme (auth_id);
create index if not exists bekleme_referans_kod on public.bekleme (referans_kod);
create index if not exists bekleme_referans_uye on public.bekleme (referans_uye_id);
comment on table public.bekleme is 'Referansla gelenlerin onay listesi. Sahip kendi alanından gelenleri, ayar.yoneticiler''deki e-postalar hepsini görür.';
alter table public.bekleme enable row level security;

-- 4) agent bağlantıları: kişinin OAuth ile bağladığı Claude / ChatGPT istemcileri (Ayarlar > Agent'larım)
create table if not exists public.agent_baglanti (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  uye_id uuid not null references public.uye(id) on delete cascade,
  istemci text not null,
  ad text not null,
  ilk_kullanim timestamptz not null default now(),
  son_kullanim timestamptz,
  kaldirildi_at timestamptz,
  unique (uye_id, istemci)
);
comment on table public.agent_baglanti is 'OAuth istemcisi (client_id) başına bağlantı. kaldirildi_at doluysa ondan önce alınmış jetonlar reddedilir.';
create index if not exists agent_baglanti_ws on public.agent_baglanti (ws_id);
alter table public.agent_baglanti enable row level security;

-- 5) yapay zekâ kullanımı (karar 5.A, 5.B): her model çağrısının maliyeti, kişi ve ay başına; sınır ayar.ai_aylik_sinir_usd
create table if not exists public.ai_kullanim (
  id bigint generated always as identity primary key,
  ws_id uuid references public.kullanici(id) on delete set null,
  kimlik text not null,
  ay date not null,
  tur text not null,
  model text,
  girdi_token int not null default 0,
  cikti_token int not null default 0,
  usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_kullanim_kimlik_ay on public.ai_kullanim (kimlik, ay);
create index if not exists ai_kullanim_ws on public.ai_kullanim (ws_id);
comment on table public.ai_kullanim is 'Kişi başı yapay zekâ kullanımı. kimlik u:<uye> ya da a:<anahtar>; tur taslak | sohbet | arka. Kullanıcıya yalnız oran gösterilir.';
alter table public.ai_kullanim enable row level security;

insert into public.ayar (anahtar, deger) values ('ai_aylik_sinir_usd', '5') on conflict (anahtar) do nothing;

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261027120000_s028_hiyerarsi_ayarlar_ai'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;
grant execute on function public.devir_sema() to service_role;

-- Geri alma (önce 0.27.0 koduna dön):
-- drop table if exists public.ai_kullanim, public.agent_baglanti, public.bekleme, public.referans;
-- alter table public.adim drop column if exists agent_sahibi;
-- delete from public.ayar where anahtar = 'ai_aylik_sinir_usd';
-- create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261025140000_w5_alt_gorev'::text $$;
