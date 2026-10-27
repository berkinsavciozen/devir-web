// E-postayla giriş (Supabase Auth, sihirli bağlantı) ve davet. Oturum açan kişi bir ya da birkaç çalışma alanına
// "uye" olarak bağlanır; rol ve kapsam anahtar tablosundakiyle aynı anlamdadır, böylece bütün uçlar aynı kurallarla çalışır.
import { type DB, type Ctx, kimlikBagla, norm } from "./core.ts";

export type Oturum = { auth_id: string; eposta: string };
export type KimlikFn = (jwt: string) => Promise<{ id: string; email: string } | null>;
/** Yeni anahtarın ömrü (MK-1): 90 gün */
export const ANAHTAR_OMRU = 90 * 864e5;
export interface Posta { girisBaglantisi(eposta: string, yonlendir: string | null): Promise<void> }

export class HesapHata extends Error { constructor(public durum: number, m: string) { super(m); } }
const ROLLER = ["sahip", "ekip", "dis"];
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const epostaNorm = (e: unknown) => String(e || "").trim().toLowerCase();
const yerelAd = (e: string) => { const t = e.split("@")[0].replace(/[._-]+/g, " ").trim(); return t ? t[0].toLocaleUpperCase("tr") + t.slice(1) : e; };

async function sha256(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
function yeniToken(on: string, n = 18) { const b = new Uint8Array(n); crypto.getRandomValues(b); return on + Array.from(b).map((x) => "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 57]).join(""); }

const uyeV = (u: any, ws?: any) => ({ id: u.id, eposta: u.eposta, kisi: u.kisi, rol: u.rol, kapsam: u.kapsam || null, katildi: u.created_at, son_giris: u.son_giris || null, ...(ws ? { alan_id: ws.id, alan: ws.ad } : {}) });
const davetV = (d: any, ws?: any) => ({ id: d.id, eposta: d.eposta, kisi: d.kisi || null, rol: d.rol, kapsam: d.kapsam || null, davet_eden: d.davet_eden || null, tarih: d.created_at, ...(ws ? { alan_id: ws.id, alan: ws.ad } : {}) });

// Oturumdan bağlam: seçili çalışma alanı (x-devir-alan başlığı ya da ?alan=), yoksa ilk üyelik.
// kanal "mcp": OAuth ile bağlanmış istemci (Claude, ChatGPT) kişinin adına yazar; aktör agent olur.
export async function oturumCtx(db: DB, ot: Oturum, secim: string | null, now: number, ua: string, ek: Record<string, unknown> = {}, kanal: "oturum" | "mcp" = "oturum") {
  const uyelikler = await db.many("uye", { auth_id: ot.auth_id }, "created_at");
  let u = secim ? uyelikler.find((x: any) => x.kullanici_id === secim) : uyelikler[0];
  if (secim && !u) throw new HesapHata(403, "Bu çalışma alanına üye değilsin.");
  if (!u) return { ctx: null as Ctx | null, uyelikler };
  const ws = await db.one("kullanici", { id: u.kullanici_id });
  db.update("uye", { id: u.id }, { [kanal === "mcp" ? "mcp_son_kullanim" : "son_giris"]: new Date(now).toISOString() }).catch(() => {});
  const ctx: Ctx = await kimlikBagla({ db, ws, key: { id: null, uye_id: u.id, kisi: u.kisi, rol: u.rol, kapsam: u.rol === "dis" ? u.kapsam || u.kisi : u.kapsam, kisi_id: u.kisi_id || null }, ua: ua || "Devir web", now, ...ek, kanal } as Ctx, "uye", u.id);
  return { ctx, uyelikler };
}

// Açık kayıt: ayar.acik_kayit = evet ise davetsiz kişi kendi çalışma alanını açabilir (§9-19).
export async function acikKayit(db: DB): Promise<boolean> {
  const acik = String((await db.one("ayar", { anahtar: "acik_kayit" }).catch(() => null))?.deger ?? "").toLowerCase();
  return ["evet", "true", "1", "acik"].includes(acik);
}

async function bekleyenDavetler(db: DB, eposta: string) {
  return db.many("davet", { eposta, durum: "bekliyor" }, "created_at");
}

// Yalnızca oturumla (JWT) gelen istekler: ben, kayıt, kendine MCP anahtarı.
export async function oturumYonlendir(db: DB, ot: Oturum, ctx: Ctx | null, uyelikler: any[], method: string, yol: string[], body: any, taban: { fn: string; web?: string | null }, now: number) {
  const [r0, r1, r2] = yol;
  const b = body && typeof body === "object" ? body : {};
  if (method === "GET" && r0 === "ben" && !r1) {
    const alanlar = [];
    for (const u of uyelikler) alanlar.push(uyeV(u, await db.one("kullanici", { id: u.kullanici_id })));
    const davetler = [];
    for (const d of await bekleyenDavetler(db, ot.eposta)) if (!uyelikler.some((u: any) => u.kullanici_id === d.kullanici_id)) davetler.push(davetV(d, await db.one("kullanici", { id: d.kullanici_id })));
    return {
      eposta: ot.eposta, uyelikler: alanlar, bekleyen_davetler: davetler, acik_kayit: await acikKayit(db),
      ...(ctx ? { kisi: ctx.key.kisi, rol: ctx.key.rol, kapsam: ctx.key.kapsam || null, calisma_alani: { id: ctx.ws.id, ad: ctx.ws.ad }, mcp_son_kullanim: uyelikler.find((u: any) => u.id === ctx.key.uye_id)?.mcp_son_kullanim || null } : { kayit_gerekli: true, bekleme: await beklemeDurumu(db, ot.eposta) }),
    };
  }
  // P7 (0.28.0): kişinin Claude/ChatGPT bağlantıları; kaldırılan bağlantı yeniden bağlanana kadar çalışmaz
  if (r0 === "ben" && r1 === "agentlar" && method === "GET") {
    if (!ctx) throw new HesapHata(403, "Önce bir çalışma alanına katıl.");
    const L = await db.many("agent_baglanti", { uye_id: ctx.key.uye_id }, "ilk_kullanim").catch(() => []);
    return { agentlar: L.filter((x: any) => !x.kaldirildi_at).map(agentV), mcp_adresi: taban.fn };
  }
  if (r0 === "ben" && r1 === "agent" && r2 && method === "POST" && yol[3] === "kaldir") {
    if (!ctx) throw new HesapHata(403, "Önce bir çalışma alanına katıl.");
    const x = await db.one("agent_baglanti", { id: r2, uye_id: ctx.key.uye_id });
    if (!x) throw new HesapHata(404, "Bağlantı yok.");
    await db.update("agent_baglanti", { id: x.id }, { kaldirildi_at: new Date(now).toISOString() });
    return { kaldirildi: true, not: `${x.ad} bağlantısı kaldırıldı. Yeniden kullanmak için ${x.ad} içinde Devir bağlayıcısını yeniden bağla.` };
  }
  // P7 (0.28.0, karar 4.B): kişiye özel referans bağlantısı; gelen kişi onaya düşer
  if (r0 === "referans" && !r1 && method === "GET") {
    if (!ctx || ctx.key.rol === "dis") throw new HesapHata(403, "Referans bağlantısı yalnız ekip üyelerine açık.");
    const ref = await referansAl(db, ctx);
    const gelen = await db.many("bekleme", { referans_kod: ref.kod }, "created_at").catch(() => []);
    const link = `${taban.web || ""}/katil/${ref.kod}`;
    return { kod: ref.kod, link, gelen: gelen.length, onaylanan: gelen.filter((x: any) => x.durum === "onaylandi").length, mesaj: `Ekiple ve AI agent'larıyla aynı işi yürütmek için Devir'i kullanıyorum. Sen de denemek istersen: ${link}` };
  }
  if (method === "POST" && r0 === "kayit" && !r1) return kayit(db, ot, uyelikler, b, now);
  if (method === "POST" && r0 === "ben" && r1 === "anahtar" && !r2) {
    if (!ctx) throw new HesapHata(403, "Önce bir çalışma alanına katıl.");
    const token = yeniToken("dv_");
    // üyeye bağlı (N-4): üyelik biterse ya da rol değişirse anahtar da ona uyar
    const son = new Date(now + ANAHTAR_OMRU).toISOString();
    const [k] = await db.insert("anahtar", [{ kullanici_id: ctx.ws.id, kisi: ctx.key.kisi, rol: ctx.key.rol, kapsam: ctx.key.kapsam || null, token_hash: await sha256(token), onek: token.slice(0, 7), son_gecerlilik: son, uye_id: ctx.key.uye_id, ...(ctx.key.kisi_id ? { kisi_id: ctx.key.kisi_id } : {}) }]);
    // anahtar adrese gömülmez (S-B1): yalnız Authorization başlığında
    return { anahtar: { id: k.id, kisi: k.kisi, rol: k.rol, onek: k.onek, son_gecerlilik: son }, token, mcp_adresi: taban.fn, baslik: `Authorization: Bearer ${token}`, not: "Claude Code ve betikler için: adresi ve Authorization başlığını ekle. Anahtar yalnızca şimdi gösterilir, 90 gün geçerli." };
  }
  return undefined;
}

async function kayit(db: DB, ot: Oturum, uyelikler: any[], b: any, now: number) {
  const at = new Date(now).toISOString();
  const davetler = (await bekleyenDavetler(db, ot.eposta)).filter((d: any) => !uyelikler.some((u: any) => u.kullanici_id === d.kullanici_id));
  const kisiAd = String(b.kisi || "").trim().slice(0, 80);
  let d: any = null;
  if (b.davet) {
    d = davetler.find((x: any) => x.id === b.davet);
    if (!d) throw new HesapHata(404, "Bu davet bulunamadı ya da artık geçerli değil.");
  } else if (!b.alan_adi) {
    if (davetler.length === 1) d = davetler[0];
    else if (davetler.length > 1) throw new HesapHata(400, `${davetler.length} davetin var; davet alanında hangisine katılacağını seç (GET /api/v1/ben bekleyen_davetler).`);
  }
  if (d) {
    const kisi = d.kisi || kisiAd || yerelAd(ot.eposta);
    const [u] = await db.insert("uye", [{ auth_id: ot.auth_id, kullanici_id: d.kullanici_id, eposta: ot.eposta, kisi, rol: d.rol, kapsam: d.rol === "dis" ? d.kapsam || kisi : d.kapsam || null, son_giris: at }]);
    await db.update("davet", { id: d.id }, { durum: "kabul", kabul_at: at });
    const ws = await db.one("kullanici", { id: d.kullanici_id });
    return { katildi: uyeV(u, ws) };
  }
  // referans bağlantısıyla gelen (P7, karar 4.B): açık kayıt kapalıyken onay listesine düşer; onaylanınca kendi alanını açar
  const bk = await db.one("bekleme", { eposta: ot.eposta }).catch(() => null);
  const onayli = bk?.durum === "onaylandi";
  if (b.referans && !onayli && !(await acikKayit(db))) {
    const ref = await db.one("referans", { kod: String(b.referans).trim().toUpperCase() }).catch(() => null);
    if (!ref) throw new HesapHata(404, "Bu referans bağlantısı geçerli değil.");
    if (!bk) await db.insert("bekleme", [{ eposta: ot.eposta, auth_id: ot.auth_id, ad: kisiAd || yerelAd(ot.eposta), referans_kod: ref.kod, referans_ws: ref.ws_id, referans_uye_id: ref.uye_id, durum: "bekliyor" }]);
    return { bekleme: await beklemeDurumu(db, ot.eposta) };
  }
  const alanAdi = String(b.alan_adi || "").trim().slice(0, 120) || ((onayli || b.referans) && !uyelikler.length ? `${kisiAd || bk.ad || yerelAd(ot.eposta)} çalışma alanı` : "");
  if (!alanAdi) throw new HesapHata(400, uyelikler.length ? "Zaten bir çalışma alanına üyesin. Yeni bir alan açmak için alan_adi ver." : "Bekleyen davetin yok. Yeni bir çalışma alanı açmak için alan_adi ver ya da bir ekipten davet iste.");
  if (!onayli && !(await acikKayit(db))) throw new HesapHata(403, "Devir şimdilik davetle açılıyor. Bir çalışma alanı sahibinden davet iste.");
  const [ws] = await db.insert("kullanici", [{ ad: alanAdi }]);
  const [u] = await db.insert("uye", [{ auth_id: ot.auth_id, kullanici_id: ws.id, eposta: ot.eposta, kisi: kisiAd || bk?.ad || yerelAd(ot.eposta), rol: "sahip", kapsam: null, son_giris: at }]);
  if (onayli) await db.update("bekleme", { id: bk.id }, { durum: "katildi", katildi_at: at });
  return { acildi: uyeV(u, ws) };
}

// ---------- P7 (0.28.0): referans, onay listesi, agent bağlantıları ----------
const REF_HARF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
async function referansAl(db: DB, ctx: Ctx) {
  const var0 = await db.one("referans", { uye_id: ctx.key.uye_id });
  if (var0) return var0;
  for (let i = 0; i < 6; i++) {
    const b = crypto.getRandomValues(new Uint8Array(6));
    const kod = Array.from(b).map((x) => REF_HARF[x % REF_HARF.length]).join("");
    try { const [r] = await db.insert("referans", [{ kod, ws_id: ctx.ws.id, uye_id: ctx.key.uye_id }]); return r; }
    catch (e) { if (!/duplicate|unique|23505/i.test(String((e as Error).message))) throw e; }
  }
  throw new HesapHata(500, "Referans kodu üretilemedi, tekrar dene.");
}
async function beklemeDurumu(db: DB, eposta: string) {
  const bk = await db.one("bekleme", { eposta }).catch(() => null);
  return bk ? { durum: bk.durum, tarih: bk.created_at } : null;
}
/** Kimliksiz: referans sayfası kimin davet ettiğini gösterir (yalnız ad) */
export async function referansBilgisi(db: DB, kod: string) {
  const ref = await db.one("referans", { kod: String(kod || "").trim().toUpperCase() }).catch(() => null);
  if (!ref) throw new HesapHata(404, "Bu referans bağlantısı geçerli değil.");
  const u = await db.one("uye", { id: ref.uye_id });
  return { kod: ref.kod, davet_eden: u ? String(u.kisi || "").split(" ")[0] : null, acik_kayit: await acikKayit(db) };
}
const agentV = (x: any) => ({ id: x.id, ad: x.ad, istemci: x.istemci, ilk_kullanim: x.ilk_kullanim || x.created_at || null, son_kullanim: x.son_kullanim || null });
/** OAuth ile gelen MCP isteği: bağlantıyı kaydeder; kaldırılmışsa ve jeton kaldırmadan önce alındıysa reddeder. */
export async function agentBaglantisi(db: DB, ctx: Ctx, istemci: string | null, jetonZamani: number | null, ad: string, now: number): Promise<boolean> {
  if (!istemci || !ctx.key?.uye_id) return true;
  const at = new Date(now).toISOString();
  try {
    const x = await db.one("agent_baglanti", { uye_id: ctx.key.uye_id, istemci });
    if (!x) { await db.insert("agent_baglanti", [{ ws_id: ctx.ws.id, uye_id: ctx.key.uye_id, istemci, ad, ilk_kullanim: at, son_kullanim: at }]); return true; }
    if (x.kaldirildi_at) {
      if (jetonZamani == null || jetonZamani <= Date.parse(x.kaldirildi_at)) return false;
      await db.update("agent_baglanti", { id: x.id }, { kaldirildi_at: null, ilk_kullanim: at, son_kullanim: at, ad });
      return true;
    }
    db.update("agent_baglanti", { id: x.id }, { son_kullanim: at }).catch(() => {});
  } catch (e) { console.warn("agent_baglanti:", (e as Error).message); } // tablo yoksa (eski şema) bağlantı çalışmaya devam eder
  return true;
}
/** Onay listesi: referansla gelenler. Sahip kendi alanının referanslarını görür; ayar.yoneticiler'deki e-postalar hepsini. */
async function yoneticiMi(db: DB, ctx: Ctx) {
  const a = await db.one("ayar", { anahtar: "yoneticiler" }).catch(() => null);
  const L = String(a?.deger || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  const u = ctx.key.uye_id ? await db.one("uye", { id: ctx.key.uye_id }) : null;
  return !!u && L.includes(String(u.eposta || "").toLowerCase());
}
const beklemeV = (x: any, ad: string | null) => ({ id: x.id, eposta: x.eposta, ad: x.ad || null, durum: x.durum, tarih: x.created_at, referans_veren: ad, karar_at: x.karar_at || null });
export async function beklemeYonlendir(ctx: Ctx, method: string, yol: string[], taban: { web: string | null }, posta?: Posta) {
  const [r0, r1, r2] = yol;
  if (r0 !== "bekleme") return undefined;
  if (ctx.key.rol !== "sahip") throw new HesapHata(403, "Onay listesini yalnızca çalışma alanının sahibi görür.");
  if (method !== "GET" && ctx.kanal !== "oturum") throw new HesapHata(403, "Bunu yalnız e-postayla giriş yapmış kişi yapabilir; anahtarla ya da agent üzerinden yapılamaz.");
  const hepsi = await yoneticiMi(ctx.db, ctx);
  const L = (hepsi ? await ctx.db.many("bekleme", {}, "created_at") : await ctx.db.many("bekleme", { referans_ws: ctx.ws.id }, "created_at")) as any[];
  const adOf = async (x: any) => (x.referans_uye_id ? (await ctx.db.one("uye", { id: x.referans_uye_id }))?.kisi || null : null);
  if (method === "GET" && !r1) return { bekleme: await Promise.all(L.slice().reverse().map(async (x) => beklemeV(x, await adOf(x)))) };
  if (method === "POST" && r1 && (r2 === "onayla" || r2 === "reddet")) {
    const x = L.find((y) => y.id === r1);
    if (!x) throw new HesapHata(404, "Bu kayıt yok ya da senin onayında değil.");
    if (x.durum === "katildi") throw new HesapHata(409, "Bu kişi zaten katıldı.");
    const durum = r2 === "onayla" ? "onaylandi" : "reddedildi";
    await ctx.db.update("bekleme", { id: x.id }, { durum, karar_at: new Date(ctx.now).toISOString(), karar_veren: ctx.key.kisi });
    let gonderildi = false;
    if (durum === "onaylandi" && posta) { try { await posta.girisBaglantisi(x.eposta, taban.web ? `${taban.web}/giris` : null); gonderildi = true; } catch (e) { console.warn("onay e-postası:", (e as Error).message); } }
    return { bekleme: beklemeV({ ...x, durum }, await adOf(x)), gonderildi };
  }
  throw new HesapHata(404, "Böyle bir uç yok.");
}

// Ekip yönetimi (anahtarla ya da oturumla; yalnızca sahip): üyeler, davetler.
export async function ekipYonlendir(ctx: Ctx, method: string, yol: string[], body: any, taban: { link: string; web: string | null }, posta?: Posta) {
  const [r0, r1, r2] = yol;
  if (!["uyeler", "davet", "uye"].includes(r0)) return undefined;
  if (ctx.key.rol !== "sahip") throw new HesapHata(403, "Bunu yalnızca çalışma alanının sahibi yapabilir.");
  // üye ve davet değişikliği güven ayarıdır: yalnız e-postayla giriş yapmış sahip (S-C1); liste okunabilir
  if (method !== "GET" && ctx.kanal !== "oturum") throw new HesapHata(403, "Bunu yalnız e-postayla giriş yapmış kişi yapabilir; anahtarla ya da agent üzerinden yapılamaz.");
  const b = body && typeof body === "object" ? body : {};
  if (method === "GET" && r0 === "uyeler" && !r1) {
    const uyeler = await ctx.db.many("uye", { kullanici_id: ctx.ws.id }, "created_at");
    const davetler = await ctx.db.many("davet", { kullanici_id: ctx.ws.id, durum: "bekliyor" }, "created_at");
    return { uyeler: uyeler.map((u: any) => ({ ...uyeV(u), ben: u.id === ctx.key.uye_id })), davetler: davetler.map((d: any) => davetV(d)), posta: !!posta };
  }
  if (method !== "POST") throw new HesapHata(404, "Böyle bir uç yok.");
  if (r0 === "davet" && !r1) {
    const eposta = epostaNorm(b.eposta);
    if (!EPOSTA.test(eposta)) throw new HesapHata(400, "Geçerli bir e-posta adresi yaz.");
    const rol = ROLLER.includes(b.rol) ? b.rol : "ekip";
    const kisi = String(b.kisi || "").trim().slice(0, 80) || null;
    const kapsam = rol === "dis" ? String(b.kapsam || kisi || "").trim() : (b.kapsam ? String(b.kapsam).trim() : null);
    if (rol === "dis" && !kapsam) throw new HesapHata(400, "Dış katılımcı için kisi ya da kapsam gerekli: adımlarda sahip olarak yazılan ad.");
    if ((await ctx.db.many("uye", { kullanici_id: ctx.ws.id, eposta }, "created_at")).length) throw new HesapHata(400, "Bu kişi zaten çalışma alanında.");
    let d = await ctx.db.one("davet", { kullanici_id: ctx.ws.id, eposta, durum: "bekliyor" });
    if (d) { await ctx.db.update("davet", { id: d.id }, { kisi, rol, kapsam, davet_eden: ctx.key.kisi }); d = { ...d, kisi, rol, kapsam, davet_eden: ctx.key.kisi }; }
    else [d] = await ctx.db.insert("davet", [{ kullanici_id: ctx.ws.id, eposta, kisi, rol, kapsam, davet_eden: ctx.key.kisi || null, durum: "bekliyor" }]);
    let gonderildi = false, gonderim_hatasi: string | null = null;
    if (posta) {
      try { await posta.girisBaglantisi(eposta, taban.web ? `${taban.web}/giris` : null); gonderildi = true; }
      catch (e) { gonderim_hatasi = (e as Error).message; }
    }
    return { davet: davetV(d), gonderildi, ...(gonderim_hatasi ? { gonderim_hatasi } : {}), not: gonderildi ? `${eposta} adresine giriş bağlantısı gönderildi. Kişi giriş yapınca davet kendiliğinden görünür.` : "Davet kaydedildi; e-posta gönderilemedi. Kişi giriş sayfasından e-postasıyla girerse daveti görür." };
  }
  if (r0 === "davet" && r1 && r2 === "iptal") {
    const d = await ctx.db.one("davet", { id: r1, kullanici_id: ctx.ws.id });
    if (!d) throw new HesapHata(404, "Davet yok.");
    if (d.durum === "bekliyor") await ctx.db.update("davet", { id: d.id }, { durum: "iptal" });
    return { iptal: true };
  }
  if (r0 === "uye" && r1) {
    const u = await ctx.db.one("uye", { id: r1, kullanici_id: ctx.ws.id });
    if (!u) throw new HesapHata(404, "Üye yok.");
    const sahipler = (await ctx.db.many("uye", { kullanici_id: ctx.ws.id, rol: "sahip" }, "created_at")).length;
    if (!r2) {
      const patch: any = {};
      if (b.rol != null) { if (!ROLLER.includes(b.rol)) throw new HesapHata(400, "rol: sahip, ekip ya da dis olmalı."); patch.rol = b.rol; }
      if (b.kisi != null) patch.kisi = String(b.kisi).trim().slice(0, 80) || u.kisi;
      if (b.kapsam !== undefined) patch.kapsam = b.kapsam ? String(b.kapsam).trim() : null;
      if (u.rol === "sahip" && patch.rol && patch.rol !== "sahip" && sahipler <= 1) throw new HesapHata(400, "Çalışma alanında en az bir sahip kalmalı.");
      if ((patch.rol || u.rol) === "dis" && !(patch.kapsam ?? u.kapsam)) patch.kapsam = patch.kisi || u.kisi;
      await ctx.db.update("uye", { id: u.id }, patch);
      return { uye: uyeV({ ...u, ...patch }) };
    }
    if (r2 === "cikar") {
      if (u.rol === "sahip" && sahipler <= 1) throw new HesapHata(400, "Çalışma alanının tek sahibi çıkarılamaz.");
      if (!ctx.db.delete) throw new HesapHata(503, "Üye çıkarma bu sunucuda kapalı.");
      // üyeye bağlı anahtarlar iptal (N-4); bağlı olmayan eski anahtarlar ad eşiyle bulunur
      const anahtarlar = (await ctx.db.many("anahtar", { kullanici_id: ctx.ws.id }, "created_at")).filter((k: any) => !String(k.token_hash).startsWith("iptal:") && (k.uye_id === u.id || (!k.uye_id && norm(k.kisi) === norm(u.kisi))));
      for (const k of anahtarlar) await ctx.db.update("anahtar", { id: k.id }, { token_hash: "iptal:" + crypto.randomUUID() });
      await ctx.db.delete("uye", { id: u.id });
      return { cikarildi: true, iptal_edilen_anahtar: anahtarlar.length };
    }
  }
  throw new HesapHata(404, "Böyle bir uç yok.");
}

