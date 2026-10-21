-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
alter table public.adim drop constraint adim_durum_check;
alter table public.adim add constraint adim_durum_check check (durum = any (array['sirada','hazir','suruyor','engelli','tamam','atlandi','ertelendi']));

create table public.cikti (
  id bigserial primary key,
  ws_id uuid not null,
  akis_id uuid not null references public.akis(id) on delete cascade,
  adim_no int not null,
  ad text not null,
  ozet text,
  icerik text,
  url text,
  kaynak text,
  surum int not null default 1,
  durum text not null default 'taslak' check (durum in ('taslak','onaylandi','yayinda')),
  paylasim text not null default 'ekip' check (paylasim in ('ekip','dis')),
  kim text,
  arac text,
  created_at timestamptz not null default now()
);
create index cikti_akis_adim on public.cikti (akis_id, adim_no);
alter table public.cikti enable row level security;

create table public.karar (
  id bigserial primary key,
  ws_id uuid not null,
  varlik text not null,
  varlik_norm text not null,
  karar text not null,
  kapsam text,
  istisna text,
  kim text,
  akis_id uuid references public.akis(id) on delete set null,
  adim_no int,
  durum text not null default 'gecerli' check (durum in ('gecerli','degisti')),
  yerine_gecen bigint,
  created_at timestamptz not null default now()
);
create index karar_ws_varlik on public.karar (ws_id, varlik_norm, durum);
alter table public.karar enable row level security;

alter table public.olay drop constraint if exists olay_tip_check;
