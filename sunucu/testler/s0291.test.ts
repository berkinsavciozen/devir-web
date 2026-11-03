// 0.29.1 (3 Kas, AI yapsın zamanlanmış rutin): jetonsuz yol. Kişinin rutini saatte bir devir_ai_isler ile kendi işlerini çeker.
import { callTool } from "../core.ts";

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
const ws = { id: "w-0291" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const atis: { url: string; jeton: string; metin: string }[] = [];
const tetik = async (url: string, jeton: string, metin: string) => { atis.push({ url, jeton, metin }); return url.includes("/fail/") ? { ok: false, durum: 500, hata: "sunucu" } : { ok: true, durum: 200, oturum: "https://claude.ai/code/session_x" }; };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm, tetik }) as any;
const agentCtx = () => ({ ...ctx(), kanal: "mcp", ua: "Claude-User" }) as any;
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
  const N1 = no(/Numune/), N2 = no(/Analiz/);

  r = await callTool("devir_adim_guncelle", { akis: ak, no: N2, sahip: "Analiz agent", sahip_tip: "agent", oto: true }, ctx());
  ok("rutin yokken uyarır", /rutini yok/.test(r), r);
  r = await callTool("devir_ai_isler", {}, agentCtx());
  ok("öncül bitmeden iş yok, bekleyen gösterilir", /hazır AI yapsın işi yok/.test(r) && /öncüller/.test(r), r);
  const z = (T.agent_tetik || []).find((t) => t.url === "zamanli");
  ok("ilk çalışma zamanlanmış rutini kaydeder", !!z && z.jeton === "" && !!z.son_tetik_at, z);
  await callTool("devir_adim_ekle", { akis: ak, ad: "Rakip fiyat tablosunu hazırla", sahip: "Fiyat agent", sahip_tip: "agent", kriter: "tablo hazır", neden: "eksik", sure_tahmin_gun: 1, bagimli: [N1] }, ctx());
  const N4 = no(/Rakip fiyat/);
  r = await callTool("devir_adim_guncelle", { akis: ak, no: N4, oto: true }, ctx());
  ok("rutin uğradıysa uyarı yok", !/rutini yok/.test(r), r);

  await callTool("devir_adim_guncelle", { akis: ak, no: N1, durum: "tamam", not: "hazır" }, ctx());
  ok("zamanlanmış satır API ile tetiklenmez", atis.length === 0 && adimOf(ak, N2).oto_durum == null, atis);
  r = await callTool("devir_ai_isler", { al: false }, agentCtx());
  ok("al=false listeler, almaz", /İş 1/.test(r) && adimOf(ak, N2).oto_durum == null, r);
  r = await callTool("devir_ai_isler", { en_cok: 1 }, agentCtx());
  ok("en_cok=1: bir işi alır, kalanı söyler", /İş 1/.test(r) && !/İş 2/.test(r) && /kalanı sonraki/.test(r), r);
  const alinan = [N2, N4].filter((n) => adimOf(ak, n).oto_durum === "tetiklendi");
  ok("alınan iş tetiklendi olur, olay yazılır", alinan.length === 1 && T.olay.some((o) => o.veri?.tur === "oto_tetik" && o.veri?.tetik === "zamanli"), alinan);
  r = await callTool("devir_ai_isler", {}, agentCtx());
  const ikinci = [N2, N4].filter((n) => adimOf(ak, n).oto_durum === "tetiklendi");
  ok("ikinci çalışma kalan işi alır, alınanı tekrar vermez", ikinci.length === 2 && (r.match(/--- İş/g) || []).length === 1, r);

  // başka kişinin rutini Berkin'in işlerini almaz
  const ayse = () => ({ ...agentCtx(), key: { id: "k2", kisi: "Ayşe", rol: "uye" } }) as any;
  r = await callTool("devir_ai_isler", {}, ayse());
  ok("başkasının işleri gelmez", /işi yok/.test(r), r);

  // takılı kalan iş: 6 saat sonra yeniden verilir, ikinci kez de bitmezse engelli
  const N = alinan[0];
  NOW += 7 * 3600e3;
  r = await callTool("devir_ai_isler", {}, agentCtx());
  ok("takılı iş yeniden verilir", adimOf(ak, N).oto_deneme === 2 && adimOf(ak, N).oto_durum === "tetiklendi" && /İş 1/.test(r), [adimOf(ak, N).oto_deneme, r]);
  NOW += 7 * 3600e3;
  await callTool("devir_ai_isler", {}, agentCtx());
  ok("ikinci kez takılınca engelli", adimOf(ak, N).durum === "engelli" && adimOf(ak, N).oto_durum === "hata", [adimOf(ak, N).durum, adimOf(ak, N).oto_durum]);

  // agent işi yapar: bakılacak
  const M = [N2, N4].find((n) => n !== N)!;
  await callTool("devir_adim_guncelle", { akis: ak, no: M, durum: "suruyor" }, agentCtx());
  await callTool("devir_adim_guncelle", { akis: ak, no: M, cikti: { ad: "Sonuç", icerik: "hazır" } }, agentCtx());
  ok("çıktı yazınca bakılacak", adimOf(ak, M).oto_durum === "bakilacak", adimOf(ak, M).oto_durum);
  r = await callTool("devir_ai_isler", {}, agentCtx());
  ok("bakılacak iş yeniden verilmez", /işi yok/.test(r), r);

  console.log(hata0 ? `\n${hata0} hata` : "\n0.29.1 testleri geçti");
  if (hata0) process.exitCode = 1;
})();
