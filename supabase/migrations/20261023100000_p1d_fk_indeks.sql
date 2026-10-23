-- P1-D (S-M4): Supabase danışmanının indekssiz yabancı anahtarları ve devir_norm arama yolu. Yalnız ekler; veri değişmez, kod değişmez.
-- Sıra: kodla ilgisi yok, istenen anda uygulanabilir. Geri alma en altta.

create index if not exists anahtar_kisi_id_idx on public.anahtar (kisi_id);
create index if not exists dosya_ws_id_idx on public.dosya (ws_id);
create index if not exists karar_akis_id_idx on public.karar (akis_id);
create index if not exists olay_kisi_id_idx on public.olay (kisi_id);
create index if not exists sablon_ws_id_idx on public.sablon (ws_id);
create index if not exists soru_kaydi_akis_id_idx on public.soru_kaydi (akis_id);
create index if not exists soru_kaydi_taslak_id_idx on public.soru_kaydi (taslak_id);
create index if not exists taslak_akis_id_idx on public.taslak (akis_id);
create index if not exists taslak_anahtar_id_idx on public.taslak (anahtar_id);
create index if not exists uye_kisi_id_idx on public.uye (kisi_id);
create index if not exists uye_kullanici_id_idx on public.uye (kullanici_id);

-- devir_norm yalnız pg_catalog işlevlerini kullanır; boş arama yolu başka şemadaki aynı adlı işlevin araya girmesini önler
alter function public.devir_norm(text) set search_path = '';

-- Şema sürümü (N-8): /api/v1/durum bunu sunucu kodunun beklediğiyle karşılaştırır. Her yeni migration bu işlevi kendi adıyla
-- yeniden yazar; scripts/sql-test.sh son migration dosyasının adıyla aynı olduğunu denetler.
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261023100000_p1d_fk_indeks'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;
grant execute on function public.devir_sema() to service_role;

-- Geri alma:
-- drop index if exists public.anahtar_kisi_id_idx, public.dosya_ws_id_idx, public.karar_akis_id_idx, public.olay_kisi_id_idx,
--   public.sablon_ws_id_idx, public.soru_kaydi_akis_id_idx, public.soru_kaydi_taslak_id_idx, public.taslak_akis_id_idx,
--   public.taslak_anahtar_id_idx, public.uye_kisi_id_idx, public.uye_kullanici_id_idx;
-- alter function public.devir_norm(text) reset search_path;
-- drop function if exists public.devir_sema();
