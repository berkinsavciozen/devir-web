// P1-C testleri (D-C1, N-10): dış paylaşım durumu, son açılış, önizleme, kapatma, süre sonu, dış sahip tipi.
import { handle } from "../server.ts";
import { sifreKur, karma } from "../baglanti.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-22T09:00:00+03:00");
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "anahtar", "kullanici", "kisi", "katilimci", "uye"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(t === "adim" ? { durum: "sirada", ciktilar: [] } : t === "akis" ? { durum: "aktif", kurallar: {}, baglam: {} } : {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const GUN = 864e5;

(async () => {
  const sifre = (await sifreKur(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64")))!;
  const ek: any = { taban: B, sifre };
  async function api(method: string, path: string, body?: any) {
    NOW += 6e4;
    const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer dv_sahip" }, body: body ? JSON.stringify(body) : undefined }), db, NOW, ek);
    return { st: r.status, j: await r.json() };
  }
  async function ac(belirtec: string) {
    NOW += 6e4;
    const r = await handle(new Request(B + "/l", { headers: { "x-devir-baglanti": belirtec } }), db, NOW, ek);
    return { st: r.status, j: await r.json() };
  }
  async function kur(baslik: string, adimlar: any[]) {
    NOW += 6e4;
    const r = await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer dv_sahip" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "devir_akis_olustur", arguments: { baslik, hedef_tarih: "2026-11-20", adimlar } } }) }), db, NOW, ek);
    return /oluşturuldu: (\w+)/.exec((await r.json()).result.content[0].text)![1];
  }
  const [ws] = await db.insert("kullanici", [{ ad: "Paylaşım alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await karma("dv_sahip") }]);
  // ekip üyesi Ayşe (kişi kimliğiyle üye)
  const [ayse] = await db.insert("kisi", [{ ws_id: ws.id, ad: "Ayşe", ad_norm: "ayşe", tip: "insan" }]);
  await db.insert("uye", [{ kullanici_id: ws.id, kisi: "Ayşe", rol: "ekip", kisi_id: ayse.id, eposta: "ayse@ornek.com" }]);

  // N-10: dış kişinin adımı "insan" yazılmış (canlıdaki 7 bağlantının durumu)
  const kod = await kur("Hasat sözleşmeleri", [
    { ad: "Sözleşmeyi imzala", sahip: "Selin", sahip_tip: "insan", kriter: "imza", sure_tahmin_gun: 1 },
    { ad: "İç onay", sahip: "Berkin", sahip_tip: "insan", kriter: "onay", sure_tahmin_gun: 1 },
    { ad: "Fiyat listesi", sahip: "Ayşe", sahip_tip: "insan", kriter: "liste", sure_tahmin_gun: 1 },
  ]);
  const akis = T.akis.find((a) => a.kisa_kod === kod);
  let x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Selin" });
  const link = x.j.katilimci.link as string, t = link.split("/l#")[1];
  ok(x.st === 200 && x.j.katilimci.mesaj.startsWith("Merhaba Selin, Hasat sözleşmeleri için") && x.j.katilimci.mesaj.endsWith(link), "WhatsApp metni akışın adıyla ve bağlantıyla gelir (arayüzde düzenlenir)");
  const adim = (ad: string) => T.adim.find((s) => s.akis_id === akis.id && s.ad === ad);
  ok(adim("Sözleşmeyi imzala").sahip_tip === "dis" && T.kisi.find((k) => k.ad === "Selin").tip === "dis", "N-10: bağlantı alan ekip dışı kişinin adımı dış olur");
  ok(adim("İç onay").sahip_tip === "insan", "N-10: başka adımlar değişmez");
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Ayşe" });
  ok(x.st === 200 && adim("Fiyat listesi").sahip_tip === "insan" && T.kisi.find((k) => k.id === ayse.id).tip === "insan", "N-10: ekip üyesine bağlantı verilse de adımı dış olmaz");

  // durum, son açılış
  const liste = async () => (await api("GET", `/api/v1/akis/${kod}/katilimcilar`)).j.katilimcilar.find((k: any) => k.ad === "Selin");
  let k = await liste();
  ok(k.durum === "acik" && k.link === link && k.son_acilis === null && k.acilis_sayisi === 0 && k.adim_sayisi === 1 && k.acik_adim === 1 && k.gecerlilik === null, "liste: açık, hiç açılmadı, 1 adım, süresiz (akış sürüyor)");
  x = await ac(t);
  ok(x.st === 200 && x.j.adimlar.length === 1, "bağlantı açılır");
  k = await liste();
  ok(k.acilis_sayisi === 1 && Date.parse(k.son_acilis) === NOW - 6e4, "son açılış listede görünür");

  // önizleme: aynı görünüm, açılış sayılmaz
  x = await api("GET", `/api/v1/katilimci/${k.id}/onizleme`);
  ok(x.st === 200 && x.j.onizleme === true && x.j.kisi === "Selin" && x.j.adimlar.length === 1 && x.j.adimlar[0].ad === "Sözleşmeyi imzala", "önizleme katılımcının göreceği adımları gösterir");
  ok(x.j.harita.adimlar.filter((a: any) => a.sahip === "Berkin").length === 0, "önizlemede öteki sahipler adsız (bağlantıyla aynı)");
  ok((await liste()).acilis_sayisi === 1, "önizleme açılış sayılmaz");
  ok((await api("GET", `/api/v1/katilimci/00000000-0000-0000-0000-000000000000/onizleme`)).st === 404, "olmayan katılımcının önizlemesi 404");

  // bütün akışlar (Pano)
  x = await api("GET", "/api/v1/katilimcilar");
  ok(x.st === 200 && x.j.katilimcilar.some((y: any) => y.ad === "Selin" && y.akis.kod === kod && y.son_acilis), "Pano listesi akışla ve son açılışla gelir");

  // kapat
  x = await api("POST", `/api/v1/katilimci/${k.id}/iptal`, {});
  ok(x.st === 200 && x.j.katilimci.durum === "iptal" && x.j.katilimci.link === null, "kapatılan bağlantı iptal görünür");
  ok((await ac(t)).st === 404, "kapatılan bağlantı açılmaz");
  ok(T.olay.some((e) => e.akis_id === akis.id && e.veri?.tur === "baglanti_iptal" && e.kim === "Berkin"), "kapatma olay kaydına yazılır");
  ok((await api("POST", `/api/v1/katilimci/${k.id}/iptal`, {})).st === 200, "ikinci kez kapatmak hata vermez");
  x = await api("POST", `/api/v1/katilimci/${k.id}/yenile`, {});
  const t2 = x.j.katilimci.link.split("/l#")[1];
  ok(x.j.katilimci.durum === "acik" && t2 !== t && (await ac(t2)).st === 200, "kapatılan bağlantı yenilenince yeni adresle açılır");

  // süre sonu: akış kapanınca 30 gün
  await db.update("akis", { id: akis.id }, { durum: "kapandi", kapandi_at: new Date(NOW).toISOString() });
  x = await ac(t2);
  ok(x.st === 200 && Date.parse(x.j.gecerlilik) === Date.parse(T.akis.find((a) => a.id === akis.id).kapandi_at) + 30 * GUN, "kapanan akışta bağlantı açılır, son geçerlilik tarihi görünür");
  k = await liste();
  ok(k.durum === "acik" && !!k.gecerlilik, "listede geçerlilik tarihi var");
  NOW += 30 * GUN;
  x = await ac(t2);
  ok(x.st === 410 && /süresi doldu/.test(x.j.hata), "kapanıştan 30 gün sonra bağlantı 410");
  k = await liste();
  ok(k.durum === "suresi_doldu" && k.link === null && k.mesaj === null, "listede süresi doldu, bağlantı gösterilmez");
  ok((await api("POST", `/api/v1/katilimci/${k.id}/yenile`, {})).st === 409, "süresi dolan bağlantı yenilenmez");
  ok(!(await api("GET", "/api/v1/katilimcilar")).j.katilimcilar.some((y: any) => y.akis.kod === kod), "süresi dolan akış Pano listesinden düşer");

  // arşiv (vazgeçilen akış): hemen kapanır
  const kod2 = await kur("Vazgeçilen iş", [{ ad: "Belge", sahip: "Emre", sahip_tip: "dis", kriter: "belge", sure_tahmin_gun: 1 }]);
  x = await api("POST", `/api/v1/akis/${kod2}/katilimci`, { ad: "Emre" });
  const t3 = x.j.katilimci.link.split("/l#")[1];
  ok((await ac(t3)).st === 200, "arşivden önce açılır");
  await db.update("akis", { kisa_kod: kod2 }, { durum: "arsiv" });
  ok((await ac(t3)).st === 410, "arşivlenen akışın bağlantısı hemen kapanır");
})();
