-- Canlı veritabanından alındı (supabase_migrations.schema_migrations). Uygulanmış kayıttır, değiştirmeyin; yeni değişiklik yeni dosyada.
alter table public.adim
  add column if not exists kosul jsonb,
  add column if not exists capa_soru text,
  add column if not exists cevap_soru text,
  add column if not exists tarih_sabit boolean not null default false,
  add column if not exists capa_tarih date;
comment on column public.adim.kosul is 'Açık bir soruya bağlı dal: {soru, deger}. Cevap gelince seçilmeyen dal atlanır.';
comment on column public.adim.capa_soru is 'Bu adımın tarihi bu sorunun cevabıyla belli olur.';
comment on column public.adim.cevap_soru is 'Bu adım bitince bu sorunun cevabı belli olur.';
comment on column public.adim.tarih_sabit is 'Son tarih kullanıcıdan ya da sabit olaydan geliyor; yeniden planlamada korunur.';
comment on column public.adim.capa_tarih is 'Adımın gerçekleştiği sabit gün (olay tarihi).';
