-- 0.33.0 (5 Kas, P3/P4 plan metodolojisi): adımın yürütme tasarımı, AI çıktısı inceleme biçimi ve karar biçimi.
-- Yalnız ekler; var olan veri değişmez (boş kalan alanları sunucu kuralla doldurur). Bu migration 0.33.0 kodundan ÖNCE uygulanır.
alter table public.adim add column if not exists yurutme text check (yurutme in ('ai_yapar','ai_hazirlar_insan_bitirir','insan','dis'));
alter table public.adim add column if not exists inceleme text check (inceleme in ('yok','hizli_onay','yorumlu_inceleme'));
alter table public.adim add column if not exists karar_tur text check (karar_tur in ('secim','coklu_secim','onay_red','tutar_tarih','serbest'));
comment on column public.adim.yurutme is 'Kim yürütür: ai_yapar · ai_hazirlar_insan_bitirir · insan · dis';
comment on column public.adim.inceleme is 'AI çıktısına bakış: yok · hizli_onay (onayla/geri gönder) · yorumlu_inceleme (yorum ve red nedeniyle)';
comment on column public.adim.karar_tur is 'Karar biçimi: secim · coklu_secim · onay_red · tutar_tarih · serbest. Seçenekler akis.baglam.kararlar içinde.';

-- Şema sürümü (N-8)
create or replace function public.devir_sema() returns text language sql immutable set search_path = '' as $$ select '20261105140000_s033_yurutme'::text $$;
revoke all on function public.devir_sema() from public, anon, authenticated;
