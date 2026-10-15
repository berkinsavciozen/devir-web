# Tasarım kaynakları arasındaki çelişkiler ve açık noktalar

Spesifikasyon kazanır; burada not edilir.

| # | Konu | Durum | Ne yapıldı |
|---|---|---|---|
| 1 | Çizim kaynağı (`kaynak/ortak.js`) token dışı renkler kullanıyor: bulutsu (#7B4FB0, #3E6BD0), yıldız (#FFF6EC, #C9B8FF), geri düğmesi zemini (#1E1645), kopyala düğmesi (#2A1D5C), alan çerçevesi (#6B5FB0), radyo çerçevesi (#9C8BE0), ev/ağaç/fener yüzey renkleri | tokens.json'da yok | Çizim parçaları (`src/cizim/ortak.js`) birebir taşındı, renkleri değişmedi. React bileşenlerinde token'a en yakın değer kullanıldı (alan çerçevesi → çizgi-lila). İstenirse tokens.json'a "illüstrasyon" grubu eklenir. |
| 2 | Birincil düğme altı ışığı `#FFB48F` | tokens.json'da yalnız degrade durağı | CSS'te `kayisi` (#F59E7A) %25 ile; fark blur altında görünmüyor. |
