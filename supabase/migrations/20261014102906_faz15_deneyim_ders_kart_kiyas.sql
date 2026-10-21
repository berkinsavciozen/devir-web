-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
-- Faz 1.5: yalnızca yeni tablolar; mevcut tablolara dokunulmaz
create table if not exists deneyim (
  id bigserial primary key,
  ws_id uuid not null,
  akis_id uuid unique,
  akis_kod text,
  is_turu text,
  cumle text,
  baslik text,
  varlik text,
  varlik_norm text,
  iliski text,
  adimlar jsonb not null default '[]',
  eklenen jsonb not null default '[]',
  atlanan jsonb not null default '[]',
  yanlis_varsayim jsonb not null default '[]',
  soru_etki jsonb not null default '[]',
  sonradan jsonb not null default '{}',
  bekleme jsonb not null default '[]',
  sapma jsonb not null default '[]',
  isabet real,
  uygulanan_ders jsonb not null default '[]',
  metin text,
  gomme real[],
  kaynak text not null default 'kapanis',
  created_at timestamptz not null default now()
);
create index if not exists deneyim_ws on deneyim(ws_id, created_at desc);

create table if not exists ders (
  id bigserial primary key,
  ws_id uuid not null,
  metin text not null,
  etki text not null check (etki in ('adim_ekle','soru_sor','sure_uzat','sira')),
  kapsam text not null default 'ekip' check (kapsam in ('varlik','ekip','alan')),
  varlik_norm text,
  tetik text[] not null default '{}',
  adim jsonb,
  soru jsonb,
  kanit jsonb not null default '[]',
  kanit_sayi int not null default 1,
  uygulandi int not null default 0,
  atlandi int not null default 0,
  guven real not null default 0.5,
  durum text not null default 'aday' check (durum in ('aday','kesin','zayif','reddedildi')),
  gomme real[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ders_ws on ders(ws_id, durum);

create table if not exists bilgi_karti (
  id bigserial primary key,
  kod text not null unique,
  baslik text not null,
  alan text not null,
  kural text not null,
  sure text,
  kim text,
  adimlar jsonb not null default '[]',
  kaynak_ad text,
  kaynak_url text,
  kontrol_tarihi date,
  tetik text[] not null default '{}',
  gomme real[],
  durum text not null default 'taslak' check (durum in ('taslak','yayinda','geri_cekildi')),
  created_at timestamptz not null default now()
);

create table if not exists standart_surec (
  id bigserial primary key,
  ws_id uuid not null,
  kod text not null,
  ad text not null,
  aciklama text,
  akis_id uuid,
  adimlar jsonb not null default '[]',
  sorular jsonb not null default '[]',
  tetik text[] not null default '{}',
  gomme real[],
  durum text not null default 'aktif' check (durum in ('aktif','kaldirildi')),
  created_at timestamptz not null default now(),
  unique (ws_id, kod)
);

create table if not exists kiyas_sonuc (
  id bigserial primary key,
  kosu text not null,
  surum text,
  senaryo text not null,
  tur int not null default 1,
  kol text not null check (kol in ('duz','devir','yargic')),
  plan jsonb,
  sorular jsonb,
  olcu jsonb,
  yargic jsonb,
  maliyet jsonb,
  sure_ms int,
  hata text,
  created_at timestamptz not null default now()
);
create index if not exists kiyas_kosu on kiyas_sonuc(kosu, senaryo, tur);

alter table deneyim enable row level security;
alter table ders enable row level security;
alter table bilgi_karti enable row level security;
alter table standart_surec enable row level security;
alter table kiyas_sonuc enable row level security;
