// 0.36.0 (12 Kas, H5): agent adımında rutin_var; başkasının agent rutini sunucudan gelir.
import { callTool } from "../core.ts";
import { apiYonlendir } from "../api.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-06T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, agent_tetik: { aktif: true }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  // PostgREST toplu eklemede satırların anahtar birleşimini gönderir: bir satırda olmayan alan null gider (varsayılan değil)
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const tum = [...new Set(rows.flatMap((r) => Object.keys(r)))]; rows = rows.map((r) => Object.fromEntries(tum.map((k) => [k, k in r ? r[k] : null]))); if (t === "adim" && rows.some((r) => "oto" in r && r.oto == null)) throw new Error('null value in column "oto" of relation "adim" violates not-null constraint'); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };

const AG = "Webinar metin agent'ı";
const taslak = () => ({
  is_turu: { kod: "webinar", ad: "Webinar", mevcut: false }, baslik: "Webinar hazırlığı", kisa_ad: "Webinar", anahtar_varlik: { tur: "sirket", ad: "Nokta" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }, { kod: "ag", ad: AG, tip: "agent", kisi: AG }],
  sorular: [{ kod: "kanal", boyut: "girdi", soru: "Duyuru hangi kanaldan?", tip: "secim", secenekler: [{ deger: "eposta", etiket: "E-posta" }, { deger: "linkedin", etiket: "LinkedIn" }], varsayilan: "", guven: 0.2, cikarilabilir: false, etki: 1, genel: false, kalici: false }],
  varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "metin", ad: "Webinar metnini yaz", sahip_rol: "ag", kriter: "metin hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a2", tur_kod: "onay", ad: "Metni onayla", sahip_rol: "ben", kriter: "onaylandı", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a3", tur_kod: "davet", ad: "Davet metnini yaz", sahip_rol: "ag", kriter: "davet hazır", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a4", tur_kod: "yayin", ad: "Duyuruyu yayınla", sahip_rol: "ben", kriter: "yayında", sure_tahmin_gun: 1, bagimli: ["a3"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0360" }, key = { id: "k1", kisi: "Berkin", rol: "sahip", uye_id: "u1" };
const sifre = { sifrele: async (s: string) => "enc:" + s, coz: async (s: string) => s.replace(/^enc:/, "") };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm, sifre }) as any;
const A = async (method: string, yol: string[], body: any = null) => apiYonlendir(ctx(), method, yol, new URLSearchParams(), body, { fn: "", link: "" }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return `${(e as any).durum || ""} ${(e as Error).message}`; } };
const FIRE = "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire";
const ece = { id: "k2", kisi: "Ece", rol: "uye", uye_id: "u2" };
const A2 = async (yol: string[], q = "") => apiYonlendir({ ...ctx(), key: ece }, "GET", yol, new URLSearchParams(q), null, { fn: "", link: "" }) as any;

(async () => {
  let r = await callTool("devir_tasla", { cumle: "Webinar hazırlamam lazım", baglam: { varlik: "Nokta", iliski: "kendi" } }, ctx());
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: { kanal: "eposta" } }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const ag = adimlar(ak).filter((s) => s.sahip_tip === "agent");
  ok("kurulum: iki agent adımı, sahibi Berkin", ag.length === 2 && ag.every((s) => s.agent_sahibi === "Berkin"), ag.map((s) => [s.sahip, s.agent_sahibi]));

  // rutin yok
  let d = await A("GET", ["akis", ak]);
  const rv = (D: any) => D.adimlar.map((x: any) => [x.no, x.sahip_tip, x.rutin_var]);
  ok("H5: rutin yokken agent adımlarında rutin_var false", d.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === false), rv(d));
  ok("H5: insan adımında rutin_var null", d.adimlar.filter((x: any) => x.sahip_tip === "insan").every((x: any) => x.rutin_var === null), rv(d));
  let e2 = await A2(["akis", ak]);
  ok("H5: başkası (Ece) da Berkin'in agent'ında rutin olmadığını görür", e2.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === false), rv(e2));

  // Berkin yalnız ilk agent'a bakan bir API rutini kurar
  await A("POST", ["tetikler"], { ad: "Webinar rutini", url: FIRE, jeton: "x".repeat(30), agentlar: [AG] });
  d = await A("GET", ["akis", ak]);
  ok("H5: rutin kurulunca agent adımlarında rutin_var true", d.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === true), rv(d));
  e2 = await A2(["akis", ak]);
  ok("H5: Ece de rutinin kurulduğunu görür", e2.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === true), rv(e2));
  const tek = await A2(["akis", ak, "adim", String(ag[0].no)]);
  ok("H5: adım ayrıntısında da rutin_var", tek.adim?.rutin_var === true, tek.adim?.rutin_var);
  const g = await A2(["gorevler"], "kisi=hepsi");
  const ga = g.gorevler.filter((x: any) => x.akis === ak && x.sahip_tip === "agent");
  ok("H5: görev listesinde açık agent satırında rutin_var", ga.length >= 1 && ga.every((x: any) => x.rutin_var === true), ga.map((x: any) => [x.no, x.rutin_var]));

  // kapsam başka agent'a geçerse rutin bu agent'ın işini almaz
  const id = T.agent_tetik.find((t) => t.ad === "Webinar rutini").id;
  await A("POST", ["tetikler", id, "agentlar"], { agentlar: ["Başka agent"], ai_ac: false });
  d = await A("GET", ["akis", ak]);
  ok("H5: kapsam dışı kalan agent'ta rutin_var false", d.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === false), rv(d));

  // zamanlanmış rutin: son 3 günde uğradıysa var, uğramadıysa yok
  await A("POST", ["tetikler", id, "agentlar"], { agentlar: null, ai_ac: false });
  T.agent_tetik.find((t) => t.id === id).url = "zamanli";
  T.agent_tetik.find((t) => t.id === id).son_tetik_at = new Date(NOW - 864e5).toISOString();
  d = await A("GET", ["akis", ak]);
  ok("H5: dün uğrayan zamanlanmış rutin sayılır", d.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === true), rv(d));
  T.agent_tetik.find((t) => t.id === id).son_tetik_at = new Date(NOW - 5 * 864e5).toISOString();
  d = await A("GET", ["akis", ak]);
  ok("H5: 5 gündür uğramayan zamanlanmış rutin sayılmaz", d.adimlar.filter((x: any) => x.sahip_tip === "agent").every((x: any) => x.rutin_var === false), rv(d));

  // biten agent adımında null
  T.adim.find((s) => s.id === ag[0].id).durum = "tamam";
  d = await A("GET", ["akis", ak]);
  ok("H5: biten agent adımında rutin_var null", d.adimlar.find((x: any) => x.no === ag[0].no).rutin_var === null, rv(d));

  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.36.0 testleri geçti");
  if (hata0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
