-- P0-B (0.14.0) · M3: anahtar süresi ve öneki, üyenin son MCP kullanımı. Yalnız ekler; 0.13.0 bu sütunları yok sayar.
-- Mevcut anahtarlara süre verilmez (son_gecerlilik null = süresiz); T5'te iptal edilecekler. Yeni anahtarlar 90 gün.
alter table public.anahtar add column son_gecerlilik timestamptz,
  add column onek text;
comment on column public.anahtar.onek is 'Anahtarın ilk 7 karakteri (dv_xxxx); listede ayırt etmek için. Anahtarın kendisi yalnız karma olarak durur.';
alter table public.uye add column mcp_son_kullanim timestamptz;
comment on column public.uye.mcp_son_kullanim is 'Bu üyenin OAuth ile bağlanmış bir istemciden (Claude, ChatGPT) son MCP çağrısı.';

-- Geri alma:
-- alter table public.anahtar drop column son_gecerlilik, drop column onek; alter table public.uye drop column mcp_son_kullanim;
