// 0.26.0 (S2, 23 Eki test bulguları): çoklu seçim cevapları (C2), zorunlu işler ve kartlar (M5), soru-adım bağı (M6),
// taslak düzeltme ve kurulu adımın tanımı (M8), kısa ad yanıtlarda (m1), dil (m2), sahiplik (m3), benzer iş (m5), karar/çıktı alanları (K11, N17).
import { callTool, planGirdisi, agacSirasi } from "../core.ts";

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
const ws = { id: "w-w5" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
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

  // ekleme
  r = await callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: [{ ad: "Laboratuvar seç" }, { ad: "Numuneyi gönder", sahip: "Kargo", sahip_tip: "dis" }, "Raporu al"] }, ctx());
  const al = adimlar(ak).filter((s) => s.ust_adim === N2);
  ok("üç alt görev eklendi, üstü 2. adım", al.length === 3 && /\+ 3 alt görev eklendi/.test(r), r);
  ok("alt görev üstün öncüllerini bekler", al.every((s) => JSON.stringify(s.bagimli) === JSON.stringify([N1])), al.map((s) => s.bagimli));
  ok("sahip verilmezse üstün sahibi; verilirse kendi", al[0].sahip === "Berkin" && al[1].sahip === "Kargo" && al[1].sahip_tip === "dis", al.map((s) => s.sahip));
  ok("öncülü bitmediği için sırada", al.every((s) => s.durum === "sirada"), al.map((s) => s.durum));
  ok("aynı adlı alt görev reddedilir", /zaten var/.test(await hata(() => callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: ["raporu al"] }, ctx()))));
  ok("alt görevin alt görevi olmaz", /alt görevin alt görevi olmaz/.test(await hata(() => callTool("devir_alt_gorev", { akis: ak, adim: al[0].no, alt_gorevler: ["x"] }, ctx()))));
  ok("boş liste reddedilir", /alt_gorevler gerekli/.test(await hata(() => callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: [] }, ctx()))));

  // akış görünümü
  r = await callTool("devir_akis", { akis: ak }, ctx());
  const L = r.split("\n"), i2 = L.findIndex((l) => new RegExp(`^. ${N2}\\. Analizi yaptır`).test(l));
  ok("üst görevin satırında alt görev sayısı", / · alt görev 0\/3/.test(L[i2]), L[i2]);
  ok("alt görevler üstünün hemen altında, girintili", L.slice(i2 + 1, i2 + 4).every((l) => l.startsWith("  ↳ ")) && !/sonradan eklendi/.test(L[i2 + 1]), L.slice(i2, i2 + 5));

  // öncül biter → alt görevler hazır
  await callTool("devir_adim_guncelle", { akis: ak, no: N1, durum: "tamam", not: "hazır" }, ctx());
  ok("öncül bitince alt görevler hazır", adimlar(ak).filter((s) => s.ust_adim === N2).every((s) => s.durum === "hazir"));
  ok("üst görev alt görevleri bitmeden tamamlanmaz", /alt görevleri bitmeden tamamlanmaz/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: N2, durum: "tamam" }, ctx()))));
  await callTool("devir_adim_guncelle", { akis: ak, no: al[0].no, durum: "suruyor" }, ctx());
  ok("alt görev başlayınca üst görev sürüyor", adimOf(ak, N2).durum === "suruyor" && adimOf(ak, N2).ilerleme === "0/3 alt görev bitti", adimOf(ak, N2));
  r = await callTool("devir_adim_oku", { akis: ak, no: al[0].no }, ctx());
  ok("alt görevi okurken üst görev söylenir", new RegExp(`Üst görev: ${N2}\\. Analizi yaptır`).test(r), r.split("\n").filter((l) => /Üst/.test(l)));
  r = await callTool("devir_adim_oku", { akis: ak, no: N2 }, ctx());
  ok("üst görevi okurken alt görevler sayılır", /Alt görevler \(0\/3 bitti\)/.test(r));
  await callTool("devir_adim_guncelle", { akis: ak, no: al[0].no, durum: "tamam", not: "seçildi" }, ctx());
  await callTool("devir_adim_guncelle", { akis: ak, no: al[1].no, durum: "atlandi", not: "elden götürüldü", atlama_nedeni: "gerek_kalmadi" }, ctx());
  ok("ilerleme alt görevlerden", adimOf(ak, N2).ilerleme === "2/3 alt görev bitti", adimOf(ak, N2).ilerleme);
  r = await callTool("devir_adim_guncelle", { akis: ak, no: al[2].no, durum: "tamam", not: "rapor geldi" }, ctx());
  ok("son alt görev bitince üst görev kendiliğinden tamam", adimOf(ak, N2).durum === "tamam" && /alt görevlerin hepsi bitti/.test(r), r);
  ok("üst görev bitince ardılları açılır", adimOf(ak, N3).durum === "hazir" && adimOf(ak, N4).durum === "hazir");
  ok("biten adıma alt görev eklenmez", /alt görev eklenemez/.test(await hata(() => callTool("devir_alt_gorev", { akis: ak, adim: N2, alt_gorevler: ["yeni"] }, ctx()))));

  // karar adımı: alt görevler bitince kendiliğinden kapanmaz
  await callTool("devir_alt_gorev", { akis: ak, adim: N3, alt_gorevler: ["Rakip fiyatlarını topla"] }, ctx());
  const k1 = adimlar(ak).find((s) => s.ust_adim === N3);
  r = await callTool("devir_adim_guncelle", { akis: ak, no: k1.no, durum: "tamam", not: "toplandı" }, ctx());
  ok("karar adımı alt görevlerle kapanmaz, kullanıcıya bırakılır", adimOf(ak, N3).durum !== "tamam" && /kararı beklendiği için adımı sen tamamla/.test(r), r);

  // sıralı alt görevler; üst görev atlanınca açık alt görevler de
  await callTool("devir_alt_gorev", { akis: ak, adim: N4, alt_gorevler: ["Taslak faturayı yaz", "Faturayı onaylat"], sirali: true }, ctx());
  const f = adimlar(ak).filter((s) => s.ust_adim === N4);
  ok("sıralı alt görev öncekini bekler", f[1].bagimli.includes(f[0].no) && f[1].durum === "sirada" && f[0].durum === "hazir", f.map((s) => [s.bagimli, s.durum]));
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N4, durum: "atlandi", not: "fatura alıcıda kesilecek", atlama_nedeni: "gerek_kalmadi" }, ctx());
  ok("üst görev atlanınca açık alt görevler de atlanır", adimlar(ak).filter((s) => s.ust_adim === N4).every((s) => s.durum === "atlandi") && /↳ – /.test(r), r);

  // plan girdisi ve ağaç sırası
  const P = planGirdisi([{ no: 1, bagimli: [] }, { no: 2, bagimli: [1] }, { no: 5, bagimli: [1], ust_adim: 2, durum: "hazir" }] as any[]);
  ok("plan: üst görev alt görevlerini bekler ve geçittir", JSON.stringify(P[1].bagimli) === "[1,5]" && (P[1] as any)._altAcik === true);
  ok("ağaç sırası: alt görev üstünün ardından", agacSirasi([{ no: 1 }, { no: 2 }, { no: 3 }, { no: 4, ust_adim: 1 }] as any[]).map((x) => x.no).join() === "1,4,2,3");

  console.log(hata0 ? `\n${hata0} hata` : "\nW5 testleri geçti");
  if (hata0) process.exitCode = 1;
})();
