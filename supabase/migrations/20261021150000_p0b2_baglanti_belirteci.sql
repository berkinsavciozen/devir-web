-- P0-B2 (0.15.0) · M4: dış bağlantı belirteci düz saklanmaz (N-3). Arama karmayla (link_hash), gösterim için
-- belirteç Edge secret'ı DEVIR_BAGLANTI_ANAHTARI ile şifreli (link_sifreli). link_token boşaltılabilir olur;
-- düz değerler 0.15.0 ilk istekte şifreleyip siler. Varsayılan değer 0.14.0 yüklüyken yeni bağlantılar için kalır.
alter table public.katilimci alter column link_token drop not null,
  add column link_hash text,
  add column link_sifreli text;
update public.katilimci set link_hash = encode(extensions.digest(link_token, 'sha256'), 'hex') where link_token is not null;
create unique index katilimci_link_hash on public.katilimci (link_hash);
comment on column public.katilimci.link_hash is 'Bağlantı belirtecinin SHA-256 karması (hex); bağlantı bununla bulunur.';
comment on column public.katilimci.link_sifreli is 'Belirteç, AES-GCM ile şifreli (v1:iv:şifreli, base64). Anahtar Edge secret DEVIR_BAGLANTI_ANAHTARI.';

-- Geri alma (önce 0.14.0 koduna dön; şifrelenmiş satırların düz belirteci geri gelmez, bu bağlantılar yenilenir):
-- drop index public.katilimci_link_hash; alter table public.katilimci drop column link_hash, drop column link_sifreli;
