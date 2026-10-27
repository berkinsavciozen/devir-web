// Ortak kaydın güvenilirliği (P1-B, S-C4 / M-M2): aynı istek ikinci kez yazmaz, hız sınırı ve günlük yapay zekâ bütçesi.
// Veri istek_kaydi ve kullanim_sayaci tablolarında; DB.rpc yoksa (bellek DB'si, sahte kip) aynı mantık one/insert/update ile.
import { DevirHata, todayIst, type Ctx, type DB } from "./core.ts";
import type { Kullanim, LlmFn } from "./llm.ts";

/** Doğal tekrar penceresi: aynı kimlik, araç ve argüman bu süre içinde gelirse ilk sonuç döner. */
export const TEKRAR_MS = 10 * 6e4;
/** islem_id / Idempotency-Key ile verilen anahtarın geçerliliği. */
export const ANAHTAR_MS = 24 * 36e5;
/** Takılı kalan "işleniyor" kaydı bu süreden sonra yeniden denenebilir. */
const ISLENIYOR_MS = 2 * 6e4;
/** Dakikalık sınırlar (kimlik başına) ve günlük yapay zekâ çağrısı (alan başına). Ayar tablosundan değiştirilebilir. */
export const SINIR = { mcp: 120, api: 60, llm: 200 };

/** İsteği yapan kimlik: anahtar, üyelik (oturum / OAuth) ya da kişi. */
export const kimlikOf = (ctx: Ctx) => (ctx.key?.id ? `a:${ctx.key.id}` : ctx.key?.uye_id ? `u:${ctx.key.uye_id}` : `k:${ctx.key?.kisi || "?"}`);

