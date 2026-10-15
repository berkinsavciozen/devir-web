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
| 9 | Kayıt herkese açık (Berkin, 15 Eki): spesifikasyonda kayıt varsayılan kapalı, A5'te açık kayıt için yalnız "Yeni çalışma alanı aç" alanı var | Yeni karar kazanır | Giriş bağlantısı yeni e-postaya da gider (`shouldCreateUser: true`). Kayıt açıksa A5 yerine "Çalışma alanını aç" (Adın, Çalışma alanı, "Alanı aç") gelir; A5 kapalı sunucu için kalır. Sunucu 0.10.0: `/ben.acik_kayit`, kimliksiz `GET /api/v1/durum` |
| 10 | Haritada üye sırası: B3 PNG'si elle verilen sırayla çizilmiş (Berkin, Claude, İçerik agent'ı, Hasat yetkilisi); §4.2 "akış sahibi + adımlarda ilk görünüş" diyor (Berkin, İçerik agent'ı, Claude, Hasat yetkilisi) | Spesifikasyon kazanır | Kural uygulandı. Şeritte Claude ile İçerik satırları yer değiştirir; yollar bu yüzden PNG'den farklı açıyla çıkar. `akis.uye_sirasi` gibi bir alan gelirse o kullanılır |
| 11 | Akış ve adım kısa adları ("Hasat postu", "App Store onayı", "Görsel") API'de yok (§10 "Akış adları uzun") | Sunucu 0.10.0 `akis.kisa_ad`, `adimlar[].kisa_ad` döner (`baglam.kisa_ad`, `baglam.kisa_adlar`; şema değişmez) | Alan boşsa: akış başlığının ilk 18 karakteri, adım adının ilk iki kelimesi. Sahte veride tasarımdaki adlar dolu |
| 12 | B1'de kapanan Ege: PNG'de hedef tarih açısında (alt, 16 Kas); §3.10 "kapanış tarihi açısında" | Spesifikasyon kazanır | Ege kapanış açısında (12 Eki, sağ üst). Bugün hapına 16°'den yakınsa geriye kayar; adı halkanın dışına yazılır |
| 13 | B1 "Test Bank’te": ek okunuşa göre; kural yazıma göre ek verir ("Bank’ta") | Yazım | Yabancı adın okunuşu bilinmiyor; kısa ad (`kisa_ad`) yazımı kullanılır |
| 14 | B1 engel özeti ("kapak fotoğraflarını") API'de yok (§9-14) | Sunucu 0.10.0: `devir_adim_guncelle` `engel_kisa` alır, `baglam.engel_kisa`'da tutar; adımda ve kartın `sira`sında `engel_kisa`, `tuttugu` döner (şema değişmez) | Boşsa "engelini" yazılır (§5 B1) |
| 15 | C1 "Kararı ver" sonrası "Bu karar Hasat'ın geçerli kararlarına yazılsın mı?" onayı | Sunucu karar adımını insan tamamlayınca kararı zaten kendisi kaydediyor (`devir_adim_guncelle`) | Onay sayfası gösterilmez; ikinci `POST /karar` çift kayıt açardı. Karar C2'de takımyıldızda görünür |
| 16 | C2 takımyıldızındaki kısa karar adları ("Komisyon %12") | `karar` tablosunda kısa ad sütunu yok; eklemek şema değişikliği (Berkin onayı) | Sunucu `kisa` alanını varsa döner (bugün hep boş). İstemci boşsa ilk cümleciğin ilk üç kelimesini yazar. Sahte veride kısa adlar dolu |
| 17 | C1 seçenekleri ve öneri (§9-6) | Sunucu 0.10.0: `devir_adim_guncelle` `karar {tur, secenekler[{ad, alt, etiket, uyari}], oneri{secim, ozet, gerekce}}` ve `karar_secimi` alır (`baglam.kararlar`, şema değişmez); adımda `karar` döner | Seçenek yoksa serbest metin alanı. Sahte veride `?hal=karar` (7 Kas) Karadeniz'e tasarımdaki 5 aday ve Claude önerisi yazılır; Ege 7. adımda karar verilmiş hali var |
