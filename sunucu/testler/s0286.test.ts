// 0.28.6 (3 Kas, NM8R bulguları 2, 3, 5, 6, 9): karar sezgisi fiile bakar, şemada ust_adim/karar_gerekli, çoklu alt görev,
// zincir bağımlılıktan, ertelenen sayılmaz, ilgili karar hatırlatması, takvimi yeniden kur.
import { callTool, kararAdimi, altSayim, ilgiliKararlar, todayIst, DAY } from "../core.ts";
import { bitis } from "../plan.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-23T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [] }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };

const taslak = () => ({
  is_turu: { kod: "numune", ad: "Numune ve analiz", mevcut: false }, baslik: "Zeytinyağı numune analizi", kisa_ad: "Numune analizi", anahtar_varlik: { tur: "kooperatif", ad: "Ege Kooperatif" },
  roller: [{ kod: "ben", ad: "Kooperatif müdürü", tip: "insan", kisi: "Berkin" }, { kod: "lab", ad: "Laboratuvar", tip: "dis", kisi: "Lab" }],
  sorular: [], varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "numune", ad: "Numuneyi hazırla", sahip_rol: "ben", kriter: "numune hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a2", tur_kod: "analiz", ad: "Analizi yaptır", sahip_rol: "ben", kriter: "analiz bitti", sure_tahmin_gun: 2, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a3", tur_kod: "fiyat-karari", ad: "Fiyat kararını ver", sahip_rol: "ben", kriter: "fiyat belli", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "karar", karar_gerekli: true, cikti_bekleniyor: false },
    { id: "a4", tur_kod: "fatura", ad: "Faturayı kes", sahip_rol: "ben", kriter: "fatura kesildi", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0286" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimOf = (kod: string, no: number) => T.adim.find((s) => s.akis_id === akisOf(kod).id && s.no === no);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };


(async () => {
  // (2) karar sezgisi: iş fiili karar sayılmaz, karar fiili sayılır
  const K = (ad: string) => kararAdimi({ ad });
  ok("'Onay merkezini geliştir' karar değil", !K("Onay merkezini geliştir"));
  ok("'Ödeme modülünü kur' karar değil", !K("Ödeme modülünü kur"));
  ok("'Ödeme ekranını tasarla' karar değil", !K("Ödeme ekranını tasarla"));
  ok("'Fiyatı onayla' karar", K("Fiyatı onayla"));
  ok("'Ödeme kararını ver' karar", K("Ödeme kararını ver"));
  ok("'Sözleşmeyi imzala' karar", K("Sözleşmeyi imzala"));
  ok("'Onay akışını kur ve onayla' karar (karar fiili var)", K("Onay akışını kur ve onayla"));
  ok("karar_gerekli: false sezgiyi ezer", !kararAdimi({ ad: "Fiyatı onayla", karar_gerekli: false }));

  let r = await callTool("devir_tasla", { cumle: "Zeytinyağı numunesini analiz ettirmem lazım", baglam: { varlik: "Ege Kooperatif", iliski: "kendi" } }, ctx());
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const no = (ad: RegExp) => adimlar(ak).find((s) => ad.test(s.ad)).no;
  const N1 = no(/Numune/), N2 = no(/Analiz/), N4 = no(/Fatura/);

  { const m = await hata(() => callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: [{ ad: "Fiyatı onayla", sahip: "Analiz agent", sahip_tip: "agent" }] }, ctx()));
    ok("ret mesajı çıkış yolunu söyler", /karar_gerekli: false/.test(m), m); }
  r = await callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: [{ ad: "Onay ekranını geliştir", sahip: "Analiz agent", sahip_tip: "agent", sure_tahmin_gun: 1 }] }, ctx());
  ok("iş fiilli 'onay' adımı agent'a verilir", adimlar(ak).some((s) => s.ad === "Onay ekranını geliştir" && s.sahip_tip === "agent"), r);

  // (3) akis_olustur şeması ust_adim, karar_gerekli, cikti_bekleniyor alanlarını gösterir
  const { TOOLS } = await import("../core.ts");
  const ao = (TOOLS as any[]).find((t) => t.name === "devir_akis_olustur").inputSchema.properties.adimlar.items.properties;
  ok("şemada ust_adim, karar_gerekli, cikti_bekleniyor", !!(ao.ust_adim && ao.karar_gerekli && ao.cikti_bekleniyor));

  // (3) çoklu üst adıma tek çağrıda alt görev
  r = await callTool("devir_alt_gorev", { akis: ak, gruplar: [
    { adim: N1, alt_gorevler: [{ ad: "Şişeyi etiketle", sure_tahmin_gun: 0.5 }, { ad: "Numuneyi paketle", sure_tahmin_gun: 0.5 }], sirali: true },
    { adim: N4, alt_gorevler: [{ ad: "Fatura bilgisini topla", sure_tahmin_gun: 0.5 }] },
  ] }, ctx());
  ok("iki üst adıma toplam 3 alt görev", adimlar(ak).filter((s) => s.ust_adim === N1).length === 2 && adimlar(ak).filter((s) => s.ust_adim === N4).length === 1, r);
  ok("grup başına sıralı: ikinci birinciyi bekler", (() => { const k = adimlar(ak).filter((s) => s.ust_adim === N1); return k[1].bagimli.includes(k[0].no); })());
  ok("aynı üst adım iki kez reddedilir", /bir kez/.test(await hata(() => callTool("devir_alt_gorev", { akis: ak, gruplar: [{ adim: N1, alt_gorevler: ["x"] }, { adim: N1, alt_gorevler: ["y"] }] }, ctx()))));
  ok("150 üstü reddedilir", /150/.test(await hata(() => callTool("devir_alt_gorev", { akis: ak, gruplar: [{ adim: N1, alt_gorevler: Array.from({ length: 151 }, (_, i) => `g${i}`) }] }, ctx()))));
  r = await callTool("devir_alt_gorev", { akis: ak, gruplar: [{ adim: N4, alt_gorevler: ["Faturayı gönder"] }, { adim: 99, alt_gorevler: ["x"] }] }, ctx());
  ok("ikinci grup hata verirse birincisi kalır, hata söylenir", /Adım 99/.test(r) && adimlar(ak).some((s) => s.ad === "Faturayı gönder"), r);

  // (6) ertelenen alt görev bitmiş sayılmaz
  ok("altSayim: ertelenen ayrı", altSayim([{ durum: "tamam" }, { durum: "ertelendi" }, { durum: "hazir" }]).metin === "1/3 · 1 ertelendi");
  const kN4 = adimlar(ak).filter((s) => s.ust_adim === N4);
  await callTool("devir_adim_guncelle", { akis: ak, no: kN4[0].no, durum: "ertelendi", not: "sonra" }, ctx());
  r = await callTool("devir_akis", { akis: ak }, ctx());
  ok("akış satırında ertelenen ayrı sayılır", /alt görev 0\/2 · 1 ertelendi/.test(r), r.split("\n").filter((l: string) => /alt görev/.test(l)));

  // (9) ilgili karar hatırlatması
  ok("ilgiliKararlar kelime köküyle eşler", ilgiliKararlar([{ karar: "Laboratuvar olarak yalnız akredite laboratuvarlar kullanılır" }, { karar: "Komisyon yüzde on" }], "Laboratuvarı seç").length === 1);
  await callTool("devir_karar", { varlik: "Ege Kooperatif", karar: "Analizler yalnız akredite laboratuvarlarda yapılır" }, ctx());
  r = await callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: [{ ad: "Laboratuvarı seç", sure_tahmin_gun: 0.5 }] }, ctx());
  ok("yeni alt görevde ilgili karar hatırlatılır", /ilgili olabilecek geçerli kararlar/.test(r) && /akredite/.test(r), r);
  const lab = adimlar(ak).find((s) => s.ad === "Laboratuvarı seç").no;
  r = await callTool("devir_adim_guncelle", { akis: ak, no: lab, sahip: "Lab", sahip_tip: "dis" }, ctx());
  ok("sahip dışarıya geçince karar hatırlatılır", /Sahip değişti/.test(r) && /akredite/.test(r), r);
  r = await callTool("devir_adim_ekle", { akis: ak, ad: "Kargoyu ayarla", sahip: "Berkin", kriter: "kargo hazır", neden: "unutulmuş" }, ctx());
  ok("ilgisiz adımda hatırlatma yok", !/geçerli kararlar/.test(r), r);

  // takvimi yeniden kur: önizleme yazmaz, uygula yazar
  ok("hedefsiz akışta takvim yenilenmez", /hedef tarihi yok/.test(await hata(() => callTool("devir_takvim_yenile", { akis: ak }, ctx()))));
  akisOf(ak).hedef_tarih = todayIst(NOW + 30 * DAY);
  const once = adimlar(ak).map((s) => [s.no, s.son_tarih]);
  r = await callTool("devir_takvim_yenile", { akis: ak }, ctx());
  ok("önizleme değişiklikleri listeler, yazmaz", /önizleme/.test(r) && JSON.stringify(adimlar(ak).map((s) => [s.no, s.son_tarih])) === JSON.stringify(once), r);
  r = await callTool("devir_takvim_yenile", { akis: ak, uygula: true }, ctx());
  ok("uygula yeni tarihleri yazar ve olaya geçer", /yeniden planlandı/.test(r) && adimlar(ak).filter((s) => !["tamam", "atlandi", "ertelendi"].includes(s.durum)).every((s) => s.son_tarih) && T.olay.some((o) => o.veri?.tur === "takvim_yenile"), r);
  r = await callTool("devir_takvim_yenile", { akis: ak }, ctx());
  ok("ikinci kez: takvim güncel", /zaten güncel/.test(r), r);
  { const k = adimlar(ak).filter((s) => s.ust_adim === N2), u = adimOf(ak, N2); ok("alt görevler üstünü aşmaz", k.filter((s) => s.son_tarih).every((s) => s.son_tarih <= u.son_tarih), [u.son_tarih, k.map((s) => s.son_tarih)]); }

  // (5) zincir kişi sırası değil bağımlılık zinciri
  const N = Date.parse("2026-11-03T09:00:00+03:00"), iso = new Date(N).toISOString();
  const A = (no: number, x: any) => ({ id: no, no, ad: `A${no}`, sahip: "Berkin", sahip_tip: "insan", durum: "hazir", bagimli: [], sure_tahmin_gun: 1, sure_kaynak: "kullanici", created_at: iso, durum_at: iso, ...x });
  const b = bitis({ created_at: iso, kurallar: {}, baglam: {} }, [A(1, { sure_tahmin_gun: 5 }), A(2, { sure_tahmin_gun: 1 }), A(3, { sahip: "Agent", sahip_tip: "agent", bagimli: [2], durum: "sirada" })], [], N);
  ok("zincir en uzun bağımlılık yolu (5 günlük iş), kişi sırası değil", JSON.stringify(b.zincir) === "[1]", b.zincir);

  console.log(hata0 ? `\n${hata0} hata` : "\n0.28.6 testleri geçti");
  if (hata0) process.exitCode = 1;
})();
