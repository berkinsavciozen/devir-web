import { kisaAdim, kisaAkis, tekillestir, kisaAdGecerli, adimKisaAdlari, KISA_AD_EN_COK } from "../ad.ts";
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

// P1-F: akış ve adımın kısa adı. Arayüz kesmez; sunucu kayıtlı ya da LLM'siz kuralla üretilmiş tekil kısa ad verir.
const CANLI: [string, string][] = [
  ["Geçici teminat mektubunu bankadan Halkbank şubesinden al","Geçici teminat mektubunu al"],
  ["Geçici teminat mektubunun iadesini idareden yazıyla al","Geçici teminat iadesini al"],
  ["Montaj planını yap ve montaja başla","Montaj planını yap ve montaja başla"],
  ["Komisyon koşullarını teyit et ve çiftçi teklif paketini hazırla","Komisyon koşullarını teyit et"],
  ["Dış ses-ışık firmasından teklif al ve otel teknik uygunluğunu teyit et","Dış ses-ışık firmasından teklif al"],
  ["Netleştir: Offsite bütçesi için ayrıca yönetici/finans onayı gerekiyor mu?","Yönetici/finans onayı?"],
  ["Mali müşavirle kuruluş görüşmesi: şirket türü, SGK, vergi, e-fatura","Mali müşavirle kuruluş görüşmesi"],
  ["M1 · Mağaza canlı: şirket, 2 tedarikçi, 20+ SKU, uçtan uca ilk siparişler","M1 · Mağaza canlı"],
  ["Dataroid sözleşmesinde yan iş / rekabet yasağı / bildirim maddelerini kontrol et","Bildirim maddelerini kontrol et"],
  ["Davetli listesini ve iletişim bilgilerini topla","İletişim bilgilerini topla"],
  ["Ara test 1: 5 km tempo koşusu ve program güncelleme","Ara test 1"],
  ["Hepsiburada mağazasını aç ve kazanan SKU'ları taşı","Hepsiburada mağazasını aç"],
];
const UZUN = [
  "Üretici kendi markalı ilk partiyi üretip teslim eder (private label kararı evetse)",
  "Vergi kaydı olmayan çiftçiler için makbuz ve belge modelini mali müşavirle netleştir",
  "Tedarikçiler sipariş alma, barkodla aynı gün sevk ve stok bildirim akışını kurar",
  "Netleştir: Davetlilerin çoğu İzmir dışından gelecek ve konaklama/ulaşımı biz mi karşılayacağız?",
  "Dataroid sözleşmesinde yan iş / rekabet yasağı / bildirim maddelerini kontrol et",
  "Kendi markalı hero ürün (private label) — nakit izin verirse",
];