/** Anahtarları sıralı JSON (karma argüman sırasından bağımsız olsun). */
export function sirali(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(sirali).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as any).filter((k) => (v as any)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${sirali((v as any)[k])}`).join(",")}}`;
  return JSON.stringify(typeof v === "string" ? v.trim() : v ?? null);
}
export async function karma(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** MCP'de yazan araçlar (okuma araçları tekrar kaydına girmez). devir_dersler yalnız işlem verilince yazar. */
const YAZAN = new Set(["devir_tasla", "devir_akis_olustur", "devir_adim_guncelle", "devir_karar_ver", "devir_adim_ekle", "devir_akis_kapat", "devir_karar", "devir_cevapla", "devir_sabitle", "devir_alt_akis", "devir_dersler", "devir_baglanti", "devir_taslak_duzelt", "devir_alt_gorev"]);
export const yazanArac = (ad: string, a: any) => YAZAN.has(ad) && (ad !== "devir_dersler" || !!a?.islem);

export type Tekrar<T> = { sonuc: T; tekrar: boolean };

/**
 * İşi bir kez yapar. Aynı (kimlik, anahtar) daha önce aynı özetle bittiyse işi yapmadan ilk sonucu döner;
 * farklı özetle kullanıldıysa 409. Hata veren iş kayıt bırakmaz (yeniden denenebilir).
 * gecerlilik: kaydın bu süreden eskisi yok sayılır (doğal tekrarda 10 dk).
 */
export async function birKez<T>(ctx: Ctx, anahtar: string, ozet: string, gecerlilik: number, is: () => Promise<T>): Promise<Tekrar<T>> {
  const db = ctx.db, kimlik = kimlikOf(ctx), simdi = new Date(ctx.now).toISOString();
  const w = { ws_id: ctx.ws.id, kimlik, anahtar };
  let k = await db.one("istek_kaydi", w);
  const yas = (x: any) => ctx.now - Date.parse(x.updated_at || x.created_at);
  if (k && k.durum !== "hata" && yas(k) < gecerlilik) {
    if (k.ozet !== ozet) throw new DevirHata(409, "Bu işlem anahtarı başka bir istekte kullanıldı. Yeni işlem için yeni anahtar üret.");
    if (k.durum === "tamam") return { sonuc: k.sonuc?.v as T, tekrar: true };
    if (yas(k) < ISLENIYOR_MS) throw new DevirHata(409, "Aynı istek şu an işleniyor; birkaç saniye sonra sonucuna bak.");
  }
  if (k) await db.update("istek_kaydi", { id: k.id }, { ozet, durum: "isleniyor", sonuc: null, updated_at: simdi });
  else {
    try { [k] = await db.insert("istek_kaydi", [{ ...w, ozet, durum: "isleniyor", updated_at: simdi }]); }
    catch (e) { if (/duplicate|unique|23505/i.test(String((e as Error).message))) throw new DevirHata(409, "Aynı istek şu an işleniyor; birkaç saniye sonra sonucuna bak."); throw e; }
  }
  try {
    const sonuc = await is();
    await db.update("istek_kaydi", { id: k.id }, { durum: "tamam", sonuc: { v: sonuc }, updated_at: new Date(ctx.now).toISOString() }).catch((e) => console.warn("istek kaydı:", (e as Error).message));
    return { sonuc, tekrar: false };
  } catch (e) {
    await db.update("istek_kaydi", { id: k.id }, { durum: "hata", updated_at: new Date(ctx.now).toISOString() }).catch(() => {});
    throw e;
  }
}

/** Sabit pencereli sayaç; yeni değeri döner. */
async function say(db: DB, ws: string, kimlik: string, tur: string, pencere: string): Promise<number> {
  if (db.rpc) return Number(await db.rpc("sayac_artir", { p_ws: ws, p_kimlik: kimlik, p_tur: tur, p_pencere: pencere }));
  const w = { ws_id: ws, kimlik, tur, pencere };
  const k = await db.one("kullanim_sayaci", w);
  if (k) { await db.update("kullanim_sayaci", w, { sayi: k.sayi + 1 }); return k.sayi + 1; }
  await db.insert("kullanim_sayaci", [{ ...w, sayi: 1 }]);
  return 1;
}

const sinirlar = new WeakMap<object, Record<string, number>>();
/** ayar.kullanim_sinirlari = {"mcp":120,"api":60,"llm":200} varsa varsayılanın yerine geçer (istek başına bir kez okunur). */
async function sinirOf(ctx: Ctx, tur: keyof typeof SINIR) {
  let s = sinirlar.get(ctx);
  if (!s) {
    s = { ...SINIR };
    try { const a = await ctx.db.one("ayar", { anahtar: "kullanim_sinirlari" }); if (a?.deger) Object.assign(s, JSON.parse(a.deger)); } catch { /* varsayılan */ }
    sinirlar.set(ctx, s);
  }
  return Number(s[tur]) || SINIR[tur];
}

/** Dakikalık istek sınırı (kimlik başına). Aşılırsa 429. */
export async function hizSiniri(ctx: Ctx, tur: "mcp" | "api") {
  const sinir = await sinirOf(ctx, tur);
  const p = Math.floor(ctx.now / 6e4) * 6e4;
  const n = await say(ctx.db, ctx.ws.id, kimlikOf(ctx), tur, new Date(p).toISOString());
  if (n > sinir) {
    const sn = Math.max(1, Math.ceil((p + 6e4 - ctx.now) / 1000));
    throw Object.assign(new DevirHata(429, `Çok sık istek: dakikada en çok ${sinir}. ${sn} sn sonra yeniden dene.`), { yeniden: sn });
  }
}

/** Günlük yapay zekâ bütçesi (alan başına, İstanbul günü). Her model çağrısı bir sayılır; aşılırsa 429 ve açık mesaj. */
export function llmButcesi(ctx: Ctx, llm: LlmFn | undefined): LlmFn | undefined {
  if (!llm) return llm;
  return (async (istek: any) => {
    const sinir = await sinirOf(ctx, "llm");
    const n = await say(ctx.db, ctx.ws.id, "*", "llm", `${todayIst(ctx.now)}T00:00:00+03:00`);
    if (n > sinir) throw new DevirHata(429, `Bugünkü yapay zekâ kullanım sınırı doldu (${sinir} çağrı). Taslak çıkarma ve ders yazımı yarın 00:00'da (TR) yeniden açılır; akışları güncellemeye ve elle akış kurmaya devam edebilirsin.`);
    await aylikSinir(ctx);
    const r = await llm(istek);
    if (r.kullanim) await kullanimYaz(ctx, istek.tool?.name === "taslak_yaz" ? "taslak" : "arka", r.model, r.kullanim);
    return r;
  }) as LlmFn;
}

// ---------- kişi başı aylık yapay zekâ kullanımı (0.28.0, P8; karar 5.A, 5.B) ----------
// Her model çağrısının maliyeti (USD) kişi başına ai_kullanim'a yazılır; sohbet ve taslak aynı sayaçtan düşer.
// Kullanıcıya yalnız oran gösterilir. Sınır ayar.ai_aylik_sinir_usd (varsayılan 5), fiyatlar ayar.ai_fiyatlar ile değişir.
/** USD / milyon token: girdi, önbellekten okunan girdi, çıktı */
export const FIYAT: Record<string, { g: number; o: number; c: number }> = {
  "claude-opus-5-5": { g: 4, o: 0.4, c: 20 },
  "claude-sonnet-5-5": { g: 2, o: 0.2, c: 10 },
  "claude-haiku-5-5": { g: 0.1, o: 0.01, c: 0.5 },
  "gpt-4.1-mini": { g: 0.4, o: 0.1, c: 1.6 },
  "gpt-4.1": { g: 2, o: 0.5, c: 8 },
  "gpt-4o": { g: 2.5, o: 1.25, c: 10 },
};
const FIYAT_BILINMEYEN = { g: 3, o: 0.3, c: 15 }; // bilinmeyen model: pahalı tarafta kal
export const AYLIK_SINIR_USD = 5;
const AY_DA = ["Ocak'ta", "Şubat'ta", "Mart'ta", "Nisan'da", "Mayıs'ta", "Haziran'da", "Temmuz'da", "Ağustos'ta", "Eylül'de", "Ekim'de", "Kasım'da", "Aralık'ta"];

/** Kullanımın sahibi: kişi (üyelik), yoksa anahtar */
export const kisiKimligi = (ctx: Ctx) => (ctx.key?.uye_id ? `u:${ctx.key.uye_id}` : ctx.key?.id ? `a:${ctx.key.id}` : `k:${ctx.key?.kisi || "?"}`);
/** İstanbul ayının ilk günü (YYYY-AA-01) ve bir sonraki ayın ilk günü */
export function ayOf(now: number) {
  const g = todayIst(now), y = Number(g.slice(0, 4)), m = Number(g.slice(5, 7));
  const sy = m === 12 ? y + 1 : y, sm = m === 12 ? 1 : m + 1;
  return { ay: `${g.slice(0, 7)}-01`, sonraki: `${sy}-${String(sm).padStart(2, "0")}-01`, sonrakiMetin: `1 ${AY_DA[sm - 1]}` };
}
async function ayarJson(ctx: Ctx, anahtar: string) {
  try { const a = await ctx.db.one("ayar", { anahtar }); return a?.deger ? JSON.parse(a.deger) : null; } catch { return null; }
}
export async function fiyatOf(ctx: Ctx, model: string) {
  const ek = (await ayarJson(ctx, "ai_fiyatlar")) || {};
  const tablo: Record<string, { g: number; o: number; c: number }> = { ...FIYAT, ...ek };
  const ad = String(model || "").replace(/\s*\(yedek;.*$/, "").replace(/^(openai|anthropic):/, "").trim();
  const k = Object.keys(tablo).filter((x) => ad.startsWith(x)).sort((p, q) => q.length - p.length)[0];
  return k ? tablo[k] : FIYAT_BILINMEYEN;
}
export const maliyet = (f: { g: number; o: number; c: number }, k: Kullanim) => (k.girdi * f.g + k.onbellek * f.o + k.cikti * f.c) / 1e6;
export async function aylikSinirUsd(ctx: Ctx) {
  try { const a = await ctx.db.one("ayar", { anahtar: "ai_aylik_sinir_usd" }); const n = Number(a?.deger); return n > 0 ? n : AYLIK_SINIR_USD; } catch { return AYLIK_SINIR_USD; }
}
export async function aylikHarcama(ctx: Ctx) {
  try {
    const L = await ctx.db.many("ai_kullanim", { kimlik: kisiKimligi(ctx), ay: ayOf(ctx.now).ay }, "id", 5000);
    return L.reduce((t: number, x: any) => t + Number(x.usd || 0), 0);
  } catch (e) { console.warn("ai_kullanim okunamadı:", (e as Error).message); return 0; }
}
export async function kullanimYaz(ctx: Ctx, tur: string, model: string, k: Kullanim) {
  const usd = maliyet(await fiyatOf(ctx, model), k);
  await ctx.db.insert("ai_kullanim", [{ ws_id: ctx.ws.id, kimlik: kisiKimligi(ctx), ay: ayOf(ctx.now).ay, tur, model: String(model || "").slice(0, 120), girdi_token: k.girdi + k.onbellek, cikti_token: k.cikti, usd: Math.round(usd * 1e6) / 1e6 }])
    .catch((e) => console.warn("ai_kullanim yazılamadı:", (e as Error).message));
  return usd;
}
/** Bu ayın kullanımı: oran (0–1), doldu mu, ne zaman yenilenir. Tutar gösterilmez. */
export async function aiKullanimi(ctx: Ctx) {
  const [h, s] = [await aylikHarcama(ctx), await aylikSinirUsd(ctx)];
  const a = ayOf(ctx.now);
  return { oran: Math.min(1, Math.round((h / s) * 1000) / 1000), doldu: h >= s, yenilenme: a.sonraki, yenilenme_metin: a.sonrakiMetin };
}
export async function aylikSinir(ctx: Ctx) {
  const k = await aiKullanimi(ctx);
  if (k.doldu) throw new DevirHata(429, `Bu ayki yapay zekâ kullanım sınırına ulaştın; ${k.yenilenme_metin} yenilenir. Akışları güncellemeye ve elle akış kurmaya devam edebilirsin.`);
}
