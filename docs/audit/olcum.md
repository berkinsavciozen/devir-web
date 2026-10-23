# Devir ölçüm ve sertleştirme (P1-D, S-M4 / N-8)

## Gecikme bütçesi (p95)

Kaynak: Supabase Logs, `function_edge_logs` (Logs Explorer ya da MCP `query_logs`, ClickHouse SQL). Haftalık bakılır.

```sql
select
  multiIf(match(log_attributes['request.pathname'], '/api/v1/tasla$'), 'POST tasla (LLM)',
          match(log_attributes['request.pathname'], '/api/v1/'), concat(log_attributes['request.method'], ' api'),
          match(log_attributes['request.pathname'], '/l$'), 'bağlantı', 'mcp/diğer') as tur,
  count() as n,
  quantile(0.5)(toInt32OrZero(log_attributes['execution_time_ms'])) as p50,
  quantile(0.95)(toInt32OrZero(log_attributes['execution_time_ms'])) as p95,
  max(toInt32OrZero(log_attributes['execution_time_ms'])) as en_cok,
  countIf(toInt32OrZero(log_attributes['response.status_code']) >= 500) as hata5xx
from logs
where source = 'function_edge_logs' and timestamp > now() - interval 7 day
group by tur order by n desc
```

İlk ölçüm (23 Eki 2026, 0.21.0; log saklama süresi 1 gün olduğundan son 24 saat, 1 043 istek, 5xx 0):

| Tür | İstek | p50 ms | p95 ms | En çok ms | Bütçe p95 |
|---|---|---|---|---|---|
| GET api | 497 | 1 032 | 3 183 | 6 525 | 1 500 |
| OPTIONS api | 484 | 410 | 1 155 | 2 619 | (önbellekle düşmeli) |
| MCP | 59 | 2 578 | 5 174 | 49 467 | 4 000 (LLM'li araçlar hariç) |
| POST api | 3 | 857 | 1 789 | 1 893 | 2 000 |

Bulgular:
- İsteklerin yarısı tarayıcının ön denetimi (OPTIONS). 0.23.0 `Access-Control-Max-Age` gönderir; Chrome bunu 2 saat, Firefox 24 saat önbellekler. Yüklemeden sonraki haftada OPTIONS sayısı GET'in çok altına inmeli.
- GET api p95 bütçenin iki katı. Ana pay soğuk başlangıç ve akış başına ayrı sorgular. Ölçüm 0.23.0'dan sonra tekrarlanacak, aşım sürerse P2-C'de sorgu birleştirme.
- MCP'deki 49 sn tek istek: taslak motoru (LLM). LLM'li araçlar MCP bütçesine sayılmaz.

## Sürüm uyumu (N-8)

- `/api/v1/durum` → `{ surum, sema: { beklenen, canli, uyumlu } }`. `beklenen` kodun beklediği son migration, `canli` veritabanındaki `devir_sema()`.
- `uyumlu: false` → kod yüklendi ama migration uygulanmadı (ya da tersi). `null` → bellek DB'si (testler, sahte kip).
- Web `src/api/surum.ts` içindeki `SUNUCU_SURUMU`'nu bekler; Ayarlar > Bağlantı denetimi sunucu daha eskiyse "Edge kodu yüklenmeli", şema uyumsuzsa "migration bekleniyor" der.
- Testler: `SUNUCU_SURUMU = SURUM` (vitest), `SEMA = son migration dosyası` (sunucu), `devir_sema() = son migration` (`scripts/sql-test.sh`). Her yeni migration `devir_sema()`'yı kendi adıyla yeniden yazar.

## Veritabanı danışmanı (23 Eki)

| Bulgu | Durum |
|---|---|
| 11 indekssiz yabancı anahtar | `20261023100000_p1d_fk_indeks` ekler; `sertlestirme.test.sql` her FK'nın kapsayan indeksi olduğunu ve public işlevlerin arama yolunun sabit olduğunu denetler |
| `devir_norm` arama yolu sabit değil | aynı migration `search_path = ''` |
| `pg_net` public şemada | Uzantı taşınamaz; düşürülüp `extensions` şemasında yeniden kurulmalı. Canlıda silme olduğu için ayrı onayla (aşağıda) |
| Sızmış parola koruması kapalı | Devir parola kullanmıyor (e-posta bağlantısı); etkisi yok, panelden açılabilir |
| 5 kullanılmayan indeks | Veri az; kaldırılmadı, büyüyünce yeniden bakılır |
| 24 tabloda RLS açık, politika yok | Bilerek: istemci rollerinin yetkisi yok (S-M1), yalnız Edge service_role ile |

`pg_net` taşıma (Berkin onayıyla, istek kuyruğu boşken):

```sql
drop extension if exists pg_net;
create extension pg_net with schema extensions;
```

`net.http_get` / `net._http_response` adları değişmez (işlevler `net` şemasında); canlı test yöntemi aynı kalır.

## Yayın kapısı (S-M3)

- CI `e2e` işi: ekran çekimleri dışındaki bütün Playwright testleri (sahte kip, gerçek sunucu kodu), CI'da bir yeniden deneme; yeniden denenip geçen test raporda "flaky" yazar.
- Gece işi (`gece.yml`, 04:30 TSİ): tam e2e + ekran çekimleri artefakt (14 gün). Tasarım karşılaştırması yerelde `npm run karsilastir`.
- Pages yayını zaten `CI` yeşilse (P0-C).
- Berkin'de: ana dal kuralına `e2e`'yi zorunlu kontrol olarak eklemek. Workers Builds dal derlemelerinde hep kırmızı (her PR'da); Cloudflare'de dal derlemelerini kapatmak ya da Workers'ı Actions'tan CI'dan sonra yayımlamak (bir `CLOUDFLARE_API_TOKEN` secret'ı ister).
