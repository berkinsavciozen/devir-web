import { callTool, INSTRUCTIONS, TOOLS, kimlikBagla, type DB, type Ctx } from "./core.ts";
import type { LlmFn } from "./llm.ts";
import type { GomFn } from "./bellek.ts";
import { apiYonlendir, baglantiV, baglantiEylem, baglantiDosya, ApiHata } from "./api.ts";
import { oturumCtx, oturumYonlendir, ekipYonlendir, acikKayit, type KimlikFn, type Posta } from "./hesap.ts";

export const SURUM = "0.22.0";
import type { Depo } from "./dosya.ts";
import { bekleyenleriSifrele, type Sifre } from "./baglanti.ts";
import { ANAHTAR_MS, TEKRAR_MS, birKez, hizSiniri, karma, llmButcesi, sirali, yazanArac } from "./islem.ts";

const PROTOS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey, x-devir-alan, x-devir-baglanti, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate, idempotent-replayed, retry-after",
};
const ISLEM_ID = { type: "string", description: "İsteğe bağlı işlem kimliği. Aynı çağrıyı yeniden denerken (zaman aşımı, bağlantı kopması) aynı değeri ver: Devir ikinci kez yazmaz, ilk sonucu döner." };
/** Yazan araçlara islem_id (P1-B); okuma araçları olduğu gibi. */
const ARACLAR = TOOLS.map((t: any) => (yazanArac(t.name, { islem: true }) ? { ...t, inputSchema: { ...t.inputSchema, properties: { ...(t.inputSchema.properties || {}), islem_id: ISLEM_ID } } } : t));
const json = (body: unknown, status = 200, ek: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...ek } });

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Devir anahtarı: önce Authorization başlığı. Adreste (yol ya da ?k=) anahtar yalnız ayar.mcp_yol_anahtari kapalı değilken geçer (S-B1, T4). */
function tokenOf(req: Request, url: URL, yolAcik: boolean) {
  const bearer = /^Bearer\s+(dv_[\w-]+)$/i.exec(req.headers.get("authorization") || "");
  if (bearer) return bearer[1];
  if (!yolAcik) return null;
  const seg = url.pathname.split("/").filter(Boolean);
  const i = seg.indexOf("devir-mcp");
  const fromPath = i >= 0 ? seg[i + 1] : seg[seg.length - 1];
  return url.searchParams.get("k") || (fromPath && fromPath.startsWith("dv_") ? fromPath : null);
}
/** Adreste anahtar taşıyan istek mi (kapalıyken veri dönmeden 401 alır) */
const adresteAnahtar = (url: URL) => url.searchParams.has("k") || url.pathname.split("/").some((p) => p.startsWith("dv_"));
async function yolAnahtariAcik(db: DB) {
  const d = String((await db.one("ayar", { anahtar: "mcp_yol_anahtari" }).catch(() => null))?.deger ?? "acik").toLowerCase();
  return !["kapali", "kapalı", "hayir", "false", "0"].includes(d);
}
/** dv_ dışındaki Bearer: Supabase oturum ya da OAuth erişim jetonu */
const jwtOf = (req: Request) => /^Bearer\s+(?!dv_)(\S+)$/i.exec(req.headers.get("authorization") || "")?.[1] || null;
/** Doğrulanmış jetonun OAuth istemcisi (client_id); web oturumunda yoktur. İmza kimlik() ile doğrulanır, burada yalnız okunur. */
export function jetonIstemcisi(jwt: string): string | null {
  try {
    const p = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const o = JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
    return typeof o.client_id === "string" && o.client_id ? o.client_id : null;
  } catch { return null; }
}

/** Anahtar ve çalışma alanı. Üyeye bağlı anahtarda rol, kapsam ve kişi üyelikten gelir; üyelik bittiyse anahtar geçmez (N-4). */
async function anahtarCoz(db: DB, token: string | null, now: number) {
  const k0 = token ? await db.one("anahtar", { token_hash: await sha256(token) }) : null;
  if (!k0) return null;
  if (k0.son_gecerlilik && Date.parse(k0.son_gecerlilik) <= now) return null; // süresi dolmuş anahtar
  let key = k0;
  if (k0.uye_id) {
    const u = await db.one("uye", { id: k0.uye_id });
    if (!u || u.kullanici_id !== k0.kullanici_id) return null;
    key = { ...k0, kisi: u.kisi, rol: u.rol, kapsam: u.rol === "dis" ? u.kapsam || u.kisi : u.kapsam, kisi_id: u.kisi_id || k0.kisi_id || null };
  }
  const ws = await db.one("kullanici", { id: key.kullanici_id });
  if (!ws) return null;
  db.update("anahtar", { id: key.id }, { son_kullanim: new Date(now).toISOString() }).catch(() => {});
  return { key, ws };
}

