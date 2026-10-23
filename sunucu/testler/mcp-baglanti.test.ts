// 0.24.0 testleri (UAJY, TRHB vakaları): MCP dış bağlantıyı yanıtta verir, devir_baglanti, ad benzerliğinden kişi birleştirme.
import { handle } from "../server.ts";
import { sifreKur, karma } from "../baglanti.ts";
import { adTabani } from "../core.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-23T15:00:00+03:00");
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "anahtar", "kullanici", "kisi", "katilimci", "uye"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(t === "adim" ? { durum: "sirada", ciktilar: [] } : t === "akis" ? { durum: "aktif", kurallar: {}, baglam: {} } : {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const WEB = "https://devir.ornek.dev";

(async () => {
  const sifre = (await sifreKur(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64")))!;
  const ek: any = { taban: B, sifre };
  async function mcp(name: string, args: any, anahtar = "dv_sahip") {
    NOW += 11 * 6e4; // doğal tekrar penceresinin (10 dk) dışında
    const r = await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${anahtar}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, ek);
    const j = await r.json();
    return { text: j.result.content[0].text as string, hata: !!j.result.isError };
  }
  async function ac(belirtec: string) {
    NOW += 6e4;
    const r = await handle(new Request(B + "/l", { headers: { "x-devir-baglanti": belirtec } }), db, NOW, ek);
    return { st: r.status, j: await r.json() };
  }
  const belirtecler = (t: string) => [...new Set([...t.matchAll(/\/l#([a-z0-9]+)/g)].map((m) => m[1]))];
  const [ws] = await db.insert("kullanici", [{ ad: "Bağlantı alanı" }]);
  await db.insert("anahtar", [
    { kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await karma("dv_sahip") },
    { kullanici_id: ws.id, kisi: "Mert Usta", rol: "dis", kapsam: "Mert Usta", token_hash: await karma("dv_dis") },
  ]);

  ok(adTabani("Mert (Gümrük Müşaviri (Mert))") === "mert" && adTabani("Mert Usta") === "mert usta", "adTabani iç içe parantezi atar");

  // UAJY: katilimcilar ile kurulan akışın yanıtında bağlantı ve hazır mesaj
  let r = await mcp("devir_akis_olustur", { baslik: "İzmir kahve dükkanı açılışı", hedef_tarih: "2027-02-15", adimlar: [
    { ad: "Dükkanları teknik incele", sahip: "Mert Usta", sahip_tip: "dis", kriter: "rapor", sure_tahmin_gun: 2 },
    { ad: "Ruhsat kontrolü", sahip: "Berkin", sahip_tip: "insan", kriter: "kontrol", sure_tahmin_gun: 1 },
    { ad: "Tadilat projesi", sahip: "Mert Usta", sahip_tip: "dis", kriter: "proje", sure_tahmin_gun: 5, bagimli_no: [1] },
    { ad: "Şirket kuruluşu", sahip: "Ayşe Hanım", sahip_tip: "dis", kriter: "vergi levhası", sure_tahmin_gun: 3 },
  ], katilimcilar: [{ ad: "Mert Usta", rol: "tadilat ustası" }, { ad: "Ayşe Hanım", rol: "muhasebeci" }] });
  const kod = /oluşturuldu: (\w+)/.exec(r.text)![1];
  let tk = belirtecler(r.text);
  ok(/Dış bağlantılar/.test(r.text) && tk.length === 2, "akış kurulunca iki katılımcının bağlantısı yanıtta");
  ok(/- Mert Usta \(tadilat ustası\) · 2 adım: 1, 3/.test(r.text) && /Hazır mesaj: Merhaba Mert Usta, İzmir kahve dükkanı açılışı için/.test(r.text), "kişi başına adım sayısı ve hazır mesaj");
  ok(r.text.includes(`${B}/l#${tk[0]}`), "web adresi yoksa sunucu adresi taban olur");
  let x = await ac(tk[0]);
  ok(x.st === 200 && x.j.adimlar.length === 2 && x.j.adimlar.every((a: any) => a.ad !== "Ruhsat kontrolü"), "Mert'in bağlantısı yalnız onun iki adımını açar");
  ok(T.katilimci.every((k) => !k.link_token && k.link_sifreli), "belirteç düz saklanmaz");

  // devir_akis: aynı bağlantılar, web adresiyle
  await db.insert("ayar", [{ anahtar: "web_adresi", deger: WEB + "/" }]);
  r = await mcp("devir_akis", { akis: kod });
  const tk2 = belirtecler(r.text);
  ok(tk2.length === 2 && tk2[0] === tk[0] && r.text.includes(`${WEB}/l#${tk[0]}`), "devir_akis aynı bağlantıyı web adresiyle verir");
  r = await mcp("devir_akis", { akis: kod }, "dv_dis");
  ok(!r.hata && belirtecler(r.text).length === 0 && !/Dış bağlantılar/.test(r.text), "dış anahtar bağlantı görmez");

  // devir_baglanti: yeni kişi, var olan kişi, yenileme, yetki
  r = await mcp("devir_baglanti", { akis: kod, ad: "Mert Usta" });
  ok(!r.hata && /zaten katılımcı/.test(r.text) && belirtecler(r.text)[0] === tk[0], "var olan katılımcı: bağlantı değişmez");
  r = await mcp("devir_baglanti", { akis: kod, ad: "Mert Usta", yenile: true });
  const yeni = belirtecler(r.text)[0];
  ok(!r.hata && yeni && yeni !== tk[0] && (await ac(tk[0])).st === 404 && (await ac(yeni)).st === 200, "yenile: eski bağlantı kapanır, yenisi açılır");
  ok(T.olay.some((e) => e.veri?.tur === "baglanti_yenile"), "yenileme olay kaydına düşer");
  r = await mcp("devir_baglanti", { akis: kod, ad: "Selin" });
  ok(!r.hata && /eklendi/.test(r.text) && /Selin · adımı yok/.test(r.text) && /bağlantı boş açılır/.test(r.text), "adımı olmayan kişi eklenir ama uyarılır");
  r = await mcp("devir_baglanti", { akis: kod, ad: "Mert Usta" }, "dv_dis");
  ok(r.hata && /yalnızca ekip/.test(r.text), "dış katılımcı bağlantı üretemez");
  r = await mcp("devir_baglanti", { akis: kod, ad: "" });
  ok(r.hata && /ad gerekli/.test(r.text), "ad zorunlu");

  // TRHB: taslak "Mert (Gümrük Müşaviri (Mert))" yazdı, katılımcı "Mert" verildi → aynı kişi
  r = await mcp("devir_akis_olustur", { baslik: "Zeytinyağı ihracatı", hedef_tarih: "2027-01-10", adimlar: [
    { ad: "Etiket kontrolü", sahip: "Mert", sahip_tip: "dis", kriter: "kontrol", sure_tahmin_gun: 1 },
    { ad: "Gümrük beyannamesi", sahip: "Mert (Gümrük Müşaviri (Mert))", sahip_tip: "dis", kriter: "beyanname", sure_tahmin_gun: 2 },
    { ad: "Banka teminatı", sahip: "Ali (Banka)", sahip_tip: "dis", kriter: "teminat", sure_tahmin_gun: 2 },
    { ad: "Navlun teklifi", sahip: "Ali (Nakliye)", sahip_tip: "dis", kriter: "teklif", sure_tahmin_gun: 2 },
  ], katilimcilar: [{ ad: "Mert" }, { ad: "Ali" }] });
  const kod2 = /oluşturuldu: (\w+)/.exec(r.text)![1];
  const ak2 = T.akis.find((a) => a.kisa_kod === kod2);
  const st = (ad: string) => T.adim.find((s) => s.akis_id === ak2.id && s.ad === ad);
  ok(st("Etiket kontrolü").sahip_kisi_id === st("Gümrük beyannamesi").sahip_kisi_id, "yalın ad ile parantezli adı aynı kişiye bağlanır");
  ok(/- Mert · 2 adım: 1, 2/.test(r.text) && (await ac(belirtecler(r.text)[0])).j.adimlar.length === 2, "Mert'in bağlantısı gümrük adımını da açar");
  ok(st("Banka teminatı").sahip_kisi_id !== st("Navlun teklifi").sahip_kisi_id, "iki parantezli ad (farklı kurum) ayrı kişi kalır");
  ok(/- Ali · adımı yok/.test(r.text) && /Adı benzeyen ama bu kişiye bağlı olmayan adım: 3 \(Ali \(Banka\)\), 4 \(Ali \(Nakliye\)\)/.test(r.text), "belirsiz yalın ad birleşmez, benzer adımlar uyarılır");
  ok(T.kisi.filter((k) => k.ws_id === ws.id && adTabani(k.ad) === "mert").length === 1, "Mert için tek kişi kaydı");

  // arşivlenen akışa bağlantı verilmez
  ak2.durum = "arsiv";
  r = await mcp("devir_baglanti", { akis: kod2, ad: "Mert" });
  ok(r.hata && /arşivde/.test(r.text), "arşivdeki akışa bağlantı yok");
})();
