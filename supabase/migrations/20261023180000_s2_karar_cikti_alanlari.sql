-- S2 (0.26.0, K11/N17): her adımın kararı ve çıktısı planlamada belirlenir. Yalnız ekler; var olan veri değişmez.
-- Boş (null) değer "belirlenmemiş" demektir: sunucu eski kurala (karar kriteri, karar- türü, ad) düşer.
-- Sıra: bu migration 0.26.0 kodundan ÖNCE uygulanır (yeni kod bu sütunlara yazar; eski kod onları görmez, etkilenmez).
-- Mevcut adımların doldurulması ayrı bir veri işidir (devir-deploy/0.26.0/doldurma.sql, ayrı onayla).

alter table public.adim add column if not exists karar_gerekli boolean;
alter table public.adim add column if not exists cikti_bekleniyor boolean;
comment on column public.adim.karar_gerekli is 'Adım bir seçim, onay, ödeme ya da imzayla mı biter (son söz insanda). null: belirlenmemiş, kural uygulanır.';
comment on column public.adim.cikti_bekleniyor is 'Adım belge, dosya, metin gibi bir çıktı üretir mi. null: belirlenmemiş, kural uygulanır.';

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261023180000_s2_karar_cikti_alanlari'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;
grant execute on function public.devir_sema() to service_role;

-- Geri alma:
-- alter table public.adim drop column if exists karar_gerekli, drop column if exists cikti_bekleniyor;
-- create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261023100000_p1d_fk_indeks'::text $$;