type Ek = { llm?: LlmFn; gom?: GomFn; modeller?: { taslak?: string; hizli?: string }; taban?: string; kimlik?: KimlikFn; posta?: Posta; depo?: Depo; yetki?: string; sifre?: Sifre | null };

/** Korunan kaynak belgesi (RFC 9728): MCP istemcisi yetkilendirme sunucusunu buradan bulur (MK-1). */
const kaynakBelgesi = (fn: string, ek: Ek) => ({ resource: fn, authorization_servers: ek.yetki ? [ek.yetki] : [], bearer_methods_supported: ["header"], resource_name: "Devir" });
const kaynakAdresi = (fn: string) => `${fn}/.well-known/oauth-protected-resource`;

// JSON uçları: /api/v1/... (Devir anahtarıyla) ve /l/<bağlantı> (dış katılımcı, anahtarsız)
async function web(req: Request, url: URL, yol: string[], db: DB, now: number, ek: Ek): Promise<Response> {
  const ua = req.headers.get("user-agent") || "";
  const taban = { fn: ek.taban || `${url.origin}/functions/v1/devir-mcp`, link: "" };
  try {
    let body: any = null;
    if (req.method === "POST") { const t = await req.text(); if (t.trim()) { try { body = JSON.parse(t); } catch { throw new ApiHata(400, "Gövde JSON olmalı."); } } }
    if (yol[0] === "l") {
      // belirteç başlıkta (N-3): adres yoluna, dolayısıyla Edge loglarına düşmez. /l/<belirteç> eski uygulama sürümleri için.
      const bas = req.headers.get("x-devir-baglanti");
      const [tok, ...kalan] = bas ? [bas, ...yol.slice(1)] : yol.slice(1);
      if (kalan[0] === "dosya") return json({ ok: true, ...(await baglantiDosya(db, tok || "", now, ua, req.method, kalan[1], body, ek.depo)) });
      if (kalan[0]) throw new ApiHata(404, "Böyle bir uç yok.");
      if (req.method === "GET") return json({ ok: true, ...(await baglantiV(db, tok || "", now, ua)) });
      if (req.method === "POST") return json({ ok: true, ...(await baglantiEylem(db, tok || "", now, ua, body, ek.depo)) });
      throw new ApiHata(405, "Yöntem desteklenmiyor.");
    }
    if (yol[1] !== "v1") throw new ApiHata(404, "Uçlar /api/v1/ altında.");
    // kimliksiz: giriş ekranı kaydın açık olup olmadığını bilir (§9-19)
    if (yol[2] === "durum" && !yol[3] && req.method === "GET") return json({ ok: true, surum: SURUM, acik_kayit: await acikKayit(db) });
    const webAdres = (await db.one("ayar", { anahtar: "web_adresi" }).catch(() => null))?.deger;
    const web = webAdres ? String(webAdres).replace(/\/$/, "") : null;
    taban.link = web || taban.fn;
    const rota = yol.slice(2);
    const arka = { llm: ek.llm, gom: ek.gom, modeller: ek.modeller, depo: ek.depo, sifre: ek.sifre };
    const token = tokenOf(req, url, await yolAnahtariAcik(db));
    const jwt = !token ? jwtOf(req) : null;
    let ctx: any;
    if (jwt && ek.kimlik) {
      // e-postayla giriş: Supabase oturumu
      const u = await ek.kimlik(jwt).catch(() => null);
      if (!u || !u.email) throw new ApiHata(401, "Oturum geçersiz ya da süresi dolmuş. Yeniden giriş yap.");
      // OAuth jetonu Claude/ChatGPT'nindir: web uçlarında insan oturumu sayılmaz (S-C1)
      if (jetonIstemcisi(jwt)) throw new ApiHata(403, "Bu jeton yalnız MCP bağlantısı için geçerli.");
      const ot = { auth_id: u.id, eposta: String(u.email).toLowerCase() };
      const o = await oturumCtx(db, ot, req.headers.get("x-devir-alan") || url.searchParams.get("alan"), now, ua, arka);
      const r = await oturumYonlendir(db, ot, o.ctx, o.uyelikler, req.method, rota, body, taban, now);
      if (r !== undefined) return json({ ok: true, ...r });
      if (!o.ctx) throw new ApiHata(403, "Henüz bir çalışma alanına üye değilsin. Davetin varsa POST /api/v1/kayit ile katıl.");
      ctx = o.ctx;
    } else {
      const a = await anahtarCoz(db, token, now);
      if (!a) throw new ApiHata(401, "Geçersiz, iptal edilmiş ya da üyeliği sona ermiş Devir anahtarı. Authorization: Bearer dv_… başlığıyla gönder.");
      ctx = await kimlikBagla({ db, ws: a.ws, key: a.key, ua: ua || "Devir web", now, kanal: "anahtar", ...arka } as Ctx, "anahtar", a.key.id);
    }
    ctx.llm = llmButcesi(ctx, ctx.llm);
    const yurut = async () => {
      const e = await ekipYonlendir(ctx, req.method, rota, body, { link: taban.link, web }, ek.posta);
      return (e !== undefined ? e : await apiYonlendir(ctx, req.method, rota, url.searchParams, body, taban)) as any;
    };
    if (req.method === "GET") return json({ ok: true, ...(await yurut()) });
    // yazan istek (P1-B): hız sınırı; Idempotency-Key varsa aynı istek ikinci kez yazmaz, ilk sonuç döner
    await hizSiniri(ctx, "api");
    const anahtar = (req.headers.get("idempotency-key") || "").trim();
    if (!anahtar) return json({ ok: true, ...(await yurut()) });
    if (anahtar.length > 200) throw new ApiHata(400, "Idempotency-Key en çok 200 karakter olmalı.");
    const r = await birKez(ctx, `api:${anahtar}`, await karma(`${req.method} ${rota.join("/")} ${sirali(body)}`), ANAHTAR_MS, yurut);
    return json({ ok: true, ...r.sonuc }, 200, r.tekrar ? { "Idempotent-Replayed": "true" } : {});
  } catch (e) {
    const m = (e as Error).message || String(e);
    const st = typeof (e as any)?.durum === "number" ? (e as any).durum : 400; // tipli hatalar (DevirHata, ApiHata, HesapHata, DosyaHata) durumunu taşır (N-9)
    if (typeof (e as any)?.durum !== "number") console.warn("api:", m);
    return json({ ok: false, hata: m }, st, (e as any)?.yeniden ? { "Retry-After": String((e as any).yeniden) } : {});
  }
}

