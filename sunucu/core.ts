// Devir MCP çekirdeği. Saf mantık: veri erişimi DB arayüzü üzerinden gelir (Supabase ya da test için bellek).

import { akisKarari, aralikMetni, gecmisYukle } from "./plan.ts";
import type { LlmFn } from "./llm.ts";
import { type GomFn, hatirla, deneyimSatiri, dersSatiri, kartSatiri, standartBlok, derslerUygula, hatirlatmaSatirlari, dayanaklar, deneyimKaydet, dersUymadi, atlamaNedeni, vnorm, kokler, standartMetni, dersMetni, type Hatira } from "./bellek.ts";
import { SISTEM, TASLAK_ARACI, TUR_ARACI, DENETCI_SISTEM, DENETCI_ARACI, denetimListesi, denetimUygula, kuralDenetimi, turDogrula, kullaniciMesaji, sec, uygula, esle, slug, BILMIYORUM as BILMIYORUM_RE, type Stat } from "./tasarim.ts";
import { belirtecAlanlari, yeniBelirtec, type Sifre } from "./baglanti.ts";

export interface DB {
  one(table: string, where: Record<string, unknown>): Promise<any | null>;
  many(table: string, where: Record<string, unknown>, order?: string, limit?: number): Promise<any[]>;
  insert(table: string, rows: any[]): Promise<any[]>;
  update(table: string, where: Record<string, unknown>, patch: Record<string, unknown>): Promise<void>;
  delete?(table: string, where: Record<string, unknown>): Promise<void>;
  /** Postgres işlevi (P1-B: adim_durum_yaz, sayac_artir). Yoksa (bellek DB'si) aynı iş tablo çağrılarıyla yapılır. */
  rpc?(fn: string, args: Record<string, unknown>): Promise<any>;
}
/** kanal: isteğin geldiği yol. Aktör türü buradan türetilir, araç argümanından değil (S-C1). */
export type Kanal = "mcp" | "oturum" | "anahtar" | "baglanti";
export type Ctx = { db: DB; ws: any; key: any; ua: string; now: number; kanal?: Kanal; llm?: LlmFn; gom?: GomFn; modeller?: { taslak?: string; hizli?: string }; depo?: any; sifre?: Sifre | null };

/** Tipli hata (N-9): HTTP durumu mesajdan değil hatadan gelir. 403 yetki, 404 yok, 400 geçersiz. */
export class DevirHata extends Error { constructor(public durum: number, m: string) { super(m); } }
const yetkiYok = (m: string) => new DevirHata(403, m);
const bulunamadi = (m: string) => new DevirHata(404, m);

export const DAY = 864e5;
export const HOUR = 36e5;
export const DONE = (s: any) => s.durum === "tamam" || s.durum === "atlandi" || s.durum === "ertelendi";
export const ICON: Record<string, string> = { tamam: "✓", suruyor: "●", hazir: "◷", engelli: "⚠", sirada: "○", atlandi: "–", ertelendi: "↷" };
export const LBL: Record<string, string> = { tamam: "tamam", suruyor: "sürüyor", hazir: "hazır, sıra sahibinde", engelli: "engelli", sirada: "sırada", atlandi: "atlandı", ertelendi: "ertelendi (açık iş)" };
const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const KARAR = /karar|onay|ödeme|imza/i;
// karar adımı: karar_kriteri varsa kesin; yoksa addan, ama soru adımları ("Netleştir: … onayı gerekiyor mu?") karar sayılmaz
export function kararAdimi(s: any) {
  if (s?.karar_kriteri) return true;
  const ad = String(s?.ad || "").trim();
  if (/^netleştir/i.test(ad) || /\?\s*$/.test(ad) || /(^|\s)m[ıiuü](\s|$)/i.test(ad)) return false;
  return KARAR.test(ad);
}

export const todayIst = (ms: number) => new Date(ms + 3 * HOUR).toISOString().slice(0, 10);
const dayNum = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / DAY);
const numDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const eod = (d: string) => Date.parse(d + "T23:59:59+03:00");
export const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
let BU_YIL = new Date().getUTCFullYear(); // callTool her çağrıda ctx.now'a göre ayarlar
export const fmtD = (d: string) => { const [y, m, g] = d.split("-").map(Number); return `${g} ${AY[m - 1]}${y !== BU_YIL ? ` ${y}` : ""}`; };
export const fmtMs = (ms: number) => fmtD(todayIst(ms));
const ts = (s: string) => Date.parse(s);
export const norm = (s: string) => String(s || "").toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/g, " ").trim();
const truthy = (v: unknown) => v === true || /^(evet|var|e|yes|true|1|olur)$/i.test(String(v ?? "").trim());
const num = (v: unknown, d = 1) => { const n = Number(v); return isFinite(n) && n > 0 ? n : d; };

export function dur(ms: number): string {
  if (ms < HOUR) return Math.max(1, Math.round(ms / 6e4)) + " dk";
  const h = ms / HOUR;
  if (h < 24) return Math.round(h) + " sa";
  const d = Math.floor(h / 24), hh = Math.round(h - d * 24);
  return hh ? `${d} g ${hh} sa` : `${d} g`;
}
const gun = (n: number) => (Math.round(n * 10) / 10).toLocaleString("tr-TR");

export function aracOf(a: any, ua: string): string {
  if (a && typeof a.arac === "string" && a.arac.trim()) return a.arac.trim();
  if (/claude|anthropic/i.test(ua)) return "Claude";
  if (/openai|chatgpt/i.test(ua)) return "ChatGPT";
  if (/cursor/i.test(ua)) return "Cursor";
  if (/gemini|google/i.test(ua)) return "Gemini";
  return "MCP istemcisi";
}
// Aktör kimlik bilgisinden gelir: kim her zaman anahtarın, oturumun ya da bağlantının kişisi; argümandaki kim ve kim_tip yok sayılır.
// MCP (ve kanalı bilinmeyen çağrı) agent'tır; web oturumu ve web'den anahtarla gelen istek insan; bağlantı ya da dış üye dış.
function actor(ctx: Ctx, a: any) {
  const arac = aracOf(a, ctx.ua);
  const kim_tip = ctx.kanal === "oturum" || ctx.kanal === "anahtar" || ctx.kanal === "baglanti" ? (isDis(ctx) ? "dis" : "insan") : "agent";
  return { kim: ctx.key.kisi, kim_tip, arac };
}
// Agent üzerinden verilen karar (MK-3): kullanıcı tipine göre insan kararı sayılır ya da beyan kalır.
// Sahip Ayarlar'da kullanıcı tipi başına seçer (kullanici.politika.agent_karari); seçilmemişse varsayılan.
const AGENT_KARARI: Record<string, "insan" | "beyan"> = { sahip: "insan", ekip: "insan", dis: "beyan" };
export const kararDuzeyi = (ctx: Ctx, act: any): "insan" | "beyan" => act.kim_tip !== "agent" ? "insan" : ({ ...AGENT_KARARI, ...(ctx.ws?.politika?.agent_karari || {}) } as any)[ctx.key.rol] === "insan" ? "insan" : "beyan";
const who = (o: any) => o.kim_tip === "agent" ? `${o.arac || "AI"} (${o.kim} adına)` : o.kim_tip === "sistem" ? "Devir" : o.kim;

function olaySatiri(ctx: Ctx, akisId: string, no: number | null, act: any, tip: string, ozet: string, veri: any = {}) {
  // kanal ve kişi kimliği (0.13.0): kayıt kimin kimlik bilgisiyle, hangi yoldan geldi; sistem olayında boş
  const kimlik = act.kim_tip === "sistem" ? {} : { kanal: ctx.kanal || "mcp", ...(ctx.key?.kisi_id ? { kisi_id: ctx.key.kisi_id } : {}) };
  return { akis_id: akisId, adim_no: no, kim: act.kim, kim_tip: act.kim_tip, arac: act.arac || null, tip, ozet, veri: { ...veri, ua: ctx.ua.slice(0, 120) }, ...kimlik };
}
async function log(ctx: Ctx, akisId: string, no: number | null, act: any, tip: string, ozet: string, veri: any = {}) {
  await ctx.db.insert("olay", [olaySatiri(ctx, akisId, no, act, tip, ozet, veri)]);
}
/**
 * Adım durumu ve durum olayı (P1-B, S-C4): Postgres'te tek işlemde (adim_durum_yaz); biri yazılıp öbürü kalamaz.
 * Durum bu arada başkası tarafından değiştiyse 409. rpc yoksa (bellek DB'si) eski sırayla iki yazım.
 */
async function durumYaz(ctx: Ctx, akisId: string, adim: { id: string; no: number }, from: string, to: string, act: any, ozet: string, patch: Record<string, unknown>) {
  const olay = olaySatiri(ctx, akisId, adim.no, act, "durum", ozet, { from, to });
  if (!ctx.db.rpc) { await ctx.db.update("adim", { id: adim.id }, patch); await ctx.db.insert("olay", [olay]); return; }
  try { await ctx.db.rpc("adim_durum_yaz", { p_adim: adim.id, p_patch: patch, p_onceki: from, p_olay: olay }); }
  catch (e) {
    if (/durum_degisti|40001/.test(String((e as Error).message))) throw new DevirHata(409, `Adım ${adim.no} bu arada başka biri tarafından güncellendi. Akışı yeniden oku ve gerekiyorsa tekrar dene.`);
    throw e;
  }
}
const SYS = { kim: "Devir", kim_tip: "sistem", arac: null };

// ---------- erişim ----------
export const isDis = (ctx: Ctx) => ctx.key.rol === "dis";
const kapsam = (ctx: Ctx) => norm(ctx.key.kapsam || ctx.key.kisi);
/** Dış kapsam eşleşmesi: tam ad, "Ad (kurum)" biçiminde adın kendisi ya da parantez içi kurum adı. Alt dizge eşleşmesi yok (S-B2): "Ali" "Mehmet Ali"yi kapsamaz. */
export function adEslesir(sahip: string, kisi: string) {
  const k = norm(kisi);
  if (!k) return false;
  const tam = String(sahip || ""), m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(tam);
  return norm(tam) === k || (!!m && (norm(m[1]) === k || norm(m[2]) === k));
}
/** Dış kapsam (P0-A): iki tarafta da kişi kimliği varsa yalnız kimlik eşitliği; ad yalnız gösterimdir. Kimliği olmayan eski kayıtta tam ad eşleşmesi. */
export function stepInScope(ctx: Ctx, s: any) {
  if (!isDis(ctx)) return true;
  if (ctx.key.kisi_id && s.sahip_kisi_id) return s.sahip_kisi_id === ctx.key.kisi_id;
  return adEslesir(s.sahip, kapsam(ctx));
}
/** Ekip üyesinin akış kapsamı (0.11.0): uye.kapsam "akis:KOD1,KOD2" ise yalnız o akışlar (ve alt akışları) ile kendi adımı olan akışlar. */
export function akisKapsami(ctx: Ctx): Set<string> | null {
  if (ctx.key.rol !== "ekip") return null;
  const m = String(ctx.key.kapsam || "").match(/^akis:(.*)$/i);
  return m ? new Set(m[1].split(",").map((x) => x.trim().toUpperCase()).filter(Boolean)) : null;
}
export function flowInScope(ctx: Ctx, akis: any, steps: any[]) {
  const ak = akisKapsami(ctx);
  if (ak) { const b = norm(ctx.key.kisi || ""); return ak.has(String(akis.kisa_kod).toUpperCase()) || ak.has(String(akis.baglam?.ust_kod || "").toUpperCase()) || (!!b && steps.some((s) => norm(s.sahip) === b)); }
  if (!isDis(ctx)) return true;
  const k = kapsam(ctx);
  return (!!k && norm(akis.baglam?.musteri || "") === k) || steps.some((s) => stepInScope(ctx, s));
}
function needTeam(ctx: Ctx, what: string) {
  if (isDis(ctx)) throw yetkiYok(`${what} yalnızca ekip üyeleri yapabilir. Senin anahtarın dış katılımcı (${ctx.key.kisi}) içindir; yalnızca sana atanan adımları görüp güncelleyebilirsin.`);
}
// Yüksek etkili eylemler (çalışma alanı kararı, standart süreç, ders, zorla kapatma) yalnız sahipte (S-C3).
function needOwner(ctx: Ctx, what: string) {
  needTeam(ctx, what);
  if (ctx.key.rol !== "sahip") throw yetkiYok(`${what} yalnızca çalışma alanının sahibi yapabilir; ekip rolü bunu yapamaz.`);
}

// ---------- kişi kimliği (P0-A) ----------
// Her çalışma alanında bir kişi bir satır: insan, dış kişi ya da agent. Adım, katılımcı, üye ve anahtar kişiye kimlikle bağlanır.
// Ad yalnız gösterimdir; ad değişse de kapsam aynı kalır. Yeni ad ilk görüldüğünde aynı alandaki tam ad eşi aranır, yoksa yeni kişi açılır.
const kisiTipi = (t: unknown) => (t === "dis" ? "dis" : t === "agent" ? "agent" : "insan");
export async function kisiCoz(ctx: Ctx, ad: unknown, tip?: unknown): Promise<any | null> {
  const a = String(ad || "").trim(), n = norm(a);
  if (!n) return null;
  const onbellek: Map<string, any> = ((ctx as any)._kisi ||= new Map());
  if (onbellek.has(n)) return onbellek.get(n);
  try {
    let k = (await ctx.db.many("kisi", { ws_id: ctx.ws.id, ad_norm: n }, "created_at"))[0];
    if (!k) [k] = await ctx.db.insert("kisi", [{ ws_id: ctx.ws.id, ad: a, ad_norm: n, tip: kisiTipi(tip) }]);
    onbellek.set(n, k);
    return k;
  } catch (e) { console.warn("kişi çözülemedi (kisi tablosu yok mu?):", (e as Error).message); return null; } // şema yüklenmeden de eski yol çalışır
}
/** Kimlik bilgisinin (anahtar, üye, bağlantı) kişisini bağlar; kaynak satırda yoksa bir kez çözüp yazar. */
export async function kimlikBagla(ctx: Ctx, tablo: "anahtar" | "uye" | "katilimci", id: unknown) {
  if (ctx.key.kisi_id) return ctx;
  const k = await kisiCoz(ctx, isDis(ctx) ? ctx.key.kapsam || ctx.key.kisi : ctx.key.kisi, isDis(ctx) ? "dis" : "insan");
  if (k) { ctx.key = { ...ctx.key, kisi_id: k.id }; if (id) await ctx.db.update(tablo, { id }, { kisi_id: k.id }).catch(() => {}); }
  return ctx;
}
/** Verilen kişi kimliği bu çalışma alanında mı? (kişi seçiciden gelen sahip_kisi_id için) */
export async function kisiAl(ctx: Ctx, id: unknown) {
  const k = /^[0-9a-f-]{36}$/i.test(String(id || "")) ? await ctx.db.one("kisi", { id: String(id), ws_id: ctx.ws.id }) : null;
  if (!k) throw bulunamadi("Kişi bu çalışma alanında yok.");
  return k;
}
/** { kisi_id } ya da çözülemezse boş nesne (şema yoksa sütun hiç yazılmaz). */
export async function kisiAlani(ctx: Ctx, ad: unknown, tip?: unknown, alan = "kisi_id") { const k = await kisiCoz(ctx, ad, tip); return k ? { [alan]: k.id } : {}; }
/** Adım satırlarına sahip kimliğini yazar (yalnız eksik olanlara). */
async function sahipBagla(ctx: Ctx, rows: any[]) {
  for (const r of rows) if (!r.sahip_kisi_id && r.sahip) { const k = await kisiCoz(ctx, r.sahip, r.sahip_tip); if (k) r.sahip_kisi_id = k.id; }
  return rows;
}

// ---------- graf ----------
function topo<T extends { no: number; bagimli: number[] }>(items: T[]): T[] {
  const by = new Map(items.map((i) => [i.no, i]));
  const st = new Map<number, number>();
  const out: T[] = [];
  const visit = (i: T, path: number[]) => {
    const s = st.get(i.no);
    if (s === 2) return;
    if (s === 1) throw new Error(`Bağımlılıklarda döngü var: ${[...path, i.no].join(" → ")}`);
    st.set(i.no, 1);
    for (const d of i.bagimli || []) { const x = by.get(d); if (x) visit(x, [...path, i.no]); }
    st.set(i.no, 2);
    out.push(i);
  };
  for (const i of items) visit(i, []);
  return out;
}

export function timeline(steps: any[], events: any[], now: number) {
  const res = new Map<number, { bekleme: number; aktif: number; engel: number; belirsiz: number; hazirAt: number | null; basAt: number | null; bitisAt: number | null; simdi: number }>();
  const tip = new Map<number, string>(steps.map((s) => [s.no, s.sahip_tip]));
  const cur = new Map<number, { state: string; at: number }>();
  for (const s of steps) { res.set(s.no, { bekleme: 0, aktif: 0, engel: 0, belirsiz: 0, hazirAt: null, basAt: null, bitisAt: null, simdi: 0 }); cur.set(s.no, { state: "sirada", at: ts(s.created_at) }); }
  const acc = (no: number, state: string, ms: number) => {
    const r = res.get(no); if (!r || ms <= 0) return;
    if (state === "hazir") r.bekleme += ms; else if (state === "engelli") r.engel += ms; else if (state === "suruyor") r.aktif += ms;
  };
  const evs = events.filter((o) => o.tip === "durum" && o.adim_no != null).sort((a, b) => ts(a.created_at) - ts(b.created_at) || a.id - b.id);
  for (const o of evs) {
    const c = cur.get(o.adim_no); if (!c) continue;
    const t = ts(o.created_at), to = o.veri && o.veri.to, r = res.get(o.adim_no)!;
    if (c.state === "hazir" && (to === "tamam" || to === "atlandi" || to === "ertelendi") && r.basAt == null && tip.get(o.adim_no) !== "dis") r.belirsiz += Math.max(t - c.at, 0);
    else acc(o.adim_no, c.state, t - c.at);
    if (to === "hazir" && r.hazirAt == null) r.hazirAt = t;
    if (to === "suruyor" && r.basAt == null) r.basAt = t;
    r.bitisAt = to === "tamam" || to === "atlandi" || to === "ertelendi" ? t : null;
    cur.set(o.adim_no, { state: to, at: t });
  }
  for (const [no, c] of cur) { acc(no, c.state, now - c.at); const r = res.get(no)!; if (c.state === "hazir" || c.state === "engelli") r.simdi = now - c.at; }
  return res;
}

export function plan(akis: any, steps: any[], tl: ReturnType<typeof timeline>, now: number) {
  const EF = new Map<number, number>(), prev = new Map<number, number | null>();
  const t0 = ts(akis.created_at);
  for (const s of topo(steps)) {
    let start = t0, p: number | null = null;
    for (const d of s.bagimli || []) { const e = EF.get(d); if (e != null && e >= start) { start = e; p = d; } }
    const r = tl.get(s.no)!;
    let f: number;
    if (DONE(s)) f = r.bitisAt ?? ts(s.durum_at);
    else f = Math.max(start, now, s.capa_tarih ? Date.parse(s.capa_tarih + "T00:00:00+03:00") - 6e4 : 0) + Math.max(num(s.sure_tahmin_gun) * DAY - r.aktif, 0.25 * DAY); // sabit tarihli olay o günden önce bitemez
    EF.set(s.no, f); prev.set(s.no, p);
  }
  let endNo: number | null = null, end = -Infinity;
  for (const [no, f] of EF) if (f > end) { end = f; endNo = no; }
  const chain: number[] = [];
  for (let x = endNo; x != null; x = prev.get(x) ?? null) chain.unshift(x);
  return { EF, chain, end };
}

export function metrics(akis: any, steps: any[], events: any[], now: number) {
  const end = akis.kapandi_at ? ts(akis.kapandi_at) : now;
  const tl = timeline(steps, events, end);
  const pl = plan(akis, steps, tl, end);
  let aktif = 0, bekleme = 0, acik = 0, belirsiz = 0;
  for (const s of steps) { const r = tl.get(s.no)!; aktif += r.aktif; bekleme += r.bekleme + r.engel; belirsiz += r.belirsiz; acik += r.aktif + r.bekleme + r.engel + r.belirsiz; }
  const sure = Math.max(end - ts(akis.created_at), 60e3);
  let kritikBekleme = 0;
  for (const no of pl.chain) { const r = tl.get(no)!; kritikBekleme += r.bekleme + r.engel; }
  const hedefMs = akis.hedef_tarih ? eod(akis.hedef_tarih) : null;
  const pay = hedefMs != null ? hedefMs - pl.end : null;
  const verim = aktif === 0 || belirsiz > aktif ? null : aktif + bekleme > 0 ? aktif / (aktif + bekleme) : null;
  return { tl, pl, aktif, bekleme, belirsiz, kritikBekleme, sure, paralel: acik / sure, verim, pay };
}

function speedLine(m: any) {
  const p = [`aktif çalışma ${dur(m.aktif)}`, `kritik yolda bekleme ${dur(m.kritikBekleme)}`, `tüm adımların toplam beklemesi ${dur(m.bekleme)}`];
  if (m.belirsiz > 0) p.push(`ayrıştırılamayan ${dur(m.belirsiz)} (başlangıcı işaretlenmeden bitirilen ekip adımları)`);
  if (m.verim != null) p.push(`akış verimi %${Math.round(m.verim * 100)}`);
  p.push(`ortalama eşzamanlı açık iş ${gun(m.paralel)}`);
  return p.join(" · ");
}

function stepLine(s: any, tl: any, pl: any, opts: { sahipGizle?: boolean } = {}) {
  const r = tl.get(s.no);
  const parts = [`${ICON[s.durum]} ${s.no}. ${s.ad}`];
  if (!opts.sahipGizle) parts[0] += ` — ${s.sahip}${s.sahip_tip === "agent" ? ` (agent${s.arac ? " · " + s.arac : ""})` : s.sahip_tip === "dis" ? " (dış)" : s.arac ? ` (${s.arac} ile)` : ""}`;
  let st = LBL[s.durum];
  if (r && r.simdi > 0) st += ` (${dur(r.simdi)})`;
  if (s.durum === "engelli" && s.engel) st += ` (${s.engel})`;
  parts.push(st);
  if (s.son_tarih && !DONE(s)) {
    let t = `son ${fmtD(s.son_tarih)}`;
    const ef = pl && pl.EF.get(s.no);
    if (ef != null && ef > eod(s.son_tarih)) t += ` ⚠ en erken ${fmtMs(ef)}`;
    parts.push(t);
  }
  if (!s.son_tarih && s.capa_soru && !DONE(s)) parts.push(`tarih bekliyor (${s.capa_soru})`);
  if (s.kosul?.soru && !DONE(s)) parts.push(`yalnızca ${s.kosul.soru}=${s.kosul.deger} ise`);
  if (s.cevap_soru && !DONE(s)) parts.push(`bitince cevaplanır: ${s.cevap_soru}`);
  if (s.kaynak === "sonradan") parts.push("sonradan eklendi");
  return parts.join(" · ");
}

export function chatLinks(akis: any, s: any) {
  const q = `Devir'deki "${akis.baslik}" akışının ${s.no}. adımı "${s.ad}" üzerinde çalışalım. Önce devir_adim_oku ile adımı oku (akis: ${akis.kisa_kod}, no: ${s.no}); kriterlere göre ilerleyelim, ilerlemeyi ve çıktıları Devir'e yaz.`;
  const e = encodeURIComponent(q);
  return { claude: "https://claude.ai/new?q=" + e, chatgpt: "https://chatgpt.com/?q=" + e };
}

