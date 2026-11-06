// 0.33.2 (6 Kas, K6 + P5 verisi): Görevler API'sinde cevabı bekleyen açık sorular ve karar kuyruğu alanları. Önceki başlık: 0.33.0 (5 Kas, P3/P4): yürütme tasarımı (yurutme/inceleme/karar_tur), insan payı, kontrol katlama, AI çıktısını reddet/yorumla geri gönder.
import { callTool } from "../core.ts";
import { apiYonlendir } from "../api.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-05T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, agent_tetik: { aktif: true }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const tum = [...new Set(rows.flatMap((r) => Object.keys(r)))]; rows = rows.map((r) => Object.fromEntries(tum.map((k) => [k, k in r ? r[k] : null]))); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...Object.fromEntries(Object.entries(r).filter(([k, v]) => !(v == null && k in (DEF[t] || {})))) })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };

const taslak = () => ({
  is_turu: { kod: "ihale", ad: "İhale başvurusu", mevcut: false }, baslik: "Belediye ihalesi", kisa_ad: "Belediye ihalesi", anahtar_varlik: { tur: "sirket", ad: "Nokta" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }],
  sorular: [{ kod: "ihale_sonucu", boyut: "sonuc", soru: "İhale kazanıldı mı?", tip: "secim", secenekler: [{ deger: "kazanildi", etiket: "Kazanıldı" }, { deger: "kaybedildi", etiket: "Kaybedildi" }], varsayilan: "", guven: 0.2, cikarilabilir: false, etki: 1, genel: false, kalici: false, ne_zaman: "sonra", cevaplayan_adim: "a1" }],
  varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "basvuru", ad: "İhale dosyasını teslim et", sahip_rol: "ben", kriter: "teslim edildi", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a2", tur_kod: "sozlesme", ad: "Sözleşmeyi imzala", sahip_rol: "ben", kriter: "imzalandı", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false, kosul: { soru: "ihale_sonucu", deger: "kazanildi" } },
    { id: "a3", tur_kod: "ekip", ad: "Ekibi kur", sahip_rol: "ben", kriter: "ekip hazır", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false, kosul: { soru: "ihale_sonucu", deger: "kazanildi" } },
    { id: "a4", tur_kod: "ders", ad: "Kayıp nedenlerini yaz", sahip_rol: "ben", kriter: "yazıldı", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false, kosul: { soru: "ihale_sonucu", deger: "kaybedildi" } },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0332" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm }) as any;
const G = async (qs = "") => (await apiYonlendir(ctx(), "GET", ["gorevler"], new URLSearchParams(qs), null, { fn: "", link: "" })) as any;

(async () => {
  let r = await callTool("devir_tasla", { cumle: "Belediye ihalesine girmem lazım", baglam: { varlik: "Nokta", iliski: "kendi" } }, ctx());
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const bek = T.akis.find((a) => a.kisa_kod === ak).baglam.bekleyen;
  ok("sonra sorusu açık soru olarak kuruldu", !!bek?.ihale_sonucu?.adim_no, bek);
  let g = await G();
  ok("cevaplayan adım bitmeden kuyrukta soru yok", Array.isArray(g.sorular) && g.sorular.length === 0, g.sorular);
  ok("görevlerde kuyruk alanları var", g.gorevler.every((x: any) => "inceleme" in x && "karar_tur" in x && "karar" in x && Array.isArray(x.inceleme_gecmisi)), g.gorevler[0]);
  await callTool("devir_adim_guncelle", { akis: ak, no: bek.ihale_sonucu.adim_no, durum: "tamam" }, ctx());
  g = await G();
  const q = g.sorular[0];
  ok("adım bitince soru kuyrukta, sahibine", g.sorular.length === 1 && q.kod === "ihale_sonucu" && q.kim === "Berkin" && q.secenekler?.length === 2, g.sorular);
  ok("dalların etkisi sayılır", q.etki?.kazanildi === 2 && q.etki?.kaybedildi === 1, q.etki);
  ok("başka kişinin kuyruğunda yok", (await G("kisi=Selin")).sorular.length === 0);
  await callTool("devir_cevapla", { akis: ak, soru: "ihale_sonucu", cevap: "kazanildi" }, ctx());
  ok("cevaplanınca kuyruktan düşer", (await G()).sorular.length === 0);
  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.33.2 testleri geçti");
  if (hata0) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
