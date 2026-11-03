// 0.28.2 (3 Kas, NM8R): hedefsiz akış açık soru tutar, taslak + kendi adımlar birlikte kurulur,
// varlık adı parantezli de olsa açık taslak kapanır ve 24 saatlik mükerrer uyarısı çalışır.
import { callTool, varlikAyni } from "../core.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-03T12:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [] }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
  async delete(t: string, w: any) { T[t] = (T[t] || []).filter((r) => !match(r, w)); },
};
let hata = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata++; };
const ws = { id: "w-0282" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum" }) as any;
const ADIMLAR = [
  { ad: "Fizibilite tasarımını hazırla", sahip: "Claude", sahip_tip: "agent", kriter: "tasarım hazır", sure_tahmin_gun: 4 },
  { ad: "Tasarımı onayla", sahip: "Berkin", sahip_tip: "insan", kriter: "onaylandı", sure_tahmin_gun: 1, bagimli: [1], karar_kriteri: "tutarlı mı" },
  { ad: "Sistemi hazır ilan et", sahip: "Berkin", sahip_tip: "insan", kriter: "ilan edildi", sure_tahmin_gun: 1, bagimli: [2] },
];
const taslakEkle = async (kod: string, musteri: string) => (await db.insert("taslak", [{ kisa_kod: kod, ws_id: ws.id, baglam: { musteri, iliski: "kendi" }, taslak: { baslik: "Faz 1 hazırlığı", hedef_tarih: null, anahtar_varlik: { ad: musteri }, adimlar: [] }, sorular: {} }]))[0];

(async () => {
  ok("varlık: parantez içi açıklama atılır", varlikAyni("E-ticaret sistemi", "E-ticaret sistemi (Çin ithalat → TR pazaryeri)"));
  ok("varlık: farklı varlık eşleşmez", !varlikAyni("Ege Kooperatif", "Karadeniz Kooperatif"));
  ok("varlık: baş eşleşmesi yalnız istenince", !varlikAyni("E-ticaret sistemi", "E-ticaret sistemi kurulumu") && varlikAyni("E-ticaret sistemi", "E-ticaret sistemi kurulumu", true));

  // 1) NM8R yolu: taslak verilmeden elle kurulum; parantezli varlığın açık taslağı kapanır, hedef açık soru olur
  await taslakEkle("TALP7", "E-ticaret sistemi (Çin ithalat → TR pazaryeri)");
  let r = await callTool("devir_akis_olustur", { baslik: "E-ticaret karar destek sistemi", baglam: { varlik: "E-ticaret sistemi", iliski: "kendi" }, adimlar: ADIMLAR }, ctx());
  const a1 = T.akis[T.akis.length - 1];
  ok("hedefsiz akış: hedef_tarih açık soru", a1.hedef_tarih == null && a1.baglam?.bekleyen?.hedef_tarih?.tip === "tarih", a1.baglam?.bekleyen);
  ok("hedefsiz akış: yanıt hedefi sormayı söyler", /Hedef tarih yok/.test(r) && /\[hedef_tarih\]/.test(r), r.slice(0, 600));
  ok("parantezli varlığın açık taslağı iptal", T.taslak.find((x) => x.kisa_kod === "TALP7")?.durum === "iptal");

  // 2) aynı işin ikinci kurulumu (9VJS yolu): parantezli varlık adıyla da mükerrer uyarısı
  let dup = "";
  try { await callTool("devir_akis_olustur", { baslik: "Faz 1 hazırlığı", baglam: { varlik: "E-ticaret sistemi (Çin ithalat → TR pazaryeri)" }, adimlar: ADIMLAR }, ctx()); } catch (e) { dup = (e as Error).message; }
  ok("mükerrer uyarısı parantezli adla da çalışır", /son 24 saatte kurulmuş aktif akış var/.test(dup), dup);

  // 3) hedef sonradan: devir_cevapla hedef_tarih
  r = await callTool("devir_cevapla", { akis: a1.kisa_kod, soru: "hedef_tarih", cevap: "2026-12-27" }, ctx());
  const a1b = T.akis.find((x) => x.id === a1.id);
  ok("hedef tarih sonradan yazılır", a1b.hedef_tarih === "2026-12-27" && !a1b.baglam?.bekleyen?.hedef_tarih, { h: a1b.hedef_tarih, b: a1b.baglam?.bekleyen });
  ok("hedef gelince son tarihler planlanır", T.adim.filter((x) => x.akis_id === a1.id).every((x) => !!x.son_tarih));

  // 4) taslak + kendi adımlar birlikte: hedef cevaptan, taslak kuruldu, akış taslağa bağlı
  const t2 = await taslakEkle("TQ2Z8", "Yeni pazar araştırması");
  r = await callTool("devir_akis_olustur", { taslak: "TQ2Z8", cevaplar: { hedef_tarih: "2027-01-15" }, baslik: "Pazar araştırması", adimlar: ADIMLAR }, ctx());
  const a2 = T.akis[T.akis.length - 1];
  ok("taslak+adımlar: hedef cevaptan", a2.hedef_tarih === "2027-01-15", a2.hedef_tarih);
  ok("taslak+adımlar: akış taslağa bağlı, varlık taslaktan", a2.taslak_id === t2.id && a2.baglam?.musteri === "Yeni pazar araştırması" && a2.baglam?.taslak === "TQ2Z8", { t: a2.taslak_id, b: a2.baglam?.musteri });
  ok("taslak+adımlar: taslak kuruldu", T.taslak.find((x) => x.id === t2.id)?.durum === "kuruldu");
  ok("taslak+adımlar: 3 adım kuruldu", T.adim.filter((x) => x.akis_id === a2.id).length === 3);
  let iki = "";
  try { await callTool("devir_akis_olustur", { taslak: "TQ2Z8", baslik: "x", adimlar: ADIMLAR, baglam: { varlik: "başka" } }, ctx()); } catch (e) { iki = (e as Error).message; }
  ok("kurulmuş taslaktan ikinci akış yok", /zaten akış kuruldu/.test(iki), iki);

  if (hata) { console.log(`${hata} hata`); process.exit(1); }
  console.log("0.28.2 testleri tamam");
})();
