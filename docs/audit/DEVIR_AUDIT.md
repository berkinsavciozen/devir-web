# Devir audit: Bulgu → Aksiyon matrisi

Kaynak: `DEVIR_AUDIT_CLAUDE_HANDOFF.md` (21 Eki 2026) ve onaylanan plan v2 (21 Eki 09:52).
Her paket ayrı PR ve test kanıtıyla kapanır; bu tablo her PR'da güncellenir.
Kapı: Blocker ve Critical satırlarının hepsi **kapandı** olmadan dış pilot ya da GTM yok.

Durum: `açık` · `kısmen` (bir kısmı bu PR'da, kalanı sonraki pakette) · `kapandı (kod)` (kod birleşti, canlıya yüklenmedi) · `kapandı` (canlıda doğrulandı)

## Audit bulguları

| Bulgu | Önem | Paket | Durum | Kanıt / not |
|---|---|---|---|---|
| S-B1 MCP anahtarı URL'de ve loglarda | Blocker | P0-B | kısmen | T1 (21 Eki): kullanılmamış 2 anahtar iptal. 0.14.0: MCP ucu Supabase Auth OAuth 2.1 jetonunu kabul eder (kişi üyelikten, yazan agent); kimliksiz istek 401 + `resource_metadata`, korunan kaynak belgesi `/.well-known/oauth-protected-resource`. `dv_` önce başlıktan okunur; adres/sorgu anahtarı `ayar.mcp_yol_anahtari = kapali` olunca 401 (yeniden yükleme gerekmez). Yeni anahtar adrese gömülmez, 90 gün, önekli. OAuth jetonu web uçlarında insan oturumu sayılmaz. Web: `/oauth/onay`, Claude'a bağla anahtarsız, Ayarlar > Bağlı uygulamalar (izni kaldır). CI: `scripts/sir-tarama.mjs`. Test: `oauth.test.ts` (26). Kalan: canlıda T2–T7 (bayrak kapatma, eski anahtarların iptali, log denetimi). |
| S-B2 Dış kapsam ad alt dizgesiyle | Blocker | P0-0 → P0-A | kapandı | 0.12.1 (canlı): tam ad / "Ad (kurum)" eşleşmesi (`adEslesir`). 0.13.0: `kisi` tablosu; kapsam `sahip_kisi_id` eşitliğiyle, kimliği olmayan eski satırda tam ad eşleşmesine düşer. Aynı adlı iki kişi birbirinin adımını görmez, ad değişince bağlar kopmaz. Test: `kimlik.test.ts` (iki Ayşe, yeniden adlandırma). Canlı: M2 21 Eki 11:20, 0.13.0 11:26. 7 dış bağlantının kimlikle gördüğü adımlar ad eşleşmesiyle birebir aynı (SQL, bağlantı açılmadan). |
| S-C1 Aktör kimliği / insan kararı taklit edilebilir | Critical | P0-0 → P0-A | kısmen | 0.12.1: `kim`/`kim_tip` argümanı yok sayılır, aktör kanaldan (mcp=agent, oturum/anahtar=insan, bağlantı=dış). Agent kararı yalnız `devir_karar_ver` ile, sahip/ekip için "insan kararı", dış için reddedilir. Test: `guvenlik.test.ts`. 0.13.0: karar politikası (sahip/ekip/dış × insan kararı/beyan, Ayarlar → Agent kararları, yalnız sahip değiştirir); beyanda adım kapanmaz, karar öneri olarak kalır. Her olay `kanal` ve `kisi_id` taşır; kanalı olmayan eski olay "doğrulanmamış eski kayıt" görünür. Test: `kimlik.test.ts` politika bloğu. Kalan: web'e anahtarla gelen istek insan sayılır (P0-B). |
| S-C2 Eksik süre gizlice 1 gün | Critical | P1-A | açık | Tarih aralığı + "süre eksik" uyarısı. Canlıda 3 aktif akışta 7 açık adım süresiz. |
| S-C3 Ekip rolü fazla yetkili | Critical | P0-0 | kapandı (kod) | 0.12.1 canlıda (21 Eki, `/durum` sürümü doğrulandı; davranış canlıda ayrıca denenmedi): çalışma alanı kararı, standart süreç, ders onay/ret, bitmemiş akışı zorla kapatma yalnız sahip (`needOwner`). Test: `guvenlik.test.ts` S-C3 bloğu. |
| S-C4 Idempotency ve hız sınırı yok | Critical | P1-B | açık | |
| M-C1 / D-M3 Kritik yol görünmüyor | Critical / Major | P1-A | açık | |
| D-C1 Dış paylaşım keşfedilemiyor | Critical | P1-C | açık | |
| S-M1 DB savunması yalnız Edge kodunda | Major | P0-0 (canlı) → P0-C | kısmen | 21 Eki 10:34: anon/authenticated yetkileri kaldırıldı (N-2). RLS politikaları ve SQL testleri P0-C. |
| S-M2 Olay/durum tutarsızlığı | Major | P1-B | açık | Canlı: Hasat akışı adım 12 (durum ertelendi, son olay atlandı). Düzeltici olay onayla. |
| S-M3 CI e2e çalıştırmıyor | Major | P1-D | açık | Şimdilik her PR'da elle `npx playwright test`. |
| S-M4 Güvenlik/performans sertleştirmeleri | Major | P1-D, P2-C | açık | |
| M-M1 360 px taşma | Major | P2-A | açık | |
| M-M2 Pano/nav çakışması | Major | P1-B | açık | |
| M-M3 Yükleme sırasında yanlış "iş yok" | Major | P1-B | açık | |
| M-M4 / D-M4 Onboarding | Major | P2-B | açık | |
| D-M1 Görevler masaüstünde 430 px | Major | P2-A | açık | |
| D-M2 1024 px tutarsızlığı | Major | P2-A | açık | |

## Audit dışı bulgular (plan v2)

| Bulgu | Önem | Paket | Durum | Kanıt / not |
|---|---|---|---|---|
| N-1 LLM anahtarları `ayar` tablosunda düz metin | P0 | P0-0 (canlı) | kısmen | 21 Eki: anahtarlar Edge secret'ında; `ayar` satırları `yedek_` önekiyle yeniden adlandırıldı, kod artık okumuyor. Anthropic kredisi yüklenip bir taslak Claude'dan gelince yedek satırlar silinecek. |
| N-2 anon/authenticated tam tablo yetkisi | P0 | P0-0 (canlı) | kapandı | 21 Eki 10:34 Berkin onayıyla canlıda (`20261021103435_p00_istemci_rollerinden_yetki_kaldir`). Doğrulama: kalan yetki 0, service_role 147; `/api/v1/durum` 200. |
| N-3 Dış bağlantı belirteci düz metin + logda | P0 | P0-B | açık | P0-B'nin ikinci PR'ı (belirteç karması, `#` parçası, başlıkla API). |
| N-4 Üye çıkarma anahtarı iptal etmiyor | P0 | P0-A | kapandı (kod) | 0.13.0: anahtar üyeye bağlı (`anahtar.uye_id`, rol ve kişi üyeden okunur); üye çıkınca anahtarları iptal edilir, üyeliği bitmiş anahtar 401. Test: `kimlik.test.ts` üye anahtarı bloğu. Canlı 0.13.0 (21 Eki 11:26): aktif 4 anahtarın 1'i üyeye bağlı; öteki 3 üyesi olmayan eski sahip anahtarı, P0-B T5'te iptal edilecek. |
| N-5 Test başlıkları herkese açık | P0 | P0-0 | kapandı (kod) | 0.12.1: `x-devir-motor` / `x-devir-openai-model` yalnız `ayar.test_basliklari = 'acik'` iken dinlenir (`sunucu/index.ts`). Deno girişi birim testte yok; canlıda başlıkla istek atıp motorun değişmediği doğrulanacak. |
| N-6 Migration'lar depoda yok | P0 | P0-0 → P0-C | kısmen | 0.12.1: 12 migration canlı `schema_migrations` kaydından `supabase/migrations/` altına alındı; canlı sütunlarla karşılaştırıldı, fark yok. SQL davranış testi P0-C. |
| N-7 Talimatlar agent'a kim_tip=insan öğretiyor | P0 | P0-0 | kapandı (kod) | 0.12.1: talimat ve araç şemalarından `kim`/`kim_tip` çıktı; karar için `devir_karar_ver` (geri alınamaz işaretli). Test: "araç şemalarında kim_tip yok". |
| N-8 İki ön yüz ve elle Edge yüklemesi | P1 | P1-D, P2-C | açık | |
| N-9 Hata → HTTP kodu regex'le | P1 | P0-A | kapandı (kod) | 0.13.0 (21 Eki canlıda): `DevirHata` (403 `yetkiYok`, 404 `bulunamadi`); regex kalktı, tipsiz hata 400. Test: `kimlik.test.ts` 403/404. |
| N-10 Dış adımlar sahip_tip=insan | P1 | P0-A, P1-C | açık | 0.13.0'da veri değişikliği yapılmadı: canlıda Şampirellam alanındaki satırlara dokunur, ayrı onay gerekir. |
| N-11 `dbg.tmp.mjs` depoda | P2 | P0-0 | kapandı | 0.12.1 PR'ında silindi. |

## Paket geçmişi

| Paket | Sürüm | PR | Testler | Canlı |
|---|---|---|---|---|
| P0-0 hızlı sertleştirme | 0.12.1 | #17 | sunucu 151 ✓ (yeni `guvenlik.test.ts` 25), vitest 59 ✓, build ✓, e2e 101 ✓ | 21 Eki yüklendi |
| P0-A kişi kimliği, aktör, yetki | 0.13.0 | #18 | sunucu 173 ✓ (yeni `kimlik.test.ts` 22), vitest 59 ✓, build ✓, e2e 101 ✓ | M2 21 Eki 11:20, kod 11:26 yüklendi |
| P0-B1 OAuth, başlık anahtarı, süre | 0.14.0 | (bu PR) | sunucu 198 ✓ (yeni `oauth.test.ts` 26), vitest 59 ✓, build ✓, sır taraması ✓, e2e 104 ✓ (zamanlama testi tam koşuda bir kez yavaş, tek başına geçti) | yüklenmedi; önce panel ayarı + M3, sonra kod (README) |
