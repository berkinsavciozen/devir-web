-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
-- E-postayla giriş: Supabase Auth kullanıcısı ile çalışma alanı arasındaki üyelik
create table public.uye (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  kullanici_id uuid not null references public.kullanici(id) on delete cascade,
  eposta text not null,
  kisi text not null,
  rol text not null default 'ekip' check (rol in ('sahip','ekip','dis')),
  kapsam text,
  created_at timestamptz not null default now(),
  son_giris timestamptz,
  unique (auth_id, kullanici_id)
);
comment on table public.uye is 'E-postayla giren kişinin çalışma alanı üyeliği; rol ve kapsam anahtar tablosundakiyle aynı anlamdadır.';

create table public.davet (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references public.kullanici(id) on delete cascade,
  eposta text not null,
  kisi text,
  rol text not null default 'ekip' check (rol in ('sahip','ekip','dis')),
  kapsam text,
  davet_eden text,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','kabul','iptal')),
  created_at timestamptz not null default now(),
  kabul_at timestamptz
);
create unique index davet_bekleyen_tekil on public.davet (kullanici_id, lower(eposta)) where durum = 'bekliyor';
create index davet_eposta on public.davet (lower(eposta));

-- Dosya yükleme: gizli kovadaki her nesnenin kaydı (kapsam denetimi ve silme için)
create table public.dosya (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  akis_id uuid not null references public.akis(id) on delete cascade,
  adim_no integer,
  yol text not null unique,
  ad text not null,
  tur text not null,
  boyut bigint not null,
  kim text,
  kim_tip text,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','yuklendi','silindi')),
  created_at timestamptz not null default now(),
  silindi_at timestamptz
);
create index dosya_akis on public.dosya (akis_id);

alter table public.uye enable row level security;
alter table public.davet enable row level security;
alter table public.dosya enable row level security;

-- Gizli kova: yalnızca sunucu (service role) erişir; indirme ve yükleme imzalı adreslerle
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('devir-dosya', 'devir-dosya', false, 20971520, array[
  'application/pdf','image/png','image/jpeg','image/webp','image/heic',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv','text/plain'
])
on conflict (id) do nothing;
