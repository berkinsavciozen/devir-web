// P0-A kimlik testleri (audit S-B2, S-C1, N-4, N-9, MK-3): kişi kimliğiyle kapsam, yeniden adlandırma, üyeye bağlı anahtar, tipli hata, karar politikası, olay kanalı.
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
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak", "katilimci", "anahtar", "kullanici", "kisi", "uye"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t]?.() || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
// sahte Supabase oturumu: "jwt:<auth_id>:<eposta>"; web'de insan yalnız oturumla (S-C1)
const kimlik = async (j: string) => { const m = /^jwt:([\w-]+):(.+)$/.exec(j); return m ? { id: m[1], email: m[2] } : null; };
const OT_BERKIN = "jwt:a-berkin:berkin@x", OT_Z = "jwt:a-z:z@x";
async function api(method: string, path: string, body?: any, token = "dv_sahip") {
  NOW += 36e5;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), db, NOW, { taban: B, kimlik });
  return { st: r.status, j: await r.json() };
}
async function mcp(name: string, args: any, token = "dv_sahip") {
  NOW += 36e5;
  const r = await handle(new Request(B + "/" + token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, { taban: B });
  return (await r.json()).result.content[0].text as string;
}


const adim = (no: number, akisId?: string) => T.adim.find((s) => s.no === no && (!akisId || s.akis_id === akisId));
const sonOlay = () => T.olay[T.olay.length - 1];

(async () => {
  const [ws] = await db.insert("kullanici", [{ ad: "Kimlik alanı" }]);
  const [ayse1, ayse2] = await db.insert("kisi", [{ ws_id: ws.id, ad: "Ayşe", ad_norm: "ayşe", tip: "dis" }, { ws_id: ws.id, ad: "Ayşe", ad_norm: "ayşe", tip: "dis" }]);
  const [uyeZ] = await db.insert("uye", [{ kullanici_id: ws.id, auth_id: "a-z", eposta: "z@x", kisi: "Zeynep", rol: "ekip" }]);
  await db.insert("uye", [{ kullanici_id: ws.id, auth_id: "a-berkin", eposta: "berkin@x", kisi: "Berkin", rol: "sahip" }]);
  await db.insert("anahtar", [
    { kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") },
    { kullanici_id: ws.id, kisi: "Zeynep", rol: "ekip", uye_id: uyeZ.id, token_hash: await sha("dv_zuye") },
    { kullanici_id: ws.id, kisi: "Ayşe", rol: "dis", kapsam: "Ayşe", kisi_id: ayse1.id, token_hash: await sha("dv_ayse1") },
    { kullanici_id: ws.id, kisi: "Ayşe", rol: "dis", kapsam: "Ayşe", kisi_id: ayse2.id, token_hash: await sha("dv_ayse2") },
  ]);
  const r = await mcp("devir_akis_olustur", { baslik: "Kimlik akışı", hedef_tarih: "2026-11-20", adimlar: [
    { ad: "Belgeleri gönder", sahip: "Ayşe", sahip_tip: "dis", kriter: "belge", sure_tahmin_gun: 1 },
    { ad: "Faturayı gönder", sahip: "Ayşe", sahip_tip: "dis", kriter: "fatura", sure_tahmin_gun: 1 },
    { ad: "Sözleşmeyi hazırla", sahip: "Ali", sahip_tip: "dis", kriter: "taslak", sure_tahmin_gun: 1 },
    { ad: "Komisyon oranına karar ver", sahip: "Zeynep", kriter: "karar", sure_tahmin_gun: 1 },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];
  ok(adim(1).sahip_kisi_id === ayse1.id && adim(2).sahip_kisi_id === ayse1.id, "adımlar kurulurken sahibin kişi kimliği yazılır (aynı addaki ilk kişi)");
  ok(!!adim(3).sahip_kisi_id && T.kisi.some((k) => k.id === adim(3).sahip_kisi_id && k.tip === "dis"), "yeni ad yeni dış kişi açar");

  // ayni_ad_iki_kisi: kişi seçiciyle ikinci Ayşe'ye verilen adımı birinci Ayşe göremez
  let x = await api("POST", `/api/v1/akis/${kod}/adim/2`, { sahip_kisi_id: ayse2.id });
  ok(x.st === 200 && adim(2).sahip_kisi_id === ayse2.id, "sahip kişi seçiciyle değiştirilir");
  let m = await mcp("devir_adim_guncelle", { akis: kod, no: 2, durum: "suruyor" }, "dv_ayse1");
  ok(adim(2).durum !== "suruyor" && /atanmamış/.test(m), "ayni_ad_iki_kisi: birinci Ayşe ikincinin adımını güncelleyemez");
  m = await mcp("devir_adim_guncelle", { akis: kod, no: 2, durum: "suruyor" }, "dv_ayse2");
  ok(adim(2).durum === "suruyor", "ayni_ad_iki_kisi: ikinci Ayşe kendi adımını günceller");
  x = await api("GET", `/api/v1/akis/${kod}/adim/1`, undefined, "dv_ayse2");
  ok(x.st === 403, "tipli_hata: başkasının adımı 403");
  x = await api("GET", `/api/v1/akis/YOKK`, undefined, "dv_sahip");
  ok(x.st === 404, "tipli_hata: olmayan akış 404");

  // yeniden_adlandirma: bağlantı kimliğe bağlı; ad değişince aynı adımları görür, eski adla açılan yeni adıma geçmez
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Ali" });
  const link = x.j.katilimci.link.split("/l#")[1], aliId = x.j.katilimci.kisi_id;
  ok(x.j.adim_sayisi === 1 && aliId === adim(3).sahip_kisi_id, "bağlantı kişiye bağlandı");
  x = await api("POST", `/api/v1/kisi/${aliId}`, { ad: "Ali Veli" });
  ok(x.st === 200 && adim(3).sahip === "Ali Veli", "kişi adı değişince adımın sahibi yeni adı gösterir");
  await api("POST", `/api/v1/akis/${kod}/adim`, { ad: "Ek belge", sahip: "Ali", sahip_tip: "dis", kriter: "belge", neden: "sonradan çıktı" });
  let l = await api("GET", `/l/${link}`, undefined, "");
  ok(l.st === 200 && l.j.adimlar.length === 1 && l.j.adimlar[0].no === 3, "yeniden_adlandirma: bağlantı aynı adımı görür, 'Ali' adıyla açılan yeni adımı görmez");
  x = await api("POST", `/api/v1/kisi/${aliId}`, { ad: "X" }, "dv_zuye");
  ok(x.st === 403, "kişi adını yalnız sahip değiştirir");

  // olay kanalı: kayıt hangi yoldan geldi
  await mcp("devir_adim_guncelle", { akis: kod, no: 1, not: "mcp notu" });
  ok(sonOlay().kanal === "mcp" && sonOlay().kim === "Berkin" && !!sonOlay().kisi_id, "olay_kanali: MCP kaydı kanal=mcp ve kişi kimliğiyle");
  x = await api("GET", "/api/v1/olaylar");
  ok(x.st === 200 && x.j.olaylar.some((e: any) => e.kanal === "mcp"), "olaylar uçunda kanal alanı");

  // üyeye bağlı anahtar (N-4): rol üyelikten gelir, üyelik bitince anahtar geçmez
  m = await mcp("devir_akislar", {}, "dv_zuye");
  ok(/Kimlik akışı|KIML|aktif/i.test(m) && !/Hata/.test(m), "üyeye bağlı anahtar çalışır");
  T.uye.find((u) => u.id === uyeZ.id).rol = "dis";
  m = await mcp("devir_sabitle", { akis: kod, ad: "x" }, "dv_zuye");
  ok(/yalnızca ekip/.test(m), "üyenin rolü dış olunca anahtar da dış yetkisine düşer");
  T.uye.find((u) => u.id === uyeZ.id).rol = "ekip";

  // karar politikası (MK-3): sahip ekip için "beyan" seçerse ekibin agent'ı karar veremez, öneri kalır
  x = await api("POST", "/api/v1/politika", { agent_karari: { ekip: "beyan" } }, "dv_zuye");
  ok(x.st === 403, "politikayı yalnız sahip değiştirir");
  x = await api("POST", "/api/v1/politika", { agent_karari: { ekip: "insan", dis: "insan" } });
  ok(x.st === 403 && /e-postayla giriş/.test(x.j.hata), "sahip anahtarı politikayı değiştiremez: agent kendine yetki veremez (S-C1)");
  x = await api("POST", "/api/v1/politika", { agent_karari: { ekip: "beyan" } }, OT_BERKIN);
  ok(x.st === 200 && x.j.politika.agent_karari.ekip === "beyan" && x.j.politika.agent_karari.sahip === "insan", "politika kaydedildi");
  x = await api("POST", "/api/v1/politika", { agent_karari: { ekip: "belki" } }, OT_BERKIN);
  ok(x.st === 400, "politika yalnız insan/beyan alır");
  await api("POST", `/api/v1/akis/${kod}/adim/4`, { durum: "suruyor" }, "dv_zuye");
  m = await mcp("devir_karar_ver", { akis: kod, no: 4, secim: ["%10"], not: "Zeynep %10 dedi" }, "dv_zuye");
  const ak = T.akis.find((a) => a.kisa_kod === kod);
  ok(adim(4).durum !== "tamam" && /beyan/.test(m) && ak.baglam.kararlar["4"].oneri.secim[0] === "%10", "beyan: ekibin agent kararı öneri olarak kaldı");
  ok(T.olay.some((e) => e.adim_no === 4 && e.veri?.tur === "karar_beyani"), "beyan olay kaydında");
  x = await api("POST", `/api/v1/akis/${kod}/adim/4`, { durum: "tamam", karar_secimi: ["%10"] }, "dv_zuye");
  ok(x.st === 403 && adim(4).durum !== "tamam", "beyan: ekip anahtarıyla web ucundan da karar verilemez (anahtar agent)");
  x = await api("POST", `/api/v1/akis/${kod}/adim/4`, { durum: "tamam", karar_secimi: ["%10"] }, OT_Z);
  ok(x.st === 200 && adim(4).durum === "tamam", "ekip kararı web'den (e-postalı oturumla) onaylar");

  // üyelik bitince anahtar 401
  await db.update("uye", { id: uyeZ.id }, { kullanici_id: "baska" });
  x = await api("GET", "/api/v1/ozet", undefined, "dv_zuye");
  ok(x.st === 401, "üyelik bitince üyeye bağlı anahtar 401");
})();
