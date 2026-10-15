# Devir · arayüz (Faz 2)

Devir'in web arayüzü: "Fener Masalı" tasarımı (akış = galaksi, adım = gezegen, üye = kendi yolundaki gemi).
Tek kod tabanı: React + TypeScript + Vite, SVG çizim, duyarlı web + PWA (ileride Capacitor kabuğu).

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Gerçek API ile geliştirme sunucusu |
| `npm run dev:sahte` | Örnek veriyle (sahte API, "bugün" = 14 Eki 2026 10:00, giriş yapan Berkin) |
| `npm run geometri:test` | `galaksi-geometri.js --test` ile aynı denetim; "TAMAM" bekler |
| `npm test` | Birim testleri (yol uzunluğu ∝ zaman, tasarım kaynağıyla birebir eşdeğerlik) |
| `npm run ekran` | Playwright ile her ekranı tasarım boyutunda (390×844 ya da 1440×900, 2x) çeker |
| `npm run karsilastir` | `karsilastirma/index.html`: tasarım PNG'si ↔ uygulama, yan yana ve fark görünümü |
| `npm run tokens` | `tasarim/tokens.json` → `src/stil/tokens.css` + `tokens.ts` |

## Doğruluk kaynakları

Proje klasöründe `design-competition/tur-3/d3-son/`: `SPESIFIKASYON.md` (önce bu), `ekranlar/*.png`, `tokens.json`,
`ikonlar/`, `kaynak/`. Depoda kopyası olanlar `tasarim/` altında: `tokens.json`, `ikonlar/`, `kaynak/galaksi-geometri.cjs`
(geometrinin tasarım kaynağı; TS taşıması `src/geometri/` bununla birebir test edilir), `kaynak/veri.json`, `veri/ornek-veri.json`.
Tasarım PNG'leri (≈ 92 MB) depoya konmaz; `karsilastir` onları `TASARIM_EKRANLAR` klasöründen okur.

## Kurallar

- Renkler yalnız token'lardan (`var(--renk-…)` ya da `tokens.ts`). Çizim parçalarındaki token dışı renkler `tasarim/CELISKILER.md`'de listelidir.
- Ekranda en fazla 2 akıllı cümle; cümlelerde gezegen, galaksi, gemi kelimeleri geçmez (akış, adım denir).
- `src/cizim/ortak.js` tasarımın çizim kaynağının taşımasıdır; ölçüleri değiştirilmez.
- Sunucuda silme, şema ya da gizli anahtar değişikliği yalnız Berkin'in açık onayıyla.