// N-3: anahtar tanımlıysa düz kalan bağlantı belirteçleri sunucu örneği başına bir kez şifrelenir
let sifrelendi = false;
export async function handle(req: Request, db: DB, now = Date.now(), ek: Ek = {}): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (ek.sifre && !sifrelendi) { sifrelendi = true; await bekleyenleriSifrele(db, ek.sifre).catch((e) => { sifrelendi = false; console.warn("şifreleme:", (e as Error).message); }); }
  const url = new URL(req.url);
  const seg = url.pathname.split("/").filter(Boolean);
  const yol = seg.indexOf("devir-mcp") >= 0 ? seg.slice(seg.indexOf("devir-mcp") + 1) : seg;
  if (yol[0] === "api" || yol[0] === "l") return web(req, url, yol, db, now, ek);
  const fn = ek.taban || `${url.origin}/functions/v1/devir-mcp`;
  if (yol[0] === ".well-known" && yol[1] === "oauth-protected-resource" && req.method === "GET") return json(kaynakBelgesi(fn, ek));
  if (req.method === "GET") {
    if ((req.headers.get("accept") || "").includes("text/event-stream")) return new Response(null, { status: 405, headers: CORS });
    return json({ ad: "Devir MCP", surum: SURUM, durum: "çalışıyor", kullanim: "Bu adresi Claude ya da ChatGPT'de bağlayıcı olarak ekle; Devir'de e-postanla onaylarsın. Betik ve Claude Code: Authorization: Bearer dv_… başlığı. Arayüz uçları: /api/v1/, dış katılımcı: /l/<bağlantı>." });
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }

  const ua = req.headers.get("user-agent") || "";
  const rpcId = Array.isArray(body) ? null : body?.id ?? null;
  // Kimliksiz ya da geçersiz istek: 401 + korunan kaynak belgesinin adresi; istemci OAuth akışını buradan başlatır (MK-1)
  const yetkisiz = (mesaj: string, gecersiz: boolean) => new Response(JSON.stringify({ jsonrpc: "2.0", id: rpcId, error: { code: -32001, message: mesaj } }), {
    status: 401,
    headers: { ...CORS, "Content-Type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${kaynakAdresi(fn)}"${gecersiz ? ', error="invalid_token"' : ""}` },
  });
  const yolAcik = await yolAnahtariAcik(db);
  const token = tokenOf(req, url, yolAcik);
  const jwt = !token ? jwtOf(req) : null;
  let ctx0: Ctx;
  if (token) {
    const a = await anahtarCoz(db, token, now);
    if (!a) return yetkisiz("Geçersiz, süresi dolmuş, iptal edilmiş ya da üyeliği sona ermiş Devir anahtarı.", true);
    ctx0 = { db, ws: a.ws, key: a.key, ua, now, kanal: "mcp", llm: ek.llm, gom: ek.gom, modeller: ek.modeller, sifre: ek.sifre } as Ctx;
  } else if (jwt && ek.kimlik) {
    // OAuth: jeton Supabase Auth'tan; kişi üyelikten, yazan agent (kanal mcp)
    const u = await ek.kimlik(jwt).catch(() => null);
    if (!u) return yetkisiz("Oturum geçersiz ya da süresi dolmuş; bağlayıcıyı yeniden bağla.", true);
    const o = await oturumCtx(db, { auth_id: u.id, eposta: String(u.email || "").toLowerCase() }, req.headers.get("x-devir-alan"), now, ua, { llm: ek.llm, gom: ek.gom, modeller: ek.modeller, sifre: ek.sifre }, "mcp");
    if (!o.ctx) return json({ jsonrpc: "2.0", id: rpcId, error: { code: -32003, message: "Bu e-postayla bir Devir çalışma alanına üye değilsin." } }, 403);
    ctx0 = o.ctx;
  } else {
    return yetkisiz(adresteAnahtar(url) ? "Adreste anahtar artık kabul edilmiyor. Bağlayıcıyı anahtarsız adresle yeniden ekle ya da Authorization: Bearer başlığı kullan." : "Kimlik gerekli. Bağlayıcıyı ekleyince Devir'de e-postanla onayla.", false);
  }
  const { key } = ctx0;

  const msgs = Array.isArray(body) ? body : [body];
  const out: any[] = [];
  for (const m of msgs) {
    if (!m || typeof m !== "object") { out.push({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }); continue; }
    if (m.id === undefined || m.id === null) continue; // bildirim
    const ok = (result: unknown) => out.push({ jsonrpc: "2.0", id: m.id, result });
    switch (m.method) {
      case "initialize": {
        const pv = m.params?.protocolVersion;
        ok({ protocolVersion: PROTOS.includes(pv) ? pv : PROTOS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "devir", title: "Devir", version: SURUM }, instructions: INSTRUCTIONS });
        break;
      }
      case "ping": ok({}); break;
      case "tools/list": ok({ tools: ARACLAR }); break;
      case "resources/list": ok({ resources: [] }); break;
      case "prompts/list": ok({ prompts: [] }); break;
      case "tools/call": {
        const name = m.params?.name;
        try {
          const ctx = key.id ? await kimlikBagla(ctx0, "anahtar", key.id) : ctx0;
          await hizSiniri(ctx, "mcp");
          ctx.llm = llmButcesi(ctx, ctx.llm);
          const args = m.params?.arguments || {};
          let text: string;
          if (yazanArac(name, args)) {
            // aynı işlem ikinci kez yazılmaz (P1-B): islem_id verildiyse 24 saat, verilmediyse aynı argümanla 10 dk
            const { islem_id, ...arg } = args;
            const oz = await karma(`${name} ${sirali(arg)}`);
            const r = islem_id
              ? await birKez(ctx, `mcp:${String(islem_id).slice(0, 200)}`, oz, ANAHTAR_MS, () => callTool(name, arg, ctx))
              : await birKez(ctx, `dogal:${oz}`, oz, TEKRAR_MS, () => callTool(name, arg, ctx));
            text = r.tekrar ? `(Bu işlem ${islem_id ? "bu islem_id ile" : "son 10 dakikada aynı argümanlarla"} zaten yapılmıştı; ikinci kez yazılmadı, önceki sonuç aşağıda.)\n\n${r.sonuc}` : r.sonuc;
          } else text = await callTool(name, args, ctx);
          ok({ content: [{ type: "text", text }] });
        } catch (e) {
          ok({ content: [{ type: "text", text: "Hata: " + ((e as Error).message || String(e)) }], isError: true });
        }
        break;
      }
      default: out.push({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } });
    }
  }
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return json(Array.isArray(body) ? out : out[0]);
}
