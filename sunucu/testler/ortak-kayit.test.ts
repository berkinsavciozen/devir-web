// P1-B1: aynı istek ikinci kez yazmaz, hız sınırı ve yapay zekâ bütçesi, durum ve olay tek yazım, taslak yaşam döngüsü, kapatma nedeni.
import { handle } from "../server.ts";
import { llmButcesi } from "../islem.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-22T09:00:00+03:00");
const DEF: Record<string, () => any> = { adim: () => ({ durum: "sirada", ciktilar: [] }), akis: () => ({ durum: "aktif", kurallar: {}, baglam: {} }), taslak: () => ({ durum: "acik", baglam: {} }), cikti: () => ({ durum: "taslak", paylasim: "ekip" }) };
const rpcCagri: string[] = [];
let rpcHata: string | null = null;
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak", "anahtar", "kullanici"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t]?.() || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
// Postgres'teki adim_durum_yaz'ın bellek karşılığı: önceki durum tutmazsa hiçbir şey yazmaz
const rpcDb: any = {
  ...db,
  async rpc(fn: string, a: any) {
    rpcCagri.push(fn);
    if (fn === "sayac_artir") { const w = { ws_id: a.p_ws, kimlik: a.p_kimlik, tur: a.p_tur, pencere: a.p_pencere }; const k = await db.one("kullanim_sayaci", w); if (k) { await db.update("kullanim_sayaci", w, { sayi: k.sayi + 1 }); return k.sayi + 1; } await db.insert("kullanim_sayaci", [{ ...w, sayi: 1 }]); return 1; }
    if (fn !== "adim_durum_yaz") throw new Error("bilinmeyen işlev");
    if (rpcHata) throw new Error(rpcHata);
    const s = T.adim.find((x) => x.id === a.p_adim);
    if (a.p_onceki != null && s.durum !== a.p_onceki) throw new Error("40001 durum_degisti");
    Object.assign(s, a.p_patch);
    T.olay.push({ id: idc++, created_at: new Date(NOW).toISOString(), ...a.p_olay });
  },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const motor = async () => { throw new Error("motor yok"); };
async function api(method: string, path: string, body?: any, o: { anahtar?: string; ilerle?: number; d?: any } = {}) {
  NOW += o.ilerle ?? 6e4;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer dv_sahip", ...(o.anahtar ? { "idempotency-key": o.anahtar } : {}) }, body: body ? JSON.stringify(body) : undefined }), o.d || db, NOW, { taban: B, llm: motor as any });
  return { st: r.status, j: await r.json(), h: r.headers };
}
async function mcp(name: string, args: any, ilerle = 6e4, d = db) {
  NOW += ilerle;
  const r = await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer dv_sahip" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), d, NOW, { taban: B, llm: motor as any });
  return (await r.json()).result.content[0].text as string;
}
const olaySay = (akisId: string, tip?: string) => (T.olay || []).filter((e) => e.akis_id === akisId && (!tip || e.tip === tip)).length;

(async () => {
  const [ws] = await db.insert("kullanici", [{ ad: "Test alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") }]);
  const r = await mcp("devir_akis_olustur", { baslik: "Hasat Karadeniz", baglam: { musteri: "Hasat" }, adimlar: [
    { ad: "Aday listesi", sahip: "Berkin", kriter: "liste", sure_tahmin_gun: 2 },
    { ad: "Sözleşme taslağı", sahip: "Berkin", kriter: "taslak", sure_tahmin_gun: 2, bagimli: [1] },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];
  const akis = T.akis.find((a) => a.kisa_kod === kod);

  // ayni_anahtar_tek_olay
  const o0 = olaySay(akis.id, "durum");
  let x = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "suruyor" }, { anahtar: "k-1" });
  let y = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "suruyor" }, { anahtar: "k-1" });
  ok(x.st === 200 && y.st === 200 && olaySay(akis.id, "durum") === o0 + 1, "aynı Idempotency-Key: tek durum olayı");
  ok(y.h.get("idempotent-replayed") === "true" && x.h.get("idempotent-replayed") === null && y.j.mesaj === x.j.mesaj, "tekrar ilk sonucu döner ve işaretlenir");
  // ayni_anahtar_farkli_govde_409
  y = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam", not: "bitti" }, { anahtar: "k-1" });
  ok(y.st === 409 && T.adim.find((s) => s.akis_id === akis.id && s.no === 1).durum === "suruyor", "aynı anahtar farklı gövde: 409, yazılmadı");
  // hata veren istek kayıt bırakmaz, aynı anahtarla düzeltilip yeniden denenebilir
  y = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "atlandi" }, { anahtar: "k-2" });
  ok(y.st === 400, "notsuz atlama hata verdi");
  y = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "atlandi" }, { anahtar: "k-2" });
  ok(y.st === 400 && /not/.test(y.j.hata), "hatalı istek önbelleğe alınmadı (yeniden işlendi)");

  // mcp_tekrar_tek_adim: aynı argümanla 10 dk içinde ikinci çağrı yazmaz
  const n0 = T.adim.filter((s) => s.akis_id === akis.id).length;
  const ekle = { akis: kod, ad: "Noter onayı", sahip: "Berkin", kriter: "onay", neden: "unutulmuş", bagimli: [2] };
  const m1 = await mcp("devir_adim_ekle", ekle);
  const m2 = await mcp("devir_adim_ekle", ekle, 3 * 6e4);
  ok(T.adim.filter((s) => s.akis_id === akis.id).length === n0 + 1 && /zaten yapılmıştı/.test(m2) && m2.endsWith(m1), "MCP doğal tekrar: tek adım, önceki sonuç döner");
  await mcp("devir_adim_ekle", ekle, 11 * 6e4);
  ok(T.adim.filter((s) => s.akis_id === akis.id).length === n0 + 2, "10 dk sonra aynı çağrı yeni iş sayılır");
  const e1 = { akis: kod, ad: "Kargo", sahip: "Berkin", kriter: "gönderildi", neden: "eksik", islem_id: "is-7" };
  await mcp("devir_adim_ekle", e1);
  const m3 = await mcp("devir_adim_ekle", e1, 60 * 6e4);
  ok(T.adim.filter((s) => s.akis_id === akis.id && s.ad === "Kargo").length === 1 && /bu islem_id ile/.test(m3), "islem_id: 1 saat sonra da tek adım");
  const m4 = await mcp("devir_adim_ekle", { ...e1, ad: "Başka" });
  ok(/başka bir istekte/.test(m4) && !T.adim.some((s) => s.ad === "Başka"), "aynı islem_id farklı argüman reddedildi");
  const okuma = await mcp("devir_akis", { akis: kod }), okuma2 = await mcp("devir_akis", { akis: kod }, 0);
  ok(!/zaten yapılmıştı/.test(okuma2) && okuma2.length > 0 && okuma.length > 0, "okuma araçları tekrar kaydına girmez");
  const liste = await (await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer dv_sahip" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), db, NOW, { taban: B })).json();
  const arac = (n: string) => liste.result.tools.find((t: any) => t.name === n);
  ok(!!arac("devir_adim_guncelle").inputSchema.properties.islem_id && !arac("devir_akis").inputSchema.properties.islem_id, "islem_id yalnız yazan araçlarda");

  // hiz_siniri_429
  T.ayar = [{ anahtar: "kullanim_sinirlari", deger: JSON.stringify({ api: 2, mcp: 3, llm: 1 }) }];
  NOW = Math.floor(NOW / 6e4) * 6e4 + 6e4; // yeni dakikanın başı
  const h = [];
  for (let i = 0; i < 3; i++) h.push(await api("POST", `/api/v1/akis/${kod}/adim/2`, { ilerleme: `deneme ${i}` }, { ilerle: 1000 }));
  ok(h[0].st === 200 && h[1].st === 200 && h[2].st === 429 && /dakikada en çok 2/.test(h[2].j.hata) && Number(h[2].h.get("retry-after")) > 0, "API hız sınırı: 429 ve Retry-After");
  ok((await api("GET", `/api/v1/akis/${kod}`, undefined, { ilerle: 1000 })).st === 200, "okuma hız sınırına takılmaz");
  ok((await api("POST", `/api/v1/akis/${kod}/adim/2`, { ilerleme: "yeni dakika" }, { ilerle: 6e4 })).st === 200, "yeni dakikada yeniden açılır");
  const mm = [];
  for (let i = 0; i < 4; i++) mm.push(await mcp("devir_akis", { akis: kod }, 1000));
  ok(/Çok sık istek/.test(mm[3]) && !/Çok sık/.test(mm[2]), "MCP hız sınırı: 4. çağrı reddedildi");

  // llm_butcesi_429_ve_mesaj (önceki adım eklemeleri de model çağırdı; bugünün sayacı sıfırdan)
  NOW += 6e4;
  T.kullanim_sayaci = T.kullanim_sayaci.filter((r) => r.tur !== "llm");
  const t1 = await api("POST", "/api/v1/tasla", { cumle: "Hasat için Karadeniz'de 20 çiftçi kazandırmam lazım" });
  const t2 = await api("POST", "/api/v1/tasla", { cumle: "Ege'de fuar standı hazırlamam lazım" });
  ok(t1.st !== 429 && t2.st === 429 && /yapay zekâ kullanım sınırı doldu \(1 çağrı\)/.test(t2.j.hata) && /elle akış kurmaya devam/.test(t2.j.hata), "yapay zekâ bütçesi: 429 ve ne yapılabileceğini söyleyen mesaj");
  { // bütçe alan başına ve günlük: ertesi gün açılır
    const ctx: any = { db, ws, key: { id: "x" }, now: NOW + 864e5, ua: "" };
    let cagri = 0;
    const L = llmButcesi(ctx, (async () => { cagri++; return { input: {}, model: "m", ms: 1 }; }) as any)!;
    await L({ system: "", user: "", tool: {} as any });
    ok(cagri === 1, "yapay zekâ bütçesi ertesi gün sıfırlanır");
  }
  T.ayar = [];

  // durum_ve_olay_birlikte: rpc varken durum ve olay tek çağrıda; eşzamanlı değişiklik 409, hiçbir şey yazılmaz
  NOW += 6e4;
  const o1 = olaySay(akis.id, "durum");
  x = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam", not: "liste hazır" }, { d: rpcDb });
  ok(x.st === 200 && rpcCagri.includes("adim_durum_yaz") && olaySay(akis.id, "durum") > o1 && T.adim.find((s) => s.akis_id === akis.id && s.no === 1).durum === "tamam", "durum ve olay adim_durum_yaz ile birlikte yazıldı");
  const s2 = T.adim.find((s) => s.akis_id === akis.id && s.no === 2), o2 = olaySay(akis.id, "durum"), d2 = s2.durum;
  rpcHata = "40001 durum_degisti";
  x = await api("POST", `/api/v1/akis/${kod}/adim/2`, { durum: "suruyor" }, { d: rpcDb });
  ok(x.st === 409 && /başka biri tarafından güncellendi/.test(x.j.hata) && s2.durum === d2 && olaySay(akis.id, "durum") === o2, "eşzamanlı güncelleme: 409, adım ve olay değişmedi");
  rpcHata = null;

  // taslak yaşam döngüsü
  const tk = (k: string, varlik: string, gun = 0) => ({ kisa_kod: k, ws_id: ws.id, cumle: `${varlik} işi`, baglam: { musteri: varlik }, taslak: { baslik: `${varlik} işi`, adimlar: [] }, sorular: {}, created_at: new Date(NOW - gun * 864e5).toISOString() });
  await db.insert("taslak", [tk("TESKI", "Lale", 8), tk("TYENI", "Lale", 1), tk("TMAVI", "Mavi", 0), tk("TPERA", "Pera", 0)]);
  x = await api("GET", "/api/v1/akislar");
  ok(x.j.taslaklar.some((t: any) => t.kod === "TYENI") && !x.j.taslaklar.some((t: any) => t.kod === "TESKI"), "7 günden eski açık taslak listede yok");
  x = await api("POST", "/api/v1/taslak/TPERA/iptal");
  ok(x.st === 200 && T.taslak.find((t) => t.kisa_kod === "TPERA").durum === "iptal" && !x.j.taslaklar.some((t: any) => t.kod === "TPERA"), "taslak iptal ucu: Vazgeç");
  x = await api("POST", "/api/v1/taslak/TPERA/kur", {});
  ok(x.st === 409 && /vazgeçildi/.test(x.j.hata), "iptal edilen taslaktan akış kurulmaz");
  const elle = await mcp("devir_akis_olustur", { baslik: "Mavi lansman", baglam: { varlik: "Mavi" }, adimlar: [{ ad: "Basın bülteni", sahip: "Berkin", kriter: "yayında" }] });
  ok(/oluşturuldu/.test(elle) && T.taslak.find((t) => t.kisa_kod === "TMAVI").durum === "iptal" && /TMAVI\) bu akış kurulduğu için iptal/.test(elle), "aynı varlıkta elle akış: açık taslak iptal");
  ok(T.taslak.find((t) => t.kisa_kod === "TYENI").durum === "acik", "başka varlığın taslağı etkilenmez");
  // aynı varlıkta son 24 saatte aktif akış: onay istenir
  const tekrar = await mcp("devir_akis_olustur", { baslik: "Mavi lansman 2", baglam: { varlik: "Mavi" }, adimlar: [{ ad: "Bülten", sahip: "Berkin", kriter: "yayında" }] }, 2 * 36e5);
  ok(/son 24 saatte kurulmuş aktif akış var/.test(tekrar) && /ayni_varlik_onay/.test(tekrar) && !T.akis.some((a) => a.baslik === "Mavi lansman 2"), "aynı varlıkta yeni akış önce onay ister");
  const onayli = await mcp("devir_akis_olustur", { baslik: "Mavi lansman 2", baglam: { varlik: "Mavi" }, adimlar: [{ ad: "Bülten", sahip: "Berkin", kriter: "yayında" }], ayni_varlik_onay: true });
  ok(/oluşturuldu/.test(onayli), "onayla kurulur");
  const sonra = await mcp("devir_akis_olustur", { baslik: "Mavi bayi", baglam: { varlik: "Mavi" }, adimlar: [{ ad: "Bayi listesi", sahip: "Berkin", kriter: "liste" }] }, 25 * 36e5);
  ok(/oluşturuldu/.test(sonra), "24 saatten eski aktif akış onay istemez");

  // kapatma nedeni: iptal deneyim yazmaz, uygulanan dersin güveni düşer
  const [ders] = await db.insert("ders", [{ ws_id: ws.id, metin: "IP izin listesi iste", durum: "kesin", guven: 0.6, atlandi: 0 }]);
  const iptalKod = /oluşturuldu: (\w+)/.exec(onayli)![1];
  const ia = T.akis.find((a) => a.kisa_kod === iptalKod);
  ia.baglam = { ...ia.baglam, dersler: [{ id: ders.id, tur_kod: "ip-izin" }] };
  const dn = (T.deneyim || []).length;
  let k = await mcp("devir_akis_kapat", { akis: iptalKod, neden: "mukerrer", degerlendirme: "Mavi lansmanın kopyası" });
  ok(/mükerrer diye kapandı/.test(k) && ia.durum === "arsiv" && ia.baglam.kapanis_nedeni === "mukerrer" && (T.deneyim || []).length === dn, "mükerrer: arşiv, deneyim yazılmadı");
  const dz = T.ders.find((d) => d.id === ders.id);
  ok(Math.abs(dz.guven - 0.4) < 1e-9 && dz.atlandi === 1 && /D\d+ bu işte uymadı/.test(k), "uygulanan dersin güveni düştü");
  ok(T.olay.some((e) => e.akis_id === ia.id && e.tip === "akis_kapandi" && e.veri?.neden === "mukerrer"), "kapanış olayında neden var");
  k = await mcp("devir_akis_kapat", { akis: kod, neden: "bitti" });
  ok(/neden: tamamlandi, iptal ya da mukerrer/.test(k), "tanımsız neden reddedildi");
  console.log(process.exitCode ? "✗ ortak kayıt testleri" : "✓ ortak kayıt testleri tamam");
})();
