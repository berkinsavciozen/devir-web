-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
create table if not exists public.okuma_isareti (
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  kim text not null,
  son_olay_id bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ws_id, kim)
);
alter table public.okuma_isareti enable row level security;
