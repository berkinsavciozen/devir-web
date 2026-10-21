-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
alter table public.olay add constraint olay_tip_check check (tip in ('durum','guncelleme','not','okuma','ret','akis_olustu','adim_eklendi','akis_kapandi','karar'));
