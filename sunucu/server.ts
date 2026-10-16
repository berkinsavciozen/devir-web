import { callTool, INSTRUCTIONS, TOOLS, type DB } from "./core.ts";
import type { LlmFn } from "./llm.ts";
import type { GomFn } from "./bellek.ts";
import { apiYonlendir, baglantiV, baglantiEylem, baglantiDosya, ApiHata } from "./api.ts";
import { oturumCtx, oturumYonlendir, ekipYonlendir, acikKayit, type KimlikFn, type Posta } from "./hesap.ts";

export const SURUM = "0.11.0";
import type { Depo } from "./dosya.ts";

const PROTOS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey, x-devir-alan",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function tokenOf(req: Request, url: URL) {
  const seg = url.pathname.split("/").filter(Boolean);
  const i = seg.indexOf("devir-mcp");
  const fromPath = i >= 0 ? seg[i + 1] : seg[seg.length - 1];
  const auth = req.headers.get("authorization") || "";
  const bearer = /^Bearer\s+(dv_[\w-]+)$/i.exec(auth);
  return url.searchParams.get("k") || (fromPath && fromPath.startsWith("dv_") ? fromPath : null) || (bearer ? bearer[1] : null);
}

type Ek = { llm?: LlmFn; gom?: GomFn; modeller?: { taslak?: string; hizli?: string }; taban?: string; kimlik?: KimlikFn; posta?: Posta; depo?: Depo };

// JSON uçları: /api/v1/... (Devir anahtarıyla) ve /l/<bağlantı> (dış katılımcı, anahtarsız)
async function web(req: Request, url: URL, yol: string[], db: DB, now: number, ek: Ek): Promise<Response> {
  const ua = req.headers.get("user-agent") || "";
  const taban = { fn: ek.taban || `${url.origin}/functions/v1/devir-mcp`, link: "" };
  try {
    let body: any = null;
    if (req.method === "POST") { const t = await req.text(); if (t.trim()) { try { body = JSON.parse(t); } catch { throw new ApiHata(400, "Gövde JSON olmalı."); } } }
    if (yol[0] === "l") {
      if (yol[2] === "dosya") return json({ ok: true, ...(await baglantiDosya(db, yol[1] || "", now, ua, req.method, yol[3], body, ek.depo)) });
      if (yol[2]) throw new ApiHata(404, "Böyle bir uç yok.");
      if (req.method === "GET") return json({ ok: true, ...(await baglantiV(db, yol[1] || "", now, ua)) });
      if (req.method === "POST") return json({ ok: true, ...(await baglantiEylem(db, yol[1] || "", now, ua, body, ek.depo)) });
      throw new ApiHata(405, "Yöntem desteklenmiyor.");
    }
    if (yol[1] !== "v1") throw new ApiHata(404, "Uçlar /api/v1/ altında.");
    // kimliksiz: giriş ekranı kaydın açık olup olmadığını bilir (§9-19)
    if (yol[2] === "durum" && !yol[3] && req.method === "GET") return json({ ok: true, surum: SURUM, acik_kayit: await acikKayit(db) });
    const webAdres = (await db.one("ayar", { anahtar: "web_adresi" }).catch(() => null))?.deger;
    const web = webAdres ? String(webAdres).replace(/\/$/, "") : null;
    taban.link = web || taban.fn;
    const rota = yol.slice(2);
    const arka = { llm: ek.llm, gom: ek.gom, modeller: ek.modeller, depo: ek.depo };
    const token = tokenOf(req, url);
    const jwt = !token ? /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "")?.[1] : null;
    let ctx: any;
    if (jwt && ek.kimlik) {
      // e-postayla giriş: Supabase oturumu
      const u = await ek.kimlik(jwt).catch(() => null);
      if (!u || !u.email) throw new ApiHata(401, "Oturum geçersiz ya da süresi dolmuş. Yeniden giriş yap.");
      const ot = { auth_id: u.id, eposta: String(u.email).toLowerCase() };
      const o = await oturumCtx(db, ot, req.headers.get("x-devir-alan") || url.searchParams.get("alan"), now, ua, arka);
      const r = await oturumYonlendir(db, ot, o.ctx, o.uyelikler, req.method, rota, body, taban, now);
      if (r !== undefined) return json({ ok: true, ...r });
      if (!o.ctx) throw new ApiHata(403, "Henüz bir çalışma alanına üye değilsin. Davetin varsa POST /api/v1/kayit ile katıl.");
      ctx = o.ctx;
    } else {
      const key = token ? await db.one("anahtar", { token_hash: await sha256(token) }) : null;
      if (!key) throw new ApiHata(401, "Geçersiz ya da eksik Devir anahtarı. Authorization: Bearer dv_… başlığıyla gönder.");
      const ws = await db.one("kullanici", { id: key.kullanici_id });
      db.update("anahtar", { id: key.id }, { son_kullanim: new Date(now).toISOString() }).catch(() => {});
      ctx = { db, ws, key, ua: ua || "Devir web", now, ...arka };
    }
    const e = await ekipYonlendir(ctx, req.method, rota, body, { link: taban.link, web }, ek.posta);
    if (e !== undefined) return json({ ok: true, ...e });
    const data: any = await apiYonlendir(ctx, req.method, rota, url.searchParams, body, taban);
    return json({ ok: true, ...data });
  } catch (e) {
    const m = (e as Error).message || String(e);
    const st = typeof (e as any)?.durum === "number" ? (e as any).durum : /bulunamadı|numaralı adım yok|taslağı yok|Çıktı yok|Anahtar yok|Katılımcı yok/i.test(m) ? 404 : /kapsamında değil|atanmamış|yalnızca ekip/i.test(m) ? 403 : 400;
    if (typeof (e as any)?.durum !== "number") console.warn("api:", m);
    return json({ ok: false, hata: m }, st);
  }
}

