-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
alter table public.kullanici alter column token_hash drop not null;
create table public.anahtar (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references public.kullanici(id) on delete cascade,
  kisi text not null,
  rol text not null default 'ekip' check (rol in ('sahip','ekip','dis')),
  kapsam text,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  son_kullanim timestamptz
);
create index on public.anahtar (kullanici_id);
alter table public.anahtar enable row level security;
comment on table public.kullanici is 'Çalışma alanı (ör. bir mali müşavir ofisi). Akışlar buna aittir.';
comment on table public.anahtar is 'MCP erişim anahtarı: bir kişi, bir rol. dis rolü yalnızca kapsamındaki akış ve adımları görür.';
