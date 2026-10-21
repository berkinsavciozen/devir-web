-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
create extension if not exists pgcrypto;

create table public.kullanici (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.sablon (
  kod text primary key,
  ad text not null,
  alan text,
  surum int not null default 1,
  aciklama text,
  sorular jsonb not null default '[]',
  adimlar jsonb not null default '[]',
  kurallar jsonb not null default '{}',
  ogrenimler jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.akis (
  id uuid primary key default gen_random_uuid(),
  kisa_kod text not null unique,
  sahip_id uuid not null references public.kullanici(id) on delete cascade,
  baslik text not null,
  amac text,
  sablon_kod text references public.sablon(kod),
  sablon_surum int,
  hedef_tarih date,
  durum text not null default 'aktif' check (durum in ('aktif','kapandi','arsiv')),
  kurallar jsonb not null default '{}',
  baglam jsonb not null default '{}',
  created_at timestamptz not null default now(),
  kapandi_at timestamptz
);

create table public.adim (
  id uuid primary key default gen_random_uuid(),
  akis_id uuid not null references public.akis(id) on delete cascade,
  no int not null,
  ad text not null,
  aciklama text,
  sahip text not null,
  sahip_tip text not null default 'insan' check (sahip_tip in ('insan','agent','dis')),
  arac text,
  kriter text not null,
  beklenen_cikti text,
  karar_kriteri text,
  son_tarih date,
  sure_tahmin_gun numeric,
  bagimli int[] not null default '{}',
  durum text not null default 'sirada' check (durum in ('sirada','hazir','suruyor','engelli','tamam','atlandi')),
  engel text,
  kaynak text not null default 'sablon' check (kaynak in ('sablon','plan','sonradan')),
  ilerleme text,
  ciktilar jsonb not null default '[]',
  durum_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (akis_id, no)
);

create table public.olay (
  id bigint generated always as identity primary key,
  akis_id uuid not null references public.akis(id) on delete cascade,
  adim_no int,
  kim text not null,
  kim_tip text not null check (kim_tip in ('insan','agent','sistem','dis')),
  arac text,
  tip text not null,
  ozet text not null,
  veri jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.katilimci (
  id uuid primary key default gen_random_uuid(),
  akis_id uuid not null references public.akis(id) on delete cascade,
  ad text not null,
  rol text,
  iletisim text,
  link_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create index on public.adim (akis_id);
create index on public.olay (akis_id, created_at);
create index on public.akis (sahip_id, durum);
create index on public.katilimci (akis_id);

alter table public.kullanici enable row level security;
alter table public.sablon enable row level security;
alter table public.akis enable row level security;
alter table public.adim enable row level security;
alter table public.olay enable row level security;
alter table public.katilimci enable row level security;
