// E-postayla giriş (Supabase Auth, sihirli bağlantı) ve davet. Oturum açan kişi bir ya da birkaç çalışma alanına
// "uye" olarak bağlanır; rol ve kapsam anahtar tablosundakiyle aynı anlamdadır, böylece bütün uçlar aynı kurallarla çalışır.
import { type DB, type Ctx } from "./core.ts";

export type Oturum = { auth_id: string; eposta: string };
export type KimlikFn = (jwt: string) => Promise<{ id: string; email: string } | null>;
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
export async function oturumCtx(db: DB, ot: Oturum, secim: string | null, now: number, ua: string, ek: Record<string, unknown> = {}) {
  const uyelikler = await db.many("uye", { auth_id: ot.auth_id }, "created_at");
  let u = secim ? uyelikler.find((x: any) => x.kullanici_id === secim) : uyelikler[0];
  if (secim && !u) throw new HesapHata(403, "Bu çalışma alanına üye değilsin.");
  if (!u) return { ctx: null as Ctx | null, uyelikler };
  const ws = await db.one("kullanici", { id: u.kullanici_id });
  db.update("uye", { id: u.id }, { son_giris: new Date(now).toISOString() }).catch(() => {});
  const ctx: Ctx = { db, ws, key: { id: null, uye_id: u.id, kisi: u.kisi, rol: u.rol, kapsam: u.rol === "dis" ? u.kapsam || u.kisi : u.kapsam }, ua: ua || "Devir web", now, ...ek } as Ctx;
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
export async function oturumYonlendir(db: DB, ot: Oturum, ctx: Ctx | null, uyelikler: any[], method: string, yol: string[], body: any, taban: { fn: string }, now: number) {
  const [r0, r1, r2] = yol;
  const b = body && typeof body === "object" ? body : {};
  if (method === "GET" && r0 === "ben" && !r1) {
    const alanlar = [];
    for (const u of uyelikler) alanlar.push(uyeV(u, await db.one("kullanici", { id: u.kullanici_id })));
    const davetler = [];
    for (const d of await bekleyenDavetler(db, ot.eposta)) if (!uyelikler.some((u: any) => u.kullanici_id === d.kullanici_id)) davetler.push(davetV(d, await db.one("kullanici", { id: d.kullanici_id })));
    return {
      eposta: ot.eposta, uyelikler: alanlar, bekleyen_davetler: davetler, acik_kayit: await acikKayit(db),
      ...(ctx ? { kisi: ctx.key.kisi, rol: ctx.key.rol, kapsam: ctx.key.kapsam || null, calisma_alani: { id: ctx.ws.id, ad: ctx.ws.ad } } : { kayit_gerekli: true }),
    };
  }
  if (method === "POST" && r0 === "kayit" && !r1) return kayit(db, ot, uyelikler, b, now);
  if (method === "POST" && r0 === "ben" && r1 === "anahtar" && !r2) {
    if (!ctx) throw new HesapHata(403, "Önce bir çalışma alanına katıl.");
    const token = yeniToken("dv_");
    const [k] = await db.insert("anahtar", [{ kullanici_id: ctx.ws.id, kisi: ctx.key.kisi, rol: ctx.key.rol, kapsam: ctx.key.kapsam || null, token_hash: await sha256(token) }]);
    return { anahtar: { id: k.id, kisi: k.kisi, rol: k.rol }, token, mcp_adresi: `${taban.fn}/${token}`, not: "Bu adresi Claude ya da ChatGPT'de bağlayıcı olarak ekle. Anahtar yalnızca şimdi gösterilir." };
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
  const alanAdi = String(b.alan_adi || "").trim().slice(0, 120);
  if (!alanAdi) throw new HesapHata(400, uyelikler.length ? "Zaten bir çalışma alanına üyesin. Yeni bir alan açmak için alan_adi ver." : "Bekleyen davetin yok. Yeni bir çalışma alanı açmak için alan_adi ver ya da bir ekipten davet iste.");
  if (!(await acikKayit(db))) throw new HesapHata(403, "Devir şimdilik davetle açılıyor. Bir çalışma alanı sahibinden davet iste.");
  const [ws] = await db.insert("kullanici", [{ ad: alanAdi }]);
  const [u] = await db.insert("uye", [{ auth_id: ot.auth_id, kullanici_id: ws.id, eposta: ot.eposta, kisi: kisiAd || yerelAd(ot.eposta), rol: "sahip", kapsam: null, son_giris: at }]);
  return { acildi: uyeV(u, ws) };
}

// Ekip yönetimi (anahtarla ya da oturumla; yalnızca sahip): üyeler, davetler.
export async function ekipYonlendir(ctx: Ctx, method: string, yol: string[], body: any, taban: { link: string; web: string | null }, posta?: Posta) {
  const [r0, r1, r2] = yol;
  if (!["uyeler", "davet", "uye"].includes(r0)) return undefined;
  if (ctx.key.rol !== "sahip") throw new HesapHata(403, "Bunu yalnızca çalışma alanının sahibi yapabilir.");
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
      await ctx.db.delete("uye", { id: u.id });
      return { cikarildi: true, not: "Kişinin bu alanda ürettiği MCP anahtarları ayrıca iptal edilmeli (POST /api/v1/anahtar/:id/iptal)." };
    }
  }
  throw new HesapHata(404, "Böyle bir uç yok.");
}

