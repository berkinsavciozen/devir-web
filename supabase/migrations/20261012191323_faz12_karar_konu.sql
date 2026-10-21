-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
alter table public.karar add column if not exists konu text;
