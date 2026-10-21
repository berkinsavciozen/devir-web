-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
alter table public.soru_kaydi drop constraint soru_kaydi_tip_check;
alter table public.soru_kaydi add constraint soru_kaydi_tip_check check (tip = any (array['soru','varsayim','kacan','yanlis_varsayim','fazla_adim']));
