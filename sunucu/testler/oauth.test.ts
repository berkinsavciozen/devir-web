// P0-B testleri (audit S-B1, MK-1): adreste anahtar, başlık anahtarı, süre, 401 el sıkışması, korunan kaynak belgesi, OAuth jetonu.
import { handle, jetonIstemcisi } from "../server.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-21T09:00:00+03:00");
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "anahtar", "kullanici", "kisi", "uye"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(t === "adim" ? { durum: "sirada", ciktilar: [] } : t === "akis" ? { durum: "aktif", kurallar: {}, baglam: {} } : {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
  async delete(t: string, w: any) { T[t] = (T[t] || []).filter((r) => !match(r, w)); },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const YETKI = "https://x.supabase.co/auth/v1";
// Sahte jeton: imza kimlik() içinde "doğrulanır"; yük base64url
const jeton = (yuk: any) => `h.${Buffer.from(JSON.stringify(yuk)).toString("base64url")}.imza`;
const OAUTH = jeton({ sub: "auth-berkin", client_id: "claude-istemci" }), WEB = jeton({ sub: "auth-berkin" }), YABANCI = jeton({ sub: "auth-yok", client_id: "c" });
const kimlik = async (j: string) => j === OAUTH || j === WEB ? { id: "auth-berkin", email: "berkin@ornek.com" } : j === YABANCI ? { id: "auth-yok", email: "kimse@ornek.com" } : null;
const ek = { taban: B, yetki: YETKI, kimlik };

const rpc = (method: string, params: any = {}) => JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
async function istek(yol: string, init: { method?: string; auth?: string; body?: string } = {}) {
  NOW += 6e4;
  const r = await handle(new Request(B + yol, { method: init.method || "POST", headers: { "content-type": "application/json", ...(init.auth ? { authorization: "Bearer " + init.auth } : {}) }, body: init.body }), db, NOW, ek);
  const metin = await r.text();
  return { st: r.status, j: metin ? JSON.parse(metin) : null, www: r.headers.get("www-authenticate") || "" };
}
const arac = (name: string, args: any) => rpc("tools/call", { name, arguments: args });

(async () => {
  const [ws] = await db.insert("kullanici", [{ ad: "OAuth alanı" }]);
  const [uye] = await db.insert("uye", [{ kullanici_id: ws.id, auth_id: "auth-berkin", eposta: "berkin@ornek.com", kisi: "Berkin", rol: "sahip" }]);
  const [uyeS] = await db.insert("uye", [{ kullanici_id: ws.id, auth_id: "auth-selin", eposta: "selin@ornek.com", kisi: "Selin", rol: "ekip" }]);
  await db.insert("anahtar", [
    { kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_eski"), uye_id: uye.id },
    { kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_suresi"), son_gecerlilik: new Date(NOW - 1).toISOString() },
    { kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: "iptal:" + await sha("dv_iptal") },
    { kullanici_id: ws.id, kisi: "Selin", rol: "ekip", token_hash: await sha("dv_selin"), uye_id: uyeS.id },
  ]);

  // korunan_kaynak_belgesi
  let x = await istek("/.well-known/oauth-protected-resource", { method: "GET" });
  ok(x.st === 200 && x.j.resource === B && x.j.authorization_servers[0] === YETKI && x.j.bearer_methods_supported.join() === "header", "korunan_kaynak_belgesi: resource MCP adresiyle birebir, yetki sunucusu Supabase Auth");

  // kimliksiz istek: 401 + resource_metadata, veri yok
  x = await istek("", { body: rpc("tools/list") });
  ok(x.st === 401 && x.www.includes(`resource_metadata="${B}/.well-known/oauth-protected-resource"`) && !x.j.result, "kimliksiz MCP isteği 401 ve resource_metadata döner");

  // geçiş dönemi (T2): yol anahtarı hâlâ geçer
  x = await istek("/dv_eski", { body: rpc("tools/list") });
  ok(x.st === 200 && x.j.result.tools.length > 0, "bayrak açıkken adresteki anahtar geçer (T2)");

  // bearer_kabul_edilir
  x = await istek("", { auth: "dv_eski", body: rpc("tools/list") });
  ok(x.st === 200 && x.j.result.tools.length > 0, "bearer_kabul_edilir");

  // suresi_dolmus_anahtar_401, iptal_anahtar_401
  x = await istek("", { auth: "dv_suresi", body: rpc("tools/list") });
  ok(x.st === 401 && x.www.includes('error="invalid_token"'), "suresi_dolmus_anahtar_401");
  x = await istek("", { auth: "dv_iptal", body: rpc("tools/list") });
  ok(x.st === 401, "iptal_anahtar_401");
  x = await istek("/api/v1/ben", { method: "GET", auth: "dv_suresi" });
  ok(x.st === 401, "süresi dolmuş anahtar web uçlarında da 401");

  // uyeligi_silinmis_anahtar_401
  await db.delete("uye", { id: uyeS.id });
  x = await istek("", { auth: "dv_selin", body: rpc("tools/list") });
  ok(x.st === 401, "uyeligi_silinmis_anahtar_401");

  // oauth_jetonu_agent_olarak_yazar
  x = await istek("", { auth: OAUTH, body: arac("devir_akis_olustur", { baslik: "OAuth akışı", hedef_tarih: "2026-11-20", adimlar: [{ ad: "Teklifi hazırla", sahip: "Berkin", kriter: "teklif", sure_tahmin_gun: 1 }] }) });
  const kod = /oluşturuldu: (\w+)/.exec(x.j?.result?.content?.[0]?.text || "")?.[1];
  ok(x.st === 200 && !!kod, "OAuth jetonuyla MCP çağrısı çalışır");
  x = await istek("", { auth: OAUTH, body: arac("devir_adim_guncelle", { akis: kod, no: 1, durum: "suruyor" }) });
  const o = T.olay[T.olay.length - 1];
  ok(o.kim_tip === "agent" && o.kanal === "mcp" && !!o.kisi_id && /Berkin/.test(o.kim), "oauth_jetonu_agent_olarak_yazar: kim_tip agent, kanal mcp, kişi kimliği dolu");
  ok(!!T.uye.find((u) => u.id === uye.id).mcp_son_kullanim, "OAuth çağrısı üyenin son MCP kullanımını yazar");
  x = await istek("/api/v1/ben", { method: "GET", auth: WEB });
  ok(x.st === 200 && !!x.j.mcp_son_kullanim, "/ben bağlantı durumunu gösterir (Claude'a bağla ekranı bunu yoklar)");

  // OAuth jetonu web uçlarında insan oturumu sayılmaz
  x = await istek("/api/v1/akislar", { method: "GET", auth: OAUTH });
  ok(x.st === 403, "OAuth jetonu web uçlarında reddedilir (insan sayılmaz)");
  ok(jetonIstemcisi(OAUTH) === "claude-istemci" && jetonIstemcisi(WEB) === null && jetonIstemcisi("bozuk") === null, "jeton istemcisi okunur");

  // üyeliği olmayan OAuth kullanıcısı
  x = await istek("", { auth: YABANCI, body: rpc("tools/list") });
  ok(x.st === 403 && !x.j.result, "üyeliği olmayan OAuth kullanıcısı veri göremez");
  x = await istek("", { auth: jeton({ sub: "x" }), body: rpc("tools/list") });
  ok(x.st === 401 && x.www.includes('error="invalid_token"'), "doğrulanamayan jeton 401 invalid_token");

  // yeni anahtar: süreli, önekli, adreste değil
  x = await istek("/api/v1/anahtar", { auth: WEB, body: JSON.stringify({ kisi: "Betik", rol: "ekip" }) });
  const yeni = x.j.token;
  ok(x.st === 200 && x.j.mcp_adresi === B && x.j.baslik === `Authorization: Bearer ${yeni}`, "yeni anahtar adrese gömülmez, başlık talimatıyla döner");
  ok(Math.round((Date.parse(x.j.anahtar.son_gecerlilik) - NOW) / 864e5) === 90 && x.j.anahtar.onek === yeni.slice(0, 7), "yeni anahtar 90 gün geçerli ve önekli");
  x = await istek("/api/v1/anahtarlar", { method: "GET", auth: WEB });
  const sat = x.j.anahtarlar.find((k: any) => k.onek === yeni.slice(0, 7));
  ok(!!sat && !!sat.son_gecerlilik && !JSON.stringify(x.j).includes(yeni), "anahtar listesi önek ve süreyi gösterir, anahtarın kendisini göstermez");
  x = await istek("/api/v1/anahtarlar", { method: "GET", auth: WEB });
  ok(x.j.anahtarlar.some((k: any) => k.suresi_doldu), "süresi dolan anahtar listede işaretli");

  // yol_anahtari_reddedilir (T4): bayrak kapanınca adres ve sorgu anahtarı veri döndürmez
  await db.insert("ayar", [{ anahtar: "mcp_yol_anahtari", deger: "kapali" }]);
  x = await istek("/dv_eski", { body: rpc("tools/list") });
  ok(x.st === 401 && x.www.includes("resource_metadata=") && !x.j.result && /Adreste anahtar/.test(x.j.error.message), "yol_anahtari_reddedilir: /devir-mcp/dv_x → 401 + resource_metadata");
  x = await istek("?k=dv_eski", { body: rpc("tools/list") });
  ok(x.st === 401 && !x.j.result, "yol_anahtari_reddedilir: ?k=dv_x → 401");
  x = await istek("/api/v1/akislar?k=dv_eski", { method: "GET" });
  ok(x.st === 401, "web uçlarında da sorgudaki anahtar reddedilir");
  x = await istek("", { auth: "dv_eski", body: rpc("tools/list") });
  ok(x.st === 200, "bayrak kapalıyken başlık anahtarı çalışır");
  x = await istek("", { auth: OAUTH, body: rpc("tools/list") });
  ok(x.st === 200, "bayrak kapalıyken OAuth çalışır");
  T.ayar.find((a) => a.anahtar === "mcp_yol_anahtari").deger = "acik";
  x = await istek("/dv_eski", { body: rpc("tools/list") });
  ok(x.st === 200, "bayrak yeniden açılınca yol anahtarı geri gelir (yeniden yükleme gerekmez)");
})();
