import { handle } from "../server.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-14T09:00:00+03:00");
const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((x) => x.toString(16).padStart(2, "0")).join("");
const DEF: Record<string, () => any> = { adim: () => ({ durum: "sirada", ciktilar: [] }), akis: () => ({ durum: "aktif", kurallar: {}, baglam: {} }), katilimci: () => ({ link_token: tok() }), cikti: () => ({ durum: "taslak", paylasim: "ekip" }) };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak", "katilimci", "anahtar", "kullanici"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t]?.() || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
async function api(method: string, path: string, body?: any, token = "dv_sahip") {
  NOW += 36e5;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), db, NOW, { taban: B });
  return { st: r.status, j: await r.json() };
}
async function mcp(name: string, args: any) {
  NOW += 36e5;
  const r = await handle(new Request(B + "/dv_sahip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, { taban: B });
  return (await r.json()).result.content[0].text as string;
}

(async () => {
  const [ws] = await db.insert("kullanici", [{ ad: "Test alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") }, { kullanici_id: ws.id, kisi: "Zeynep", rol: "ekip", token_hash: await sha("dv_ekip") }]);
  const r = await mcp("devir_akis_olustur", { baslik: "Hasat Karadeniz çiftçileri", hedef_tarih: "2026-11-20", baglam: { musteri: "Hasat" }, adimlar: [
    { ad: "Aday listesi", sahip: "Berkin", kriter: "liste", sure_tahmin_gun: 2 },
    { ad: "Muhasebeci belge modelini onaylar", sahip: "Mali müşavir Ayten", sahip_tip: "dis", kriter: "onay", sure_tahmin_gun: 3, bagimli: [1] },
    { ad: "Komisyon oranına karar ver", sahip: "Berkin", kriter: "karar", sure_tahmin_gun: 1, bagimli: [1] },
    { ad: "Sözleşme taslağı", sahip: "Hukuk agent", sahip_tip: "agent", kriter: "taslak", sure_tahmin_gun: 2, bagimli: [2, 3] },
    { ad: "Netleştir: belediye onayı gerekiyor mu?", sahip: "Zeynep", kriter: "cevap", sure_tahmin_gun: 1 },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];
  ok(T.adim.find((s) => s.ad.startsWith("Netleştir"))?.sahip === "Zeynep", "Netleştir adımı karar sayılmadı (sahibi değişmedi)");

  let x = await api("GET", "/api/v1/ozet");
  ok(x.st === 200 && x.j.ok, "GET /ozet 200");
  console.log("  ozet:", x.j.ozet);
  ok(x.j.benim.some((b: any) => b.ad === "Aday listesi"), "benim: sırası gelen iş listede");
  x = await api("GET", "/api/v1/akislar");
  ok(x.j.akislar.length === 1 && x.j.akislar[0].kod === kod && typeof x.j.akislar[0].ozet === "string", "GET /akislar kart + özet");
  console.log("  kart:", x.j.akislar[0].ozet);
  x = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam", not: "liste hazır" });
  ok(x.st === 200 && x.j.adim.durum === "tamam", "POST adım tamam");
  x = await api("GET", `/api/v1/akis/${kod}`);
  ok(x.j.adimlar.length === 5 && x.j.kritik_yol.length > 0 && x.j.sahipler.length >= 3, "GET /akis detay: adımlar, kritik yol, sahipler");
  ok(x.j.adimlar.find((a: any) => a.no === 3).karar_adimi === true && x.j.adimlar.find((a: any) => a.no === 5).karar_adimi === false, "karar_adimi alanı doğru");
  console.log("  akis ozet:", x.j.akis.ozet);
  // katılımcı bağlantısı
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Mali müşavir Ayten", rol: "muhasebe" });
  ok(x.st === 200 && x.j.katilimci.link.includes("/l/") && x.j.katilimci.whatsapp.startsWith("https://wa.me/"), "katılımcı bağlantısı + WhatsApp");
  const link = x.j.katilimci.link.split("/l/")[1];
  let l = await api("GET", `/l/${link}`, undefined, "");
  ok(l.st === 200 && l.j.adimlar.length === 1 && l.j.adimlar[0].eylemler.includes("basladim"), "bağlantı: yalnızca kendi adımı ve eylemler");
  console.log("  bağlantı özeti:", l.j.ozet);
  l = await api("POST", `/l/${link}`, { no: 4, eylem: "basladim" }, "");
  ok(l.st === 403 || l.st === 400, `bağlantı: başkasının adımı reddedildi (${l.st})`);
  l = await api("POST", `/l/${link}`, { no: 2, eylem: "tamam", metin: "Belge modeli uygun", cikti: { ad: "Belge modeli", url: "https://drive/x", ozet: "3 belge" } }, "");
  ok(l.st === 200 && l.j.adimlar[0].durum === "tamam", "bağlantı: tamam + çıktı");
  ok(T.olay.some((e) => e.kim === "Mali müşavir Ayten" && e.kim_tip === "dis" && e.tip === "durum"), "olay kaydı dış katılımcı adına");
  // yenile → eski bağlantı kapanır
  const kid = T.katilimci[0].id;
  x = await api("POST", `/api/v1/katilimci/${kid}/yenile`); console.log("  yenile:", x.st, JSON.stringify(x.j).slice(0,200));
  l = await api("GET", `/l/${link}`, undefined, "");
  ok(l.st === 404, "yenilenen bağlantının eskisi açılmıyor");
  // karar
  x = await api("POST", `/api/v1/akis/${kod}/adim/3`, { durum: "tamam", not: "Komisyon %12" });
  x = await api("GET", "/api/v1/kararlar");
  ok(x.j.varliklar[0]?.kararlar[0]?.karar === "Komisyon %12", "karar adımı insan tamamlayınca karar kaydı");
  // anahtarlar
  x = await api("POST", "/api/v1/anahtar", { kisi: "Ayten", rol: "dis", kapsam: "Mali müşavir Ayten" });
  ok(x.j.token?.startsWith("dv_") && x.j.mcp_adresi.endsWith(x.j.token), "anahtar üretildi");
  const disTok = x.j.token, disId = x.j.anahtar.id;
  let d = await api("GET", `/api/v1/akis/${kod}`, undefined, disTok);
  ok(d.st === 200 && d.j.adimlar.length === 1 && d.j.gizli_adim_sayisi === 4 && !d.j.kararlar, "dış anahtar yalnızca kendi adımını görür");
  d = await api("GET", "/api/v1/anahtarlar", undefined, "dv_ekip");
  ok(d.st === 403, "ekip üyesi anahtar listeleyemez");
  x = await api("POST", `/api/v1/anahtar/${disId}/iptal`); console.log("  iptal:", x.st, JSON.stringify(x.j));
  d = await api("GET", "/api/v1/ozet", undefined, disTok);
  ok(d.st === 401, "iptal edilen anahtar çalışmıyor");
  // tekrar (A2) API üzerinden
  x = await api("POST", `/api/v1/akis/${kod}/tekrar`, { adimlar: [4], kalemler: ["Ayşe", "Mehmet"], kalem_turu: "çiftçi" });
  ok(x.st === 200 && x.j.tekrar[0].kalemler.length === 2, "tekrar uçu: 2 kalem");
  x = await api("GET", "/api/v1/akislar");
  ok(x.j.akislar.length === 1 && x.j.akislar[0].tekrar[0].kalem_sayisi === 2, "alt akışlar listede üst akışın altında");
  x = await api("GET", "/api/v1/yok");
  ok(x.st === 404, "bilinmeyen uç 404");
  x = await api("GET", "/api/v1/ozet", undefined, "dv_yanlis");
  ok(x.st === 401, "yanlış anahtar 401");
  const mcpList = await handle(new Request(B + "/dv_sahip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), db, NOW, {});
  ok((await mcpList.json()).result.tools.length === 15, "MCP: 15 araç");
})();
