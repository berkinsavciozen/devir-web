# Tasarım kaynakları arasındaki çelişkiler ve açık noktalar

Spesifikasyon kazanır; burada not edilir.

| # | Konu | Durum | Ne yapıldı |
|---|---|---|---|
| 1 | Çizim kaynağı (`kaynak/ortak.js`) token dışı renkler kullanıyor: bulutsu (#7B4FB0, #3E6BD0), yıldız (#FFF6EC, #C9B8FF), geri düğmesi zemini (#1E1645), kopyala düğmesi (#2A1D5C), alan çerçevesi (#6B5FB0), radyo çerçevesi (#9C8BE0), ev/ağaç/fener yüzey renkleri | tokens.json'da yok | Çizim parçaları (`src/cizim/ortak.js`) birebir taşındı, renkleri değişmedi. React bileşenlerinde token'a en yakın değer kullanıldı (alan çerçevesi → çizgi-lila). İstenirse tokens.json'a "illüstrasyon" grubu eklenir. |
| 2 | Birincil düğme altı ışığı `#FFB48F` | tokens.json'da yalnız degrade durağı | CSS'te `kayisi` (#F59E7A) %25 ile; fark blur altında görünmüyor. |
| 3 | Nötr hayalet düğme çerçevesi: PNG'lerde `#B9A6F2` (A1 "Anahtarla gir", A1b, A1d, A4, A5), §3.18'de lila `#8E80D6` | Spesifikasyon kazanır | `ton="lila"` → `--renk-vurgu-cizgi-lila` |
| 4 | A3 MCP adresi: PNG'de `…/functions/v1/devir-mcp`; 0.9.0'da `mcp_adresi` anahtarı da içerir (`…/devir-mcp/dv_…`) | Kopyalanan tam değer | Gösterim `…/functions/v1/devir-mcp/dv_••••`; anahtar ayrıca 3. adımda |
| 5 | PNG'lerin altındaki ev çubuğu (134 × 5) | İşletim sisteminin çizdiği öğe | Uygulama çizmez |
| 6 | A1 hata hali (geçersiz e-posta) PNG'de yok | Metin alanın altına sığmıyor (düğmeyle arası 16 px) | Hata cümlesi etiket satırında, sağda, mercan |
| 7 | "Anahtarla gir" giriş sayfası PNG'de yok | — | Alt sayfa: dv_ alanı + "Gir"; GET /ben ile doğrulanır, 401 cümlesi gösterilir |
| 8 | A3 "Bağlandı" alt cümlesi tanımlı değil | — | "Claude artık bu alana yazıyor." |