(async () => {
  for (const [ad, k] of CANLI) ok(kisaAdim(ad) === k, `adım: "${ad}" → "${k}" (${kisaAdim(ad)})`);
  for (const ad of UZUN) { const k = kisaAdim(ad); ok(kisaAdGecerli(k) && k.length <= KISA_AD_EN_COK, `uzun ad sığar, üç noktasız: "${k}"`); }
  ok(kisaAkis("Belediye park aydınlatma ihalesi: teklif, sonuç ve sözleşme/itiraz") === "Belediye park aydınlatma ihalesi", "akış: varlığı uzun başlık");
  ok(kisaAkis("Hasat: Karadeniz'den 5 çiftçi kazanımı (en az 3'ü faturalı, kooperatif ağırlıklı)") === "Hasat çiftçi kazanımı", "akış: 'Varlık: iş' başlığı");
  ok(kisaAkis("İzmir 2 günlük müşteri etkinliği (40 davetli, Aralık 2026)") === "İzmir müşteri etkinliği", "akış: özel ad korunur, sayı düşer");
  ok(kisaAkis("6 aylık koşu programı: 10 km'yi 5:30/km tempoyla rahat koşmak") === "Koşu programı", "akış: ölçü düşer");

  // çakışma: ayırt edici ön, olmazsa sıra eki; kayıtlı ad önce
  const t = tekillestir([
    { no: 1, kisa: "Karşılaştırması hazırla", ad: "Yemek/içki/servis fizibilite karşılaştırması hazırla" },
    { no: 2, kisa: "Karşılaştırması hazırla", ad: "Ses-ışık-sahne fizibilite karşılaştırması hazırla" },
  ]);
  ok(t.get(1) === "Yemek karşılaştırması hazırla" && t.get(2) === "Ses karşılaştırması hazırla", `çakışmada ayırt edici ön (${[...t.values()].join(" | ")})`);
  const t2 = tekillestir([{ no: 3, kisa: "Belge modelini netleştir", ad: "Vergi kaydı olmayan çiftçiler için belge modelini netleştir" }, { no: 9, kisa: "Belge modelini netleştir", ad: "Vergi kaydı olmayan 2 çiftçi için belge modelini netleştir" }]);
  ok(t2.get(3) === "Belge modelini netleştir" && t2.get(9) === "Belge modelini netleştir 2", "aynı önde sıra eki");
  const t3 = tekillestir([{ no: 1, kisa: "Teklif al" }, { no: 2, kisa: "Teklif al", sabit: true }]);
  ok(t3.get(2) === "Teklif al" && t3.get(1) === "Teklif al 2", "kayıtlı ad önce yer alır");
  const m = adimKisaAdlari({ baglam: { kisa_adlar: { "2": "Mektup iadesi", "3": "çok uzun bir kısa ad ki otuz karakteri geçiyor" } } }, [{ no: 1, ad: "Geçici teminat mektubunu bankadan al" }, { no: 2, ad: "Geçici teminat mektubunun iadesini al" }, { no: 3, ad: "Ara test 1: 5 km tempo koşusu ve program güncelleme" }]);
  ok(m.get(2) === "Mektup iadesi" && m.get(3) === "Ara test 1", "geçersiz kayıtlı ad yok sayılır, geçerli olan kullanılır");
  ok(!kisaAdGecerli("Teklifi hazırla ve") && !kisaAdGecerli("Üretici kendi…") && kisaAdGecerli("Teklifi hazırla"), "geçerlilik: bağlaç ve üç nokta");

  // uçtan uca: kurulumda yazılır, api döner, düzeltilir, eklenen adım tekil
  const [ws] = await db.insert("kullanici", [{ ad: "Test alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") }, { kullanici_id: ws.id, kisi: "Dış", rol: "dis", token_hash: await sha("dv_dis") }]);
  const r = await mcp("devir_akis_olustur", { baslik: "Belediye park aydınlatma ihalesi: teklif, sonuç ve sözleşme/itiraz", hedef_tarih: "2026-12-20", adimlar: [
    { ad: "Geçici teminat mektubunu bankadan Halkbank şubesinden al", sahip: "Berkin", kriter: "mektup", sure_tahmin_gun: 2 },
    { ad: "Geçici teminat mektubunun iadesini idareden yazıyla al", sahip: "Berkin", kriter: "iade", sure_tahmin_gun: 1, bagimli: [1] },
    { ad: "Teklif dosyasını hazırla ve EKAP'tan ver", kisa_ad: "EKAP teklifi ver", sahip: "Berkin", kriter: "teklif", sure_tahmin_gun: 2, bagimli: [1] },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];
  const akis = T.akis.find((a) => a.kisa_kod === kod);
  ok(akis.baglam.kisa_ad === "Belediye park aydınlatma ihalesi", "kurulumda akış kısa adı yazılır");
  ok(akis.baglam.kisa_adlar["1"] === "Geçici teminat mektubunu al" && akis.baglam.kisa_adlar["2"] === "Geçici teminat iadesini al" && akis.baglam.kisa_adlar["3"] === "EKAP teklifi ver", "kurulumda adım kısa adları yazılır, verilen korunur");
  const d = (await api("GET", `/api/v1/akis/${kod}`)).j;
  ok(JSON.stringify(d).includes('"kisa_ad":"Belediye park aydınlatma ihalesi"'), "api akış kısa adı");
  const ad = (await api("GET", `/api/v1/akis/${kod}/adim/2`)).j;
  ok(JSON.stringify(ad).includes('"kisa_ad":"Geçici teminat iadesini al"') && JSON.stringify(ad).includes('"ad":"Geçici teminat mektubunun iadesini idareden yazıyla al"'), "adım detayı kısa ve tam adı birlikte döner");
  const g = (await api("GET", "/api/v1/gorevler?kisi=hepsi")).j;
  ok(g.gorevler.every((x: any) => x.kisa_ad && x.akis_kisa_ad === "Belediye park aydınlatma ihalesi"), "görevlerde adım ve akış kısa adı");
  const h1 = await mcp("devir_adim_guncelle", { akis: kod, no: 3, kisa_ad: "Geçici teminat mektubunu al" });
  ok(/1\. adımın kısa adı/.test(h1), "düzeltme: akışta tekil olmalı");
  const h2 = await mcp("devir_adim_guncelle", { akis: kod, no: 3, kisa_ad: "Teklif dosyasını hazırla ve" });
  ok(/en çok 40 karakter/.test(h2), "düzeltme: bağlaçla biten ad reddedilir");
  await mcp("devir_adim_guncelle", { akis: kod, no: 3, kisa_ad: "Teklif dosyasını ver" });
  ok(T.akis.find((a) => a.kisa_kod === kod).baglam.kisa_adlar["3"] === "Teklif dosyasını ver", "düzeltme kaydedilir");
  await mcp("devir_adim_ekle", { akis: kod, ad: "Geçici teminat mektubunu bankadan Halkbank şubesinden al", sahip: "Berkin", kriter: "ikinci mektup", neden: "ikinci kalem" });
  const ka = T.akis.find((a) => a.kisa_kod === kod).baglam.kisa_adlar;
  ok(ka["4"] && ka["4"] !== ka["1"], `eklenen adımın kısa adı tekil (${ka["4"]})`);
})();
