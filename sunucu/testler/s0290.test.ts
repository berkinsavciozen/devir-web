// 0.29.0 (3 Kas, AI yapsın): agent adımı hazır olunca kişinin Claude rutini tetiklenir; çıktı bakılacak olarak gelir, tamamı sahibi verir.
import { callTool, otoUygunDegil, otoBekledigi, otoGunluk, DAY, todayIst } from "../core.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-23T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, agent_tetik: { aktif: true }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
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
const ws = { id: "w-0290" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const atis: { url: string; jeton: string; metin: string }[] = [];
const tetik = async (url: string, jeton: string, metin: string) => { atis.push({ url, jeton, metin }); return url.includes("/fail/") ? { ok: false, durum: 500, hata: "sunucu" } : { ok: true, durum: 200, oturum: "https://claude.ai/code/session_x" }; };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm, tetik }) as any;
const agentCtx = () => ({ ...ctx(), kanal: "mcp", ua: "Claude-User" }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimOf = (kod: string, no: number) => T.adim.find((s) => s.akis_id === akisOf(kod).id && s.no === no);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };


(async () => {
  // uygunluk
  ok("insan adımı AI yapsın olamaz", !!otoUygunDegil({ ad: "Rapor yaz", sahip_tip: "insan" }));
  ok("dışarıya gönderme olamaz", /gönderme/.test(otoUygunDegil({ ad: "Teklifi müşteriye gönder", sahip_tip: "agent" }) || ""));
  ok("karar olamaz", /karar/.test(otoUygunDegil({ ad: "Fiyatı onayla", sahip_tip: "agent" }) || ""));
  ok("hazırlık işi olur", otoUygunDegil({ ad: "Rakip analizini hazırla", sahip_tip: "agent" }) === null);

  let r = await callTool("devir_tasla", { cumle: "Zeytinyağı numunesini analiz ettirmem lazım", baglam: { varlik: "Ege Kooperatif", iliski: "kendi" } }, ctx());
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const no = (ad: RegExp) => adimlar(ak).find((s) => ad.test(s.ad)).no;
  const N1 = no(/Numune/), N2 = no(/Analiz/), N4 = no(/Fatura/);

  ok("insan adımında AI yapsın reddedilir", /AI yapsın olamaz/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N1, oto: true }, ctx()))));
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N2, sahip: "Analiz agent", sahip_tip: "agent", oto: true }, ctx());
  ok("tetik yokken açılır ama uyarır", adimOf(ak, N2).oto === true && /rutini yok/.test(r), r);
  ok("agent kendini otomatiğe alamaz", /agent kendini/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N2, oto: false }, agentCtx()))));

  // tetikler: Berkin'in iki agent'ı
  T.agent_tetik = [
    { id: "t1", ws_id: ws.id, kisi: "Berkin", kisi_norm: "berkin", ad: "Genel Claude", url: "https://api.anthropic.com/v1/claude_code/routines/genel/fire", jeton: "j1", aktif: true },
    { id: "t2", ws_id: ws.id, kisi: "Berkin", kisi_norm: "berkin", ad: "Analiz agent", url: "https://api.anthropic.com/v1/claude_code/routines/analiz/fire", jeton: "j2", aktif: true },
    { id: "t3", ws_id: ws.id, kisi: "Berkin", kisi_norm: "berkin", ad: "Fatura agent", url: "https://api.anthropic.com/v1/claude_code/routines/fail/fire", jeton: "j3", aktif: true },
  ];
  ok("öncül bitmeden tetiklenmez", atis.length === 0 && otoBekledigi(adimOf(ak, N2), adimlar(ak), NOW) === "öncüller");
  await callTool("devir_adim_guncelle", { akis: ak, no: N1, durum: "tamam", not: "hazır" }, ctx());
  ok("öncül bitince bir kez tetiklenir, adın eşleştiği rutin", atis.length === 1 && atis[0].url.includes("/analiz/") && atis[0].jeton === "j2", atis.map((a) => a.url));
  ok("tetik metni akış ve adımı taşır", atis[0].metin.includes(ak) && atis[0].metin.includes(`${N2}. adımı`), atis[0].metin);
  ok("adım tetiklendi, oturum kaydedildi, olay yazıldı", adimOf(ak, N2).oto_durum === "tetiklendi" && adimOf(ak, N2).oto_oturum && T.olay.some((o) => o.veri?.tur === "oto_tetik"));
  await callTool("devir_adim_guncelle", { akis: ak, no: N1, not: "ek not" }, ctx());
  ok("yeniden taramada ikinci kez tetiklenmez", atis.length === 1);
  r = await callTool("devir_akis", { akis: ak }, ctx());
  ok("akış satırında AI yapıyor", /AI yapıyor/.test(r));

  // agent işi yapar: tamam yerine bakılacak
  await callTool("devir_adim_guncelle", { akis: ak, no: N2, durum: "suruyor" }, agentCtx());
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N2, durum: "tamam", cikti: { ad: "Analiz raporu", icerik: "Asitlik 0,3" } }, agentCtx());
  ok("agent tamam diyemez: sürüyor + bakılacak", adimOf(ak, N2).durum === "suruyor" && adimOf(ak, N2).oto_durum === "bakilacak" && /bakılacak/.test(r), [adimOf(ak, N2).durum, adimOf(ak, N2).oto_durum, r]);
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N2, durum: "tamam", not: "baktım, uygun" }, ctx());
  ok("sahibi onaylayınca tamam", adimOf(ak, N2).durum === "tamam" && !adimOf(ak, N2).oto_durum, [adimOf(ak, N2).durum, adimOf(ak, N2).oto_durum, adimOf(ak, N2).oto]);

  // başarısız tetik: iki denemeden sonra engelli
  await callTool("devir_adim_guncelle", { akis: ak, no: N4, sahip: "Fatura agent", sahip_tip: "agent", oto: true }, ctx());
  ok("ilk hata: yeniden denenecek", adimOf(ak, N4).oto_durum == null && adimOf(ak, N4).oto_deneme === 1 && T.olay.some((o) => o.veri?.tur === "oto_hata"), [adimOf(ak, N4).oto_durum, adimOf(ak, N4).oto_deneme]);
  await callTool("devir_adim_guncelle", { akis: ak, no: N1, not: "tekrar" }, ctx());
  ok("ikinci hata: engelli ve nedeni", adimOf(ak, N4).durum === "engelli" && adimOf(ak, N4).oto_durum === "hata" && /AI yapsın başlatılamadı/.test(adimOf(ak, N4).engel || ""), [adimOf(ak, N4).durum, adimOf(ak, N4).engel]);

  // planlanan günü bekleyen adım ve günlük tarama
  r = await callTool("devir_adim_ekle", { akis: ak, ad: "Fiyat karşılaştırmasını hazırla", sahip: "Analiz agent", sahip_tip: "agent", kriter: "tablo hazır", neden: "eksik", sure_tahmin_gun: 1 }, ctx());
  const N5 = no(/karşılaştırma/);
  const ileri = todayIst(NOW + 10 * DAY);
  await callTool("devir_adim_guncelle", { akis: ak, no: N5, son_tarih: ileri, oto: true, oto_tarih_bekle: true }, ctx());
  const once = atis.length;
  ok("planlanan gün gelmeden tetiklenmez", atis.length === once && /planlanan gün/.test(otoBekledigi(adimOf(ak, N5), adimlar(ak), NOW) || ""), otoBekledigi(adimOf(ak, N5), adimlar(ak), NOW));
  NOW += 10 * DAY;
  T.kullanici = [{ id: ws.id }];
  const g = await otoGunluk({ db, ua: "cron", now: NOW, tetik } as any);
  ok("günlük tarama günü gelen adımı tetikler", g.tetiklenen === 1 && adimOf(ak, N5).oto_durum === "tetiklendi", g);

  // kurulumda AI yapsın: dışarıya gönderme reddedilir
  const m = await hata(() => callTool("devir_akis_olustur", { baslik: "Teklif", adimlar: [{ ad: "Teklifi hazırla", sahip: "Teklif agent", sahip_tip: "agent", kriter: "hazır", oto: true }, { ad: "Teklifi müşteriye gönder", sahip: "Teklif agent", sahip_tip: "agent", kriter: "gitti", oto: true, bagimli: [1] }] }, ctx()));
  ok("kurulumda gönderme adımı AI yapsın olamaz", /2 \(Teklifi müşteriye gönder\) AI yapsın olamaz/.test(m), m);

  console.log(hata0 ? `\n${hata0} hata` : "\n0.29.0 testleri geçti");
  if (hata0) process.exitCode = 1;
})();
