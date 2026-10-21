-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
-- şablonlar: çalışma alanına özel kopya (öğrenim yalnızca orada birikir); ws_id null = başlangıç şablonu
alter table public.akis drop constraint if exists akis_sablon_kod_fkey;
alter table public.sablon drop constraint if exists sablon_pkey;
alter table public.sablon add column if not exists id uuid not null default gen_random_uuid();
alter table public.sablon add primary key (id);
alter table public.sablon add column if not exists ws_id uuid references public.kullanici(id) on delete cascade;
alter table public.sablon add column if not exists kaynak text not null default 'baslangic' check (kaynak in ('baslangic','ogrenilmis'));
alter table public.sablon add column if not exists akis_sayisi int not null default 0;
create unique index if not exists sablon_ws_kod on public.sablon (coalesce(ws_id, '00000000-0000-0000-0000-000000000000'::uuid), kod);

-- tohum öğrenimleri test çalışma alanına özel kopyaya taşı, başlangıç şablonunu temizle
insert into public.sablon (kod, ad, alan, surum, aciklama, sorular, adimlar, kurallar, ogrenimler, ws_id, kaynak, akis_sayisi)
select kod, ad, alan, surum, aciklama, sorular, adimlar, kurallar, ogrenimler, 'c370682c-5111-4d7c-876f-b43dc9a8fe46'::uuid, 'ogrenilmis', jsonb_array_length(ogrenimler)
from public.sablon where kod = 'musteri-onboarding' and ws_id is null;
update public.sablon set ogrenimler = '[]'::jsonb where ws_id is null;

-- adım türü kimliği ve ilk taslak
alter table public.adim add column if not exists tur_kod text;
alter table public.akis add column if not exists taslak_id uuid;
alter table public.akis add column if not exists ilk_taslak jsonb;

create table if not exists public.taslak (
  id uuid primary key default gen_random_uuid(),
  kisa_kod text not null unique,
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  anahtar_id uuid references public.anahtar(id) on delete set null,
  cumle text not null,
  baglam jsonb not null default '{}',
  is_turu text,
  is_turu_ad text,
  yeni_tur boolean not null default false,
  taslak jsonb not null,
  sorular jsonb not null default '[]',
  varsayimlar jsonb not null default '[]',
  durum text not null default 'acik' check (durum in ('acik','kuruldu','iptal')),
  akis_id uuid references public.akis(id) on delete set null,
  model text,
  sure_ms int,
  created_at timestamptz not null default now()
);
create index if not exists taslak_ws on public.taslak (ws_id, created_at);

create table if not exists public.soru_kaydi (
  id bigint generated always as identity primary key,
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  taslak_id uuid references public.taslak(id) on delete cascade,
  akis_id uuid references public.akis(id) on delete cascade,
  is_turu text,
  tip text not null default 'soru' check (tip in ('soru','varsayim','kacan')),
  soru_kod text,
  boyut text,
  soru text,
  cevap text,
  kaynak text,
  etki jsonb not null default '{}',
  etki_puan numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists soru_kaydi_tur on public.soru_kaydi (ws_id, is_turu, soru_kod);

create table if not exists public.ayar (anahtar text primary key, deger text not null, updated_at timestamptz not null default now());

alter table public.taslak enable row level security;
alter table public.soru_kaydi enable row level security;
alter table public.ayar enable row level security;
