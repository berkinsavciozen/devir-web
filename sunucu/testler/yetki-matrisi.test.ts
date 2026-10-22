// P0-C güvenlik test kapısı: çapraz alan ve rol matrisi. Bir alanın kimliği başka alanın hiçbir kaydını okuyamaz ya da
// değiştiremez; ekip ve dış rolleri sahip işlerini yapamaz; dış kişi yalnız kendi adımını görür. Her uç tabloda tek satır.
import { handle } from "../server.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-22T09:00:00+03:00");
const DEF: Record<string, () => any> = { adim: () => ({ durum: "sirada", ciktilar: [] }), akis: () => ({ durum: "aktif", kurallar: {}, baglam: {} }), cikti: () => ({ durum: "taslak", paylasim: "ekip" }) };
const UUID = ["adim", "akis", "taslak", "katilimci", "anahtar", "kullanici", "kisi", "dosya", "uye"];
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: UUID.includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t]?.() || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
let hata = 0;
const ok = (c: boolean, m: string) => { if (!c) { console.log("✗ " + m); hata++; process.exitCode = 1; } };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const depo = { async yuklemeAdresi() { return { url: "https://depo/yukle", token: "t" }; }, async indirmeAdresi() { return "https://depo/indir"; }, async bilgi() { return { boyut: 10, tur: "application/pdf" }; }, async sil() {} };
const ek = { taban: B, depo };
async function api(method: string, path: string, token: string, body?: any) {
  NOW += 6e4;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: method === "GET" ? undefined : JSON.stringify(body || {}) }), db, NOW, ek);
  const metin = await r.text();
  return { st: r.status, metin, j: (() => { try { return JSON.parse(metin); } catch { return {}; } })() };
}
async function mcp(token: string, name: string, args: any) {
  NOW += 6e4;
  const r = await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, ek);
  return (await r.json()).result?.content?.[0]?.text as string || "";
}
const IZ = "GIZLIA"; // A alanına ait her metinde geçer; B'nin hiçbir yanıtında görünmemeli

