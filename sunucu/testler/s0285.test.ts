// 0.28.5 (3 Kas, NM8R): kurulu adımın süresi ve bağımlılığı düzeltilir, süresiz alt görev uyarısı, alt görevin son tarihi üstünü aşmaz.
import { callTool, takvim } from "../core.ts";

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
const ws = { id: "w-0285" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimOf = (kod: string, no: number) => T.adim.find((s) => s.akis_id === akisOf(kod).id && s.no === no);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };


(async () => {
  let r = await callTool("devir_tasla", { cumle: "Zeytinyağı numunesini analiz ettirmem lazım", baglam: { varlik: "Ege Kooperatif", iliski: "kendi" } }, ctx());
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const no = (ad: RegExp) => adimlar(ak).find((s) => ad.test(s.ad)).no;
  const N1 = no(/Numune/), N2 = no(/Analiz/), N3 = no(/Fiyat/), N4 = no(/Fatura/);

  // (b) süresiz alt görev uyarısı
  r = await callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: [{ ad: "Laboratuvar seç", sure_tahmin_gun: 0.5 }, "Raporu al"] }, ctx());
  const al = adimlar(ak).filter((s) => s.ust_adim === N2);
  ok("süresiz alt görev için uyarı, numarasıyla", /1 alt görevde \(\d+\) süre yok/.test(r) && /sure_tahmin_gun/.test(r), r);
  r = await callTool("devir_alt_gorev", { akis: ak, adim: N4, alt_gorevler: [{ ad: "Faturayı hazırla", sure_tahmin_gun: 1 }] }, ctx());
  ok("süresi olan alt görevde uyarı yok", !/süre yok/.test(r), r);

  // (a) süre düzeltme
  const k2 = al[1].no;
  r = await callTool("devir_adim_guncelle", { akis: ak, no: k2, sure_tahmin_gun: 1.5 }, ctx());
  ok("süre yazıldı", adimOf(ak, k2).sure_tahmin_gun === 1.5 && /süre → 1.5 gün/.test(r), r);
  ok("süre olayı kaydedildi", T.olay.some((o) => o.adim_no === k2 && /süre → 1.5 gün/.test(o.ozet)));
  ok("geçersiz süre reddedilir", /0'dan büyük/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: k2, sure_tahmin_gun: 0 }, ctx()))));
  ok("aynı süre: güncellenecek bir şey yok", /Güncellenecek bir şey yok/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: k2, sure_tahmin_gun: 1.5 }, ctx()))));

  // (a) bağımlılık düzeltme
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N4, bagimli: [N1] }, ctx());
  ok("bağımlılık değişti, eskisi olayda", JSON.stringify(adimOf(ak, N4).bagimli) === JSON.stringify([N1]) && new RegExp(`bağımlılık → ${N1} \\(önce: ${N2}\\)`).test(r), r);
  ok("döngü reddedilir", /döngü/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N1, bagimli: [N3] }, ctx()))));
  ok("alt görev üstünü bekleyemez", /üst görevini bekleyemez/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: k2, bagimli: [N2] }, ctx()))));
  ok("üst görev alt görevini bekleyince döngü", /döngü/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N1, bagimli: [k2] }, ctx()))));
  ok("olmayan adım reddedilir", /99 numaralı adım yok/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N4, bagimli: [99] }, ctx()))));
  ok("kendini bekleyemez", /kendini bekleyemez/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N4, bagimli: [N4] }, ctx()))));
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N4, bagimli: [] }, ctx());
  ok("boş liste bağımlılığı kaldırır, adım hazır olur", adimOf(ak, N4).bagimli.length === 0 && adimOf(ak, N4).durum === "hazir", [adimOf(ak, N4).bagimli, adimOf(ak, N4).durum]);
  const dis = { ...ctx(), key: { id: "k9", kisi: "Lab", rol: "dis" }, kanal: "dis" };
  { const m = await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N4, sure_tahmin_gun: 3 }, dis)); ok("dış katılımcı süre değiştiremez", !!m && adimOf(ak, N4).sure_tahmin_gun !== 3, m); }

  // (c) geri planlama: alt görevin son tarihi üst görevini aşmaz
  const P = () => [
    { no: 1, ad: "Başla", bagimli: [], sure_tahmin_gun: 1, son_tarih: null },
    { no: 2, ad: "Üst", bagimli: [1], sure_tahmin_gun: 5, son_tarih: null },
    { no: 3, ad: "Son", bagimli: [2], sure_tahmin_gun: 4, son_tarih: null },
    { no: 4, ad: "Alt a", ust_adim: 2, bagimli: [1], sure_tahmin_gun: 2, son_tarih: null },
    { no: 5, ad: "Alt b", ust_adim: 2, bagimli: [1, 4], sure_tahmin_gun: 1, son_tarih: null },
  ];
  const bugun = Math.floor(Date.parse("2026-11-03T00:00:00Z") / 864e5);
  const s1 = P(); takvim(s1, "2026-12-31", bugun, []);
  const t = (n: number) => s1.find((x) => x.no === n)!.son_tarih!;
  ok("alt görevler üst görevden sonra değil", t(4) <= t(2) && t(5) <= t(2), s1.map((x) => [x.no, x.son_tarih]));
  ok("alt görev zinciri: a, b'den önce", t(4) < t(5), [t(4), t(5)]);
  ok("üst görev sonraki adımdan önce", t(2) < t(3) && t(3) === "2026-12-31", [t(2), t(3)]);
  ok("başlangıç alt görevlerden önce", t(1) < t(4), [t(1), t(4)]);
  const s2 = P(); s2[1].son_tarih = "2026-11-20" as any; takvim(s2, "2026-12-31", bugun, []);
  ok("sabit tarihli üst görev alt görevleri de çeker", s2.filter((x: any) => x.ust_adim === 2).every((x) => x.son_tarih! <= "2026-11-20"), s2.map((x) => [x.no, x.son_tarih]));

  console.log(hata0 ? `\n${hata0} hata` : "\n0.28.5 testleri geçti");
  if (hata0) process.exitCode = 1;
})();