export async function handle(req: Request, db: DB, now = Date.now(), ek: Ek = {}): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const seg = url.pathname.split("/").filter(Boolean);
  const yol = seg.indexOf("devir-mcp") >= 0 ? seg.slice(seg.indexOf("devir-mcp") + 1) : seg;
  if (yol[0] === "api" || yol[0] === "l") return web(req, url, yol, db, now, ek);
  if (req.method === "GET") {
    if ((req.headers.get("accept") || "").includes("text/event-stream")) return new Response(null, { status: 405, headers: CORS });
    return json({ ad: "Devir MCP", surum: SURUM, durum: "çalışıyor", kullanim: "MCP istemcisine bu adresi anahtarınla ekle. Arayüz uçları: /api/v1/ (Authorization: Bearer dv_… ya da e-postayla giriş oturumu), dış katılımcı: /l/<bağlantı>." });
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }

  const token = tokenOf(req, url);
  const key = token ? await db.one("anahtar", { token_hash: await sha256(token) }) : null;
  if (!key) return json({ jsonrpc: "2.0", id: Array.isArray(body) ? null : body?.id ?? null, error: { code: -32001, message: "Geçersiz ya da eksik Devir anahtarı. Bağlantı adresinin sonunda kişisel anahtarın olmalı." } }, 401);
  const ws = await db.one("kullanici", { id: key.kullanici_id });
  db.update("anahtar", { id: key.id }, { son_kullanim: new Date(now).toISOString() }).catch(() => {});
  const ua = req.headers.get("user-agent") || "";

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
      case "tools/list": ok({ tools: TOOLS }); break;
      case "resources/list": ok({ resources: [] }); break;
      case "prompts/list": ok({ prompts: [] }); break;
      case "tools/call": {
        const name = m.params?.name;
        try {
          const text = await callTool(name, m.params?.arguments || {}, { db, ws, key, ua, now, llm: ek.llm, gom: ek.gom, modeller: ek.modeller });
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
