import { callTool, kararAdimi } from "../core.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-14T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [] }, akis: { durum: "aktif" } };
const db: any = {
  async one(t: string, w: any) { return (T[t] || []).find((r) => match(r, w)) || null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const ctx = () => ({ db, ws: { id: "w1" }, key: { id: "k1", kisi: "Berkin", rol: "ekip" }, ua: "test", now: NOW, kanal: "oturum" } as any); // insan web oturumu: karar adımlarını tamamlayabilir
const kisa = (s: string) => s.split("\n").filter((l) => !/aç:|açmak için/.test(l)).join("\n");
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const call = async (n: string, a: any) => { NOW += 36e5; return callTool(n, a, ctx()); };
const hata = async (n: string, a: any) => { try { await call(n, a); return ""; } catch (e) { return (e as Error).message; } };
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === T.akis.find((f) => f.kisa_kod === kod).id).sort((a, b) => a.no - b.no);

// karar tespiti
ok(kararAdimi({ ad: "Komisyon oranına karar ver" }) === true, "karar adı karar sayılır");
ok(kararAdimi({ ad: "Netleştir: belediye onayı gerekiyor mu?" }) === false, "Netleştir soru adımı karar sayılmaz");
ok(kararAdimi({ ad: "Ödeme onayı gerekli mi" }) === false, "soru ekiyle biten ad karar sayılmaz");
ok(kararAdimi({ ad: "Sözleşmeyi incele", karar_kriteri: "risk düşükse imzala" }) === true, "karar_kriteri varsa karar");

(async () => {
  const r = await call("devir_akis_olustur", { baslik: "Karadeniz'den 3 çiftçi kazan", hedef_tarih: "2026-12-30", baglam: { musteri: "Hasat" }, adimlar: [
    { ad: "Aday listesini çıkar", sahip: "Berkin", kriter: "liste hazır", sure_tahmin_gun: 2 },
    { ad: "{kalem} ile görüş", sahip: "Berkin", kriter: "görüşüldü", sure_tahmin_gun: 1, bagimli: [1] },
    { ad: "Çiftçi belgeleri gönderir", sahip: "Çiftçi", sahip_tip: "dis", kriter: "belgeler geldi", sure_tahmin_gun: 3, bagimli: [2] },
    { ad: "Sözleşmeyi imzala", sahip: "Berkin", kriter: "imzalandı", sure_tahmin_gun: 1, bagimli: [3] },
    { ad: "Pilot sevkiyatı planla", sahip: "Berkin", kriter: "plan hazır", sure_tahmin_gun: 2, bagimli: [4] },
  ] });
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const r2 = await call("devir_alt_akis", { akis: ak, adimlar: [2, 3, 4], kalemler: ["Ayşe Yılmaz", "Mehmet Kaya", "Ali Demir"], kalem_turu: "çiftçi" });
  console.log("\n" + r2 + "\n");
  const kod = Object.fromEntries([...r2.matchAll(/([A-ZÇĞİÖŞÜa-zçğıöşü ]+): (\w{4})/g)].map((m) => [m[1].trim(), m[2]]));
  ok(Object.keys(kod).length === 3, "3 alt akış kuruldu");
  const ay = kod["Ayşe Yılmaz"];
  const c1 = adimlar(ay);
  ok(c1.length === 3 && c1[0].ad === "Ayşe Yılmaz ile görüş" && c1[1].sahip === "Ayşe Yılmaz" && c1[1].sahip_tip === "dis", "kalem adı ve sahibi yerine kondu");
  ok(c1[0].durum === "sirada", "alt akış üstteki 1. adım bitmeden kapalı");
  ok((await hata("devir_adim_guncelle", { akis: ay, no: 1, durum: "suruyor" })).includes("üst akış"), "üst ön koşul bitmeden başlatılamaz");
  ok((await hata("devir_adim_guncelle", { akis: ak, no: 2, durum: "tamam" })).includes("alt akışlarda"), "özet adım doğrudan güncellenemez");
  await call("devir_adim_guncelle", { akis: ak, no: 1, durum: "tamam", not: "liste hazır", kim_tip: "insan" });
  ok(adimlar(ay)[0].durum === "hazir", "üst 1. adım bitince alt akışlar açıldı");
  // Ayşe tamamen biter
  for (const n of [1, 2, 3]) await call("devir_adim_guncelle", { akis: ay, no: n, durum: "tamam", not: "ok", kim_tip: "insan" });
  let p = adimlar(ak);
  ok(p[1].durum === "suruyor" && p[1].ilerleme === "1/3 çiftçi tamam", `üst 2. adım sürüyor, ilerleme: ${p[1].ilerleme}`);
  // Mehmet engelli
  const me = kod["Mehmet Kaya"];
  await call("devir_adim_guncelle", { akis: me, no: 1, durum: "tamam", not: "görüştük", kim_tip: "insan" });
  await call("devir_adim_guncelle", { akis: me, no: 2, durum: "engelli", engel: "vergi levhası eksik" });
  console.log("\n" + kisa(await call("devir_akis", { akis: ak })) + "\n");
  console.log(await call("devir_akislar", {}));
  // Ali vazgeçti → atlandı; Mehmet biter
  const al = kod["Ali Demir"];
  for (const n of [1, 2, 3]) await call("devir_adim_guncelle", { akis: al, no: n, durum: "atlandi", not: "çiftçi vazgeçti", atlama_nedeni: "gerek_kalmadi" });
  for (const n of [2, 3]) await call("devir_adim_guncelle", { akis: me, no: n, durum: "tamam", not: "ok", kim_tip: "insan" });
  p = adimlar(ak);
  ok(p.slice(1, 4).every((s) => s.durum === "tamam"), "tüm kalemler bitince özet adımlar tamam");
  ok(p[4].durum === "hazir", "sonraki adım (sevkiyat) açıldı");
  // sonradan kalem ekle → özet adımlar yeniden açılır
  const r3 = await call("devir_alt_akis", { akis: ak, kalemler: ["Fatma Şahin"] });
  p = adimlar(ak);
  ok(p[1].durum !== "tamam" && p[4].durum === "sirada", `yeni kalem eklenince özet adım yeniden açıldı (${p[1].durum}), sevkiyat yeniden bekliyor (${p[4].durum})`);
  const fa = /Fatma Şahin: (\w+)/.exec(r3)![1];
  for (const n of [1, 2, 3]) await call("devir_adim_guncelle", { akis: fa, no: n, durum: "tamam", not: "ok", kim_tip: "insan" });
  await call("devir_adim_guncelle", { akis: ak, no: 5, durum: "tamam", not: "plan", kim_tip: "insan" });
  const kap = await call("devir_akis_kapat", { akis: ak });
  ok(T.akis.filter((f) => f.baglam?.ust_akis).every((f) => f.durum === "kapandi"), "üst akış kapanınca alt akışlar da kapandı");
  ok(/kapandı/.test(kap), "üst akış kapandı");
})();