// ---------- yükleme ----------
export async function getAkis(ctx: Ctx, ref: unknown) {
  const r = String(ref ?? "").trim().replace(/^#/, "");
  if (!r) throw new Error("akis parametresi gerekli (ör. K7M2). devir_akislar ile listeleyebilirsin.");
  const where = /^[0-9a-f-]{36}$/i.test(r) ? { id: r } : { kisa_kod: r.toUpperCase() };
  const akis = await ctx.db.one("akis", { ...where, sahip_id: ctx.ws.id });
  if (!akis) throw bulunamadi(`'${r}' kodlu akış bulunamadı. devir_akislar ile akışları listele.`);
  return akis;
}
export async function loadFlow(ctx: Ctx, akis: any) {
  const steps = (await ctx.db.many("adim", { akis_id: akis.id }, "no")).map(fixStep);
  const events = await ctx.db.many("olay", { akis_id: akis.id }, "id");
  if (!flowInScope(ctx, akis, steps)) throw yetkiYok(`'${akis.kisa_kod}' akışı senin kapsamında değil.`);
  return { steps, events };
}
export function fixStep(s: any) { s.bagimli = (s.bagimli || []).map(Number); s.ciktilar = s.ciktilar || []; return s; }

async function setDurum(ctx: Ctx, akis: any, s: any, to: string, act: any, ozet: string, extra: Record<string, unknown> = {}) {
  const from = s.durum, at = new Date(ctx.now).toISOString();
  await durumYaz(ctx, akis.id, s, from, to, act, ozet, { durum: to, durum_at: at, ...extra });
  Object.assign(s, { durum: to, durum_at: at }, extra);
}
async function recalc(ctx: Ctx, akis: any, steps: any[]) {
  const by = new Map(steps.map((s) => [s.no, s]));
  const ready: any[] = [];
  const ust = await ustBekleyen(ctx, akis);
  for (const s of steps) {
    if (DONE(s) || s.durum === "suruyor" || s.durum === "engelli") continue;
    const ok = s.bagimli.every((n: number) => { const d = by.get(n); return !d || DONE(d); }) && !(ust.get(s.no) || []).length;
    const target = ok ? "hazir" : "sirada";
    if (s.durum === target) continue;
    await setDurum(ctx, akis, s, target, SYS, target === "hazir" ? `Adım ${s.no} hazır; sıra şimdi: ${s.sahip}` : `Adım ${s.no} yeniden sıraya alındı`);
    if (target === "hazir") ready.push(s);
  }
  return ready;
}

// ---------- öğrenim ----------
function learnings(sab: any | null, musteri?: string, wsId?: string, cevaplar?: Record<string, unknown>) {
  const L: any[] = (sab && sab.ogrenimler) || [];
  const out: { genel: string[]; musteri: string[]; ekle: any[]; ek_sure: Map<string, number> } = { genel: [], musteri: [], ekle: [], ek_sure: new Map() };
  if (!L.length) return out;
  const n = L.length;
  const add = new Map<string, { c: number; e: any; m: Set<string> }>();
  for (const l of L) for (const e of l.eklenen || []) {
    const k = norm(e.tur_kod || e.ad); const x = add.get(k) || { c: 0, e, m: new Set<string>() };
    x.c++; if (l.baglam?.musteri) x.m.add(norm(l.baglam.musteri)); add.set(k, x);
  }
  for (const [, x] of add) {
    const pct = Math.round((x.c / n) * 100);
    if (n >= 4 && x.c / n >= 0.3) out.genel.push(`Geçmiş ${n} akıştan ${x.c} tanesinde (%${pct}) sonradan eklendi: "${x.e.ad}"${x.e.neden ? ` (${x.e.neden})` : ""}.`);
  }
  const waits = new Map<string, { t: number; c: number; ad: string }>();
  for (const l of L) for (const b of l.bekleme || []) { const k = norm(b.ad); const w = waits.get(k) || { t: 0, c: 0, ad: b.ad }; w.t += b.saat; w.c++; waits.set(k, w); }
  [...waits.values()].filter((w) => w.t / w.c >= 24).sort((a, b) => b.t / b.c - a.t / a.c).slice(0, 2)
    .forEach((w) => out.genel.push(`"${w.ad}" adımı geçmişte ortalama ${dur((w.t / w.c) * HOUR)} bekledi.`));
  if (musteri) {
    const m = norm(musteri);
    const mine = L.filter((l) => norm(l.baglam?.musteri || "") === m && (!wsId || l.ws === wsId));
    if (mine.length) {
      const mw = new Map<string, { t: number; c: number; ad: string; dis: boolean }>();
      for (const l of mine) for (const b of l.bekleme || []) { const k = norm(b.ad); const w = mw.get(k) || { t: 0, c: 0, ad: b.ad, dis: !!b.dis || norm(b.sahip || "").includes(m) }; w.t += b.saat; w.c++; mw.set(k, w); }
      [...mw.values()].filter((w) => w.t / w.c >= 24).sort((a, b) => b.t / b.c - a.t / a.c).slice(0, 3).forEach((w) => {
        out.musteri.push(w.dis
          ? `${musteri}, geçmiş ${w.c} akışta "${w.ad}" adımında ortalama ${dur((w.t / w.c) * HOUR)} bekletti; tahmini süre buna göre uzatıldı.`
          : `${musteri} akışlarında "${w.ad}" adımı ortalama ${dur((w.t / w.c) * HOUR)} sırada bekledi (ekip içi); tahmini süre buna göre uzatıldı.`);
        out.ek_sure.set(norm(w.ad), Math.round((w.t / w.c / 24) * 4) / 4);
      });
      for (const l of mine) for (const e of l.eklenen || []) {
        const k = norm(e.tur_kod || e.ad); if (out.ekle.some((x) => norm(x.tur_kod || x.ad) === k)) continue;
        out.ekle.push(e);
        out.musteri.push(`${musteri} için geçmişte sonradan eklenen "${e.ad}" adımı bu kez baştan eklendi${e.neden ? ` (${e.neden})` : ""}.`);
      }
    }
  }
  if (cevaplar) {
    const m = norm(musteri || "");
    const on = Object.keys(cevaplar).filter((k) => truthy(cevaplar[k]));
    const sim = L.filter((l) => (!wsId || l.ws === wsId) && (!m || norm(l.baglam?.musteri || "") !== m) && l.baglam?.cevaplar && on.every((k) => truthy(l.baglam.cevaplar[k])));
    if (sim.length >= 2) {
      const cnt = new Map<string, { c: number; e: any }>();
      for (const l of sim) for (const e of l.eklenen || []) { const k = norm(e.tur_kod || e.ad); const x = cnt.get(k) || { c: 0, e }; x.c++; cnt.set(k, x); }
      const etiket = on.length ? `Benzer müşterilerde (${on.join(", ")})` : "Benzer akışlarda";
      for (const [k, x] of cnt) {
        if (x.c < 2 || x.c / sim.length < 0.5 || out.ekle.some((y) => norm(y.tur_kod || y.ad) === k)) continue;
        out.ekle.push(x.e);
        out.musteri.push(`${etiket} ${sim.length} akıştan ${x.c} tanesinde "${x.e.ad}" adımı sonradan eklenmişti${x.e.neden ? ` (${x.e.neden})` : ""}; bu kez baştan eklendi.`);
      }
      const sw = new Map<string, { t: number; c: number; ad: string }>();
      for (const l of sim) for (const b of l.bekleme || []) if (b.dis) { const k = norm(b.ad); const w = sw.get(k) || { t: 0, c: 0, ad: b.ad }; w.t += b.saat; w.c++; sw.set(k, w); }
      [...sw.values()].filter((w) => w.t / w.c >= 48 && !out.ek_sure.has(norm(w.ad))).sort((a, b) => b.t / b.c - a.t / a.c).slice(0, 2).forEach((w) => {
        out.musteri.push(`${etiket} "${w.ad}" adımında müşteri tarafı ortalama ${dur((w.t / w.c) * HOUR)} bekletti; tahmini süre buna göre uzatıldı.`);
        out.ek_sure.set(norm(w.ad), Math.round((w.t / w.c / 24) * 4) / 4);
      });
    }
  }
  return out;
}

// ---------- şablon ----------
function instantiate(sab: any, cevaplar: Record<string, unknown>, degisken: Record<string, string>) {
  const sub = (t: any) => t == null ? t : String(t).replace(/\{(\w+)\}/g, (m, k) => (degisken && degisken[k]) || m);
  const all: any[] = sab.adimlar || [];
  const keep = all.filter((s) => !s.kosul || truthy(cevaplar[s.kosul]));
  const keepSet = new Set(keep.map((s) => s.kod));
  const byKod = new Map(all.map((s) => [s.kod, s]));
  const resolve = (kod: string, seen: Set<string>): string[] => {
    if (keepSet.has(kod)) return [kod];
    if (seen.has(kod)) return [];
    seen.add(kod);
    return ((byKod.get(kod) || {}).bagimli || []).flatMap((k: string) => resolve(k, seen));
  };
  const noOf = new Map(keep.map((s, i) => [s.kod, i + 1]));
  return keep.map((s) => ({
    ad: sub(s.ad), aciklama: sub(s.aciklama), sahip: sub(s.sahip), sahip_tip: s.sahip_tip || "insan", arac: s.arac || null,
    kriter: sub(s.kriter), beklenen_cikti: sub(s.beklenen_cikti), karar_kriteri: sub(s.karar_kriteri), sure_tahmin_gun: s.sure_tahmin_gun,
    bagimli: [...new Set((s.bagimli || []).flatMap((k: string) => resolve(k, new Set())))].map((k) => noOf.get(k)),
    _kod: s.kod,
  }));
}

function backward(steps: any[], hedef: string, ilkCapa: number | null = null, sonra: Set<number> = new Set()) {
  const H = dayNum(hedef) + 1;
  const by = new Map(steps.map((s) => [s.no, s]));
  const kids = new Map<number, number[]>();
  for (const s of steps) for (const d of s.bagimli) { const k = kids.get(d) || []; k.push(s.no); kids.set(d, k); }
  const LF = new Map<number, number>();
  for (const s of topo(steps).reverse()) {
    let lf = H;
    if (s.son_tarih && isDate(s.son_tarih)) lf = Math.min(lf, dayNum(s.son_tarih) + 1); // sabit ya da verilmiş son tarih çapadır
    else if (ilkCapa != null && !sonra.has(s.no) && !(kids.get(s.no) || []).length) lf = Math.min(lf, ilkCapa); // olayla bağı olmayan uç adım: olaydan önce bitsin
    for (const c of kids.get(s.no) || []) { const v = LF.get(c)! - num(by.get(c).sure_tahmin_gun); if (v < lf) lf = v; }
    LF.set(s.no, lf);
  }
  let n = 0;
  for (const s of steps) if (!s.son_tarih) { s.son_tarih = numDay(Math.ceil(LF.get(s.no)! - 1e-9) - 1); n++; }
  return n;
}

// takvim: sabit tarihli adımlar (_capa), hedef tarihe göre geriye planlama, netleştir başa, geçmiş tarih yok.
// Tarihi henüz belli olmayan olay (_capaSoru) ve ondan sonraki adımlara tarih verilmez.
function takvim(steps: any[], hedef: string | null, bugun: number, notes: string[]) {
  const capali = steps.filter((s) => s._capa && isDate(s._capa));
  for (const s of capali) s.son_tarih = numDay(dayNum(s._capa) + Math.max(1, Math.ceil(num(s.sure_tahmin_gun))) - 1);
  const sonra = new Set<number>(); // çapalı adımlar ve onlardan sonra gelenler
  if (capali.length) {
    for (const s of topo(steps)) if (s._capa || s.bagimli.some((d: number) => sonra.has(d))) sonra.add(s.no);
    // kesirli ileri hesap: yalnızca çapadan SONRAKİ işler hedefi uzatabilir; çapadan önceki sıkışıklık uyarıdır
    const ef = new Map<number, number>();
    for (const s of topo(steps)) {
      const bas = Math.max(bugun, ...s.bagimli.map((d: number) => ef.get(d) ?? bugun));
      ef.set(s.no, s._capa ? dayNum(s._capa) + num(s.sure_tahmin_gun) : bas + num(s.sure_tahmin_gun));
    }
    const enGec = numDay(Math.ceil(Math.max(...[...sonra].map((n) => ef.get(n)!)) - 1e-9) - 1);
    if (!hedef || hedef < enGec) { if (hedef) notes.push(`Hedef ${fmtD(hedef)}, sabit tarihli adımdan sonra yapılacak işlere yetmiyor; hedef ${fmtD(enGec)} yapıldı.`); hedef = enGec; }
    for (const c of capali) {
      const once = Math.max(bugun, ...c.bagimli.map((d: number) => ef.get(d) ?? bugun));
      if (once > dayNum(c._capa) + 1e-9) notes.push(`"${c.ad}" (${fmtD(c._capa)}) öncesindeki işler sırayla yapılırsa ancak ${fmtD(numDay(Math.ceil(once - 1e-9)))} yetişir; takvim sıkışık. Süreleri kısalt, işleri paralel yürüt ya da kapsamı daralt.`);
    }
  }
  let planned = 0;
  const ilkCapa = capali.length ? Math.min(...capali.map((s) => dayNum(s._capa))) : null;
  if (hedef) planned = backward(steps, hedef, ilkCapa, sonra);
  // tarihi bekleyen olay ve sonrası: uydurma tarih yok
  const bekler = new Set<number>();
  for (const s of topo(steps)) if (s._capaSoru || s.bagimli.some((d: number) => bekler.has(d))) bekler.add(s.no);
  for (const s of steps) if (bekler.has(s.no) && !s._sabit) { if (s.son_tarih) planned--; s.son_tarih = null; }
  // netleştir adımları en başa; hiçbir son tarih bugünden önce olmasın
  const today = numDay(bugun);
  for (const s of steps) if (s._netlestir) { const erken = numDay(bugun + Math.max(1, Math.ceil(num(s.sure_tahmin_gun)))); if (!s.son_tarih || s.son_tarih > erken) s.son_tarih = erken; }
  const gecmis = steps.filter((s) => s.son_tarih && s.son_tarih < today);
  for (const s of gecmis) s.son_tarih = today;
  if (gecmis.length) notes.push(`${gecmis.length} adımın son tarihi hedefe göre bugünden önceye düşüyordu (${gecmis.map((s) => s.no).join(", ")}); bugüne çekildi. Takvim sıkışık.`);
  return { hedef, planned: Math.max(0, planned), capali, bekler };
}

function shortCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function validateSteps(raw: any[], kurallar: any) {
  if (!Array.isArray(raw) || raw.length < 1) throw new Error("En az bir adım gerekli.");
  if (raw.length > 40) throw new Error("En fazla 40 adım; daha büyük işi birden çok akışa böl.");
  const errs: string[] = [];
  const n = raw.length;
  const steps = raw.map((a, i) => {
    const no = i + 1;
    const s: any = {
      no, ad: String(a.ad || "").trim(), aciklama: a.aciklama || null, sahip: String(a.sahip || "").trim(),
      sahip_tip: ["insan", "agent", "dis"].includes(a.sahip_tip) ? a.sahip_tip : "insan", arac: a.arac || null,
      kriter: String(a.kriter || "").trim(), beklenen_cikti: a.beklenen_cikti || null, karar_kriteri: a.karar_kriteri || null,
      son_tarih: a.son_tarih || null, sure_tahmin_gun: a.sure_tahmin_gun != null ? num(a.sure_tahmin_gun) : null,
      bagimli: [...new Set((a.bagimli || []).map(Number))], _kod: a._kod || null, _ek: a._ek || null,
    };
    if (!s.ad) errs.push(`Adım ${no}: ad boş.`);
    if (!s.sahip) errs.push(`Adım ${no} (${s.ad}): sahip yok. Her adımın bir sahibi olmalı.`);
    if (!s.kriter) errs.push(`Adım ${no} (${s.ad}): kriter yok. "Bitti mi" testini yaz.`);
    if (s.son_tarih && !isDate(s.son_tarih)) errs.push(`Adım ${no}: son_tarih YYYY-AA-GG olmalı.`);
    for (const d of s.bagimli) if (!Number.isInteger(d) || d < 1 || d > n || d === no) errs.push(`Adım ${no}: geçersiz bağımlılık ${d}.`);
    if (kurallar.karar_insanda !== false && s.sahip_tip === "agent" && kararAdimi(s))
      errs.push(`Adım ${no} (${s.ad}) bir karar/onay/ödeme adımı; sahibi insan olmalı. Agent hazırlık adımı ayrı olsun.`);
    return s;
  });
  if (errs.length) throw new Error("Akış kurulamadı:\n- " + errs.join("\n- "));
  topo(steps);
  return steps;
}

// ---------- araçlar ----------
export const TOOLS = [
  {
    name: "devir_tasla",
    description: "Kullanıcı bir hedef, iş ya da 'şunu yapmam lazım' cümlesi yazdığında, tavsiye vermeden ÖNCE bunu çağır; tek cümle yeter. Tavsiyeni taslağın varsayımları ve sorularıyla birlikte ver. Devir taslak akışı çıkarır, varsayımlarını yazar ve yalnızca akışı gerçekten değiştirecek en fazla 5 soruyu seçer. Soruları kullanıcıya tek mesajda sor, cevaplarla devir_akis_olustur({ taslak, cevaplar }) çağır. Yanıt 30–60 saniye sürebilir.",
    inputSchema: { type: "object", required: ["cumle"], properties: {
      cumle: { type: "string", description: "Kullanıcının işi anlattığı cümle, olduğu gibi." },
      baglam: { type: "object", description: "Kullanıcı hakkında bildiklerin: { varlik: 'Ege Bank', iliski: 'kendi' | 'musteri' | 'isveren' | 'kisisel', ... }. varlik işin bağlı olduğu şirket, proje ya da kişi; iliski kullanıcının onunla ilişkisi (kendi şirketi/projesi mi, hizmet verdiği müşterisi mi, çalıştığı şirket mi, kişisel mi). Biliyorsan iliski'yi mutlaka ver: dış onay ve dışarıdan istenecek girdi adımlarını o belirler. Aynı varlıkla geçmiş akışlar buradan eşleşir." },
      hedef_tarih: { type: "string", description: "Kullanıcı tarih verdiyse YYYY-AA-GG." },
    } },
  },
  {
    name: "devir_kurallar",
    description: "İyi akış kurallarını, ekibin şablonlarını, ön sorularını ve öğrenimlerini gösterir. Yeni iş için önce devir_tasla'yı kullan; bunu şablonları incelemek ya da elle kurmak için kullan.",
    inputSchema: { type: "object", properties: { sablon_kod: { type: "string", description: "Ayrıntısı istenen şablon (ör. aylik-kapanis)." }, musteri: { type: "string", description: "Varsa bu müşteriye/kişiye özel geçmiş öğrenimler de gelir." }, cevaplar: { type: "object", description: "Ön soru cevapları biliniyorsa; benzer akışların öğrenimleri gelir." } } },
  },
  {
    name: "devir_akis_olustur",
    description: "Akışı kurar. Asıl yol: devir_tasla'nın verdiği taslak kodu ve kullanıcının cevaplarıyla çağır ({ taslak, cevaplar }). Diğer yollar: sablon_kod + cevaplar + degiskenler ya da adimlar listesini kendin ver. hedef_tarih varsa son tarihler geriye doğru planlanır.",
    inputSchema: {
      type: "object",
      properties: {
        taslak: { type: "string", description: "devir_tasla'nın verdiği taslak kodu (ör. T7K2F)." },
        baslik: { type: "string" }, amac: { type: "string" },
        hedef_tarih: { type: "string", description: "YYYY-AA-GG; işin bitmesi gereken son gün." },
        sablon_kod: { type: "string" },
        cevaplar: { type: "object", description: "Soru kodu → cevap. Bilinmiyorsa \"bilmiyorum\" yaz; akış durmaz, netleştir adımı eklenir." },
        degiskenler: { type: "object", description: "Şablondaki {musteri}, {donem} gibi yer tutucuların değerleri." },
        baglam: { type: "object", description: "Akışı tanımlayan anahtarlar; ör. { varlik: 'Yıldız Kafe', iliski: 'musteri', donem: '2026-09' }. Öğrenimler varlığa göre eşleşir." },
        kurallar: { type: "object", description: "ör. { karar_insanda: true, veri_ozet: true }" },
        ayni_varlik_onay: { type: "boolean", description: "Aynı varlık için son 24 saatte kurulmuş aktif akış varken yine de kurmak için true. Önce kullanıcıya sor: mükerrer olabilir." },
        adimlar: {
          type: "array", description: "Şablonsuz kurulumda adımlar. bagimli, bu listedeki 1'den başlayan sıra numaralarıdır.",
          items: { type: "object", required: ["ad", "sahip", "kriter"], properties: {
            ad: { type: "string" }, aciklama: { type: "string" }, sahip: { type: "string", description: "Kişi, ekip, dış katılımcı ya da agent adı." },
            sahip_tip: { type: "string", enum: ["insan", "agent", "dis"] }, arac: { type: "string", description: "Agent ya da kişinin kullandığı araç (Claude, ChatGPT, Figma...)." },
            kriter: { type: "string", description: "Adımın bitti sayılması için test." }, beklenen_cikti: { type: "string" }, karar_kriteri: { type: "string" },
            son_tarih: { type: "string" }, sure_tahmin_gun: { type: "number" }, bagimli: { type: "array", items: { type: "integer" } } } },
        },
        katilimcilar: { type: "array", items: { type: "object", properties: { ad: { type: "string" }, rol: { type: "string" }, iletisim: { type: "string" } } } },
      },
    },
  },
  {
    name: "devir_akislar",
    description: "Akışları özetler: her akışta ilerleme, şu an kimde ne kadar süredir beklediği, hedef tarih ve en erken bitiş. En üstte portföy özeti ve riskteki akışlar. 'Bugün neye bakayım', 'ne durumdayız' sorularında çağır.",
    inputSchema: { type: "object", properties: { durum: { type: "string", enum: ["aktif", "kapandi", "hepsi"] }, sablon_kod: { type: "string" }, ara: { type: "string", description: "Başlık ya da müşteri adında arama." } } },
  },
  {
    name: "devir_akis",
    description: "Tek bir akışın tamamı: adımlar, durumlar, son tarihler, hız ölçüleri (toplam süre, aktif çalışma, bekleme, kritik yoldaki bekleme, eşzamanlı iş), kritik yol, son hareketler.",
    inputSchema: { type: "object", required: ["akis"], properties: { akis: { type: "string", description: "Akış kodu (ör. K7M2)." } } },
  },
  {
    name: "devir_adim_oku",
    description: "Bir adım üzerinde çalışmaya başlamadan önce çağır: amacı, bitti kriteri, karar kriteri, bağımlılıklar, sonraki adımlar, çıktılar, geçmiş ve öğrenimler gelir. Kullanıcı bir Devir bağlantısıyla sohbete geldiyse ilk iş bunu çağır.",
    inputSchema: { type: "object", required: ["akis", "no"], properties: { akis: { type: "string" }, no: { type: "integer" } } },
  },
  {
    name: "devir_adim_guncelle",
    description: "Bir adımın durumunu, ilerlemesini ya da çıktılarını yazar. Çalışmaya başlayınca durum=suruyor; birini/bir şeyi bekliyorsan durum=engelli ve engel; kriter karşılanınca durum=tamam. İşi sen (AI) yaptıysan kim_tip=agent; kullanıcı kendisi yaptıysa ya da onayladıysa kim_tip=insan. Karar/onay/ödeme adımlarını yalnızca insan tamamlayabilir.",
    inputSchema: {
      type: "object", required: ["akis", "no"],
      properties: {
        akis: { type: "string" }, no: { type: "integer" },
        durum: { type: "string", enum: ["suruyor", "engelli", "tamam", "atlandi", "ertelendi", "hazir"], description: "atlandi: gerek kalmadı. ertelendi: yapılması gerekiyor ama bu akışta değil; açık iş olarak kalır ve varlığın sonraki işlerine taşınır." },
        ilerleme: { type: "string", description: "Kısa durum cümlesi, ör. '38/42 fatura yüklendi'." },
        not: { type: "string", description: "Olay kaydına düşülecek açıklama; atlama için neden." },
        atlama_nedeni: { type: "string", enum: ["gerek_kalmadi", "mukerrer", "varsayim_yanlis"], description: "durum=atlandi ise: gerek_kalmadi (iş artık gerekmiyor), mukerrer (aynı iş başka adımda yapılıyor), varsayim_yanlis (adım yanlış bir varsayım yüzünden kurulmuştu; Devir bunu öğrenir)." },
        engel: { type: "string", description: "durum=engelli ise ne ya da kim bekleniyor." },
        karar: { type: "object", description: "Karar adımında seçenekler ve önerin: { secenekler: [{ ad, alt (ör. 'Rize/Hemşin · çay'), etiket (ör. 'faturalı'), uyari (teyit bekliyorsa true) }], oneri: { secim: [seçilen adlar], ozet (ör. '5'ini de kabul et'), gerekce } }. Kararı kullanıcı verir.", properties: { tur: { type: "string", description: "Seçeneklerin ne olduğu, tekil (ör. çiftçi, teklif)." }, secenekler: { type: "array", items: { anyOf: [{ type: "string" }, { type: "object", properties: { ad: { type: "string" }, alt: { type: "string" }, etiket: { type: "string" }, uyari: { type: "boolean" } }, required: ["ad"] }] } }, oneri: { type: "object", properties: { secim: { type: "array", items: { type: "string" } }, ozet: { type: "string" }, gerekce: { type: "string" } } } } },
        karar_secimi: { type: "array", items: { type: "string" }, description: "Kullanıcının seçtiği seçenekler. Agent olarak seçimi kaydetmek için devir_karar_ver'i kullan." },
        engel_kisa: { type: "string", description: "durum=engelli ise beklenen şeyin 1-3 kelimelik kısa adı, belirtme hâlinde (ör. 'kapak fotoğraflarını'); ana ekranın cümlesinde kullanılır." },
        cikti: {
          description: "Bu adımda üretilen iş. Nesne ver: { ad, ozet (1-3 satır, her zaman), icerik (metin çıktısının tamamı, markdown: mesaj, teklif, brif…), url ve kaynak (Confluence, Google Docs, Instagram… dış bir araçtaysa), durum (taslak|onaylandi|yayinda), paylasim (ekip|dis: dış katılımcı görebilsin mi) }. Aynı ad tekrar yazılırsa yeni sürüm olur. Liste de verebilirsin.",
          anyOf: [
            { type: "string" },
            { type: "object", properties: { ad: { type: "string" }, ozet: { type: "string" }, icerik: { type: "string" }, url: { type: "string" }, kaynak: { type: "string" }, durum: { type: "string", enum: ["taslak", "onaylandi", "yayinda"] }, paylasim: { type: "string", enum: ["ekip", "dis"] } }, required: ["ad"] },
            { type: "array", items: { anyOf: [{ type: "string" }, { type: "object", properties: { ad: { type: "string" }, ozet: { type: "string" }, icerik: { type: "string" }, url: { type: "string" }, kaynak: { type: "string" }, durum: { type: "string", enum: ["taslak", "onaylandi", "yayinda"] }, paylasim: { type: "string", enum: ["ekip", "dis"] } }, required: ["ad"] }] } },
          ],
        },
        sahip: { type: "string" }, sahip_tip: { type: "string", enum: ["insan", "agent", "dis"], description: "Sahip değişiyorsa yeni sahibin tipi. Kullanıcının kendisi ya da ekibi insan, ekip dışı biri dis." }, son_tarih: { type: "string" },
        arac: { type: "string", description: "Kullandığın araç adı, ör. Claude, ChatGPT." },
        zorla: { type: "boolean", description: "Bağımlılıklar bitmeden başlatmak için; not ile neden yaz." },
        cevap: { type: "string", description: "Bu adım bitince belli olan açık sorunun cevabı (adımda 'bitince cevaplanır' yazıyorsa). Devir akışı ona göre yeniden kurar." },
      },
    },
  },
  {
    name: "devir_karar_ver",
    title: "Karar ver",
    description: "Bir karar adımını kullanıcının verdiği kararla tamamlar. Yalnızca kullanıcı kararı bu konuşmada açıkça verdiyse çağır; öneri sunmak için devir_adim_guncelle'nin karar alanını kullan. Kayıt kullanıcının adına, senin aracınla verilmiş olarak düşer; çalışma alanı ayarı izin vermiyorsa Devir kararı web onayına yönlendirir.",
    annotations: { title: "Karar ver", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object", required: ["akis", "no"],
      properties: {
        akis: { type: "string" }, no: { type: "integer" },
        secim: { type: "array", items: { type: "string" }, description: "Kullanıcının seçtiği seçenekler (seçenekli kararlarda)." },
        not: { type: "string", description: "Kararın kısa gerekçesi ya da kullanıcının söylediği." },
        cikti: { type: "object", properties: { ad: { type: "string" }, ozet: { type: "string" } } },
      },
    },
  },
  {
    name: "devir_adim_ekle",
    description: "Akışa sonradan adım ekler. Konuşmada akışta olmayan bir iş doğduğunda (birinden bir şey istendiğinde, unutulan bir kalem çıktığında) çağır ve nedenini yaz; Devir bunu öğrenir ve bir sonraki benzer akışa baştan ekler.",
    inputSchema: {
      type: "object", required: ["akis", "ad", "sahip", "kriter", "neden"],
      properties: {
        akis: { type: "string" }, ad: { type: "string" }, sahip: { type: "string" }, sahip_tip: { type: "string", enum: ["insan", "agent", "dis"] }, arac: { type: "string" },
        kriter: { type: "string" }, aciklama: { type: "string" }, son_tarih: { type: "string" }, sure_tahmin_gun: { type: "number" },
        bagimli: { type: "array", items: { type: "integer" }, description: "Bu adımın beklediği adım numaraları." },
        bekleyenler: { type: "array", items: { type: "integer" }, description: "Artık bu yeni adımı beklemesi gereken adım numaraları." },
        neden: { type: "string", description: "Bu adım neden sonradan çıktı? Öğrenim için." },
      },
    },
  },
  {
    name: "devir_cikti_oku",
    description: "Bir çıktının tam içeriğini getirir (devir_adim_oku uzun içeriği kısaltır). id, devir_adim_oku'da köşeli parantez içinde görünür.",
    inputSchema: { type: "object", required: ["akis", "id"], properties: { akis: { type: "string" }, id: { type: "string", description: "Çıktı kimliği." } } },
  },
  {
    name: "devir_karar",
    description: "Bir şirket, proje ya da kişi (varlık) için verilen kararı kaydeder ya da geçerli kararları listeler. Kullanıcı bir kural, oran, kapsam ya da istisna belirlediğinde çağır (ör. 'komisyon %12', 'pilotta yalnızca faturalı satıcı; vitrin için istisna'). Kararlar her araçtan görünür; taslak motoru onları kısıt olarak kullanır. karar vermeden çağırırsan listeler.",
    inputSchema: { type: "object", properties: {
      varlik: { type: "string", description: "Kararın ait olduğu varlık (ör. Hasat). Boşsa akis'tan alınır." },
      karar: { type: "string", description: "Kararın kendisi, tek cümle." },
      kapsam: { type: "string", description: "Neye uygulanır (ör. satış, pilot, Ege çiftçileri)." },
      istisna: { type: "string" },
      akis: { type: "string", description: "Kararın verildiği akış kodu." }, no: { type: "integer", description: "Kararın verildiği adım." },
      yerine: { type: "string", description: "Bu karar eski bir kararın yerine geçiyorsa onun kimliği." },
      konu: { type: "string", description: "Karar bir adım türünü karşılıyorsa o adım türü kodu (ör. komisyon-karari); o adım sonraki akışlarda kurulmaz." },
    } },
  },
  {
    name: "devir_cevapla",
    description: "Akış kurulurken açık kalan bir sorunun cevabı belli olunca çağır (sonuç, tutar, dışarıdan verilen tarih ya da 'bilmiyorum' denmiş soru). Devir seçilmeyen dalın adımlarını atlar, tarihe bağlı adımları planlar ve takvimi yeniden kurar. Açık sorular devir_akis'ta görünür. Bir adımı tamamlarken cevap da geldiyse devir_adim_guncelle'ye cevap alanıyla da verebilirsin.",
    inputSchema: { type: "object", required: ["akis", "soru", "cevap"], properties: {
      akis: { type: "string" }, soru: { type: "string", description: "Açık sorunun kodu (ör. ihale_sonucu, durusma_tarihi)." },
      cevap: { type: "string", description: "Seçim sorusunda seçenek, tarih sorusunda YYYY-AA-GG." },
      arac: { type: "string" },
    } },
  },
  {
    name: "devir_akis_kapat",
    description: "Biten akışı kapatır (neden: tamamlandi; yapılmayacak iş için iptal, kopya akış için mukerrer); toplam süre, bekleme, sonradan eklenen ve atlanan adımlar, yanlış çıkan varsayımlar deneyim olarak ekibin belleğine yazılır ve derslere dönüşür. Benzer bir sonraki işte hatırlanır.",
    inputSchema: { type: "object", required: ["akis"], properties: { akis: { type: "string" }, degerlendirme: { type: "string" }, zorla: { type: "boolean" }, neden: { type: "string", enum: ["tamamlandi", "iptal", "mukerrer"], description: "Varsayılan tamamlandi. iptal (iş yapılmayacak) ve mukerrer (başka akışın kopyası) deneyim yazmaz; bu akışa uygulanan dersler 'bu işte uymadı' sayılır." } } },
  },
  {
    name: "devir_sabitle",
    description: "Bir akışı ekibin standart süreci olarak sabitler (düzenli tekrar eden ya da düzenlemeye tabi işler için). Benzer bir sonraki işte taslak bu süreçten başlar; motor yalnızca soruları ve dalları uyarlar. kaldir ile sabitlenmiş süreci kaldırır. Kullanıcı açıkça isterse çağır.",
    inputSchema: { type: "object", properties: { akis: { type: "string", description: "Sabitlenecek akışın kodu." }, ad: { type: "string", description: "Sürecin adı (ör. Aylık kapanış)." }, aciklama: { type: "string" }, kaldir: { type: "string", description: "Kaldırılacak standart sürecin kodu." } } },
  },
  {
    name: "devir_alt_akis",
    description: "Bir akıştaki aynı adımlar birden çok kalem için ayrı ayrı yürüyecekse (her çiftçi, müşteri, aday, şube için belge toplama, görüşme, sözleşme gibi) o adımları kalem başına bir alt akışa böler. Üst akışta bu adımlar özet adım olur (ör. '3/5 çiftçi tamam'); hepsi bitince sonraki adımlar açılır. Sonradan kalem eklemek için aynı akışla yeni kalemleri ver. Adım adlarında {kalem} yazarsan kalemin adıyla değişir.",
    inputSchema: { type: "object", required: ["akis", "kalemler"], properties: {
      akis: { type: "string" },
      adimlar: { type: "array", items: { type: "integer" }, description: "Her kalem için tekrarlanacak adım numaraları (ör. [3,4,5]). Mevcut gruba kalem eklerken verme." },
      kalemler: { type: "array", items: { type: "string" }, description: "Kalemlerin adları (ör. çiftçi adları)." },
      kalem_turu: { type: "string", description: "Kalemin ne olduğu, tekil (ör. çiftçi, müşteri, aday)." },
      kalem_sahibi_adimlar: { type: "array", items: { type: "integer" }, description: "Sahibi kalemin kendisi olan adımlar (ör. çiftçinin belgeleri göndermesi)." },
      grup: { type: "string", description: "Akışta birden çok tekrar grubu varsa kalem eklenecek grubun kodu (ör. G1)." },
    } },
  },
  {
    name: "devir_dersler",
    description: "Devir'in ekibin geçmiş işlerinden çıkardığı dersleri listeler; kullanıcı bir aday dersi onaylarsa ya da yanlış bulursa onu kaydeder. Onaylanan ders kanıtlı olur ve benzer işlerde uygulanır; reddedilen ders bir daha önerilmez.",
    inputSchema: { type: "object", properties: { islem: { type: "string", enum: ["liste", "onayla", "reddet"] }, ders: { type: "string", description: "Ders kodu (ör. D12); onayla ve reddet için." }, ara: { type: "string", description: "Listede metin araması." } } },
  },
];

export const INSTRUCTIONS = `Devir, insanların ve AI agent'larının aynı işi yürüttüğü ortak durum kaydıdır. Kurallar:
- Kullanıcı bir hedef ya da iş cümlesi yazdığında ("…kazandırmam lazım", "…hazırlamam lazım") önce devir_tasla'yı çağır; tavsiyeyi ondan sonra, taslağın varsayımları ve sorularıyla birlikte ver. Önceki işlerden ya da sohbet hafızandan bildiklerini (bölge, kanal, lojistik, onay) bu iş için de geçerli sayma; Devir'in sorularıyla kullanıcıya sor.
- Sohbet hafızanda olup Devir'in geçerli kararlarında olmayan bir kural ya da karar varsa (ör. "pilotta hayvansal ürün yok") kullanıcıya hâlâ geçerli olup olmadığını sor; onaylarsa devir_karar ile kaydet.
- Kullanıcı çok adımlı yeni bir iş başlattığında (proje, organizasyon, müşteri süreci, taşınma, kampanya…) devir_tasla'yı kullanıcının cümlesiyle çağır. Kullanıcı hakkında bildiklerini baglam'a koy; özellikle varlık (şirket, proje, kişi) ve kullanıcının onunla ilişkisi (kendi, musteri, isveren, kisisel). Dönen soruları kullanıcıya tek mesajda sor, cevaplarla devir_akis_olustur({ taslak, cevaplar }) çağır. Sorulmayanlar için Devir varsayım yapar; varsayımları kullanıcıya kısaca söyle ve yanlış olanı kurmadan önce düzelt.
- Bir adımı atlarken atlama_nedeni ver: gerek_kalmadi, mukerrer ya da varsayim_yanlis; not'a nedenini yaz. Sahibini değiştiriyorsan sahip_tip'i de ver. Devir yanlış çıkan varsayımı öğrenir ve bir dahaki sefere sorar.
- Akışın tamamını görmek için devir_akis'ı çağır; devir_adim_oku'yu yalnızca üzerinde çalışacağın adım için çağır. Başlarken, ilerledikçe ve bitince devir_adim_guncelle ile yaz. Kullanıcı ayrıca istemese de yaz.
- Ürettiğin her işi cikti olarak yaz: ozet her zaman; mesaj, teklif, brif gibi metinlerin tamamı icerik'e; dış bir araçtaysa (Confluence, Docs, sosyal medya) url ve kaynak. Devir işin kendisini sonraki adıma devreder.
- Kullanıcı bir karar verdiğinde (oran, kural, kapsam, istisna) devir_karar ile kaydet. Yeni bir işe girişmeden önce devir_adim_oku'daki geçerli kararlarla çelişip çelişmediğine bak; çelişiyorsa kullanıcıya sor.
- Bir iş gerekli ama bu akışta yapılmayacaksa atlama, durum=ertelendi yap; açık iş olarak kalır ve sonraki işlere taşınır.
- Akışta açık soru varsa (sonradan belli olacak sonuç, tutar ya da tarih; "bilmiyorum" denmiş soru) cevap belli olunca devir_cevapla ile yaz ya da o adımı tamamlarken devir_adim_guncelle'ye cevap alanıyla ver; Devir seçilmeyen dalı atlar ve takvimi yeniden kurar. Tarihi bilinmeyen adıma tarih uydurma.
- Konuşmada akışta olmayan yeni bir iş doğarsa devir_adim_ekle ile ekle ve nedenini yaz; Devir hangi sorunun eksik kaldığını öğrenir.
- Karar, onay ve ödeme adımlarında son söz kullanıcıdadır: özetle, önerini göster ve kullanıcının kararını iste. Kullanıcı kararı bu konuşmada açıkça verirse devir_karar_ver ile kaydet; kararı sen verme. Kayıt kullanıcının adına, senin aracınla verilmiş olarak düşer; Devir yazanı bağlantının sahibinden belirler.
- Akış bitince devir_akis_kapat ile kapat; Devir bu işten ders çıkarır ve benzer bir sonraki işte hatırlar.
- Taslakta "Devir'in hatırladıkları" bölümü varsa kullanıcıya kısaca aktar; kullanıcı bir dersi yanlış bulursa devir_dersler ile reddet, doğrularsa onayla.
- Aynı adımlar birden çok kalem için ayrı yürüyecekse (her çiftçi, müşteri ya da aday için) devir_alt_akis ile kalem başına alt akışa böl; sonra her kalemin adımını kendi alt akışında güncelle.
- Kişisel ve finansal ayrıntıyı nota açık yazma; özet ve toplam yaz.`;

export async function callTool(name: string, a: any, ctx: Ctx): Promise<string> {
  a = a || {};
  BU_YIL = Number(todayIst(ctx.now).slice(0, 4));
  switch (name) {
    case "devir_tasla": return tasla(a, ctx);
    case "devir_kurallar": return kurallar(a, ctx);
    case "devir_akis_olustur": return olustur(a, ctx);
    case "devir_akislar": return akislar(a, ctx);
    case "devir_akis": return akisDetay(a, ctx);
    case "devir_adim_oku": return adimOku(a, ctx);
    case "devir_adim_guncelle": return adimGuncelle(a, ctx);
    case "devir_karar_ver": if (kararDuzeyi(ctx, actor(ctx, a)) !== "insan") return kararBeyan(a, ctx); return adimGuncelle({ akis: a.akis, no: a.no, durum: "tamam", not: a.not, cikti: a.cikti, ...(Array.isArray(a.secim) && a.secim.length ? { karar_secimi: a.secim } : {}) }, ctx, { kararAraci: true });
    case "devir_adim_ekle": return adimEkle(a, ctx);
    case "devir_akis_kapat": return kapat(a, ctx);
    case "devir_cikti_oku": return ciktiOku(a, ctx);
    case "devir_karar": return karar(a, ctx);
    case "devir_cevapla": return cevapla(a, ctx);
    case "devir_sabitle": return sabitle(a, ctx);
    case "devir_dersler": return dersler(a, ctx);
    case "devir_alt_akis": return altAkis(a, ctx);
  }
  throw new Error(`Bilinmeyen araç: ${name}`);
}

const GENEL = [
  "Her adım tek bir işin devridir: bir sahibi (kişi, ekip, dış katılımcı ya da agent) ve bir 'bitti mi' testi (kriter) vardır.",
  "Bağımlılıkları açık yaz; birbirini beklemeyen işleri paralel kur.",
  "Hedef tarih varsa son tarihleri boş bırakabilirsin; Devir sure_tahmin_gun ile geriye doğru planlar.",
  "Karar, onay, ödeme ve imza adımlarının sahibi insandır; agent hazırlar, insan karar verir.",
  "Kişisel ve finansal veriyi notlara açık yazma; özet ve toplam yaz.",
  "Akış 3–15 adım olsun; daha büyüğü birden çok akıştır.",
  "Şablonun ön sorularını kurmadan önce kullanıcıya sor; cevaplar koşullu adımları açar.",
  "Konuşmada akışta olmayan bir iş doğarsa devir_adim_ekle ile ekle ve nedenini yaz; Devir bundan öğrenir.",
];

async function kurallar(a: any, ctx: Ctx) {
  const out: string[] = ["# Devir · iyi akış kuralları", ...GENEL.map((g, i) => `${i + 1}. ${g}`)];
  if (a.sablon_kod) {
    const sab = await getSablon(ctx, a.sablon_kod);
    if (!sab) throw new Error(`'${a.sablon_kod}' şablonu yok.`);
    out.push("", `## Şablon: ${sab.ad} (${sab.kod}, sürüm ${sab.surum})`, sab.aciklama || "");
    if ((sab.sorular || []).length) {
      out.push("", "Ön sorular (kurmadan önce kullanıcıya sor, cevaplar → cevaplar alanı):");
      for (const q of sab.sorular) out.push(`- ${q.kod}: ${q.soru}${q.neden ? ` — ${q.neden}` : ""}`);
    }
    const deg = new Set<string>();
    JSON.stringify(sab.adimlar).replace(/\{(\w+)\}/g, (_m: string, k: string) => { deg.add(k); return ""; });
    if (deg.size) out.push("", `Değişkenler (degiskenler alanı): ${[...deg].join(", ")}`);
    out.push("", "Adımlar:");
    for (const s of sab.adimlar) out.push(`- ${s.kod}: ${s.ad} — ${s.sahip}${s.sahip_tip === "agent" ? " (agent)" : s.sahip_tip === "dis" ? " (dış)" : ""}${s.kosul ? ` · yalnızca ${s.kosul}=evet ise` : ""}${s.bagimli && s.bagimli.length ? ` · bekler: ${s.bagimli.join(", ")}` : ""}`);
    const L = learnings(sab, a.musteri, ctx.ws.id, a.cevaplar);
    if (L.genel.length || L.musteri.length) { out.push("", "Öğrenimler:"); for (const l of [...L.genel, ...L.musteri]) out.push(`- ${l}`); }
    if (sab.kurallar && Object.keys(sab.kurallar).length) out.push("", `Şablon kuralları: ${JSON.stringify(sab.kurallar)}`);
    out.push("", "Kurulum: devir_akis_olustur({ baslik, sablon_kod, cevaplar, degiskenler, hedef_tarih, baglam: { musteri, donem } })");
  } else {
    const list = await sablonlar(ctx);
    out.push("", "## Şablonlar");
    for (const s of list) out.push(`- ${s.kod}: ${s.ad}${s.alan ? ` (${s.alan})` : ""} — ${(s.adimlar || []).length} adım, ${(s.sorular || []).length} ön soru, ${(s.ogrenimler || []).length} kapanmış akıştan öğrenim`);
    out.push("Uygun şablon yoksa adimlar listesini kurallara göre kendin kur.", "Ayrıntı için: devir_kurallar({ sablon_kod })");
  }
  return out.join("\n");
}

async function olustur(a: any, ctx: Ctx) {
  needTeam(ctx, "Akış oluşturmayı");
  if (a.hedef_tarih && !isDate(a.hedef_tarih)) throw new Error("hedef_tarih YYYY-AA-GG olmalı.");
  const kur = { karar_insanda: true, veri_ozet: true, ...(a.kurallar || {}) };
  const baglam: any = a.baglam && typeof a.baglam === "object" ? { ...a.baglam } : {};
  if (!baglam.musteri && baglam.varlik) baglam.musteri = baglam.varlik;
  const notes: string[] = [];
  const etkiNotlari: string[] = [];
  let sab: any = null, tk: any = null, u: any = null, turKod: string | null = null;
  let baslik = String(a.baslik || "").trim();
  let hedef: string | null = a.hedef_tarih || null;
  const degisken = { ...(a.degiskenler || {}) };
  let raw: any[];
  let fark: any = null;
  let L: ReturnType<typeof learnings>;
  if (a.taslak) {
    tk = await ctx.db.one("taslak", { kisa_kod: String(a.taslak).trim().toUpperCase(), ws_id: ctx.ws.id });
    if (!tk) throw bulunamadi(`'${a.taslak}' taslağı bulunamadı. Önce devir_tasla ile taslak çıkar.`);
    if (tk.durum === "iptal") throw new DevirHata(409, `${tk.kisa_kod} taslağından vazgeçildi${tk.akis_id ? " (aynı varlık için elle akış kuruldu)" : ""}. Gerekirse devir_tasla ile yeni taslak çıkar.`);
    if (tk.durum && tk.durum !== "acik") throw new Error(`Bu taslaktan zaten akış kuruldu. devir_akislar ile bak.`);
    const t = tk.taslak, S = tk.sorular || {};
    const kk = await kararlar(ctx, baglam.musteri || tk.baglam?.musteri || t.anahtar_varlik?.ad || null);
    const konular = new Map<string, any>(kk.filter((k: any) => k.konu).map((k: any) => [k.konu, k]));
    for (const x of t.adimlar || []) { const k = x.tur_kod && konular.get(x.tur_kod); if (k) notes.push(`"${x.ad}" kurulmadı; karar zaten verilmiş: ${k.karar} (${fmtMs(ts(k.created_at))}).`); }
    u = uygula(t, S.secilen || [], S.varsayim || [], a.cevaplar || {}, ctx.key.kisi, new Set(konular.keys()), S.sonra || []);
    raw = u.adimlar;
    if (!baslik) baslik = t.baslik;
    if (!hedef && u.hedef && isDate(u.hedef)) hedef = u.hedef;
    turKod = tk.is_turu;
    if (!baglam.musteri && (tk.baglam?.musteri || t.anahtar_varlik?.ad)) baglam.musteri = tk.baglam?.musteri || t.anahtar_varlik.ad;
    baglam.cevaplar = u.onayli;
    baglam.kalici_kodlar = [...(S.secilen || []), ...(S.varsayim || [])].filter((q: any) => q.kalici === true).map((q: any) => q.kod);
    baglam.taslak = tk.kisa_kod;
    const il = u.tumCevap.iliski || tk.baglam?.iliski;
    if (il && !BILMIYORUM_RE.test(String(il))) baglam.iliski = il;
    sab = await getSablon(ctx, turKod!, true);
    L = learnings(null); // taslak yolunda öğrenim deneyim belleğinden (dersler) gelir; şablon öğrenimi kullanılmaz
    const hz = t._hatira || {};
    const turlar = new Set((u.adimlar || []).map((x: any) => x._tur));
    if (hz.dersler?.length) baglam.dersler = hz.dersler.filter((x: any) => !x.tur_kod || turlar.has(x.tur_kod));
    if (hz.kartlar?.length) baglam.kartlar = hz.kartlar;
    if (hz.standart) baglam.standart = hz.standart;
    const adOf = new Map<string, string>((t.adimlar || []).map((s: any) => [s.id, s.ad]));
    for (const e of u.etkiler) {
      if (e.kaynak === "bilinmiyor") { const bag = (t.adimlar || []).filter((s: any) => s.kosul?.soru === e.kod).map((s: any) => `"${s.ad}"`); etkiNotlari.push(`${e.kod}: bilinmiyor → "Netleştir" adımı eklendi${bag.length ? `; ${bag.join(", ")} şimdilik akışta ve onu bekliyor (gerekmezse atlanır)` : ""}.`); }
      else if (e.eklenen.length || e.cikarilan.length) etkiNotlari.push(`${e.kod}=${e.cevap} → ${e.eklenen.length ? `+${e.eklenen.map((i: string) => `"${adOf.get(i) || i}"`).join(", ")}` : ""}${e.cikarilan.length ? ` −${e.cikarilan.map((i: string) => `"${adOf.get(i) || i}"`).join(", ")}` : ""}`);
      else if (e.kaynak === "cevapsiz") notes.push(`${e.kod} cevaplanmadı; varsayılan (${e.cevap}) kullanıldı.`);
    }
    for (const b of u.bekleyen) if (b.kaynak === "sonra") { const bag = (t.adimlar || []).filter((x: any) => x.kosul?.soru === b.kod || x.tarih_capasi?.soru === b.kod).map((x: any) => `"${x.ad}"`); etkiNotlari.push(`${b.kod}: sonradan belli olacak; "${b.adim_ad}" adımında cevaplanır${bag.length ? `. ${bag.join(", ")} o zamana kadar bekliyor; ${b.tip === "tarih" ? "tarih belli olunca planlanır" : "seçilmeyen dal kendiliğinden atlanır"}` : ""}.`); }
  } else {
    if (!baslik) throw new Error("baslik gerekli. Yeni bir iş için önce devir_tasla'yı çağır.");
    if (a.sablon_kod) { sab = await getSablon(ctx, a.sablon_kod); if (!sab) throw new Error(`'${a.sablon_kod}' şablonu yok. devir_kurallar ile şablonlara bak.`); turKod = sab.kod; }
    if (!baglam.musteri && degisken.musteri) baglam.musteri = degisken.musteri;
    L = learnings(sab, baglam.musteri, ctx.ws.id, sab ? a.cevaplar || {} : undefined);
    if (sab && a.cevaplar) baglam.cevaplar = a.cevaplar;
    if (Array.isArray(a.adimlar) && a.adimlar.length) {
      raw = a.adimlar.map((s: any) => ({ ...s, _tur: s.tur_kod || slug(s.ad) }));
      if (sab) {
        const tpl = instantiate(sab, a.cevaplar || {}, degisken).map((s) => norm(s.ad));
        const mine = raw.map((s) => norm(s.ad));
        fark = { eklenen: raw.filter((s) => !tpl.includes(norm(s.ad))).map((s) => s.ad), cikarilan: instantiate(sab, a.cevaplar || {}, degisken).filter((s) => !mine.includes(norm(s.ad))).map((s) => s.ad) };
      }
    } else {
      if (!sab) throw new Error("adimlar, sablon_kod ya da taslak gerekli. Yeni bir iş için devir_tasla'yı çağır.");
      raw = instantiate(sab, a.cevaplar || {}, degisken).map((s: any) => ({ ...s, _tur: s._kod }));
      const missing = new Set<string>();
      JSON.stringify(raw).replace(/\{(\w+)\}/g, (_m: string, k: string) => { missing.add(k); return ""; });
      if (missing.size) throw new Error(`Şablon değişkenleri eksik: ${[...missing].join(", ")}. degiskenler alanında ver.`);
      if (sab.sorular && sab.sorular.length) {
        const yok = sab.sorular.filter((q: any) => !(a.cevaplar && q.kod in a.cevaplar)).map((q: any) => q.kod);
        if (yok.length) notes.push(`Cevaplanmayan ön sorular 'hayır' sayıldı: ${yok.join(", ")}. Gerekirse devir_adim_ekle ile ekle.`);
      }
    }
  }
  if (!baslik) throw new Error("baslik gerekli.");
  // aynı varlıkta son 24 saatte kurulmuş aktif akış varsa önce onay (P1-B, J2LU: aynı iş iki kez kuruldu)
  if (baglam.musteri && !baglam.ust_akis && a.ayni_varlik_onay !== true) {
    const yakin = (await varlikAkislari(ctx, baglam.musteri)).filter((f: any) => f.durum === "aktif" && !f.baglam?.ust_akis && ctx.now - ts(f.created_at) < DAY);
    if (yakin.length) throw new DevirHata(409, `${baglam.musteri} için son 24 saatte kurulmuş aktif akış var: ${yakin.map((f: any) => `${f.kisa_kod} · ${f.baslik}`).join("; ")}. Aynı iş olabilir; kullanıcıya sor. Ayrı bir işse ayni_varlik_onay=true ile yeniden çağır.`);
  }
  // öğrenimden adım ekle (şablon ve taslak yolu)
  if (!(Array.isArray(a.adimlar) && a.adimlar.length)) {
    const kelime = (x: string) => new Set(norm(x).split(" ").filter((w) => w.length > 3));
    const benzer = (a: string, b: string) => { const A = kelime(a), B = kelime(b); if (!A.size || !B.size) return false; let o = 0; for (const w of A) if (B.has(w)) o++; return o / Math.min(A.size, B.size) >= 0.6; };
    const has = (e: any) => raw.some((s) => norm(s.ad) === norm(e.ad) || (e.tur_kod && s._tur === e.tur_kod) || benzer(s.ad, e.ad));
    const findNo = (ad: string) => raw.findIndex((s) => norm(s.ad) === norm(ad) || s._tur === ad) + 1;
    for (const e of L.ekle) {
      if (has(e)) continue;
      const no = raw.length + 1;
      raw.push({ ad: e.ad, sahip: e.sahip ? String(e.sahip).replace(/\{(\w+)\}/g, (m: string, k: string) => degisken[k] || baglam.musteri || m) : (baglam.musteri || ctx.key.kisi), sahip_tip: e.sahip_tip || "insan", kriter: e.kriter || e.ad, sure_tahmin_gun: e.sure_tahmin_gun || 0.5, bagimli: [...new Set([...(e.bagimli_ad || []), ...(e.bagimli_tur || [])].map(findNo).filter((x: number) => x > 0))], _ek: true, _tur: e.tur_kod || slug(e.ad) });
      for (const b of new Set([...(e.bekleyen_ad || []), ...(e.bekleyen_tur || [])])) { const i = findNo(b); if (i > 0 && !(raw[i - 1].bagimli || []).includes(no)) raw[i - 1].bagimli = [...(raw[i - 1].bagimli || []), no]; }
    }
    for (const s of raw) { const ek = L.ek_sure.get(norm(s.ad)) ?? L.ek_sure.get(norm(s._tur || "")); if (ek) s.sure_tahmin_gun = num(s.sure_tahmin_gun) + ek; }
  }
  if (tk && kur.karar_insanda !== false) for (const s of raw) if (s.sahip_tip === "agent" && kararAdimi(s)) { notes.push(`"${s.ad}" bir karar adımı; sahibi agent yerine ${ctx.key.kisi} yapıldı.`); s.sahip = ctx.key.kisi; s.sahip_tip = "insan"; }
  const steps = validateSteps(raw, kur);
  steps.forEach((s, i) => { s._tur = raw[i]._tur || slug(s.ad); s._capa = raw[i]._capa || null; s._netlestir = !!raw[i]._netlestir; s._kosul = raw[i]._kosul || null; s._capaSoru = raw[i]._capaSoru || null; s._cevapSoru = raw[i]._cevapSoru || null; s._sabit = !!raw[i].son_tarih; });
  const bugun = dayNum(todayIst(ctx.now));
  const tk0 = takvim(steps, hedef, bugun, notes);
  hedef = tk0.hedef;
  const { capali, planned } = tk0;
  if (u && u.bekleyen.length) {
    baglam.bekleyen = {};
    for (const b of u.bekleyen) { const st = steps.find((x: any) => x._cevapSoru === b.kod); baglam.bekleyen[b.kod] = { soru: b.soru, tip: b.tip, secenekler: b.secenekler || null, boyut: b.boyut || null, adim_no: st ? st.no : null, kaynak: b.kaynak }; }
  }
  // grup sahipleri ve büyük iş uyarıları
  const GRUP = /(kurulu|ekibi|aileler|gönüllüler|firmalar[ıi]?|yatırımcılar|müşteriler|tedarikçiler|çiftçiler|adaylar|katılımcılar|konuşmacılar|üyeler)\b/i;
  const gruplu = steps.filter((s) => GRUP.test(s.sahip));
  if (gruplu.length) notes.push(`Grup sahibi: ${gruplu.map((s) => `${s.no}. ${s.sahip}`).join(", ")}. Her adımın tek bir sorumlusu olmalı; bir temsilci ata ya da kişileri ayrı izlemek gerekiyorsa adımı böl.`);
  const buyuk = steps.filter((s) => num(s.sure_tahmin_gun) > 90 || /\bher (bölge|müşteri|çiftçi|aday|kalem|okul|şube|ülke|ürün)/i.test(s.ad));
  if (buyuk.length) notes.push(`Bu iş tek akışa büyük geliyor (${buyuk.map((s) => `${s.no}. ${s.ad}`).join("; ")}). Tekrar eden kısmı ayrı akışlara bölmeyi düşün (ör. bölge ya da müşteri başına bir akış).`);

  let akis: any = null;
  for (let i = 0; i < 6 && !akis; i++) {
    try {
      [akis] = await ctx.db.insert("akis", [{ kisa_kod: shortCode(), sahip_id: ctx.ws.id, baslik, amac: a.amac || (tk ? tk.taslak.amac || null : null), sablon_kod: turKod, sablon_surum: sab ? sab.surum : null, hedef_tarih: hedef, kurallar: kur, baglam: { ...baglam, ...(fark ? { sablon_farki: fark } : {}) }, taslak_id: tk ? tk.id : null, ilk_taslak: steps.map((s) => s._tur) }]);
    } catch (e) { if (!/duplicate|unique|23505/i.test(String((e as Error).message))) throw e; }
  }
  if (!akis) throw new Error("Akış kodu üretilemedi, tekrar dene.");
  const rows = steps.map((s) => ({
    akis_id: akis.id, no: s.no, ad: s.ad, aciklama: s.aciklama, sahip: s.sahip, sahip_tip: s.sahip_tip, arac: s.arac, kriter: s.kriter,
    beklenen_cikti: s.beklenen_cikti, karar_kriteri: s.karar_kriteri, son_tarih: s.son_tarih, sure_tahmin_gun: s.sure_tahmin_gun, bagimli: s.bagimli,
    kaynak: s._kod || tk ? "sablon" : "plan", tur_kod: s._tur,
    kosul: s._kosul, capa_soru: s._capaSoru, cevap_soru: s._cevapSoru, tarih_sabit: !!s._capa || !!s._sabit, capa_tarih: s._capa && isDate(s._capa) ? s._capa : null,
  }));
  const inserted = (await ctx.db.insert("adim", await sahipBagla(ctx, rows))).map(fixStep).sort((x: any, y: any) => x.no - y.no);
  if (Array.isArray(a.katilimcilar) && a.katilimcilar.length)
    for (const k of a.katilimcilar.filter((k: any) => k && k.ad)) await ctx.db.insert("katilimci", [{ akis_id: akis.id, ad: k.ad, rol: k.rol || null, iletisim: k.iletisim || null, ...(await kisiAlani(ctx, k.ad, "dis")), ...(await belirtecAlanlari(yeniBelirtec(), ctx.sifre)) }]);
  const act = actor(ctx, a);
  await log(ctx, akis.id, null, act, "akis_olustu", `Akış kuruldu: ${steps.length} adım${tk ? `, taslak ${tk.kisa_kod}` : sab ? `, şablon ${sab.kod}` : ""}`, { sablon: turKod, fark, ogrenim: [...L.musteri] });
  if (tk) {
    await ctx.db.update("taslak", { id: tk.id }, { durum: "kuruldu", akis_id: akis.id });
    const kayit = [
      ...u.etkiler.map((e: any) => ({ ws_id: ctx.ws.id, taslak_id: tk.id, akis_id: akis.id, is_turu: turKod, tip: "soru", soru_kod: e.kod, boyut: e.boyut, soru: e.soru, cevap: e.cevap, kaynak: e.kaynak, etki: { eklenen: e.eklenen, cikarilan: e.cikarilan }, etki_puan: e.puan })),
      ...((tk.sorular?.varsayim || []) as any[]).map((q: any) => ({ ws_id: ctx.ws.id, taslak_id: tk.id, akis_id: akis.id, is_turu: turKod, tip: "varsayim", soru_kod: q.kod, boyut: q.boyut, soru: q.soru, cevap: String(q.cevap ?? q.varsayilan ?? ""), kaynak: q.kaynak, etki: {}, etki_puan: 0 })),
    ];
    if (kayit.length) await ctx.db.insert("soru_kaydi", kayit);
  } else if (baglam.musteri && !baglam.ust_akis) {
    // elle kurulan akış aynı varlığın açık taslağını kapatır; yoksa sonradan o taslaktan ikinci akış kurulabiliyor (P1-B)
    const acik = (await ctx.db.many("taslak", { ws_id: ctx.ws.id, durum: "acik" }, "created_at")).filter((x: any) => norm(x.baglam?.musteri || x.taslak?.anahtar_varlik?.ad || "") === norm(baglam.musteri));
    for (const x of acik) await ctx.db.update("taslak", { id: x.id }, { durum: "iptal", akis_id: akis.id });
    if (acik.length) notes.push(`${baglam.musteri} için açık taslak${acik.length > 1 ? "lar" : ""} (${acik.map((x: any) => x.kisa_kod).join(", ")}) bu akış kurulduğu için iptal edildi.`);
  }
  const ready = await recalc(ctx, akis, inserted);
  const events = await ctx.db.many("olay", { akis_id: akis.id }, "id");
  const m = metrics(akis, inserted, events, ctx.now);

  const out = [`✓ Akış oluşturuldu: ${akis.kisa_kod} · ${baslik}`];
  const head = [`${steps.length} adım`];
  if (akis.hedef_tarih) head.push(`hedef ${fmtD(akis.hedef_tarih)}`, `en erken bitiş ${fmtMs(m.pl.end)}${m.pay != null ? (m.pay >= 0 ? ` (${dur(m.pay)} pay)` : ` ⚠ ${dur(-m.pay)} gecikme riski`) : ""}`);
  else head.push(`en erken bitiş ${fmtMs(m.pl.end)}`);
  if (capali.length) head.push(`sabit tarih: ${capali.map((s) => `${s.no}. adım ${fmtD(s._capa)}`).join(", ")}`);
  if (planned) head.push(`${planned} son tarih geriye doğru planlandı`);
  out.push(head.join(" · "));
  if (akis.hedef_tarih) out.push("(Son tarih: hedefi tutturmak için adımın en geç bitmesi gereken gün. En erken bitiş: her adım sırası gelince hemen başlarsa işin bitebileceği gün.)");
  out.push("");
  for (const s of inserted) out.push(stepLine(s, m.tl, m.pl));
  out.push("", `Kritik yol: ${m.pl.chain.join(" → ")}`);
  if (etkiNotlari.length) { out.push("", "Cevapların akışa etkisi:"); for (const e of etkiNotlari) out.push(`- ${e}`); }
  if (baglam.bekleyen && Object.keys(baglam.bekleyen).length) { out.push("", "Açık sorular (cevap gelince devir_cevapla ile yaz; akış kendini yeniden kurar):"); for (const [k, b] of Object.entries<any>(baglam.bekleyen)) out.push(`- [${k}] ${b.soru}${b.adim_no ? ` · ${b.adim_no}. adımda belli olur` : ""}`); }
  const named = (l: string) => (l.match(/"[^"]+"/g) || []);
  const present = new Set(steps.map((s) => `"${s.ad}"`));
  const mus = L.musteri.filter((l) => named(l).every((x) => present.has(x)));
  const seenN = new Set(mus.flatMap(named));
  const dikkat = [...mus, ...L.genel.filter((l) => named(l).every((x) => present.has(x)) && !named(l).some((x) => seenN.has(x))), ...notes];
  if (tk?.taslak?._hatira?.satirlar?.length) { out.push("", "Devir'in hatırladıkları:"); for (const x of tk.taslak._hatira.satirlar.slice(0, 5)) out.push(`- ${x}`); }
  if (fark && (fark.eklenen.length || fark.cikarilan.length)) dikkat.push(`Şablondan fark: eklenen ${fark.eklenen.length ? fark.eklenen.map((x: string) => `"${x}"`).join(", ") : "yok"}; çıkarılan ${fark.cikarilan.length ? fark.cikarilan.map((x: string) => `"${x}"`).join(", ") : "yok"}.`);
  if (dikkat.length) { out.push("", "Dikkat:"); for (const d of dikkat) out.push(`- ${d}`); }
  if (ready.length) {
    out.push("", "Şimdi başlayabilecek adımlar:");
    for (const s of ready.slice(0, 3)) { const l = chatLinks(akis, s); out.push(`- ${s.no}. ${s.ad} (${s.sahip}) · Claude'da aç: ${l.claude} · ChatGPT'de aç: ${l.chatgpt}`); }
  }
  return out.join("\n");
}

// ---------- akış tasarımcısı ----------
async function sablonlar(ctx: Ctx) {
  const g = await ctx.db.many("sablon", { ws_id: null }, "kod");
  const w = await ctx.db.many("sablon", { ws_id: ctx.ws.id }, "kod");
  const by = new Map<string, any>();
  for (const s of g) by.set(s.kod, s);
  for (const s of w) by.set(s.kod, s);
  return [...by.values()];
}
async function getSablon(ctx: Ctx, kod: string, yalnizcaOzel = false) {
  const w = await ctx.db.one("sablon", { kod, ws_id: ctx.ws.id });
  if (w || yalnizcaOzel) return w;
  return ctx.db.one("sablon", { kod, ws_id: null });
}
// 1.5.8 soru istatistiği: iş türü yerine soru koduna göre; benzer geçmiş işlerde yeterli kayıt varsa onlar esas alınır
function soruIstatistik(kayit: any[], tur: string, benzer: Set<string>) {
  const tum = new Map<string, Stat>(), yakin = new Map<string, Stat>(), kacan = new Map<string, number>(), yanlis = new Map<string, number>();
  const ekle = (m: Map<string, Stat>, k: any) => { const s = m.get(k.soru_kod) || { n: 0, ort: 0, kacan: 0 }; s.ort = (s.ort * s.n + Number(k.etki_puan || 0)) / (s.n + 1); s.n++; m.set(k.soru_kod, s); };
  const yakinAkis = (k: any) => !!k.akis_id && benzer.has(k.akis_id);
  for (const k of kayit) {
    if (k.tip === "soru" && k.soru_kod && k.kaynak !== "bilinmiyor") { ekle(tum, k); if (yakinAkis(k)) ekle(yakin, k); }
    if (k.tip === "kacan" && k.boyut && k.boyut !== "genel" && (yakinAkis(k) || (!benzer.size && k.is_turu === tur))) kacan.set(k.boyut, (kacan.get(k.boyut) || 0) + 1);
    if (k.tip === "yanlis_varsayim" && k.soru_kod) yanlis.set(k.soru_kod, (yanlis.get(k.soru_kod) || 0) + 1);
  }
  const stats = new Map<string, Stat>();
  for (const [kod, st] of tum) stats.set(kod, (yakin.get(kod)?.n || 0) >= 2 ? yakin.get(kod)! : st);
  // kullanıcıya gösterilecek gerekçe: "benzer 3 işin 2'sinde planı değiştirdi"
  const gerekce = new Map<string, string>();
  const akisBy = new Map<string, Map<string, number>>();
  for (const k of kayit) if (k.tip === "soru" && k.soru_kod && yakinAkis(k)) { const m = akisBy.get(k.soru_kod) || new Map(); m.set(k.akis_id, Math.max(m.get(k.akis_id) || 0, Number(k.etki_puan || 0))); akisBy.set(k.soru_kod, m); }
  for (const [kod, m] of akisBy) { if (kod === "hedef_tarih") continue; const deg = [...m.values()].filter((v) => v > 0).length; if (m.size >= 2 && deg) gerekce.set(kod, `benzer ${m.size} geçmiş işin ${deg} tanesinde cevabı planı değiştirdi`); }
  for (const [kod, n] of yanlis) if (!gerekce.has(kod)) gerekce.set(kod, `bu konuda sormadan yapılan varsayım daha önce ${n} kez yanlış çıktı`);
  return { stats, kacan, yanlis, gerekce };
}
function soruIstatistikSatirlari(kayit: any[], benzer: Set<string>) {
  const grup = new Map<string, any[]>();
  for (const k of kayit) {
    if (k.tip === "varsayim" || k.tip === "fazla_adim") continue;
    const key = k.tip === "kacan" ? "kacan:" + k.boyut : k.tip === "yanlis_varsayim" ? "yanlis:" + k.soru_kod : k.soru_kod;
    if (!key || key.endsWith(":null") || key === "kacan:genel") continue;
    const g = grup.get(key) || []; g.push(k); grup.set(key, g);
  }
  const satir: { s: string; yakin: number }[] = [];
  for (const [q, g] of grup) {
    const yakin = g.filter((k) => k.akis_id && benzer.has(k.akis_id)).length;
    const yer = yakin ? ` (${yakin} tanesi benzer işlerde)` : "";
    if (q.startsWith("kacan:")) satir.push({ s: `"${q.slice(6)}" boyutunda ${g.length} kez sonradan adım eklendi${yer} (bu boyutta soru sormayı düşün)`, yakin });
    else if (q.startsWith("yanlis:")) satir.push({ s: `"${q.slice(7)}" varsayımı ${g.length} kez yanlış çıktı${yer} (bu soruyu aday olarak yaz, güveni düşük tut)`, yakin });
    else { const ort = g.reduce((s, k) => s + Number(k.etki_puan || 0), 0) / g.length; satir.push({ s: `${q} sorusu ${g.length} kez soruldu${yer}, ortalama etki ${Math.round(ort * 10) / 10}${g.length >= 3 && ort === 0 ? " (ölü soru, sorma)" : ""}`, yakin }); }
  }
  return satir.sort((a, b) => b.yakin - a.yakin).map((x) => x.s);
}
// benzer deneyimlerin akış kimlikleri (soru_kaydi akis_id ile eşleşir)
async function benzerAkisIdleri(ctx: Ctx, h: Hatira) {
  const ids = new Set<string>(h.deneyim.map((d: any) => d.akis_id).filter(Boolean));
  const kodlar = h.deneyim.filter((d: any) => !d.akis_id && d.akis_kod).map((d: any) => d.akis_kod);
  if (kodlar.length) for (const f of await ctx.db.many("akis", { sahip_id: ctx.ws.id, kisa_kod: kodlar }, "created_at")) ids.add(f.id);
  return ids;
}
// tur null ise varlığın tüm iş türlerindeki akışlarına bakar
async function gecmisCevaplar(ctx: Ctx, tur: string | null, varlik: string) {
  const flows = await ctx.db.many("akis", tur ? { sahip_id: ctx.ws.id, sablon_kod: tur } : { sahip_id: ctx.ws.id }, "created_at");
  const out: Record<string, string> = {};
  for (const f of flows) {
    if (f.durum === "arsiv" || norm(f.baglam?.musteri || "") !== norm(varlik)) continue;
    if (f.baglam?.cevaplar) { const kal = new Set<string>(f.baglam.kalici_kodlar || []); for (const [k, v] of Object.entries(f.baglam.cevaplar)) if (kal.has(k)) out[k] = v as string; } // kalıcı bilgisi olmayan eski cevaplar taşınmaz
    if (f.baglam?.iliski) out.iliski = f.baglam.iliski;
  }
  for (const k of Object.keys(out)) if (BILMIYORUM_RE.test(String(out[k]))) delete out[k];
  return out;
}
// varlığın akışları (aynı çalışma alanında)
async function varlikAkislari(ctx: Ctx, varlik: string) {
  const flows = await ctx.db.many("akis", { sahip_id: ctx.ws.id }, "created_at");
  return flows.filter((f: any) => norm(f.baglam?.musteri || f.baglam?.varlik || "") === norm(varlik));
}
// ertelenmiş açık işler
export async function acikIsler(ctx: Ctx, varlik: string | null) {
  if (!varlik) return [];
  const flows = await varlikAkislari(ctx, varlik);
  if (!flows.length) return [];
  const steps = await ctx.db.many("adim", { akis_id: flows.map((f: any) => f.id), durum: "ertelendi" }, "no");
  const byId = new Map(flows.map((f: any) => [f.id, f]));
  return steps.map((s: any) => ({ ...s, akis_kod: byId.get(s.akis_id)?.kisa_kod }));
}
// geçerli kararlar
export async function kararlar(ctx: Ctx, varlik: string | null) {
  if (!varlik) return [];
  return (await ctx.db.many("karar", { ws_id: ctx.ws.id, varlik_norm: norm(varlik), durum: "gecerli" }, "created_at"));
}
const kararSatiri = (k: any) => `${k.karar}${k.kapsam ? ` (kapsam: ${k.kapsam})` : ""}${k.istisna ? ` · istisna: ${k.istisna}` : ""} — ${k.kim}, ${fmtMs(ts(k.created_at))}`;
// çıktılar: her ad için son sürüm
export async function ciktilar(ctx: Ctx, akisId: string, nolar: number[]) {
  if (!nolar.length) return [];
  const rows = await ctx.db.many("cikti", { akis_id: akisId, adim_no: nolar }, "created_at");
  const son = new Map<string, any>();
  for (const r of rows) son.set(`${r.adim_no}|${norm(r.ad)}`, r);
  return [...son.values()];
}
const ICERIK_KISA = 700;
function ciktiSatiri(c: any, tam = false) {
  const bas = `[${c.id}] ${c.ad}${c.surum > 1 ? ` (v${c.surum})` : ""}${c.durum && c.durum !== "taslak" ? ` · ${c.durum}` : ""}${c.kaynak ? ` · ${c.kaynak}` : ""}${c.url ? (String(c.url).startsWith("dosya:") ? " · Devir'e yüklenmiş dosya (arayüzden indirilir)" : ` · ${c.url}`) : ""}`;
  const L = [bas];
  if (c.ozet) L.push(`  Özet: ${c.ozet}`);
  if (c.icerik) {
    const t = String(c.icerik);
    L.push(tam || t.length <= ICERIK_KISA ? `  İçerik:\n${t.split("\n").map((x) => "    " + x).join("\n")}` : `  İçerik (ilk ${ICERIK_KISA} karakter; tamamı için devir_cikti_oku):\n${t.slice(0, ICERIK_KISA).split("\n").map((x) => "    " + x).join("\n")}…`);
  }
  return L.join("\n");
}

// atlanan adım taslaktaki bir varsayıma bağlıysa o varsayım yanlış çıkmıştır; değilse taslak fazla adım üretmiştir
async function atlamaSinyali(ctx: Ctx, akis: any, s: any, not: string, kesin = false) {
  if (!akis.taslak_id) return null;
  try {
    const tk = await ctx.db.one("taslak", { id: akis.taslak_id });
    if (!tk) return null;
    const ts0 = (tk.taslak?.adimlar || []).find((x: any) => x.tur_kod && x.tur_kod === s.tur_kod);
    const kod = ts0?.kosul?.soru;
    const v = kod ? [...(tk.sorular?.varsayim || [])].find((q: any) => q.kod === kod) : null;
    const base = { ws_id: ctx.ws.id, taslak_id: tk.id, akis_id: akis.id, is_turu: akis.sablon_kod, cevap: not || null, etki: { atlanan: [s.tur_kod] }, etki_puan: 1 };
    if (v) {
      await ctx.db.insert("soru_kaydi", [{ ...base, tip: "yanlis_varsayim", soru_kod: kod, boyut: v.boyut || null, soru: v.soru, kaynak: v.kaynak || "varsayilan" }]);
      return `"${v.soru}" sorusu sorulmadan "${v.cevap ?? v.varsayilan}" varsayılmıştı ve yanlış çıktı. Devir bunu kaydetti; bir dahaki sefere bu soruyu soracak.`;
    }
    if (!kod && !kesin) await ctx.db.insert("soru_kaydi", [{ ...base, tip: "fazla_adim", soru_kod: null, boyut: ts0?.boyut || null, soru: s.ad, kaynak: "adim_atlandi" }]);
  } catch (e) { console.warn("atlama sinyali yazılamadı:", (e as Error).message); }
  return null;
}

async function tasla(a: any, ctx: Ctx) {
  needTeam(ctx, "Akış taslağı çıkarmayı");
  if (!ctx.llm) throw new Error("Taslak motoru şu an kapalı. devir_kurallar ve devir_akis_olustur ile elle kurabilirsin.");
  const cumle = String(a.cumle || "").trim();
  if (!cumle) throw new Error("cumle gerekli: işi tek cümleyle anlat.");
  const baglam: any = a.baglam && typeof a.baglam === "object" ? { ...a.baglam } : {};
  if (a.hedef_tarih) { if (!isDate(a.hedef_tarih)) throw new Error("hedef_tarih YYYY-AA-GG olmalı."); baglam.hedef_tarih = a.hedef_tarih; }
  if (!baglam.musteri && baglam.varlik) baglam.musteri = baglam.varlik;
  if (baglam.musteri && !baglam.iliski) { const g = await gecmisCevaplar(ctx, null, baglam.musteri); if (g.iliski) baglam.iliski = g.iliski; }
  const turler = await sablonlar(ctx);
  // iş türü etiketleri: başlangıç şablonları + ekibin kapanmış işlerinin etiketleri
  for (const d of await ctx.db.many("deneyim", { ws_id: ctx.ws.id }, "created_at", 400).catch(() => [])) if (d.is_turu && !turler.some((x: any) => x.kod === d.is_turu)) turler.push({ kod: d.is_turu, ad: d.is_turu, ws_id: ctx.ws.id });
  const kayit = await ctx.db.many("soru_kaydi", { ws_id: ctx.ws.id }, "id");
  const varlik0 = baglam.musteri || null;
  // 1.5.3 benzer geçmiş işler, dersler, kartlar, standart süreç (iş türü kodundan bağımsız)
  let h: Hatira = { deneyim: [], ders: [], kart: [], standart: null, gommeli: false };
  try { h = await hatirla(ctx, { cumle, varlik: varlik0, iliski: baglam.iliski || null }); } catch (e) { console.warn("bellek okunamadı:", (e as Error).message); }
  const benzerAkis = await benzerAkisIdleri(ctx, h);
  const istat = soruIstatistikSatirlari(kayit, benzerAkis);
  const yanlisKod = new Set(kayit.filter((k: any) => k.tip === "yanlis_varsayim" && k.soru_kod).map((k: any) => k.soru_kod));
  const gecmisLines: string[] = [];
  if (baglam.musteri) {
    const c = await gecmisCevaplar(ctx, null, baglam.musteri);
    for (const k of Object.keys(c)) if (yanlisKod.has(k)) delete c[k];
    if (Object.keys(c).length) gecmisLines.push(`${baglam.musteri}: ${JSON.stringify(c)}`);
  }
  const kararList = await kararlar(ctx, varlik0);
  const acikList = await acikIsler(ctx, varlik0);
  const r = await ctx.llm({ system: SISTEM, user: kullaniciMesaji({ cumle, bugun: todayIst(ctx.now), kisi: ctx.key.kisi, baglam, turler: turler.slice(0, 40), istatistik: istat.slice(0, 30), gecmis: gecmisLines, kararlar: kararList.map(kararSatiri), acikIsler: acikList.map((s: any) => `${s.ad} [tur_kod: ${s.tur_kod || slug(s.ad)}] (${s.akis_kod} akışında ertelendi)`), benzer: h.deneyim.map(deneyimSatiri), dersler: h.ders.map(dersSatiri), kartlar: h.kart.map(kartSatiri), standart: h.standart ? standartBlok(h.standart) : null }), tool: TASLAK_ARACI, model: ctx.modeller?.taslak });
  const t = r.input || {};
  if (!Array.isArray(t.adimlar) || !t.adimlar.length) throw new Error("Taslak motoru adım üretemedi; cümleyi biraz daha açık yazıp tekrar dene.");
  t.sorular = Array.isArray(t.sorular) ? t.sorular : [];
  t.roller = Array.isArray(t.roller) ? t.roller : [];
  t.varsayimlar = Array.isArray(t.varsayimlar) ? t.varsayimlar : [];
  if (baglam.hedef_tarih) { t.hedef_tarih = baglam.hedef_tarih; t.sorular = t.sorular.filter((q: any) => q.kod !== "hedef_tarih"); }
  // 1.5.5 denetçi (ucuz model): girdi, kapı, bağımlılık, sahiplik, ders ve kart kontrolü; süre sınırına yakınsa atlanır
  if (r.ms < 80_000) try {
    const ek = [h.ders.length ? `Getirilen dersler:\n${h.ders.map(dersSatiri).join("\n")}` : "", h.kart.length ? `Bilgi kartları:\n${h.kart.map(kartSatiri).join("\n")}` : ""].filter(Boolean).join("\n");
    const d = await ctx.llm({ system: DENETCI_SISTEM, user: `İş: ${t.baslik || cumle}\nCümle: ${cumle}\n${denetimListesi(t)}${ek ? `\n${ek}` : ""}`, tool: DENETCI_ARACI, model: ctx.modeller?.hizli, max_tokens: 2500 });
    t._denetim = denetimUygula(t, d.input || {});
  } catch (e) { console.warn("denetim yapılamadı:", (e as Error).message); }
  // kesin dersler motor ya da denetçi atlamış olsa da uygulanır; ardından kurallı doğrulayıcı
  t._ders_notlari = derslerUygula(t, h.ders);
  t._kural = [...kuralDenetimi(t), ...turDogrula(t, turler, cumle)];
  const tur = slug(t.is_turu?.kod || t.baslik || "is");
  const varlik = baglam.musteri || t.anahtar_varlik?.ad || null;
  const gecmis = varlik ? await gecmisCevaplar(ctx, tur, varlik) : {};
  if (varlik && !baglam.iliski) { const g = await gecmisCevaplar(ctx, null, varlik); if (g.iliski) baglam.iliski = g.iliski; }
  const bilinen: Record<string, string> = {};
  if (baglam.iliski) bilinen.iliski = String(baglam.iliski);
  const { stats, kacan, yanlis, gerekce } = soruIstatistik(kayit, tur, benzerAkis);
  const s = sec(t, stats, kacan, gecmis, bilinen, yanlis);
  const soruGerekce = new Map<string, string>();
  for (const q of s.secilen) { const g = gerekce.get(q.kod); if (g) soruGerekce.set(q.kod, g); else if (dayanaklar(q).length) { /* dayanaktan gelir */ } }
  const hatira = hatirlatmaSatirlari(t, h, s.secilen, soruGerekce);
  const dersRef = new Set<string>([...(t.adimlar || []), ...(t.sorular || [])].flatMap((x: any) => dayanaklar(x)));
  t._hatira = {
    satirlar: hatira,
    dersler: h.ders.filter((x: any) => dersRef.has(`D${x.id}`)).map((x: any) => ({ id: x.id, tur_kod: (t.adimlar || []).find((a0: any) => dayanaklar(a0).includes(`D${x.id}`))?.tur_kod || null })),
    kartlar: h.kart.filter((k: any) => dersRef.has(`K:${k.kod}`)).map((k: any) => k.kod),
    benzer: h.deneyim.map((d: any) => ({ akis: d.akis_kod, puan: d._puan })),
    standart: h.standart ? h.standart.kod : null,
    gommeli: h.gommeli,
  };
  let tk: any = null;
  for (let i = 0; i < 6 && !tk; i++) {
    try {
      [tk] = await ctx.db.insert("taslak", [{ kisa_kod: "T" + shortCode(), ws_id: ctx.ws.id, anahtar_id: ctx.key.id || null, cumle, baglam: { ...baglam, musteri: varlik }, is_turu: tur, is_turu_ad: t.is_turu?.ad || tur, yeni_tur: !turler.some((x: any) => x.kod === tur), taslak: t, sorular: s, varsayimlar: t.varsayimlar, model: r.model, sure_ms: r.ms }]);
    } catch (e) { if (!/duplicate|unique|23505/i.test(String((e as Error).message))) throw e; }
  }
  if (!tk) throw new Error("Taslak kaydedilemedi, tekrar dene.");
  const kosullu = t.adimlar.filter((x: any) => x.kosul && x.kosul.soru).length;
  const out = [`Taslak ${tk.kisa_kod} · ${t.is_turu?.ad || tur}${tk.yeni_tur ? " (yeni iş türü)" : ""} · ${t.adimlar.length} adım${kosullu ? `, ${kosullu} tanesi cevaplara bağlı` : ""}`, `Başlık: ${t.baslik}${t.hedef_tarih ? ` · hedef ${fmtD(t.hedef_tarih)}` : ""}`];
  const vs = [...t.varsayimlar.slice(0, 6).map((v: any) => v.metin), ...s.varsayim.filter((q: any) => q.kaynak === "gecmis").map((q: any) => `${q.kod} = ${q.cevap} (geçen sefer böyleydi)`), ...s.varsayim.filter((q: any) => q.kaynak === "baglam").map((q: any) => `${q.kod} = ${q.cevap} (bağlamdan)`), ...s.varsayim.filter((q: any) => q.kaynak === "varsayilan" || q.kaynak === "olu").map((q: any) => { const o = (q.secenekler || []).find((x: any) => String(x.deger) === String(q.cevap)); return `${q.soru} → ${o?.etiket || q.cevap} (sormadım; yanlışsa kurmadan önce cevaplar'a ${q.kod} olarak yaz)`; })];
  if (vs.length) { out.push("", "Varsayımlarım:"); for (const v of vs) out.push(`- ${v}`); }
  if (kararList.length) { out.push("", `Geçerli kararlar (${varlik0}):`); for (const k of kararList) out.push(`- ${kararSatiri(k)}`); }
  if (acikList.length) { out.push("", "Ertelenmiş açık işler:"); for (const x of acikList) out.push(`- ${x.ad} (${x.akis_kod})`); }
  if (hatira.length) { out.push("", "Devir'in hatırladıkları (kullanıcıya göster; düz bir sohbetin bilemeyeceği bilgiler):"); for (const x of hatira.slice(0, 8)) out.push(`- ${x}`); }
  if (h.standart) out.push("", `Standart süreç kullanıldı: ${h.standart.ad} [S:${h.standart.kod}].`);
  const den = [...(t._ders_notlari || []), ...(t._denetim?.adim || []).map((x: string) => `Adım: ${x}`), ...(t._denetim?.bagimlilik || []), ...(t._denetim?.soru || []).map((x: string) => `Soru eklendi: ${x}`), ...(t._denetim?.not || []), ...(t._kural || [])];
  if (den.length) { out.push("", "Denetimde düzeltilenler:"); for (const x of den.slice(0, 10)) out.push(`- ${x}`); }
  if (s.secilen.length) {
    out.push("", "Sorular — kullanıcıya TEK mesajda, numaralı sor; seçenekleri, varsayılanı ve kısa nedeni göster:");
    s.secilen.forEach((q: any, i: number) => {
      const sec = q.tip === "secim" && Array.isArray(q.secenekler) && q.secenekler.length ? ` Seçenekler: ${q.secenekler.map((o: any) => o.etiket ? `${o.etiket} (${o.deger})` : o.deger).join(" / ")}.` : q.tip === "tarih" ? " (tarih, YYYY-AA-GG)" : "";
      out.push(`${i + 1}. [${q.kod}] ${q.soru}${sec}${q.varsayilan ? ` Varsayılan: ${q.varsayilan}.` : ""} — Neden: ${q.neden}`);
    });
    out.push("", `Cevaplar gelince: devir_akis_olustur({ taslak: "${tk.kisa_kod}", cevaplar: { ${s.secilen.map((q: any) => `${q.kod}: "…"`).join(", ")} } }). Kullanıcı "bilmiyorum" derse cevabı "bilmiyorum" yaz; akış durmaz, bir "Netleştir" adımı eklenir. Kullanıcı bir soruyu geçerse o soruyu cevaplar'a koyma; varsayılan kullanılır.`);
  } else out.push("", `Soru gerekmiyor. Hemen kur: devir_akis_olustur({ taslak: "${tk.kisa_kod}" }).`);
  if (s.sonra?.length) { out.push("", "Sonradan belli olacaklar (şimdi sorma; akış iki dalı da kurar, cevap gelince devir_cevapla ile yazılır):"); for (const q of s.sonra) { const c = t.adimlar.find((x: any) => String(x.id) === String(q.cevaplayan_adim || "")); out.push(`- [${q.kod}] ${q.soru}${c ? ` · "${c.ad}" adımında belli olur` : ""}`); } }
  out.push("", "Taslak adımları:");
  const rol = new Map<string, any>(t.roller.map((x: any) => [x.kod, x]));
  t.adimlar.forEach((x: any, i: number) => { const r0 = rol.get(x.sahip_rol); out.push(`${i + 1}. ${x.ad} — ${r0 ? r0.kisi || r0.ad : x.sahip_rol}${x.kosul && x.kosul.soru ? ` [yalnızca ${x.kosul.soru}=${x.kosul.deger} ise]` : ""}`); });
  return out.join("\n");
}

async function akislar(a: any, ctx: Ctx) {
  const durum = a.durum || "aktif";
  const where: Record<string, unknown> = { sahip_id: ctx.ws.id };
  if (durum !== "hepsi") where.durum = durum;
  if (a.sablon_kod) where.sablon_kod = a.sablon_kod;
  let flows = await ctx.db.many("akis", where, "created_at");
  if (a.ara) { const q = norm(a.ara); flows = flows.filter((f: any) => norm(f.baslik).includes(q) || norm(f.baglam?.musteri || "").includes(q)); }
  else flows = flows.filter((f: any) => !f.baglam?.ust_akis); // alt akışlar üst akışın satırında özetlenir
  if (!flows.length) return durum === "aktif" ? "Aktif akış yok. Yeni bir iş için devir_tasla ile başla." : "Akış bulunamadı.";
  const ids = flows.map((f: any) => f.id);
  const allSteps = (await ctx.db.many("adim", { akis_id: ids }, "no")).map(fixStep);
  const allEv = await ctx.db.many("olay", { akis_id: ids, tip: "durum" }, "id");
  const rows: any[] = [];
  const bekleyen = new Map<string, number>();
  let tamam = 0, toplam = 0, acikBekleme = 0;
  for (const f of flows) {
    const steps = allSteps.filter((s: any) => s.akis_id === f.id);
    if (!flowInScope(ctx, f, steps)) continue;
    const vis = steps.filter((s: any) => stepInScope(ctx, s));
    const m = metrics(f, steps, allEv.filter((e: any) => e.akis_id === f.id), ctx.now);
    tamam += steps.filter(DONE).length; toplam += steps.length;
    const waits = vis.filter((s: any) => s.durum === "hazir" || s.durum === "engelli").map((s: any) => ({ s, w: m.tl.get(s.no)!.simdi }));
    for (const { s, w } of waits) { acikBekleme += w; bekleyen.set(s.sahip, (bekleyen.get(s.sahip) || 0) + w); }
    rows.push({ f, steps, vis, m, waits });
  }
  rows.sort((x, y) => (x.f.durum === "aktif" ? (x.m.pay ?? Infinity) : Infinity) - (y.f.durum === "aktif" ? (y.m.pay ?? Infinity) : Infinity));
  const out = [`${durum === "aktif" ? "Aktif" : durum === "kapandi" ? "Kapanmış" : "Tüm"} akışlar (${rows.length}) · bugün ${fmtD(todayIst(ctx.now))}`];
  if (!isDis(ctx)) {
    out.push(`Toplam ${tamam}/${toplam} adım tamam · şu an açık bekleme ${dur(acikBekleme)}`);
    const top = [...bekleyen.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
    if (top.length) out.push(`En çok bekleten: ${top.map(([k, v]) => `${k} ${dur(v)}`).join(" · ")}`);
    const risk = rows.filter((r) => r.f.durum === "aktif" && r.m.pay != null && r.m.pay < 0);
    if (risk.length) out.push(`⚠ Hedefi kaçırma riski: ${risk.map((r) => `${r.f.kisa_kod} (${dur(-r.m.pay)})`).join(", ")}`);
    const tumAkis = (await ctx.db.many("akis", { sahip_id: ctx.ws.id }, "created_at")).filter((f: any) => !akisKapsami(ctx) || rows.some((r) => r.f.id === f.id));
    const er = tumAkis.length ? await ctx.db.many("adim", { akis_id: tumAkis.map((f: any) => f.id), durum: "ertelendi" }, "no") : [];
    if (er.length) { const kod = new Map(tumAkis.map((f: any) => [f.id, f])); out.push(`↷ Ertelenmiş açık işler (${er.length}): ${er.map((x: any) => { const f: any = kod.get(x.akis_id); return `${x.ad} (${f?.kisa_kod}${f?.baglam?.musteri ? ` · ${f.baglam.musteri}` : ""})`; }).join("; ")}`); }
  }
  out.push("");
  for (const r of rows) {
    const { f, steps, vis, m, waits } = r;
    const parts = [`${f.kisa_kod} · ${f.baslik}`, `${steps.filter(DONE).length}/${steps.length}`];
    if (f.durum === "kapandi") parts.push(`kapandı, ${dur(m.sure)} sürdü, ${dur(m.bekleme)} bekleme`);
    else {
      const act = vis.filter((s: any) => s.durum === "suruyor").map((s: any) => `${s.no}. ${s.ad} (${s.sahip}) sürüyor`);
      const w = waits.sort((x: any, y: any) => y.w - x.w).map(({ s, w }: any) => `${s.no}. ${s.ad} → ${s.sahip}, ${s.durum === "engelli" ? "engelli" : "bekliyor"}: ${dur(w)}`);
      if (w.length) parts.push("sıra: " + w.slice(0, 2).join("; "));
      if (act.length) parts.push(act.slice(0, 2).join("; "));
      if (f.hedef_tarih) parts.push(`hedef ${fmtD(f.hedef_tarih)}, en erken ${fmtMs(m.pl.end)}${m.pay < 0 ? " ⚠" : ""}`);
      for (const g of altGruplar(f)) { const ozet = steps.filter((s: any) => g.adimlar.includes(s.no) && !DONE(s)).map((s: any) => s.ilerleme).filter(Boolean)[0]; parts.push(`tekrar: ${g.kalemler.length} ${g.kalem_turu || "kalem"}${ozet ? ` (${ozet})` : ""}`); }
    }
    out.push(parts.join(" · "));
  }
  return out.join("\n");
}

async function akisDetay(a: any, ctx: Ctx) {
  const akis = await getAkis(ctx, a.akis);
  const { steps, events } = await loadFlow(ctx, akis);
  const m = metrics(akis, steps, events, ctx.now);
  const out = [`${akis.kisa_kod} · ${akis.baslik}${akis.durum !== "aktif" ? ` (${akis.durum})` : ""}`];
  if (akis.amac) out.push(akis.amac);
  if (akis.baglam?.ust_akis) out.push(`Alt akış: ${akis.baglam.ust_kod} akışının "${akis.baglam.kalem}" için tekrarı.`);
  const ctxLine = Object.entries(akis.baglam || {}).filter(([k, v]) => !["ust_akis", "ust_kod", "grup", "kalem"].includes(k) && k !== "sablon_farki" && k !== "cevaplar" && k !== "kalici_kodlar" && k !== "bekleyen" && k !== "cevaplanan" && (v == null || typeof v !== "object")).map(([k, v]) => `${k}: ${v}`).join(" · ");
  if (ctxLine) out.push(ctxLine);
  // MK-8: MCP yanıtı ekrandaki karar şeridiyle aynı cümleyle başlar
  const vis0 = steps.filter((s: any) => stepInScope(ctx, s));
  const { bitis: bt, karar_ozeti: ko } = akisKarari(akis, steps, events.filter((e: any) => e.tip !== "okuma"), ctx.now, await gecmisYukle(ctx), { dis: isDis(ctx), vis: vis0 });
  if (ko.cumle) out.splice(1, 0, ko.cumle);
  if (isDis(ctx)) {
    out.push(`İlerleme: ${steps.filter(DONE).length}/${steps.length} adım tamam${akis.hedef_tarih ? ` · hedef ${fmtD(akis.hedef_tarih)}` : ""}`, "", "Sana atanan adımlar:");
    for (const s of steps.filter((s: any) => stepInScope(ctx, s))) out.push(stepLine(s, m.tl, m.pl, { sahipGizle: true }));
    out.push("", "Diğer adımların ayrıntısı rolün gereği gizli.");
    return out.join("\n");
  }
  out.push(
    "",
    `Süre: ${dur(m.sure)}${akis.hedef_tarih ? ` · hedef ${fmtD(akis.hedef_tarih)} · en erken bitiş ${fmtMs(m.pl.end)}${m.pay != null ? (m.pay >= 0 ? ` (${dur(m.pay)} pay)` : ` ⚠ ${dur(-m.pay)} gecikme riski`) : ""}` : ""}`,
    speedLine(m),
    `Kritik yol: ${m.pl.chain.join(" → ")}`,
    ...(bt.aralik && !akis.kapandi_at ? [`Bitiş aralığı: ${aralikMetni(bt.aralik)} (${bt.guven === "kesin" ? "kesin" : bt.guven === "eksik" ? "süresi eksik adım var" : "tahmini"})${bt.varsayimlar.length ? " · " + bt.varsayimlar.join("; ") : ""}`] : []),
    "",
  );
  for (const s of steps) out.push(stepLine(s, m.tl, m.pl) + (altAdimi(akis, s.no) ? ` · tekrarlı: ${s.ilerleme || "alt akışlarda"}` : ""));
  out.push(...await altOzet(ctx, akis, steps));
  const bek = Object.entries<any>(akis.baglam?.bekleyen || {});
  if (bek.length) { out.push("", "Açık sorular (cevap gelince devir_cevapla):"); for (const [k, b] of bek) out.push(`- [${k}] ${b.soru}${b.adim_no ? ` · ${b.adim_no}. adımda belli olur` : ""}`); }
  if (akis.baglam?.musteri) {
    const kk = await kararlar(ctx, akis.baglam.musteri);
    if (kk.length) { out.push("", `Geçerli kararlar (${akis.baglam.musteri}):`); for (const k of kk) out.push(`- ${kararSatiri(k)}`); }
    const ak = (await acikIsler(ctx, akis.baglam.musteri)).filter((x: any) => x.akis_id !== akis.id);
    if (ak.length) { out.push("", "Bu varlıkta başka akışlardan ertelenmiş işler:"); for (const x of ak) out.push(`- ${x.ad} (${x.akis_kod})`); }
  }
  const kat = await ctx.db.many("katilimci", { akis_id: akis.id }, "created_at");
  if (kat.length) out.push("", "Katılımcılar: " + kat.map((k: any) => `${k.ad}${k.rol ? ` (${k.rol})` : ""}`).join(", "));
  const recent = events.filter((e: any) => e.tip !== "okuma").slice(-10).reverse();
  if (recent.length) {
    out.push("", "Son hareketler:");
    for (const e of recent) out.push(`- ${fmtMs(ts(e.created_at))} ${new Date(ts(e.created_at) + 3 * HOUR).toISOString().slice(11, 16)} · ${who(e)}${e.adim_no ? ` · adım ${e.adim_no}` : ""}: ${e.ozet}`);
  }
  const reads = events.filter((e: any) => e.tip === "okuma");
  const writes = events.filter((e: any) => e.kim_tip === "agent" && e.tip !== "okuma");
  out.push("", `Agent etkinliği: ${reads.length} okuma, ${writes.length} yazma (${[...new Set(events.filter((e: any) => e.kim_tip === "agent").map((e: any) => e.arac))].join(", ") || "—"})`);
  return out.join("\n");
}

async function adimOku(a: any, ctx: Ctx) {
  const akis = await getAkis(ctx, a.akis);
  const { steps, events } = await loadFlow(ctx, akis);
  const s = steps.find((x: any) => x.no === Number(a.no));
  if (!s) throw bulunamadi(`Bu akışta ${a.no} numaralı adım yok (1–${steps.length}).`);
  const act = actor(ctx, a);
  if (!stepInScope(ctx, s)) {
    await log(ctx, akis.id, s.no, act, "ret", `Kapsam dışı adım okuma isteği reddedildi`, {});
    throw yetkiYok(`Adım ${s.no} sana atanmamış; rolün gereği ayrıntısı gizli.`);
  }
  const m = metrics(akis, steps, events, ctx.now);
  const by = new Map(steps.map((x: any) => [x.no, x]));
  const r = m.tl.get(s.no)!;
  const out = [`Adım ${s.no}/${steps.length} · ${s.ad}`, `Akış: ${akis.kisa_kod} · ${akis.baslik}`];
  let st = `Durum: ${LBL[s.durum]}`;
  if (r.simdi) st += ` · bekliyor: ${dur(r.simdi)}`;
  if (s.son_tarih) st += ` · son tarih ${fmtD(s.son_tarih)}`;
  const ef = m.pl.EF.get(s.no);
  if (!DONE(s) && s.son_tarih && ef && ef > eod(s.son_tarih)) st += ` ⚠ en erken bitiş ${fmtMs(ef)}`;
  if (m.pl.chain.includes(s.no) && !DONE(s)) st += " · kritik yolda";
  out.push(st);
  out.push(`Sahip: ${s.sahip}${s.sahip_tip === "agent" ? ` (agent${s.arac ? " · " + s.arac : ""})` : s.sahip_tip === "dis" ? " (dış katılımcı)" : s.arac ? ` (${s.arac} kullanıyor)` : ""}`);
  if (s.aciklama) out.push(`Açıklama: ${s.aciklama}`);
  out.push(`Bitti sayılması için: ${s.kriter}`);
  if (s.beklenen_cikti) out.push(`Beklenen çıktı: ${s.beklenen_cikti}`);
  if (s.karar_kriteri) out.push(`Karar kriteri: ${s.karar_kriteri}`);
  if (s.ilerleme) out.push(`Son ilerleme: ${s.ilerleme}`);
  if (s.engel) out.push(`Engel: ${s.engel}`);
  const bq = s.cevap_soru && akis.baglam?.bekleyen?.[s.cevap_soru];
  if (bq && !DONE(s)) out.push(`Bu adım bitince cevaplanacak soru: ${bq.soru} [${s.cevap_soru}]${bq.secenekler?.length ? ` (${bq.secenekler.map((o: any) => o.deger).join(" / ")})` : bq.tip === "tarih" ? " (YYYY-AA-GG)" : ""}. Cevabı devir_adim_guncelle'nin cevap alanına yaz; Devir akışı ona göre yeniden kurar.`);
  if (s.capa_soru && !s.son_tarih && !DONE(s)) out.push(`Tarihi bekliyor: ${akis.baglam?.bekleyen?.[s.capa_soru]?.soru || s.capa_soru}`);
  if (s.kosul?.soru && !DONE(s)) out.push(`Yalnızca ${s.kosul.soru}=${s.kosul.deger} ise yapılacak; cevap farklı çıkarsa kendiliğinden atlanır.`);
  if (s.ciktilar.length) out.push(`Çıktılar: ${s.ciktilar.map((c: any) => c.ad).join(", ")}`);
  const ag = altAdimi(akis, s.no);
  if (ag) out.push(`Bu adım her ${ag.kalem_turu || "kalem"} için ayrı alt akışta yürüyor (${s.ilerleme || "henüz başlamadı"}): ${ag.kalemler.map((k) => `${k.ad} ${k.kod}`).join(", ")}. Bir kalemde ilerlemek için o alt akışın adımını oku ve güncelle.`);
  if (akis.baglam?.ust_akis) out.push(`Bu, ${akis.baglam.ust_kod} akışının "${akis.baglam.kalem}" için alt akışı; bitince üst akış kendiliğinden güncellenir.`);
  if (!isDis(ctx)) {
    if (s.bagimli.length) out.push(`Beklediği adımlar: ${s.bagimli.map((n: number) => { const d: any = by.get(n); return d ? `${ICON[d.durum]} ${d.no}. ${d.ad} (${d.sahip})` : n; }).join(" · ")}`);
    const next = steps.filter((x: any) => x.bagimli.includes(s.no));
    if (next.length) out.push(`Bu adımı bekleyenler: ${next.map((d: any) => `${ICON[d.durum]} ${d.no}. ${d.ad} (${d.sahip})`).join(" · ")}`);
  }
  const kur = akis.kurallar || {};
  const rules = [];
  if (kur.karar_insanda !== false && kararAdimi(s)) rules.push("bu bir karar adımı: son söz insanda, agent yalnızca hazırlar");
  if (kur.veri_ozet !== false) rules.push("kişisel ve finansal ayrıntı nota açık yazılmaz, özet yazılır");
  if (rules.length) out.push(`Kurallar: ${rules.join("; ")}`);
  if (akis.sablon_kod) {
    const sab = await getSablon(ctx, akis.sablon_kod);
    const L = learnings(sab, akis.baglam?.musteri, ctx.ws.id);
    const rel = [...L.musteri, ...L.genel].filter((l) => l.includes(`"${s.ad}"`));
    if (rel.length) out.push("Öğrenimler:", ...rel.map((l) => `- ${l}`));
  }
  // bu adımın çıktıları ve önceki adımlardan gelen girdiler
  const kendi = await ciktilar(ctx, akis.id, [s.no]);
  if (kendi.length) { out.push("Bu adımın çıktıları:"); for (const c of kendi) out.push(ciktiSatiri(c)); }
  const girdi = (await ciktilar(ctx, akis.id, s.bagimli)).filter((c: any) => !isDis(ctx) || c.paylasim === "dis");
  if (girdi.length) { out.push("Girdiler (önceki adımların çıktıları):"); for (const c of girdi) out.push(`Adım ${c.adim_no} · ` + ciktiSatiri(c)); }
  if (!isDis(ctx) && akis.baglam?.musteri) {
    const kk = await kararlar(ctx, akis.baglam.musteri);
    if (kk.length) { out.push(`Geçerli kararlar (${akis.baglam.musteri}) — bunlarla çelişen bir iş yapacaksan önce kullanıcıya sor:`); for (const k of kk) out.push(`- ${kararSatiri(k)}`); }
  }
  const hist = events.filter((e: any) => e.adim_no === s.no && e.tip !== "okuma").slice(-6);
  if (hist.length) { out.push("Geçmiş:"); for (const e of hist) out.push(`- ${fmtMs(ts(e.created_at))} · ${who(e)}: ${e.ozet}`); }
  out.push("Nasıl ilerlenir: başlarken durum=suruyor; ilerlemeyi ilerleme ile yaz; ürettiğin işi cikti olarak yaz (ozet her zaman, metinse icerik'in tamamı, dış araçtaysa url); birini bekliyorsan durum=engelli ve engel; kriter karşılanınca durum=tamam; kullanıcı bir karar verirse devir_karar ile kaydet.");
  if (!DONE(s)) { const l = chatLinks(akis, s); out.push(`Bu adımı ayrı sohbette açmak için: Claude ${l.claude} · ChatGPT ${l.chatgpt}`); }
  await log(ctx, akis.id, s.no, act, "okuma", `Adım ${s.no} okundu`, {});
  return out.join("\n");
}

/** Politika "beyan" ise agent'ın kararı adımı kapatmaz: öneri olarak yazılır, kişi Devir'de (web ya da bağlantı) onaylar. */
async function kararBeyan(a: any, ctx: Ctx) {
  const akis = await getAkis(ctx, a.akis);
  const secim = (Array.isArray(a.secim) ? a.secim : []).map(String);
  await adimGuncelle({ akis: a.akis, no: a.no, karar: { oneri: { secim, ozet: a.not ? String(a.not) : secim.join(", ") || "Agent üzerinden bildirilen karar", gerekce: "beyan: kişinin onayı bekleniyor" } } }, ctx);
  const act = actor(ctx, a);
  await log(ctx, akis.id, Number(a.no), act, "ret", `Karar ${act.arac} üzerinden bildirildi; beyan sayıldı, ${act.kim}'in onayı bekleniyor`, { tur: "karar_beyani", secim });
  return `Kararı öneri olarak kaydettim; adım kapanmadı. Bu çalışma alanında ${ctx.key.kisi} adına agent üzerinden verilen karar beyan sayılıyor. ${ctx.key.kisi} kararı Devir web'de ya da kişisel bağlantısında onaylamalı.`;
}
/** Agent'ın karar adımını tamamlaması: yalnız devir_karar_ver aracıyla ve kullanıcı tipinin politikası "insan kararı say" ise. */
async function kararIzni(ctx: Ctx, akis: any, act: any, s: any, op: { kararAraci?: boolean }) {
  const ret = (neden: string) => log(ctx, akis.id, s.no, act, "ret", `Karar adımını agent tamamlamak istedi; reddedildi (${neden})`, { istek: "tamam", arac_karar: !!op.kararAraci });
  if (!op.kararAraci) { await ret("devir_karar_ver kullanılmadı"); throw yetkiYok(`Adım ${s.no} (${s.ad}) bir karar adımı. Kullanıcıya özetini ve önerini göster${s.karar_kriteri ? ` (karar kriteri: ${s.karar_kriteri})` : ""}; kullanıcı kararı bu konuşmada açıkça verirse devir_karar_ver ile kaydet. Kararı sen verme.`); }
  if (kararDuzeyi(ctx, act) !== "insan") { await ret("agent kararı bu kullanıcı için beyan"); throw yetkiYok(`Adım ${s.no} (${s.ad}) bir karar adımı; ${ctx.key.kisi} adına agent üzerinden verilen karar bu çalışma alanında yalnız beyan sayılıyor. Kararı Devir'de (web ya da kişisel bağlantı) vermesi gerekiyor.`); }
}
async function adimGuncelle(a: any, ctx: Ctx, op: { kararAraci?: boolean } = {}) {
  const akis = await getAkis(ctx, a.akis);
  if (akis.durum !== "aktif") throw new Error(`Akış ${akis.durum}; güncellenemez.`);
  const { steps } = await loadFlow(ctx, akis);
  const s = steps.find((x: any) => x.no === Number(a.no));
  if (!s) throw bulunamadi(`Bu akışta ${a.no} numaralı adım yok (1–${steps.length}).`);
  const act = actor(ctx, a);
  if (!stepInScope(ctx, s)) {
    await log(ctx, akis.id, s.no, act, "ret", `Kapsam dışı adımı güncelleme isteği reddedildi`, {});
    throw yetkiYok(`Adım ${s.no} sana atanmamış; yalnızca kendi adımlarını güncelleyebilirsin.`);
  }
  const by = new Map(steps.map((x: any) => [x.no, x]));
  const out: string[] = [];
  const warn: string[] = [];
  const patch: Record<string, unknown> = {};
  if (a.ilerleme) patch.ilerleme = String(a.ilerleme);
  if (a.sahip_kisi_id && !isDis(ctx)) { const k = await kisiAl(ctx, a.sahip_kisi_id); patch.sahip = k.ad; patch.sahip_kisi_id = k.id; }
  else if (a.sahip && !isDis(ctx)) { patch.sahip = String(a.sahip); Object.assign(patch, await kisiAlani(ctx, a.sahip, a.sahip_tip, "sahip_kisi_id")); }
  if (!isDis(ctx)) {
    let yeniTip: string | null = ["insan", "agent", "dis"].includes(a.sahip_tip) ? a.sahip_tip : null;
    if (!yeniTip && patch.sahip && s.sahip_tip === "dis" && norm(String(patch.sahip)) === norm(ctx.key.kisi)) yeniTip = "insan"; // kullanıcı adımı kendine aldı
    if (yeniTip === "agent" && (akis.kurallar || {}).karar_insanda !== false && kararAdimi(s)) throw new Error(`Adım ${s.no} (${s.ad}) bir karar adımı; sahibi agent olamaz.`);
    if (yeniTip && yeniTip !== s.sahip_tip) patch.sahip_tip = yeniTip;
  }
  if (a.son_tarih) { if (!isDate(a.son_tarih)) throw new Error("son_tarih YYYY-AA-GG olmalı."); if (isDis(ctx)) throw yetkiYok("Son tarihi yalnızca ekip değiştirebilir."); patch.son_tarih = a.son_tarih; patch.tarih_sabit = true; }
  const cikti: any[] = (a.cikti == null ? [] : Array.isArray(a.cikti) ? a.cikti : [a.cikti]).filter(Boolean).map((c: any) => {
    if (typeof c === "string") { const t = c.trim(); try { if (t.startsWith("{")) c = JSON.parse(t); else return { ad: t }; } catch { return { ad: t }; } }
    const o: any = { ad: String(c.ad || c.baslik || "").trim(), ozet: c.ozet ? String(c.ozet) : null, icerik: c.icerik ? String(c.icerik) : null, url: c.url ? String(c.url) : null, kaynak: c.kaynak ? String(c.kaynak) : null, durum: ["taslak", "onaylandi", "yayinda"].includes(c.durum) ? c.durum : "taslak", paylasim: c.paylasim === "dis" ? "dis" : "ekip" };
    if (!o.ad) o.ad = (o.ozet || o.icerik || o.url || "çıktı").slice(0, 80);
    return o;
  });
  if (cikti.length) patch.ciktilar = [...s.ciktilar, ...cikti.map((c: any) => ({ ad: c.ad, kim: act.kim, arac: act.kim_tip === "agent" ? act.arac : null, at: new Date(ctx.now).toISOString() }))];
  for (const c of cikti) {
    if (c.url && !c.icerik && !c.ozet) warn.push(`"${c.ad}" yalnızca bağlantı olarak kaydedildi. Bağlantıya erişemeyenler için ozet ya da icerik ekle.`);
    if (!c.url && !c.icerik && !c.ozet) warn.push(`"${c.ad}" yalnızca adıyla kaydedildi; işin kendisi devredilmiyor. Metinse icerik'e tamamını, dış bir araçtaysa url ve ozet yaz.`);
    if (/claude\.ai|Claude Docs/i.test(`${c.url || ""} ${c.kaynak || ""}`) && !c.icerik) warn.push(`"${c.ad}" kişisel Claude hesabında duruyor; başkaları açamayabilir. İçeriğin metnini icerik alanına da yaz.`);
  }
  const to = a.durum && a.durum !== s.durum ? String(a.durum) : null;
  if (to) {
    if (!["suruyor", "engelli", "tamam", "atlandi", "ertelendi", "hazir"].includes(to)) throw new Error("durum: suruyor, engelli, tamam, atlandi, ertelendi ya da hazir olmalı.");
    const grup = altAdimi(akis, s.no);
    if (grup) throw new Error(`Adım ${s.no} ${grup.kalemler.length} ${grup.kalem_turu || "kalem"} için alt akışlarda yürüyor (${grup.kalemler.map((k) => `${k.ad}: ${k.kod}`).join(", ")}). Durumu alt akışlardan gelir; ilgili alt akışın adımını güncelle.`);
    const pending = s.bagimli.filter((n: number) => { const d: any = by.get(n); return d && !DONE(d); });
    const ustAcik = (await ustBekleyen(ctx, akis)).get(s.no) || [];
    if ((to === "suruyor" || to === "tamam") && ustAcik.length && !a.zorla)
      throw new Error(`Adım ${s.no} henüz başlayamaz; üst akış ${akis.baglam.ust_kod}'da şu adımlar bitmedi: ${ustAcik.join(", ")}. Gerçekten başladıysa zorla=true ve not ile nedenini yaz.`);
    if ((to === "suruyor" || to === "tamam") && pending.length && !a.zorla)
      throw new Error(`Adım ${s.no} henüz başlayamaz; şu adımlar bitmedi: ${pending.map((n: number) => { const d: any = by.get(n); return `${n}. ${d.ad} (${d.sahip}, ${LBL[d.durum]})`; }).join("; ")}. Gerçekten başladıysa zorla=true ve not ile nedenini yaz.`);
    const isKarar = (akis.kurallar || {}).karar_insanda !== false && kararAdimi(s);
    if (op.kararAraci && !isKarar) throw new Error(`Adım ${s.no} (${s.ad}) bir karar adımı değil; devir_adim_guncelle ile güncelle.`);
    if (to === "tamam" && isKarar && act.kim_tip === "agent") await kararIzni(ctx, akis, act, s, op);
    if (to === "engelli") { if (!a.engel) throw new Error("durum=engelli için engel yaz: ne ya da kim bekleniyor?"); patch.engel = String(a.engel); }
    else patch.engel = null;
    if ((to === "atlandi" || to === "ertelendi") && !a.not) throw new Error(to === "atlandi" ? "Adımı atlamak için not alanına nedenini yaz." : "Adımı ertelemek için not alanına neden ve ne zaman yapılacağını yaz.");
    if (to === "tamam" && !cikti.length && !s.ciktilar.length && !a.not && !a.ilerleme) warn.push(`Kriter "${s.kriter}" — tamamlandığına dair çıktı ya da not eklenmedi.`);
    const ozet = to === "tamam" ? `Adım ${s.no} tamamlandı${a.not ? `: ${a.not}` : ""}` : to === "suruyor" ? `Adım ${s.no} başladı${a.zorla && pending.length ? ` (bağımlılıklar bitmeden: ${a.not || "neden yazılmadı"})` : ""}` : to === "engelli" ? `Adım ${s.no} engelli: ${a.engel}` : to === "atlandi" ? `Adım ${s.no} atlandı${a.atlama_nedeni ? ` (${a.atlama_nedeni === "mukerrer" ? "mükerrer" : a.atlama_nedeni === "gerek_kalmadi" ? "gerek kalmadı" : "varsayım yanlıştı"})` : ""}: ${a.not}` : to === "ertelendi" ? `Adım ${s.no} ertelendi (açık iş): ${a.not}` : `Adım ${s.no} geri alındı`;
    await setDurum(ctx, akis, s, to, act, ozet, patch);
    // ekran cümlesi için engelin kısa adı (şema değişmez: akis.baglam.engel_kisa[no])
    const ek0 = akis.baglam?.engel_kisa?.[String(s.no)] || null, ek1 = to === "engelli" && a.engel_kisa ? String(a.engel_kisa).trim().slice(0, 40) : null;
    if (ek0 !== ek1) { const ekler = { ...(akis.baglam?.engel_kisa || {}) }; if (ek1) ekler[String(s.no)] = ek1; else delete ekler[String(s.no)]; akis.baglam = { ...(akis.baglam || {}), engel_kisa: ekler }; await ctx.db.update("akis", { id: akis.id }, { baglam: akis.baglam }); }
    if (to === "tamam" && isKarar && act.kim_tip === "agent") await log(ctx, akis.id, s.no, act, "guncelleme", `Karar ${act.kim} tarafından ${act.arac} üzerinden verildi`, { tur: "karar_onayi", duzey: "insan", kanal: "agent", kisi: act.kim, arac: act.arac });
    if (to === "tamam" && isKarar && act.kim_tip !== "dis" && akis.baglam?.musteri && !akis.baglam?.ust_akis && (s.karar_kriteri || /karar/i.test(s.ad))) { // imza/ödeme/onay insanda kalır ama varlık kararı sayılmaz
      const c0: any = cikti[0];
      const metin = String((c0 && (c0.ozet || c0.ad)) || a.not || s.ad).trim();
      const varlik = String(akis.baglam.musteri);
      const eski = (await kararlar(ctx, varlik)).filter((k: any) => k.konu && k.konu === s.tur_kod);
      const [k] = await ctx.db.insert("karar", [{ ws_id: ctx.ws.id, varlik, varlik_norm: norm(varlik), karar: metin, konu: s.tur_kod || null, kapsam: null, istisna: null, kim: act.kim, akis_id: akis.id, adim_no: s.no, durum: "gecerli" }]);
      for (const e of eski) await ctx.db.update("karar", { id: e.id }, { durum: "degisti", yerine_gecen: k.id });
      await log(ctx, akis.id, s.no, act, "karar", `Karar: ${metin}`, { karar_id: k.id });
      warn.push(`Karar kaydına eklendi [${k.id}] · ${varlik}: ${metin}. ${varlik} için sonraki işlerde bu karar adımı yeniden kurulmaz${eski.length ? `; önceki karar (${eski.map((e: any) => e.id).join(", ")}) yerini buna bıraktı` : ""}.`);
    }
    if (to === "atlandi" && a.atlama_nedeni !== "mukerrer" && a.atlama_nedeni !== "gerek_kalmadi") { const sinyal = await atlamaSinyali(ctx, akis, s, String(a.not || ""), a.atlama_nedeni === "varsayim_yanlis"); if (sinyal) warn.push(sinyal); }
    out.push(`${ICON[to]} Adım ${s.no} · ${s.ad} → ${LBL[to]}`);
  } else if (Object.keys(patch).length) {
    await ctx.db.update("adim", { id: s.id }, patch);
    Object.assign(s, patch);
    out.push(`Adım ${s.no} · ${s.ad} güncellendi`);
  }
  // karar seçenekleri ve öneri (§9-6): şema değişmez, akis.baglam.kararlar[no]
  if (a.karar || a.karar_secimi) {
    const kk = { ...(akis.baglam?.kararlar || {}) }, k0: any = { ...(kk[String(s.no)] || {}) };
    if (a.karar && typeof a.karar === "object") {
      const sec = (Array.isArray(a.karar.secenekler) ? a.karar.secenekler : []).slice(0, 50).map((x: any) => typeof x === "string" ? { ad: x } : { ad: String(x.ad || "").trim(), alt: x.alt ? String(x.alt) : null, etiket: x.etiket ? String(x.etiket) : null, uyari: !!x.uyari }).filter((x: any) => x.ad);
      if (sec.length) k0.secenekler = sec;
      if (a.karar.tur) k0.tur = String(a.karar.tur).slice(0, 30);
      const o = a.karar.oneri;
      if (o) k0.oneri = { kim: act.kim_tip === "agent" ? act.arac || act.kim : act.kim, secim: (Array.isArray(o.secim) ? o.secim : []).map(String), ozet: o.ozet ? String(o.ozet) : null, gerekce: o.gerekce ? String(o.gerekce) : null, at: new Date(ctx.now).toISOString() };
    }
    if (Array.isArray(a.karar_secimi)) {
      if (act.kim_tip === "agent") await kararIzni(ctx, akis, act, s, op);
      k0.secim = { secim: a.karar_secimi.map(String), kim: act.kim, at: new Date(ctx.now).toISOString() };
    }
    kk[String(s.no)] = k0;
    akis.baglam = { ...(akis.baglam || {}), kararlar: kk };
    await ctx.db.update("akis", { id: akis.id }, { baglam: akis.baglam });
    if (!out.length) out.push(`Adım ${s.no} · ${s.ad}: karar ${a.karar_secimi ? "seçimi" : "seçenekleri"} yazıldı`);
  }
  // çıktıları depoya yaz (sürüm: aynı adımda aynı ad varsa artar)
  const yazilan: any[] = [];
  if (cikti.length) {
    const once = await ctx.db.many("cikti", { akis_id: akis.id, adim_no: s.no }, "created_at");
    const rows = cikti.map((c: any) => ({ ws_id: ctx.ws.id, akis_id: akis.id, adim_no: s.no, ...c, surum: once.filter((x: any) => norm(x.ad) === norm(c.ad)).length + 1, kim: act.kim, arac: act.kim_tip === "agent" ? act.arac : null }));
    yazilan.push(...(await ctx.db.insert("cikti", rows)));
  }
  // bu adım tamamlandıysa aynı varlığın başka akışlarında ertelenmiş aynı iş kapanır
  if (to === "tamam" && s.tur_kod && akis.baglam?.musteri) {
    for (const x of await acikIsler(ctx, akis.baglam.musteri)) {
      if (x.akis_id === akis.id || x.tur_kod !== s.tur_kod) continue;
      await durumYaz(ctx, x.akis_id, x, "ertelendi", "tamam", act, `Ertelenmiş iş ${akis.kisa_kod} akışında tamamlandı`, { durum: "tamam", durum_at: new Date(ctx.now).toISOString() });
      warn.push(`${x.akis_kod} akışında ertelenmiş "${x.ad}" işi de kapandı.`);
    }
  }
  if (a.cevap != null && String(a.cevap).trim()) {
    const bek = Object.keys(akis.baglam?.bekleyen || {});
    const kod = s.cevap_soru || (bek.length === 1 ? bek[0] : null);
    if (!kod) throw new Error(bek.length ? `Bu adım bir açık soruya bağlı değil. Açık sorular: ${bek.join(", ")}; devir_cevapla ile soruyu belirterek yaz.` : "Bu akışta açık soru yok.");
    out.push(...await soruUygula(ctx, akis, steps, kod, a.cevap, act));
  } else if (to === "tamam" && s.cevap_soru && akis.baglam?.bekleyen?.[s.cevap_soru]) warn.push(`Bu adım bitince "${akis.baglam.bekleyen[s.cevap_soru].soru}" sorusunun cevabı belli olmalıydı. Cevabı devir_cevapla({ akis: "${akis.kisa_kod}", soru: "${s.cevap_soru}", cevap }) ile yaz; bağlı adımlar o zamana kadar bekliyor.`);
  const bits = [];
  if (a.ilerleme) bits.push(`ilerleme: ${a.ilerleme}`);
  if (cikti.length) bits.push(`çıktı: ${cikti.map((c: any) => c.ad).join(", ")}`);
  if (patch.sahip || patch.sahip_tip) bits.push(`sahip → ${patch.sahip || s.sahip}${patch.sahip_tip ? ` (${patch.sahip_tip === "dis" ? "dış" : patch.sahip_tip})` : ""}`);
  if (patch.son_tarih) bits.push(`son tarih → ${fmtD(String(patch.son_tarih))}`);
  if (a.karar?.oneri) bits.push(`karar önerisi: ${a.karar.oneri.ozet || (a.karar.oneri.secim || []).join(", ")}`);
  else if (a.karar?.secenekler) bits.push(`karar seçenekleri: ${a.karar.secenekler.length}`);
  if (Array.isArray(a.karar_secimi)) bits.push(`seçim: ${a.karar_secimi.join(", ") || "hiçbiri"}`);
  if (bits.length || (a.not && !to)) await log(ctx, akis.id, s.no, act, a.not && !bits.length ? "not" : "guncelleme", bits.length ? `${bits.join(" · ")}${a.not && !to ? ` · ${a.not}` : ""}` : String(a.not), {});
  if (!to && !bits.length && !a.not && !a.karar && !a.karar_secimi && !(a.cevap != null && String(a.cevap).trim())) throw new Error("Güncellenecek bir şey yok: durum, ilerleme, cikti, not, sahip ya da son_tarih ver.");
  if (!out.length) out.push(`Adım ${s.no} · ${s.ad}: not eklendi`);
  if (yazilan.length) out.push(`Çıktı kaydedildi: ${yazilan.map((c: any) => `[${c.id}] ${c.ad}${c.surum > 1 ? ` (v${c.surum})` : ""}`).join(", ")}. Sonraki adımlar bunu girdi olarak görür.`);
  const ready = await recalc(ctx, akis, steps);
  if (ready.length && !isDis(ctx)) {
    out.push("", "Sıra geçti:");
    for (const r of ready) { const l = chatLinks(akis, r); out.push(`- ${r.no}. ${r.ad} → ${r.sahip}${r.sahip_tip === "dis" ? " (dış katılımcı; haber ver)" : ""} · Claude'da aç: ${l.claude} · ChatGPT'de aç: ${l.chatgpt}`); }
  }
  out.push(...await altZincir(ctx, akis));
  if (steps.every(DONE)) out.push("", akis.baglam?.ust_akis ? `Bu kalemin tüm adımları bitti; üst akış ${akis.baglam.ust_kod} güncellendi.` : `Tüm adımlar bitti. devir_akis_kapat({ akis: "${akis.kisa_kod}" }) ile kapat; Devir bu işten ders çıkarır.`);
  if (warn.length) out.push("", ...warn.map((w) => `Not: ${w}`));
  return out.join("\n");
}

async function adimEkle(a: any, ctx: Ctx) {
  needTeam(ctx, "Adım eklemeyi");
  const akis = await getAkis(ctx, a.akis);
  if (akis.durum !== "aktif") throw new Error(`Akış ${akis.durum}; adım eklenemez.`);
  const { steps } = await loadFlow(ctx, akis);
  if (!a.neden) throw new Error("neden gerekli: bu adım neden sonradan çıktı?");
  const no = steps.reduce((mx: number, s: any) => Math.max(mx, s.no), 0) + 1;
  const v: any = {
    ad: String(a.ad || "").trim(), aciklama: a.aciklama || null, sahip: String(a.sahip || "").trim(),
    sahip_tip: ["insan", "agent", "dis"].includes(a.sahip_tip) ? a.sahip_tip : "insan", arac: a.arac || null,
    kriter: String(a.kriter || "").trim(), son_tarih: a.son_tarih || null, sure_tahmin_gun: a.sure_tahmin_gun != null ? num(a.sure_tahmin_gun) : null,
    bagimli: [...new Set(((a.bagimli || []) as unknown[]).map(Number))],
  };
  if (!v.ad || !v.sahip || !v.kriter) throw new Error("ad, sahip ve kriter gerekli.");
  if (v.son_tarih && !isDate(v.son_tarih)) throw new Error("son_tarih YYYY-AA-GG olmalı.");
  for (const d of v.bagimli) if (!steps.some((s: any) => s.no === d)) throw new Error(`bagimli: ${d} numaralı adım yok.`);
  if ((akis.kurallar || {}).karar_insanda !== false && v.sahip_tip === "agent" && kararAdimi(v)) throw new Error(`"${v.ad}" bir karar/onay/ödeme adımı; sahibi insan olmalı.`);
  const bekleyen: number[] = (a.bekleyenler || []).map(Number);
  for (const b of bekleyen) { const t = steps.find((s: any) => s.no === b); if (!t) throw new Error(`bekleyenler: ${b} numaralı adım yok.`); if (DONE(t)) throw new Error(`bekleyenler: ${b} zaten bitmiş.`); }
  const test = [...steps.map((s: any) => ({ no: s.no, bagimli: bekleyen.includes(s.no) ? [...s.bagimli, no] : s.bagimli })), { no, bagimli: v.bagimli }];
  topo(test);
  let turKod = slug(v.ad), boyut: string | null = null;
  if (ctx.llm) {
    try {
      const turler = [...new Set(steps.map((s: any) => s.tur_kod).filter(Boolean))];
      const r = await ctx.llm({ system: "Devir adım türü eşleştiricisi. Yeni adım, listedeki bir adım türüyle aynı işse o kodu aynen ver; değilse kısa, kalıcı kebab-case yeni kod üret. Ayrıca bu adımın akışa baştan girmemesinin hangi boyuttaki bir sorunun sorulmamasından kaynaklandığını seç: sonuc, zaman, karar, kapi, dis, girdi, arac, kisit, belirsizlik, tekrar, bagli ya da genel.", user: `İş türü: ${akis.sablon_kod || "-"}\nMevcut adım türleri: ${turler.join(", ") || "-"}\nYeni adım: "${v.ad}" (sahip: ${v.sahip})\nNeden sonradan çıktı: ${a.neden}`, tool: TUR_ARACI, model: ctx.modeller?.hizli, max_tokens: 600 });
      if (r.input?.tur_kod) turKod = slug(r.input.tur_kod);
      if (r.input?.boyut) boyut = String(r.input.boyut);
    } catch (e) { console.warn("adim_turu eşleştirilemedi:", (e as Error).message); }
  }
  if (!boyut) boyut = "genel";
  const [row] = await ctx.db.insert("adim", await sahipBagla(ctx, [{ akis_id: akis.id, no, ad: v.ad, aciklama: v.aciklama, sahip: v.sahip, sahip_tip: v.sahip_tip, arac: v.arac, kriter: v.kriter, son_tarih: v.son_tarih, sure_tahmin_gun: v.sure_tahmin_gun, bagimli: v.bagimli, kaynak: "sonradan", tur_kod: turKod, tarih_sabit: !!v.son_tarih }]));
  if (akis.sablon_kod || akis.taslak_id) await ctx.db.insert("soru_kaydi", [{ ws_id: ctx.ws.id, taslak_id: akis.taslak_id || null, akis_id: akis.id, is_turu: akis.sablon_kod, tip: "kacan", boyut, soru: v.ad, cevap: String(a.neden), kaynak: "adim_ekle", etki: { eklenen: [turKod] }, etki_puan: 1 }]);
  fixStep(row);
  for (const b of bekleyen) { const t = steps.find((s: any) => s.no === b); t.bagimli = [...t.bagimli, no]; await ctx.db.update("adim", { id: t.id }, { bagimli: t.bagimli }); }
  const act = actor(ctx, a);
  const by = (n: number) => steps.find((s: any) => s.no === n);
  await log(ctx, akis.id, no, act, "adim_eklendi", `Sonradan eklendi: ${v.ad} (${a.neden})`, { neden: a.neden, tur_kod: turKod, boyut, bagimli_ad: v.bagimli.map((n: number) => by(n)?.ad).filter(Boolean), bekleyen_ad: bekleyen.map((n) => by(n)?.ad).filter(Boolean), bagimli_tur: v.bagimli.map((n: number) => by(n)?.tur_kod).filter(Boolean), bekleyen_tur: bekleyen.map((n) => by(n)?.tur_kod).filter(Boolean) });
  steps.push(row);
  const ready = await recalc(ctx, akis, steps);
  const out = [`+ Adım ${no} eklendi: ${v.ad} — ${v.sahip}`, `Neden: ${a.neden}`];
  if (bekleyen.length) out.push(`Artık bunu bekleyen adımlar: ${bekleyen.join(", ")}`);
  out.push(`Durum: ${LBL[row.durum]}${ready.some((r: any) => r.no === no) ? " (hemen başlayabilir)" : ""}`);
  if (boyut && boyut !== "genel") out.push(`Sorulmamış boyut: ${boyut}. Bir sonraki benzer işte bu boyuttaki soru öne çıkar.`);
  out.push("Akış kapanınca bu ekleme ekibin deneyim belleğine yazılır; benzer işlerde baştan önerilir.");
  return out.join("\n");
}

// ---------- sonradan cevaplanan soru ----------
async function soruUygula(ctx: Ctx, akis: any, steps: any[], kod: string, cevapHam: unknown, act: any) {
  const bek: Record<string, any> = akis.baglam?.bekleyen || {};
  const b = bek[kod];
  if (!b) throw new Error(`'${kod}' bu akışta açık bir soru değil.${Object.keys(bek).length ? ` Açık sorular: ${Object.keys(bek).join(", ")}.` : " Açık soru yok."}`);
  let cevap = String(cevapHam ?? "").trim();
  if (!cevap || BILMIYORUM_RE.test(cevap)) throw new Error("Cevap henüz belli değilse çağırma; soru açık kalır ve bağlı adımlar bekler.");
  if (b.tip === "tarih") { if (!isDate(cevap)) throw new Error(`"${b.soru}" bir tarih sorusu; cevabı YYYY-AA-GG yaz.`); }
  else {
    cevap = esle(b, cevap);
    const ops: any[] = Array.isArray(b.secenekler) ? b.secenekler : [];
    if (b.tip === "secim" && ops.length && !ops.some((o) => norm(o.deger) === norm(cevap))) throw new Error(`Cevap şu seçeneklerden biri olmalı: ${ops.map((o) => `${o.deger}${o.etiket ? ` (${o.etiket})` : ""}`).join(" / ")}.`);
  }
  const out: string[] = [`✓ ${b.soru} → ${cevap}`];
  const notes: string[] = [];
  // dallar: seçilmeyen dal atlanır, seçilen dalın koşulu kalkar
  const eslesir = (k: any) => String(k.deger).split("|").some((d) => norm(d) === norm(cevap));
  const atlanan: any[] = [];
  for (const x of steps) {
    if (DONE(x) || x.kosul?.soru !== kod) continue;
    if (eslesir(x.kosul)) { await ctx.db.update("adim", { id: x.id }, { kosul: null }); x.kosul = null; }
    else { await setDurum(ctx, akis, x, "atlandi", SYS, `Adım ${x.no} atlandı (gerek kalmadı): ${kod}=${cevap}, bu dal seçilmedi`, { engel: null, kosul: null }); atlanan.push(x); }
  }
  // seçilmeyen dalda cevaplanacak sorular da düşer; onlara bağlı adımlar da atlanır
  const dusen: string[] = [];
  for (let i = 0; i < atlanan.length; i++) {
    const k2 = atlanan[i].cevap_soru;
    if (!k2 || k2 === kod || !bek[k2] || dusen.includes(k2)) continue;
    dusen.push(k2);
    for (const x of steps) if (!DONE(x) && (x.kosul?.soru === k2 || x.capa_soru === k2)) { await setDurum(ctx, akis, x, "atlandi", SYS, `Adım ${x.no} atlandı (gerek kalmadı): ${k2} sorusu seçilmeyen dalda kaldı (${kod}=${cevap})`, { engel: null, kosul: null }); atlanan.push(x); }
  }
  if (atlanan.length) out.push(`Seçilmeyen dal atlandı: ${atlanan.map((x) => `${x.no}. ${x.ad}`).join("; ")}`);
  if (dusen.length) out.push(`Artık gerekmeyen sorular kapandı: ${dusen.join(", ")}`);
  // soruyu bekleyen netleştir / sonuç adımı kapanır
  for (const x of steps) {
    if (x.cevap_soru !== kod) continue;
    if (!DONE(x) && /^(netlestir|sonuc)-/.test(x.tur_kod || "")) await setDurum(ctx, akis, x, "tamam", act, `Adım ${x.no} tamamlandı: ${kod}=${cevap}`, { cevap_soru: null });
    else { await ctx.db.update("adim", { id: x.id }, { cevap_soru: null }); x.cevap_soru = null; }
  }
  // tarih: bağlı adımlara çapa, açık adımların takvimi yeniden
  if (b.tip === "tarih") {
    for (const x of steps) if (x.capa_soru === kod && !DONE(x)) x._capa = cevap;
    const acik = steps.filter((x) => !DONE(x));
    const acikNo = new Set(acik.map((x) => x.no));
    const plan = acik.map((x) => ({ no: x.no, ad: x.ad, bagimli: x.bagimli.filter((d: number) => acikNo.has(d)), sure_tahmin_gun: x.sure_tahmin_gun, son_tarih: x.tarih_sabit && !x._capa ? x.son_tarih : null, _sabit: !!x.tarih_sabit && !x._capa, _capa: x._capa || null, _capaSoru: x._capa ? null : x.capa_soru || null, _netlestir: /^netlestir-/.test(x.tur_kod || "") }));
    const bugun = dayNum(todayIst(ctx.now));
    const eskiHedef = akis.hedef_tarih || null;
    const r = takvim(plan, kod === "hedef_tarih" ? cevap : eskiHedef, bugun, notes); // hedef tarihin kendisi sonradan cevaplanabilir
    let degisen = 0;
    for (const p of plan) {
      const x = steps.find((y) => y.no === p.no)!;
      const patch: Record<string, unknown> = {};
      if ((p.son_tarih || null) !== (x.son_tarih || null)) patch.son_tarih = p.son_tarih || null;
      if (x._capa) { patch.capa_soru = null; patch.tarih_sabit = true; patch.capa_tarih = x._capa; }
      if (Object.keys(patch).length) { await ctx.db.update("adim", { id: x.id }, patch); Object.assign(x, patch); if ("son_tarih" in patch) degisen++; }
    }
    const capali = steps.filter((x) => x._capa);
    if (capali.length) out.push(`Sabit tarih: ${capali.map((x) => `${x.no}. ${x.ad} → ${fmtD(cevap)}`).join("; ")}`);
    if (degisen) out.push(`${degisen} adımın son tarihi yeniden planlandı.`);
    if (r.hedef && r.hedef !== eskiHedef) { await ctx.db.update("akis", { id: akis.id }, { hedef_tarih: r.hedef }); out.push(eskiHedef ? `Hedef ${fmtD(eskiHedef)} → ${fmtD(r.hedef)}.` : `Hedef tarih ${fmtD(r.hedef)} oldu.`); akis.hedef_tarih = r.hedef; }
  }
  // kayıt
  const baglam = { ...(akis.baglam || {}) };
  baglam.cevaplar = { ...(baglam.cevaplar || {}), [kod]: cevap };
  baglam.cevaplanan = { ...(baglam.cevaplanan || {}), [kod]: { cevap, at: new Date(ctx.now).toISOString(), kim: act.kim } };
  const yeni = { ...bek }; delete yeni[kod]; for (const k2 of dusen) delete yeni[k2]; baglam.bekleyen = yeni;
  await ctx.db.update("akis", { id: akis.id }, { baglam });
  akis.baglam = baglam;
  await log(ctx, akis.id, null, act, "guncelleme", `Cevap: ${kod} = ${cevap}${atlanan.length ? ` (${atlanan.length} adım atlandı)` : ""}`, { tur: "cevap", soru: kod, cevap, atlanan: atlanan.map((x) => x.no) });
  try {
    await ctx.db.insert("soru_kaydi", [{ ws_id: ctx.ws.id, taslak_id: akis.taslak_id || null, akis_id: akis.id, is_turu: akis.sablon_kod, tip: "soru", soru_kod: kod, boyut: b.boyut || null, soru: b.soru, cevap, kaynak: "sonradan", etki: { cikarilan: atlanan.map((x) => x.tur_kod) }, etki_puan: b.tip === "tarih" ? 1 : atlanan.length }]);
  } catch (e) { console.warn("soru kaydı yazılamadı:", (e as Error).message); }
  for (const n of notes) if (!/^Hedef /.test(n)) out.push(`Not: ${n}`);
  const kalan = Object.keys(yeni);
  if (kalan.length) out.push(`Açık kalan sorular: ${kalan.join(", ")}`);
  return out;
}

async function cevapla(a: any, ctx: Ctx) {
  needTeam(ctx, "Açık soruyu cevaplamayı");
  const akis = await getAkis(ctx, a.akis);
  if (akis.durum !== "aktif") throw new Error(`Akış ${akis.durum}; güncellenemez.`);
  const { steps } = await loadFlow(ctx, akis);
  const act = actor(ctx, a);
  const out = await soruUygula(ctx, akis, steps, String(a.soru || "").trim(), a.cevap, act);
  const ready = await recalc(ctx, akis, steps);
  out.push(...await altZincir(ctx, akis));
  if (ready.length) { out.push("", "Sıra geçti:"); for (const r of ready) { const l = chatLinks(akis, r); out.push(`- ${r.no}. ${r.ad} → ${r.sahip} · Claude'da aç: ${l.claude} · ChatGPT'de aç: ${l.chatgpt}`); } }
  if (steps.every(DONE)) out.push("", `Tüm adımlar bitti. devir_akis_kapat({ akis: "${akis.kisa_kod}" }) ile kapat.`);
  return out.join("\n");
}

async function ciktiOku(a: any, ctx: Ctx) {
  const akis = await getAkis(ctx, a.akis);
  const cid = Number(String(a.id ?? "").replace(/[^0-9]/g, ""));
  const c = cid ? await ctx.db.one("cikti", { id: cid, akis_id: akis.id }) : null;
  if (!c) throw new Error(`Bu akışta '${a.id}' kimlikli çıktı yok. devir_adim_oku çıktıları kimlikleriyle listeler.`);
  if (isDis(ctx)) {
    const s = await ctx.db.one("adim", { akis_id: akis.id, no: c.adim_no });
    if (c.paylasim !== "dis" && !(s && stepInScope(ctx, s))) throw new Error("Bu çıktı ekibe özel; rolün gereği göremezsin.");
  }
  const surumler = (await ctx.db.many("cikti", { akis_id: akis.id, adim_no: c.adim_no }, "created_at")).filter((x: any) => norm(x.ad) === norm(c.ad));
  const out = [`Adım ${c.adim_no} · ${ciktiSatiri(c, true)}`, `Yazan: ${c.kim}${c.arac ? ` (${c.arac})` : ""} · ${fmtMs(ts(c.created_at))}`];
  if (surumler.length > 1) out.push(`Sürümler: ${surumler.map((x: any) => `v${x.surum} [${x.id}]${x.id === c.id ? " ← bu" : ""}`).join(", ")}`);
  if (!c.icerik && c.url) out.push(String(c.url).startsWith("dosya:") ? "Bu çıktı Devir'e yüklenmiş bir dosya; metni burada yok, özetine göre ilerle ya da kullanıcıdan içeriği iste." : "İçeriğin metni Devir'de yok; yalnızca bağlantı ve özet var.");
  return out.join("\n");
}

async function karar(a: any, ctx: Ctx) {
  needTeam(ctx, "Karar kaydetmeyi");
  let akis: any = null;
  if (a.akis) akis = await getAkis(ctx, a.akis);
  const varlik = String(a.varlik || akis?.baglam?.musteri || "").trim();
  if (!varlik) throw new Error("varlik gerekli (ör. Hasat) ya da akis ver.");
  const out: string[] = [];
  if (a.karar && String(a.karar).trim()) {
    needOwner(ctx, "Çalışma alanı kararı kaydetmeyi");
    const [k] = await ctx.db.insert("karar", [{ ws_id: ctx.ws.id, varlik, varlik_norm: norm(varlik), karar: String(a.karar).trim(), konu: a.konu ? String(a.konu) : null, kapsam: a.kapsam || null, istisna: a.istisna || null, kim: ctx.key.kisi, akis_id: akis?.id || null, adim_no: a.no ?? null, durum: "gecerli" }]);
    if (a.yerine) { await ctx.db.update("karar", { id: Number(String(a.yerine).replace(/[^0-9]/g, "")), ws_id: ctx.ws.id }, { durum: "degisti", yerine_gecen: k.id }); out.push(`Eski karar (${a.yerine}) bu kararla değiştirildi.`); }
    if (akis) await log(ctx, akis.id, a.no ?? null, actor(ctx, a), "karar", `Karar: ${k.karar}${k.istisna ? ` (istisna: ${k.istisna})` : ""}`, { karar_id: k.id });
    out.unshift(`✓ Karar kaydedildi [${k.id}] · ${varlik}: ${kararSatiri(k)}`);
  }
  const kk = await kararlar(ctx, varlik);
  out.push("", `${varlik} için geçerli kararlar (${kk.length}):`);
  for (const k of kk) out.push(`- [${k.id}] ${kararSatiri(k)}`);
  if (!kk.length) out.push("- henüz yok");
  out.push("", "Bu kararlar yeni taslaklarda kısıt olarak kullanılır ve adım okunurken gösterilir.");
  return out.join("\n");
}

async function kapat(a: any, ctx: Ctx) {
  needTeam(ctx, "Akış kapatmayı");
  const akis = await getAkis(ctx, a.akis);
  if (akis.durum !== "aktif") throw new Error(`Akış zaten ${akis.durum}.`);
  const neden = a.neden == null || a.neden === "" ? "tamamlandi" : String(a.neden);
  if (!["tamamlandi", "iptal", "mukerrer"].includes(neden)) throw new Error("neden: tamamlandi, iptal ya da mukerrer olmalı.");
  const { steps, events } = await loadFlow(ctx, akis);
  const open = steps.filter((s: any) => !DONE(s));
  if (neden !== "tamamlandi") return vazgec(ctx, a, akis, neden, open.length);
  if (open.length && !a.zorla) throw new Error(`Bitmemiş adımlar var: ${open.map((s: any) => `${s.no}. ${s.ad} (${LBL[s.durum]})`).join("; ")}. Yine de kapatmak için zorla=true.`);
  if (open.length) needOwner(ctx, "Bitmemiş adımı olan akışı kapatmayı");
  const m = metrics(akis, steps, events, ctx.now);
  const added = events.filter((e: any) => e.tip === "adim_eklendi" && (steps.find((x: any) => x.no === e.adim_no) || {}).durum !== "atlandi").map((e: any) => {
    const s = steps.find((x: any) => x.no === e.adim_no) || {};
    return { ad: s.ad, tur_kod: s.tur_kod || null, boyut: e.veri?.boyut || null, neden: e.veri?.neden, sahip: s.sahip, sahip_tip: s.sahip_tip, kriter: s.kriter, sure_tahmin_gun: s.sure_tahmin_gun, bagimli_ad: e.veri?.bagimli_ad || [], bekleyen_ad: e.veri?.bekleyen_ad || [], bagimli_tur: e.veri?.bagimli_tur || [], bekleyen_tur: e.veri?.bekleyen_tur || [] };
  });
  const skipped = steps.filter((s: any) => s.durum === "atlandi").map((s: any) => s.ad);
  const ertelenen = steps.filter((s: any) => s.durum === "ertelendi").map((s: any) => s.ad);
  const bekleme = steps.map((s: any) => { const r = m.tl.get(s.no)!; return { ad: s.ad, tur_kod: s.tur_kod || null, sahip: s.sahip, dis: s.sahip_tip === "dis", saat: Math.round(((r.bekleme + r.engel) / HOUR) * 10) / 10 }; }).filter((b: any) => b.saat > 0);
  const sapma = steps.filter((s: any) => s.sure_tahmin_gun).map((s: any) => { const r = m.tl.get(s.no)!; return { ad: s.ad, tahmin: Number(s.sure_tahmin_gun), gercek: Math.round(((r.aktif + r.bekleme + r.engel) / DAY) * 10) / 10 }; });
  await ctx.db.update("akis", { id: akis.id }, { durum: "kapandi", kapandi_at: new Date(ctx.now).toISOString() });
  const act = actor(ctx, a);
  await log(ctx, akis.id, null, act, "akis_kapandi", `Akış kapandı: ${dur(m.sure)}, bekleme ${dur(m.bekleme)}`, { degerlendirme: a.degerlendirme || null });
  if (akis.baglam?.ust_akis) return `■ ${akis.kisa_kod} · ${akis.baslik} kapandı (alt akış). Deneyim üst akış ${akis.baglam.ust_kod} kapanınca birlikte yazılır.`;
  const cocuklar = altGruplar(akis).flatMap((g) => g.kalemler);
  if (cocuklar.length) for (const f of await ctx.db.many("akis", { id: cocuklar.map((k) => k.akis_id), durum: "aktif" }, "created_at")) {
    await ctx.db.update("akis", { id: f.id }, { durum: "kapandi", kapandi_at: new Date(ctx.now).toISOString() });
    await log(ctx, f.id, null, act, "akis_kapandi", `Üst akış ${akis.kisa_kod} ile birlikte kapandı`, {});
  }
  const ilk: string[] = Array.isArray(akis.ilk_taslak) ? akis.ilk_taslak : [];
  const son = steps.filter((s: any) => s.durum !== "atlandi").map((s: any) => s.tur_kod || slug(s.ad));
  const birlesim = new Set([...ilk, ...son]);
  const isabet = ilk.length ? [...birlesim].filter((x) => ilk.includes(x) && son.includes(x)).length / Math.max(1, birlesim.size) : null;
  // 1.5.1 deneyim kaydı · 1.5.2 dersler (şablona öğrenim yazılmaz; iş türü yalnızca etikettir)
  let bellekNotlari: string[] = [];
  try {
    const kayit = await ctx.db.many("soru_kaydi", { ws_id: ctx.ws.id, akis_id: akis.id }, "id");
    const atlamaOlay = new Map<number, string>();
    for (const e of events) if (e.tip === "durum" && e.veri?.to === "atlandi" && e.adim_no != null) atlamaOlay.set(e.adim_no, e.ozet || "");
    const tk = akis.taslak_id ? await ctx.db.one("taslak", { id: akis.taslak_id }) : null;
    const d = {
      akis_id: akis.id, akis_kod: akis.kisa_kod, is_turu: akis.sablon_kod || null, cumle: tk?.cumle || null, baslik: akis.baslik,
      varlik: akis.baglam?.musteri || null, iliski: akis.baglam?.iliski || null,
      adimlar: steps.map((s: any) => ({ no: s.no, ad: s.ad, tur_kod: s.tur_kod || slug(s.ad), sahip_tip: s.sahip_tip, durum: s.durum, sure_tahmin_gun: s.sure_tahmin_gun != null ? Number(s.sure_tahmin_gun) : null })),
      eklenen: added.map((x: any) => ({ ad: x.ad, tur_kod: x.tur_kod, boyut: x.boyut, neden: x.neden, sahip_tip: x.sahip_tip, kriter: x.kriter, sure_tahmin_gun: x.sure_tahmin_gun, bagimli_tur: x.bagimli_tur, bekleyen_tur: x.bekleyen_tur })),
      atlanan: steps.filter((s: any) => s.durum === "atlandi").map((s: any) => ({ ad: s.ad, tur_kod: s.tur_kod || null, neden: atlamaNedeni(atlamaOlay.get(s.no) || "") })),
      yanlis_varsayim: kayit.filter((k: any) => k.tip === "yanlis_varsayim").map((k: any) => ({ soru_kod: k.soru_kod, soru: k.soru, boyut: k.boyut, cevap: k.cevap })),
      soru_etki: kayit.filter((k: any) => k.tip === "soru").map((k: any) => ({ kod: k.soru_kod, cevap: k.cevap, kaynak: k.kaynak, puan: Number(k.etki_puan || 0) })),
      sonradan: akis.baglam?.cevaplanan || {},
      bekleme, sapma: sapma.map((x: any, i: number) => ({ ...x, tur_kod: steps.filter((s: any) => s.sure_tahmin_gun)[i]?.tur_kod || null })), isabet,
    };
    const sonuc = await deneyimKaydet(ctx, d, Array.isArray(akis.baglam?.dersler) ? akis.baglam.dersler : []);
    bellekNotlari = sonuc.notlar;
  } catch (e) { console.warn("deneyim kaydı yazılamadı:", (e as Error).message); bellekNotlari = ["Deneyim kaydı yazılamadı; akış yine de kapandı."]; }
  const out = [`■ ${akis.kisa_kod} · ${akis.baslik} kapandı`, `Toplam ${dur(m.sure)} · ` + speedLine(m)];
  if (akis.hedef_tarih) out.push(eod(akis.hedef_tarih) >= ctx.now ? `Hedef ${fmtD(akis.hedef_tarih)} tutturuldu.` : `Hedef ${fmtD(akis.hedef_tarih)} kaçırıldı.`);
  const topw = [...bekleme].sort((x, y) => y.saat - x.saat).slice(0, 3);
  if (topw.length) out.push(`En çok bekleyen: ${topw.map((b) => `${b.ad} ${dur(b.saat * HOUR)}`).join(" · ")}`);
  if (added.length) out.push(`Sonradan eklenen: ${added.map((x: any) => `"${x.ad}" (${x.neden})`).join(", ")}`);
  if (skipped.length) out.push(`Atlanan: ${skipped.join(", ")}`);
  if (ertelenen.length) out.push(`Ertelenen açık işler: ${ertelenen.map((x: string) => `"${x}"`).join(", ")}. Kaybolmaz: ${akis.baglam?.musteri ? `${akis.baglam.musteri} için açılacak sonraki işlerin taslağına önerilir` : "devir_akislar listesinde görünür"}.`);
  if (isabet != null) out.push(`İlk taslak isabeti: %${Math.round(isabet * 100)} (ilk plandaki adımların ne kadarı sonuna kadar geçerli kaldı).`);
  if (bellekNotlari.length) { out.push("", "Devir bu işten öğrendikleri:"); for (const x of bellekNotlari.slice(0, 6)) out.push(`- ${x}`); }
  out.push("Deneyim ekibin belleğine yazıldı; benzer bir sonraki işte (iş türü farklı olsa da) hatırlanır. Başka ekipler görmez.");
  return out.join("\n");
}

// iptal ya da mükerrer kapanış (P1-B): akış arşive gider, deneyim yazılmaz; uygulanan dersler bu işte uymadı sayılır
async function vazgec(ctx: Ctx, a: any, akis: any, neden: string, acik: number) {
  if (acik) needOwner(ctx, "Bitmemiş adımı olan akışı iptal etmeyi");
  const at = new Date(ctx.now).toISOString(), act = actor(ctx, a), ad = neden === "iptal" ? "iptal edildi" : "mükerrer diye kapandı";
  await ctx.db.update("akis", { id: akis.id }, { durum: "arsiv", kapandi_at: at, baglam: { ...(akis.baglam || {}), kapanis_nedeni: neden } });
  await log(ctx, akis.id, null, act, "akis_kapandi", `Akış ${ad}${a.degerlendirme ? `: ${a.degerlendirme}` : ""}`, { neden, degerlendirme: a.degerlendirme || null });
  const cocuklar = altGruplar(akis).flatMap((g) => g.kalemler);
  if (cocuklar.length) for (const f of await ctx.db.many("akis", { id: cocuklar.map((k) => k.akis_id), durum: "aktif" }, "created_at")) {
    await ctx.db.update("akis", { id: f.id }, { durum: "arsiv", kapandi_at: at, baglam: { ...(f.baglam || {}), kapanis_nedeni: neden } });
    await log(ctx, f.id, null, act, "akis_kapandi", `Üst akış ${akis.kisa_kod} ile birlikte ${ad}`, { neden });
  }
  const notlar = akis.baglam?.ust_akis ? [] : await dersUymadi(ctx, Array.isArray(akis.baglam?.dersler) ? akis.baglam.dersler : []);
  const out = [`■ ${akis.kisa_kod} · ${akis.baslik} ${ad}; arşive taşındı.`, "Deneyim yazılmadı: bu akış benzer işlerde örnek alınmaz."];
  if (notlar.length) { out.push("", "Bu akışa uygulanan dersler:"); for (const x of notlar.slice(0, 6)) out.push(`- ${x}`); }
  return out.join("\n");
}

// ---------- A2 tekrarlı alt akış ----------
// Üst akışta seçilen adımlar kalem başına bir alt akışta yürür; üstteki adım özet adımdır (durumu alt akışlardan gelir).
type AltGrup = { id: string; adimlar: number[]; kalem_turu: string | null; kalemler: { ad: string; akis_id: string; kod: string }[] };
export const altGruplar = (akis: any): AltGrup[] => (Array.isArray(akis?.baglam?.alt_gruplar) ? akis.baglam.alt_gruplar : []);
export const altAdimi = (akis: any, no: number) => altGruplar(akis).find((g) => g.adimlar.includes(no)) || null;

// alt akışta: üst akışta henüz bitmemiş ön koşullar (alt adım no → üst adım no listesi)
async function ustBekleyen(ctx: Ctx, akis: any): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  const ub: Record<string, number[]> = akis?.baglam?.ust_bekler || {};
  if (!akis?.baglam?.ust_akis || !Object.keys(ub).length) return out;
  const ust = await ctx.db.many("adim", { akis_id: akis.baglam.ust_akis }, "no");
  const acik = new Set(ust.filter((x: any) => !DONE(x)).map((x: any) => x.no));
  for (const [k, v] of Object.entries(ub)) { const a = (v || []).filter((n) => acik.has(n)); if (a.length) out.set(Number(k), a); }
  return out;
}

async function altAkis(a: any, ctx: Ctx) {
  needTeam(ctx, "Tekrarlı alt akış kurmayı");
  const akis = await getAkis(ctx, a.akis);
  if (akis.baglam?.ust_akis) throw new Error(`Bu zaten bir alt akış; tekrarı üst akış ${akis.baglam.ust_kod} üzerinde kur.`);
  if (akis.durum !== "aktif") throw new Error(`Akış ${akis.durum}; değiştirilemez.`);
  const { steps } = await loadFlow(ctx, akis);
  const kalemler: string[] = [];
  for (const x of Array.isArray(a.kalemler) ? a.kalemler : []) { const t = String(x ?? "").trim(); if (t && !kalemler.some((k) => norm(k) === norm(t))) kalemler.push(t); }
  if (!kalemler.length) throw new Error("kalemler gerekli: her biri için ayrı yürüyecek kişi ya da şeylerin adları (ör. çiftçi adları).");
  if (kalemler.length > 50) throw new Error("Tek seferde en fazla 50 kalem eklenebilir.");
  const gruplar = altGruplar(akis).map((g) => ({ ...g, kalemler: [...g.kalemler] }));
  let grup: AltGrup | undefined;
  if (a.grup) { grup = gruplar.find((g) => g.id === String(a.grup).toUpperCase()); if (!grup) throw new Error(`'${a.grup}' tekrar grubu yok. Gruplar: ${gruplar.map((g) => g.id).join(", ") || "yok"}.`); }
  else if (!(Array.isArray(a.adimlar) && a.adimlar.length)) {
    if (gruplar.length === 1) grup = gruplar[0];
    else throw new Error(gruplar.length ? `Akışta birden çok tekrar grubu var (${gruplar.map((g) => g.id).join(", ")}); grup ver.` : "adimlar gerekli: her kalem için tekrarlanacak adım numaraları (ör. [3,4,5]).");
  } else {
    const nolar = [...new Set(a.adimlar.map(Number))].sort((x: any, y: any) => x - y) as number[];
    for (const n of nolar) {
      const st = steps.find((x: any) => x.no === n);
      if (!st) throw bulunamadi(`Bu akışta ${n} numaralı adım yok.`);
      if (DONE(st) || st.durum === "suruyor" || st.durum === "engelli") throw new Error(`Adım ${n} (${st.ad}) başlamış ya da bitmiş; tekrarlanacak adımlar henüz başlamamış olmalı.`);
      if (altAdimi(akis, n)) throw new Error(`Adım ${n} zaten bir tekrar grubunda.`);
    }
    grup = { id: `G${gruplar.length + 1}`, adimlar: nolar, kalem_turu: a.kalem_turu ? String(a.kalem_turu).trim() : null, kalemler: [] };
    gruplar.push(grup);
  }
  const g = grup!;
  const yeni = kalemler.filter((k) => !g.kalemler.some((x) => norm(x.ad) === norm(k)));
  if (!yeni.length) throw new Error("Bu kalemlerin hepsi zaten var.");
  const secili = g.adimlar.map((n) => steps.find((x: any) => x.no === n)).filter(Boolean);
  const yeniNo = new Map<number, number>(g.adimlar.map((n, i) => [n, i + 1]));
  const kalemSahibi = new Set<number>((a.kalem_sahibi_adimlar || []).map(Number));
  const tur = g.kalem_turu ? norm(g.kalem_turu) : null;
  const act = actor(ctx, a);
  const kurulan: string[] = [];
  for (const kalem of yeni) {
    const sub = (t: unknown) => String(t ?? "").replace(/\{kalem\}/g, kalem);
    const ustBekler: Record<string, number[]> = {};
    for (const st of secili) { const d = st.bagimli.filter((n: number) => !yeniNo.has(n)); if (d.length) ustBekler[String(yeniNo.get(st.no))] = d; }
    let cocuk: any = null;
    for (let i = 0; i < 6 && !cocuk; i++) {
      try {
        [cocuk] = await ctx.db.insert("akis", [{ kisa_kod: shortCode(), sahip_id: ctx.ws.id, baslik: `${akis.baslik} · ${kalem}`, amac: akis.amac || null, sablon_kod: akis.sablon_kod || null, hedef_tarih: akis.hedef_tarih || null, kurallar: akis.kurallar || {}, baglam: { musteri: akis.baglam?.musteri || null, iliski: akis.baglam?.iliski || null, ust_akis: akis.id, ust_kod: akis.kisa_kod, grup: g.id, kalem, ust_harita: Object.fromEntries(g.adimlar.map((n) => [String(yeniNo.get(n)), n])), ust_bekler: ustBekler }, ilk_taslak: secili.map((st: any) => st.tur_kod || slug(st.ad)) }]);
      } catch (e) { if (!/duplicate|unique|23505/i.test(String((e as Error).message))) throw e; }
    }
    if (!cocuk) throw new Error("Alt akış kodu üretilemedi, tekrar dene.");
    const rows = secili.map((st: any) => {
      const kendi = kalemSahibi.has(st.no) || (!!tur && st.sahip_tip === "dis" && norm(st.sahip).includes(tur));
      return { akis_id: cocuk.id, no: yeniNo.get(st.no), ad: sub(st.ad), aciklama: st.aciklama ? sub(st.aciklama) : null, sahip: kendi ? kalem : sub(st.sahip), sahip_tip: st.sahip_tip, arac: st.arac, kriter: sub(st.kriter), beklenen_cikti: st.beklenen_cikti, karar_kriteri: st.karar_kriteri, son_tarih: st.son_tarih, sure_tahmin_gun: st.sure_tahmin_gun, bagimli: st.bagimli.filter((n: number) => yeniNo.has(n)).map((n: number) => yeniNo.get(n)), kaynak: "plan", tur_kod: st.tur_kod, kosul: st.kosul || null, tarih_sabit: !!st.tarih_sabit, capa_tarih: st.capa_tarih || null };
    });
    const ins = (await ctx.db.insert("adim", await sahipBagla(ctx, rows))).map(fixStep);
    await log(ctx, cocuk.id, null, act, "akis_olustu", `Alt akış kuruldu: ${akis.kisa_kod} akışının "${kalem}" için tekrarı, ${rows.length} adım`, { ust_akis: akis.kisa_kod, grup: g.id, kalem });
    await recalc(ctx, cocuk, ins);
    g.kalemler.push({ ad: kalem, akis_id: cocuk.id, kod: cocuk.kisa_kod });
    kurulan.push(`${kalem}: ${cocuk.kisa_kod}`);
  }
  const baglam = { ...(akis.baglam || {}), alt_gruplar: gruplar };
  await ctx.db.update("akis", { id: akis.id }, { baglam });
  for (const st of secili) if (/\{kalem\}/.test(st.ad + st.kriter)) { const ad = st.ad.replace(/\{kalem\}/g, `her ${g.kalem_turu || "kalem"}`), kriter = st.kriter.replace(/\{kalem\}/g, `her ${g.kalem_turu || "kalem"}`); await ctx.db.update("adim", { id: st.id }, { ad, kriter }); st.ad = ad; st.kriter = kriter; }
  akis.baglam = baglam;
  await log(ctx, akis.id, g.adimlar[0], act, "guncelleme", `Tekrar: ${g.adimlar.join(", ")}. adımlar ${g.kalemler.length} ${g.kalem_turu || "kalem"} için ayrı yürüyor (eklenen: ${yeni.join(", ")})`, { tur: "alt_akis", grup: g.id, eklenen: yeni });
  await altSenkron(ctx, akis);
  const out = [`✓ ${g.id} · ${secili.map((st: any) => `${st.no}. ${st.ad}`).join(", ")} artık her ${g.kalem_turu || "kalem"} için ayrı yürüyor (${g.kalemler.length} ${g.kalem_turu || "kalem"}).`, `Yeni alt akışlar: ${kurulan.join(" · ")}`];
  if (Object.keys(secili.reduce((m: any, st: any) => { for (const d of st.bagimli) if (!yeniNo.has(d)) m[d] = 1; return m; }, {})).length) out.push("Alt akışlar, üst akıştaki ön koşullar bitince açılır.");
  out.push(`Üst akışta bu adımlar özet olarak görünür (ör. "2/${g.kalemler.length} ${g.kalem_turu || "kalem"} tamam"); hepsi bitince sonraki adımlar açılır.`, "Bir kalemin adımını ilerletmek için o kalemin alt akış koduyla devir_adim_guncelle çağır. Yeni kalem eklemek için devir_alt_akis'ı aynı akış ve yeni kalemlerle tekrar çağır.");
  return out.join("\n");
}

// üst akıştaki özet adımların durumunu alt akışlardan hesaplar, sonra üst akışı ve alt akışların kapısını yeniden hesaplar
async function altSenkron(ctx: Ctx, ust: any): Promise<any[]> {
  const gruplar = altGruplar(ust);
  if (!gruplar.length) return [];
  const steps = (await ctx.db.many("adim", { akis_id: ust.id }, "no")).map(fixStep);
  const ids = gruplar.flatMap((g) => g.kalemler.map((k) => k.akis_id));
  const flows = ids.length ? await ctx.db.many("akis", { id: ids }, "created_at") : [];
  const canli = new Map(flows.filter((f: any) => f.durum !== "arsiv").map((f: any) => [f.id, f]));
  const cs = ids.length ? (await ctx.db.many("adim", { akis_id: [...canli.keys()] }, "no")).map(fixStep) : [];
  for (const g of gruplar) for (const n of g.adimlar) {
    const s = steps.find((x: any) => x.no === n);
    if (!s) continue;
    const karsi = cs.filter((c: any) => { const f: any = canli.get(c.akis_id); return f && f.baglam?.grup === g.id && Number(f.baglam?.ust_harita?.[String(c.no)]) === n; });
    if (!karsi.length) continue;
    const tamam = karsi.filter((x: any) => x.durum === "tamam").length, bitti = karsi.filter(DONE).length, engelli = karsi.filter((x: any) => x.durum === "engelli").length;
    const ilerleme = `${tamam}/${karsi.length} ${g.kalem_turu || "kalem"} tamam${engelli ? ` · ${engelli} engelli` : ""}`;
    let to: string | null = null;
    if (bitti === karsi.length) to = tamam ? "tamam" : "atlandi";
    else if (karsi.some((x: any) => x.durum === "suruyor" || x.durum === "engelli" || DONE(x))) to = "suruyor";
    else if (DONE(s) || s.durum === "suruyor") to = "hazir"; // yeni kalem eklendi, henüz kimse başlamadı
    if (to && to !== s.durum) await setDurum(ctx, ust, s, to, SYS, to === "tamam" ? `Adım ${n} tamamlandı: ${ilerleme}` : to === "atlandi" ? `Adım ${n} atlandı: tüm ${g.kalem_turu || "kalem"}lerde atlandı` : to === "suruyor" ? `Adım ${n} sürüyor: ${ilerleme}` : `Adım ${n} yeniden açıldı: yeni ${g.kalem_turu || "kalem"} eklendi`, { ilerleme, engel: null });
    else if (ilerleme !== s.ilerleme) { await ctx.db.update("adim", { id: s.id }, { ilerleme }); s.ilerleme = ilerleme; }
  }
  const ready = await recalc(ctx, ust, steps);
  // üstte ön koşul bittiyse alt akışlar açılır
  for (const f of canli.values()) {
    if (f.durum !== "aktif" || !Object.keys(f.baglam?.ust_bekler || {}).length) continue;
    await recalc(ctx, f, cs.filter((c: any) => c.akis_id === f.id));
  }
  return ready;
}

// bir güncellemeden sonra üst ya da alt akışları senkronlar; sırası gelenleri döndürür
async function altZincir(ctx: Ctx, akis: any): Promise<string[]> {
  try {
    if (akis.baglam?.ust_akis) {
      const ust = await ctx.db.one("akis", { id: akis.baglam.ust_akis });
      if (!ust || ust.durum !== "aktif") return [];
      const ready = await altSenkron(ctx, ust);
      return ready.length && !isDis(ctx) ? ["", `Üst akış ${ust.kisa_kod}'da sıra geçti:`, ...ready.map((r: any) => `- ${r.no}. ${r.ad} → ${r.sahip}`)] : [];
    }
    if (altGruplar(akis).length) await altSenkron(ctx, akis);
  } catch (e) { console.warn("alt akış senkronu:", (e as Error).message); }
  return [];
}

// üst akış detayında tekrar gruplarının özeti
async function altOzet(ctx: Ctx, akis: any, steps: any[]) {
  const out: string[] = [];
  for (const g of altGruplar(akis)) {
    if (!g.kalemler.length) continue;
    const flows = await ctx.db.many("akis", { id: g.kalemler.map((k) => k.akis_id) }, "created_at");
    const cs = (await ctx.db.many("adim", { akis_id: g.kalemler.map((k) => k.akis_id) }, "no")).map(fixStep);
    const tur = g.kalem_turu || "kalem";
    out.push("", `Tekrarlı adımlar ${g.id} (${g.adimlar.join(", ")}) · ${g.kalemler.length} ${tur}:`);
    const asama = new Map<string, number>();
    for (const k of g.kalemler) {
      const f: any = flows.find((x: any) => x.id === k.akis_id);
      const ks = cs.filter((c: any) => c.akis_id === k.akis_id);
      const acik = ks.find((c: any) => !DONE(c));
      if (f?.durum === "arsiv") { out.push(`- ${k.ad} (${k.kod}): arşivlendi`); continue; }
      if (!acik) { out.push(`- ${k.ad} (${k.kod}): ✓ bitti`); asama.set("bitti", (asama.get("bitti") || 0) + 1); continue; }
      const ustAd = steps.find((x: any) => x.no === Number(f?.baglam?.ust_harita?.[String(acik.no)]))?.ad || acik.ad;
      asama.set(ustAd, (asama.get(ustAd) || 0) + 1);
      out.push(`- ${k.ad} (${k.kod}): ${ICON[acik.durum]} ${acik.ad} · ${LBL[acik.durum]}${acik.engel ? ` (${acik.engel})` : ""}`);
    }
    const parca = [...asama.entries()].map(([ad, n]) => ad === "bitti" ? `${n} bitti` : `${n} "${ad}" aşamasında`);
    if (parca.length) out.splice(out.length - g.kalemler.length, 0, `Özet (${g.kalemler.length} ${tur}): ${parca.join(", ")}.`);
  }
  return out;
}

// ---------- 1.5.7 standart süreç ----------
async function sabitle(a: any, ctx: Ctx) {
  needOwner(ctx, "Standart süreç sabitlemeyi");
  if (a.kaldir) {
    const kod = String(a.kaldir).replace(/^S:/i, "").trim();
    const st = await ctx.db.one("standart_surec", { ws_id: ctx.ws.id, kod });
    if (!st) throw new Error(`'${kod}' standart süreci yok.`);
    await ctx.db.update("standart_surec", { id: st.id }, { durum: "kaldirildi" });
    return `Standart süreç kaldırıldı: ${st.ad} [S:${st.kod}]. Benzer işler yeniden sıfırdan planlanacak.`;
  }
  const akis = await getAkis(ctx, a.akis);
  const { steps } = await loadFlow(ctx, akis);
  const tk = akis.taslak_id ? await ctx.db.one("taslak", { id: akis.taslak_id }) : null;
  const t = tk?.taslak || {};
  const byNo = new Map(steps.map((s: any) => [s.no, s]));
  const kosulOf = new Map<string, any>((t.adimlar || []).filter((x: any) => x.kosul?.soru).map((x: any) => [x.tur_kod, x.kosul]));
  // seçilmeyen dalın adımları da süreçte kalır (koşuluyla); gereksiz diye atlananlar çıkar
  const dahil = steps.filter((s: any) => s.durum !== "atlandi" || kosulOf.has(s.tur_kod));
  const adimlar = dahil.map((s: any) => ({
    kod: s.tur_kod || slug(s.ad), ad: s.ad, sahip: s.sahip, sahip_tip: s.sahip_tip, kriter: s.kriter, sure_tahmin_gun: s.sure_tahmin_gun,
    bagimli: (s.bagimli || []).map((n: number) => { const d: any = byNo.get(n); return d && dahil.includes(d) ? d.tur_kod || slug(d.ad) : null; }).filter(Boolean),
    kosul: kosulOf.get(s.tur_kod) || null,
  }));
  const sorular = [...(tk?.sorular?.secilen || []), ...(tk?.sorular?.varsayim || []), ...(tk?.sorular?.sonra || [])].map((q: any) => ({ kod: q.kod, soru: q.soru, tip: q.tip, secenekler: q.secenekler || null, varsayilan: q.varsayilan ?? null }));
  const ad = String(a.ad || tk?.is_turu_ad || akis.baslik).trim();
  const kod = slug(ad);
  const row = { ws_id: ctx.ws.id, kod, ad, aciklama: a.aciklama || `${akis.kisa_kod} akışından sabitlendi.`, akis_id: akis.id, adimlar, sorular, tetik: kokler(`${ad} ${akis.baslik} ${tk?.cumle || ""}`).slice(0, 10), gomme: null as any, durum: "aktif" };
  if (ctx.gom) { try { row.gomme = (await ctx.gom([standartMetni(row)]))[0] || null; } catch { /* getirmede tamamlanır */ } }
  const var0 = await ctx.db.one("standart_surec", { ws_id: ctx.ws.id, kod });
  if (var0) await ctx.db.update("standart_surec", { id: var0.id }, row);
  else await ctx.db.insert("standart_surec", [row]);
  return [`✓ Standart süreç ${var0 ? "güncellendi" : "sabitlendi"}: ${ad} [S:${kod}] · ${adimlar.length} adım, ${sorular.length} soru`, `Benzer bir sonraki işte taslak bu süreçten başlar; yalnızca sorular ve dallar uyarlanır. Kaldırmak için: devir_sabitle({ kaldir: "${kod}" })`].join("\n");
}

// ---------- dersler ----------
async function dersler(a: any, ctx: Ctx) {
  needTeam(ctx, "Dersleri yönetmeyi");
  const islem = a.islem || (a.ders ? "onayla" : "liste");
  if (islem === "onayla" || islem === "reddet") {
    needOwner(ctx, "Dersleri onaylamayı ya da reddetmeyi");
    const id = Number(String(a.ders || "").replace(/[^0-9]/g, ""));
    const x = id ? await ctx.db.one("ders", { id, ws_id: ctx.ws.id }) : null;
    if (!x) throw bulunamadi(`'${a.ders}' dersi bulunamadı. devir_dersler ile listele.`);
    const durum = islem === "onayla" ? "kesin" : "reddedildi";
    await ctx.db.update("ders", { id: x.id }, { durum, guven: islem === "onayla" ? Math.max(0.8, Number(x.guven) || 0) : 0, updated_at: new Date(ctx.now).toISOString() });
    return islem === "onayla" ? `✓ D${x.id} onaylandı; artık kanıtlı ve benzer işlerde uygulanacak: ${x.metin}` : `D${x.id} reddedildi; bir daha önerilmeyecek: ${x.metin}`;
  }
  let L = await ctx.db.many("ders", { ws_id: ctx.ws.id, durum: ["kesin", "aday", "zayif"] }, "updated_at", 200);
  if (a.ara) { const q = vnorm(a.ara); L = L.filter((x: any) => vnorm(dersMetni(x)).includes(q)); }
  if (!L.length) return "Henüz ders yok. Akışlar kapandıkça Devir sonradan eklenen adımlardan, yanlış çıkan varsayımlardan ve uzun beklemelerden ders çıkarır.";
  const sira: Record<string, number> = { kesin: 0, aday: 1, zayif: 2 };
  L.sort((x: any, y: any) => sira[x.durum] - sira[y.durum] || y.kanit_sayi - x.kanit_sayi);
  const out = [`Ekibin dersleri (${L.length}) · kesin olanlar benzer işlerde uygulanır, adaylar yalnızca kaynağına yakın işlerde önerilir`];
  for (const x of L) out.push(`- ${dersSatiri(x)}${x.durum === "zayif" ? " · zayıf (gereksiz çıktı, önerilmiyor)" : ""}${x.uygulandi || x.atlandi ? ` · uygulandı ${x.uygulandi || 0}, gereksiz çıktı ${x.atlandi || 0}` : ""}`);
  out.push("", "Bir aday dersi doğruysa devir_dersler({ islem: \"onayla\", ders: \"D…\" }), yanlışsa islem: \"reddet\".");
  return out.join("\n");
}
