import { callTool } from "../core.ts";
import { kokler } from "../bellek.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-14T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada" }, akis: { durum: "aktif" }, taslak: { durum: "acik" }, ders: { durum: "aday", kanit_sayi: 1, uygulandi: 0, atlandi: 0, guven: 0.5 }, standart_surec: { durum: "aktif" } };
const db: any = {
  async one(t: string, w: any) { return (T[t] || []).find((r) => match(r, w)) || null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x; },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
// sahte gömme: kök torbası → 256 boyutlu hash
const gom = async (m: string[]) => m.map((x) => { const v = new Array(256).fill(0); for (const k of kokler(x)) { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; v[h % 256] += 1; } return v; });
let SON_USER = "";
let TASLAK_ADIM_SIZMA = false; // motor dersi uygulasın mı
let TASLAK_MODEL = "sahte"; // P1-E madde 11: yedek motor etiketi
const plan = () => ({
  is_turu: { kod: "banka-entegrasyonu", ad: "Banka entegrasyonu", mevcut: false }, baslik: "Ege Bank ödeme entegrasyonu", hedef_tarih: null, anahtar_varlik: { tur: "sirket", ad: "Ege Bank" },
  roller: [{ kod: "ben", ad: "Berkin", tip: "insan", kisi: "Berkin" }, { kod: "banka", ad: "Ege Bank BT", tip: "dis" }, { kod: "dev", ad: "Geliştirici agent", tip: "agent" }],
  sorular: [
    { kod: "hedef_tarih", boyut: "zaman", soru: "Canlı tarihi?", neden: "", tip: "tarih", varsayilan: "", guven: 0.2, cikarilabilir: false, etki: 1, ne_zaman: "simdi" },
    { kod: "test_ortami", boyut: "girdi", soru: "Test ortamı hazır mı?", neden: "", tip: "secim", secenekler: [{ deger: "evet" }, { deger: "hayir" }], varsayilan: "evet", guven: 0.6, cikarilabilir: false, etki: 2, ne_zaman: "simdi" },
  ],
  varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "api-dokuman", ad: "API dokümanını al", sahip_rol: "ben", kriter: "alındı", sure_tahmin_gun: 2, bagimli: [], boyut: "girdi" },
    { id: "a2", tur_kod: "test-ortami-talep", ad: "Test ortamı erişimi iste", sahip_rol: "ben", kriter: "erişim var", sure_tahmin_gun: 3, bagimli: [], boyut: "girdi", kosul: { soru: "test_ortami", deger: "hayir" } },
    { id: "a3", tur_kod: "gelistirme", ad: "Entegrasyonu geliştir", sahip_rol: "dev", kriter: "testler geçti", sure_tahmin_gun: 5, bagimli: ["a1", "a2", "zz"], boyut: "genel" },
    { id: "a4", tur_kod: "uat", ad: "Banka ile UAT", sahip_rol: "banka", kriter: "onaylandı", sure_tahmin_gun: 3, bagimli: ["a3"], boyut: "kapi" },
    { id: "a5", tur_kod: "canli", ad: "Canlıya çık", sahip_rol: "ben", kriter: "canlıda", sure_tahmin_gun: 1, bagimli: ["a4"], boyut: "sonuc" },
    ...(TASLAK_ADIM_SIZMA ? [{ id: "a6", tur_kod: "sizma-testi-raporu", ad: "Sızma testi raporunu paylaş", sahip_rol: "ben", kriter: "paylaşıldı", sure_tahmin_gun: 2, bagimli: [], boyut: "kapi", dayanak: (/\[D(\d+)\]/.exec(SON_USER) ? ["D" + /\[D(\d+)\]/.exec(SON_USER)![1]] : []) }] : []),
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") { SON_USER = req.user; return { input: plan(), model: TASLAK_MODEL, ms: 10 }; }
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [{ id: "a5", bekledigi: ["a3"], neden: "zaten dolaylı" }], adim_ekle: [{ ad: "Canlı geçiş onayı al", tur_kod: "canli-onay", sahip_rol: "ben", kriter: "onay", sure_tahmin_gun: 1, bagimli: ["a4"], bekleyen: ["a5"], neden: "kapı eksik" }], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "sizma-testi-raporu", boyut: "kapi" }, model: "sahte", ms: 5 };
  if (req.tool.name === "ders_yaz") return { input: { dersler: [{ i: 0, metin: "Ege Bank bilgi güvenliği canlıya çıkıştan önce güncel sızma testi raporu istiyor.", kapsam: "varlik", tetik: ["banka", "entegrasyon", "sızma testi"], gecerli: true }] }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w1" }; const key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "test", now: NOW, kanal: "oturum", llm, gom }); // insan web oturumu
const kisa = (s: string) => s.split("\n").filter((l) => !/aç:/.test(l)).join("\n");

async function tur(n: number, cumle: string) {
  console.log(`\n========== TUR ${n} ==========`);
  const r1 = await callTool("devir_tasla", { cumle, baglam: { varlik: "Ege Bank", iliski: "musteri" } }, ctx() as any);
  console.log(r1);
  if (n > 1) console.log("\n[motora giden bellek blokları]\n" + SON_USER.split("\n").filter((l) => /Benzer|Kanıtlı|^- \[|^- G|etiket/.test(l)).join("\n"));
  const kod = /Taslak (T\w+)/.exec(r1)![1];
  const r2 = await callTool("devir_akis_olustur", { taslak: kod, cevaplar: { hedef_tarih: "2026-12-30", test_ortami: "evet" } }, ctx() as any);
  console.log("\n" + kisa(r2));
  const ak = /oluşturuldu: (\w+)/.exec(r2)![1];
  const st = T.adim.filter((s) => s.akis_id === T.akis.find((f) => f.kisa_kod === ak).id).sort((a, b) => a.no - b.no);
  if (n === 1) await callTool("devir_adim_ekle", { akis: ak, ad: "Sızma testi raporunu paylaş", sahip: "Berkin", kriter: "rapor paylaşıldı", neden: "Banka bilgi güvenliği canlı öncesi istedi", bekleyen: [st.find((s) => s.tur_kod === "canli").no] }, ctx() as any);
  NOW += 3 * 864e5;
  for (let i = 0; i < 12; i++) {
    const open = T.adim.filter((s) => s.akis_id === T.akis.find((f) => f.kisa_kod === ak).id && (s.durum === "hazir" || s.durum === "sirada")).sort((a, b) => a.no - b.no);
    const h = open.find((s) => s.durum === "hazir"); if (!h) break;
    NOW += 2 * 864e5;
    await callTool("devir_adim_guncelle", { akis: ak, no: h.no, durum: "tamam", not: "ok", kim_tip: "insan", kim: "Berkin" }, ctx() as any);
  }
  const r3 = await callTool("devir_akis_kapat", { akis: ak, zorla: true }, ctx() as any);
  console.log("\n" + r3);
  return ak;
}
await tur(1, "Ege Bank için ödeme entegrasyonunu canlıya almam lazım");
NOW += 10 * 864e5;
TASLAK_ADIM_SIZMA = true;
await tur(2, "Ege Bank'ın kart ödeme API entegrasyonunu bitirmem lazım");
console.log("\n[dersler]\n" + await callTool("devir_dersler", {}, ctx() as any));
NOW += 10 * 864e5;
TASLAK_ADIM_SIZMA = false; // motor atlasa da kesin ders uygulanmalı
const r = await callTool("devir_tasla", { cumle: "Ege Bank için havale entegrasyonu yapmam lazım", baglam: { varlik: "Ege Bank" } }, ctx() as any);
console.log("\n========== TUR 3 (yalnızca taslak) ==========\n" + r);
const ilgisiz = await callTool("devir_tasla", { cumle: "Kızımın doğum günü partisini organize etmem lazım", baglam: { varlik: "Ev" } }, ctx() as any);
console.log("\n========== İLGİSİZ ==========\n" + ilgisiz.split("\n").filter((l) => /hatırla|Sızma|D\d/.test(l)).join("\n") || "(bellekten bir şey gelmedi ✓)");
console.log("\n" + await callTool("devir_sabitle", { akis: T.akis[0].kisa_kod, ad: "Banka entegrasyonu" }, ctx() as any));
console.log("\n[deneyim satırları]", T.deneyim.map((d) => ({ kod: d.akis_kod, eklenen: d.eklenen.map((e: any) => e.ad), atlanan: d.atlanan, uygulanan: d.uygulanan_ders })));
await callTool("devir_tasla", { cumle: "Ege Bank için yeni bir banka entegrasyonu yapmam lazım", baglam: { varlik: "Ege Bank" } }, ctx() as any);
console.log("\n[standart blok motorda]", /Standart süreç \(ekip/.test(SON_USER));
// gömmesiz (kelime benzerliği) yol
const r9 = await callTool("devir_tasla", { cumle: "Ege Bank entegrasyonu için canlıya çıkış", baglam: { varlik: "Ege Bank" } }, { db, ws, key, ua: "t", now: NOW, llm } as any);
console.log("[gömmesiz] dersler geldi:", /D\d+\]/.test(SON_USER), "benzer geldi:", /Benzer geçmiş/.test(SON_USER));
// P1-E madde 11: yedek motorla üretilen taslak çıktıda söylenir
const r0 = await callTool("devir_tasla", { cumle: "Ege Bank için havale entegrasyonu yapmam lazım", baglam: { varlik: "Ege Bank" } }, ctx() as any);
TASLAK_MODEL = "openai:gpt-4.1 (yedek; birincil: kredi bitti)";
const ry = await callTool("devir_tasla", { cumle: "Ege Bank için havale entegrasyonu yapmam lazım", baglam: { varlik: "Ege Bank" } }, ctx() as any);
const yedekOk = /yedek motorla \(OpenAI gpt-4\.1\) üretildi/.test(ry) && !/yedek motor/.test(r0);
console.log((yedekOk ? "✓ " : "✗ ") + "yedek motorla üretilen taslak etiketlenir, birincil etiketlenmez");
if (!yedekOk) process.exitCode = 1;