(async () => {
  const [A] = await db.insert("kullanici", [{ ad: `${IZ} alanı` }]);
  const [Bws] = await db.insert("kullanici", [{ ad: "B alanı" }]);
  await db.insert("anahtar", [
    { kullanici_id: A.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_a") },
    { kullanici_id: A.id, kisi: "Zeynep", rol: "ekip", token_hash: await sha("dv_ae") },
    { kullanici_id: A.id, kisi: "Emre", rol: "dis", kapsam: "Emre", token_hash: await sha("dv_ad") },
    { kullanici_id: Bws.id, kisi: "Burak", rol: "sahip", token_hash: await sha("dv_b") },
  ]);
  const m = await mcp("dv_a", "devir_akis_olustur", { baslik: `${IZ} hasat akışı`, hedef_tarih: "2026-12-01", baglam: { musteri: `${IZ} müşteri` }, adimlar: [
    { ad: `${IZ} aday listesi`, sahip: "Berkin", kriter: "liste", sure_tahmin_gun: 2 },
    { ad: `${IZ} belge topla`, sahip: "Zeynep", kriter: "belge", sure_tahmin_gun: 2 },
    { ad: `${IZ} fatura gönder`, sahip: "Emre", sahip_tip: "dis", kriter: "fatura", sure_tahmin_gun: 1 },
    { ad: `${IZ} komisyona karar ver`, sahip: "Berkin", kriter: "karar", sure_tahmin_gun: 1 },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(m)?.[1] as string;
  ok(!!kod, "A akışı kuruldu");
  const akis = T.akis.find((a) => a.kisa_kod === kod);
  let x = await api("POST", `/api/v1/akis/${kod}/adim/1`, "dv_a", { durum: "tamam", not: `${IZ} not`, cikti: { ozet: `${IZ} çıktı`, icerik: `${IZ} içerik` } });
  ok(x.st === 200, "A sahibi adım ve çıktı yazar");
  const cikti = T.cikti?.find((c) => c.akis_id === akis.id);
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, "dv_a", { ad: "Emre" });
  const katilimci = T.katilimci.find((k) => k.akis_id === akis.id);
  const linkA = String(x.j.katilimci?.link || "").split("/l#")[1];
  x = await api("POST", "/api/v1/karar", "dv_a", { varlik: `${IZ} müşteri`, karar: `${IZ} komisyon yüzde 5` });
  x = await api("POST", "/api/v1/anahtar", "dv_a", { kisi: "Selin", rol: "ekip" });
  const anahtarA = x.j.anahtar?.id;
  const kisiA = T.kisi.find((k) => k.ws_id === A.id && k.ad === "Zeynep");
  const [dosyaA] = await db.insert("dosya", [{ ws_id: A.id, akis_id: akis.id, adim_no: 2, yol: `${A.id}/x.pdf`, ad: `${IZ}.pdf`, tur: "application/pdf", boyut: 10, durum: "yuklendi" }]);
  const [dersA] = await db.insert("ders", [{ ws_id: A.id, metin: `${IZ} ders`, etki: "adim_ekle", kapsam: "ekip", durum: "aday", updated_at: new Date(NOW).toISOString() }]);
  const [taslakA] = await db.insert("taslak", [{ ws_id: A.id, kisa_kod: "TGZA", cumle: `${IZ} taslak`, durum: "acik", taslak: { baslik: `${IZ} taslak`, adimlar: [{ no: 1, ad: `${IZ} adım`, sahip: "Berkin", kriter: "liste", sure_tahmin_gun: 1 }] }, sorular: [], varsayimlar: [] }]);
  ok(!!cikti && !!katilimci && !!linkA && !!anahtarA && !!kisiA, "A alanında çıktı, katılımcı, anahtar, kişi var");

  const adimDurum = () => JSON.stringify(T.adim.filter((s) => s.akis_id === akis.id).map((s) => [s.no, s.durum, s.sahip, s.ad]));
  const onceki = adimDurum();
  // 1) Çapraz alan: B'nin sahibi A'nın kimliklerini bilse de hiçbir şeyi okuyamaz, değiştiremez
  const capraz: [string, string, any?][] = [
    ["GET", `/api/v1/akis/${kod}`], ["GET", `/api/v1/akis/${akis.id}`], ["GET", `/api/v1/akis/${kod}/adim/1`],
    ["GET", `/api/v1/akis/${kod}/katilimcilar`], ["GET", `/api/v1/akis/${kod}/dosyalar`], ["GET", `/api/v1/cikti/${cikti?.id}?akis=${kod}`],
    ["GET", `/api/v1/dosya/${dosyaA.id}`], ["GET", `/api/v1/taslak/${taslakA.kisa_kod}`],
    ["POST", `/api/v1/akis/${kod}/adim/2`, { durum: "tamam" }], ["POST", `/api/v1/akis/${kod}/adim`, { ad: "sızma", sahip: "Burak" }],
    ["POST", `/api/v1/akis/${kod}/cevap`, { soru: "x", cevap: "y" }], ["POST", `/api/v1/akis/${kod}/kapat`, { zorla: true }],
    ["POST", `/api/v1/akis/${kod}/sabitle`, {}], ["POST", `/api/v1/akis/${kod}/tekrar`, { kalemler: ["a"] }],
    ["POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Emre" }], ["POST", `/api/v1/katilimci/${katilimci.id}/yenile`],
    ["POST", `/api/v1/akis/${kod}/adim/2/dosya`, { ad: "a.pdf", tur: "application/pdf", boyut: 10 }],
    ["POST", `/api/v1/dosya/${dosyaA.id}/sil`], ["POST", `/api/v1/akis/${kod}/dosyalari-sil`],
    ["POST", `/api/v1/kisi/${kisiA.id}`, { ad: "Değişti" }], ["POST", `/api/v1/anahtar/${anahtarA}/iptal`],
    ["POST", `/api/v1/ders/${dersA.id}/onayla`], ["POST", `/api/v1/taslak/${taslakA.kisa_kod}/kur`, {}],
  ];
  for (const [mt, yol, b] of capraz) {
    const r = await api(mt, yol, "dv_b", b);
    ok(r.st >= 400 && !r.metin.includes(IZ), `çapraz alan: ${mt} ${yol} → ${r.st}${r.metin.includes(IZ) ? " (A verisi sızdı)" : ""}`);
  }
  // listeler B'de 200 döner ama A'dan iz taşımaz
  for (const yol of ["/api/v1/ozet", "/api/v1/akislar", "/api/v1/akislar?durum=kapandi", `/api/v1/akislar/detay?kodlar=${kod}`, "/api/v1/gorevler", "/api/v1/olaylar",
    "/api/v1/kararlar", `/api/v1/kararlar?varlik=${encodeURIComponent(IZ + " müşteri")}`, "/api/v1/kisiler", "/api/v1/anahtarlar", "/api/v1/dersler", "/api/v1/politika", "/api/v1/ben"]) {
    const r = await api("GET", yol, "dv_b");
    ok(r.st < 500 && !r.metin.includes(IZ), `çapraz alan liste: ${yol} → ${r.st}${r.metin.includes(IZ) ? " (A verisi sızdı)" : ""}`);
  }
  // MCP araçları da aynı sınırda
  for (const [ad, args] of [["devir_akis", { akis: kod }], ["devir_adim_oku", { akis: kod, no: 1 }], ["devir_cikti_oku", { akis: kod, id: cikti?.id }],
    ["devir_adim_guncelle", { akis: kod, no: 2, durum: "tamam" }], ["devir_akislar", {}], ["devir_karar", { varlik: `${IZ} müşteri` }], ["devir_kurallar", {}], ["devir_dersler", {}]] as [string, any][]) {
    const t = (await mcp("dv_b", ad, args)).replaceAll(`${IZ} müşteri`, ""); // aranan varlık adı yanıtta yankılanabilir
    ok(!t.includes(IZ), `çapraz alan MCP: ${ad}${t.includes(IZ) ? " (A verisi sızdı)" : ""}`);
  }
  ok(adimDurum() === onceki, "çapraz denemeler A'nın adımlarını değiştirmedi");
  ok(T.kisi.find((k) => k.id === kisiA.id)?.ad === "Zeynep" && !String(T.anahtar.find((k) => k.id === anahtarA)?.token_hash).startsWith("iptal:"), "çapraz denemeler A'nın kişisini ve anahtarını değiştirmedi");
  ok(T.katilimci.find((k) => k.id === katilimci.id)?.link_hash === katilimci.link_hash && T.dosya.find((d) => d.id === dosyaA.id)?.durum === "yuklendi", "çapraz denemeler A'nın bağlantısını ve dosyasını değiştirmedi");

  // 3) Bağlantı kapsamı: A'nın bağlantısı yalnız kendi adımını gösterir, başka akışa ya da alana uzanmaz
  NOW += 6e4;
  let r = await handle(new Request(B + "/l", { headers: { "x-devir-baglanti": linkA } }), db, NOW, ek);
  let j: any = await r.json();
  ok(r.status === 200 && j.adimlar?.length === 1 && j.adimlar[0].no === 3, "bağlantı yalnız kendi adımını gösterir");
  for (const no of [1, 2, 4]) {
    NOW += 6e4;
    r = await handle(new Request(B + "/l", { method: "POST", headers: { "content-type": "application/json", "x-devir-baglanti": linkA }, body: JSON.stringify({ no, eylem: "tamam" }) }), db, NOW, ek);
    ok(r.status >= 400 && T.adim.find((s) => s.akis_id === akis.id && s.no === no)?.durum !== "tamam" || no === 1, `bağlantı başkasının adımını (${no}) kapatamaz → ${r.status}`);
  }
  NOW += 6e4;
  r = await handle(new Request(B + "/l", { headers: { "x-devir-baglanti": linkA + "x" } }), db, NOW, ek);
  ok(r.status === 404, "değiştirilmiş belirteç açılmaz");
  NOW += 6e4;
  r = await handle(new Request(B + "/api/v1/akislar", { headers: { "x-devir-baglanti": linkA } }), db, NOW, ek);
  ok(r.status === 401, "bağlantı belirteci API kimliği yerine geçmez");

  // 2) Rol matrisi (A içinde): s = sahip, e = ekip, d = dış. true = izinli
  const rol: [string, string, any, { s: boolean; e: boolean; d: boolean }][] = [
    ["POST", "/api/v1/anahtar", { kisi: "Can", rol: "ekip" }, { s: true, e: false, d: false }],
    ["POST", `/api/v1/anahtar/${anahtarA}/iptal`, {}, { s: true, e: false, d: false }],
    ["POST", "/api/v1/politika", { agent_karari: { ekip: "beyan" } }, { s: true, e: false, d: false }],
    ["POST", `/api/v1/kisi/${kisiA.id}`, { ad: "Zeynep" }, { s: true, e: false, d: false }],
    ["POST", `/api/v1/akis/${kod}/dosyalari-sil`, {}, { s: true, e: false, d: false }],
    ["GET", "/api/v1/anahtarlar", null, { s: true, e: false, d: false }],
    ["GET", "/api/v1/kisiler", null, { s: true, e: true, d: false }],
    ["GET", "/api/v1/politika", null, { s: true, e: true, d: false }],
    ["GET", "/api/v1/kararlar", null, { s: true, e: true, d: false }],
    ["GET", `/api/v1/akis/${kod}/katilimcilar`, null, { s: true, e: true, d: false }],
    ["POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Emre" }, { s: true, e: true, d: false }],
    ["POST", `/api/v1/katilimci/${katilimci.id}/yenile`, {}, { s: true, e: true, d: false }],
    ["GET", `/api/v1/taslak/${taslakA.kisa_kod}`, null, { s: true, e: true, d: false }],
    ["POST", "/api/v1/karar", { varlik: `${IZ} müşteri`, karar: "rol denemesi" }, { s: true, e: false, d: false }],
    ["POST", `/api/v1/ders/${dersA.id}/onayla`, {}, { s: true, e: false, d: false }],
    ["POST", `/api/v1/akis/${kod}/adim/3`, { durum: "suruyor" }, { s: true, e: true, d: true }],
    ["POST", `/api/v1/akis/${kod}/adim/2`, { durum: "suruyor" }, { s: true, e: true, d: false }],
    ["GET", `/api/v1/akis/${kod}/adim/3`, null, { s: true, e: true, d: true }],
    ["GET", `/api/v1/akis/${kod}/adim/1`, null, { s: true, e: true, d: false }],
  ];
  for (const [mt, yol, b, izin] of rol) for (const [r, tok] of [["s", "dv_a"], ["e", "dv_ae"], ["d", "dv_ad"]] as const) {
    if (r === "s" && yol.includes("/iptal")) continue; // sahibin iptali satırı değiştirir; aşağıda ayrı
    const y = await api(mt, yol, tok, b ?? undefined);
    const gecti = ![401, 403, 404].includes(y.st) && y.st < 500;
    ok(gecti === izin[r], `rol ${r}: ${mt} ${yol} → ${y.st} (beklenen ${izin[r] ? "izin" : "ret"})`);
  }
  // dış kişi akışta yalnız kendi adımını görür
  x = await api("GET", `/api/v1/akis/${kod}`, "dv_ad");
  const gorunen = (x.j.adimlar || []).map((a: any) => a.no);
  ok(x.st >= 400 || (gorunen.length === 1 && gorunen[0] === 3), `dış kişi akışta yalnız kendi adımını görür (${x.st}: ${gorunen.join(",")})`);
  x = await api("GET", `/api/v1/cikti/${cikti?.id}?akis=${kod}`, "dv_ad");
  ok(x.st === 403 && !x.metin.includes(`${IZ} içerik`), "dış kişi ekibe özel çıktıyı okuyamaz");
  const [dosya2] = await db.insert("dosya", [{ ws_id: A.id, akis_id: akis.id, adim_no: 2, yol: `${A.id}/y.pdf`, ad: "y.pdf", tur: "application/pdf", boyut: 10, durum: "yuklendi" }]);
  x = await api("GET", `/api/v1/dosya/${dosya2.id}`, "dv_ad");
  ok(x.st === 403, "dış kişi başkasının adımındaki dosyayı indiremez");

  // sahibin iptali en sonda: kendi alanındaki anahtarı iptal edebilir
  x = await api("POST", `/api/v1/anahtar/${anahtarA}/iptal`, "dv_a");
  ok(x.st === 200 && String(T.anahtar.find((k) => k.id === anahtarA)?.token_hash).startsWith("iptal:"), "sahip kendi alanındaki anahtarı iptal eder");

  console.log(hata ? `✗ yetki matrisi: ${hata} hata` : `✓ yetki matrisi: ${capraz.length} çapraz yazma/okuma, 13 liste, 8 MCP aracı, ${rol.length * 3 - 1} rol hücresi, bağlantı kapsamı`);
})();
