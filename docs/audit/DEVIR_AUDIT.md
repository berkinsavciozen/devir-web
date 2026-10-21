# Devir audit: Bulgu → Aksiyon matrisi

Kaynak: `DEVIR_AUDIT_CLAUDE_HANDOFF.md` (21 Eki 2026) ve onaylanan plan v2 (21 Eki 09:52).
Her paket ayrı PR ve test kanıtıyla kapanır; bu tablo her PR'da güncellenir.
Kapı: Blocker ve Critical satırlarının hepsi **kapandı** olmadan dış pilot ya da GTM yok.

Durum: `açık` · `kısmen` (bir kısmı bu PR'da, kalanı sonraki pakette) · `kapandı (kod)` (kod birleşti, canlıya yüklenmedi) · `kapandı` (canlıda doğrulandı)

## Audit bulguları

| Bulgu | Önem | Paket | Durum | Kanıt / not |
|---|---|---|---|---|
| S-B1 MCP anahtarı URL'de ve loglarda | Blocker | P0-B | açık | 0.12.1'de değişmedi. OAuth + başlıkla anahtar + anahtar yenileme (T1–T7) P0-B'de. |
| S-B2 Dış kapsam ad alt dizgesiyle | Blocker | P0-0 → P0-A | kısmen | 0.12.1: tam ad / "Ad (kurum)" eşleşmesi (`adEslesir`), katılımcı bağlantısı da aynı kuralla. Test: `guvenlik.test.ts` ali_mehmet_ali, parantezli_sahip, turkce_karakter. Kişi kimliğiyle (kisi_id) eşleşme P0-A. |
| S-C1 Aktör kimliği / insan kararı taklit edilebilir | Critical | P0-0 → P0-A | kısmen | 0.12.1: `kim`/`kim_tip` argümanı yok sayılır, aktör kanaldan (mcp=agent, oturum/anahtar=insan, bağlantı=dış). Agent kararı yalnız `devir_karar_ver` ile, sahip/ekip için "insan kararı", dış için reddedilir. Test: `guvenlik.test.ts`. Kalan: web'e anahtarla gelen istek hâlâ insan sayılır (P0-B'de anahtar MCP'ye özel olur); alan ayarında karar matrisi P0-A. |
| S-C2 Eksik süre gizlice 1 gün | Critical | P1-A | açık | Tarih aralığı + "süre eksik" uyarısı. Canlıda 3 aktif akışta 7 açık adım süresiz. |
| S-C3 Ekip rolü fazla yetkili | Critical | P0-0 | kapandı (kod) | 0.12.1: çalışma alanı kararı, standart süreç, ders onay/ret, bitmemiş akışı zorla kapatma yalnız sahip (`needOwner`). Test: `guvenlik.test.ts` S-C3 bloğu. |
| S-C4 Idempotency ve hız sınırı yok | Critical | P1-B | açık | |
| M-C1 / D-M3 Kritik yol görünmüyor | Critical / Major | P1-A | açık | |
| D-C1 Dış paylaşım keşfedilemiyor | Critical | P1-C | açık | |
| S-M1 DB savunması yalnız Edge kodunda | Major | P0-0 (canlı, onay) → P0-C | açık | anon/authenticated yetkilerini kaldırma ayrı onaya sunulacak. |
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
| N-1 LLM anahtarları `ayar` tablosunda düz metin | P0 | P0-0 (canlı, onay) | açık | Edge secret'a taşıma ve satırları silme ayrı onaya sunulacak. Kod zaten secret'a düşüyor. |
| N-2 anon/authenticated tam tablo yetkisi | P0 | P0-0 (canlı, onay) | açık | Yetki kaldırma SQL'i ayrı onaya sunulacak. |
| N-3 Dış bağlantı belirteci düz metin + logda | P0 | P0-B | açık | |
| N-4 Üye çıkarma anahtarı iptal etmiyor | P0 | P0-A | açık | |
| N-5 Test başlıkları herkese açık | P0 | P0-0 | kapandı (kod) | 0.12.1: `x-devir-motor` / `x-devir-openai-model` yalnız `ayar.test_basliklari = 'acik'` iken dinlenir (`sunucu/index.ts`). Deno girişi birim testte yok; canlıda başlıkla istek atıp motorun değişmediği doğrulanacak. |
| N-6 Migration'lar depoda yok | P0 | P0-0 → P0-C | kısmen | 0.12.1: 12 migration canlı `schema_migrations` kaydından `supabase/migrations/` altına alındı; canlı sütunlarla karşılaştırıldı, fark yok. SQL davranış testi P0-C. |
| N-7 Talimatlar agent'a kim_tip=insan öğretiyor | P0 | P0-0 | kapandı (kod) | 0.12.1: talimat ve araç şemalarından `kim`/`kim_tip` çıktı; karar için `devir_karar_ver` (geri alınamaz işaretli). Test: "araç şemalarında kim_tip yok". |
| N-8 İki ön yüz ve elle Edge yüklemesi | P1 | P1-D, P2-C | açık | |
| N-9 Hata → HTTP kodu regex'le | P1 | P0-A | açık | |
| N-10 Dış adımlar sahip_tip=insan | P1 | P0-A, P1-C | açık | |
| N-11 `dbg.tmp.mjs` depoda | P2 | P0-0 | kapandı (kod) | 0.12.1 PR'ında silindi. |

## Paket geçmişi

| Paket | Sürüm | PR | Testler | Canlı |
|---|---|---|---|---|
| P0-0 hızlı sertleştirme | 0.12.1 | (bu PR) | sunucu 151 ✓ (yeni `guvenlik.test.ts` 25), vitest 59 ✓, build ✓, e2e 101 ✓ | yüklenmedi |
