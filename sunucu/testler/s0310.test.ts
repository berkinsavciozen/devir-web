// 0.31.0 (5 Kas, Berkin): akışı arşive at / arşivden geri al ve yeniden adlandır (MCP + web API).
import { callTool, TOOLS } from "../core.ts";
import { apiYonlendir } from "../api.ts";

let idc = 1;
const T: Record<string, any[]> = { akis: [], adim: [], olay: [] };
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-05T09:00:00+03:00");
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const out = rows.map((r) => ({ id: idc++, created_at: new Date(NOW).toISOString(), ...r })); T[t].push(...out); return out; },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };
const ws = { id: "w-0310", ad: "Test" };
const ctx = (rol = "sahip") => ({ db, ws, key: { id: "k1", kisi: "Berkin", rol }, ua: "test", now: (NOW += 6e4), kanal: "mcp" }) as any;
const akis = (kod: string, ek: any = {}) => { const a = { id: `id-${kod}`, kisa_kod: kod, sahip_id: ws.id, baslik: `${kod} başlığı`, durum: "aktif", kapandi_at: null, kurallar: {}, baglam: { kisa_ad: `${kod} kısa` }, created_at: new Date(NOW).toISOString(), ...ek }; T.akis.push(a); T.adim.push({ id: `s-${kod}`, akis_id: a.id, no: 1, ad: "İş", sahip: "Berkin", sahip_tip: "insan", durum: "hazir", ciktilar: [], bagimli: [], durum_at: a.created_at }); return a; };
const A = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);

(async () => {
  ok("MCP araç listesinde arşivle ve adlandır var", ["devir_akis_arsivle", "devir_akis_adlandir"].every((n) => (TOOLS as any[]).some((t) => t.name === n)));

  akis("AR1");
  let r = await callTool("devir_akis_arsivle", { akis: "AR1" }, ctx());
  ok("aktif akış arşive gider", A("AR1").durum === "arsiv" && A("AR1").baglam.arsiv?.onceki === "aktif", A("AR1"));
  ok("arşiv kapanış tarihi yazmaz", A("AR1").kapandi_at == null);
  ok("yanıt geri alma yolunu söyler", /geri_al: true/.test(r), r);
  ok("olay guncelleme/arsiv", T.olay.some((o) => o.akis_id === "id-AR1" && o.tip === "guncelleme" && o.veri.tur === "arsiv"));
  ok("ikinci kez arşivlenmez", /zaten arşivde/.test(await hata(() => callTool("devir_akis_arsivle", { akis: "AR1" }, ctx()))));
  r = await callTool("devir_akislar", {}, ctx());
  ok("aktif listede arşivdeki yok", !/AR1/.test(r), r);
  r = await callTool("devir_akislar", { durum: "arsiv" }, ctx());
  ok("arşiv listesi arşivdekini gösterir", /Arşivdeki akışlar \(1\)/.test(r) && /AR1/.test(r) && /arşivde/.test(r), r);
  r = await callTool("devir_akis_arsivle", { akis: "AR1", geri_al: true }, ctx());
  ok("geri alınca aktif olur, arşiv kaydı silinir", A("AR1").durum === "aktif" && !("arsiv" in A("AR1").baglam) && A("AR1").baglam.kisa_ad === "AR1 kısa", A("AR1"));
  ok("arşivde olmayan geri alınmaz", /arşivde değil/.test(await hata(() => callTool("devir_akis_arsivle", { akis: "AR1", geri_al: true }, ctx()))));

  // kapanmış akış arşive gider, geri alınınca kapanmış kalır
  akis("AR2", { durum: "kapandi", kapandi_at: "2026-11-01T10:00:00Z" });
  await callTool("devir_akis_arsivle", { akis: "AR2" }, ctx());
  await callTool("devir_akis_arsivle", { akis: "AR2", geri_al: true }, ctx());
  ok("kapanan akış geri alınınca kapandı kalır", A("AR2").durum === "kapandi" && A("AR2").kapandi_at === "2026-11-01T10:00:00Z", A("AR2"));

  // iptal edilip arşive düşmüş akış geri alınınca yeniden açılır
  akis("AR3", { durum: "arsiv", kapandi_at: "2026-11-02T10:00:00Z", baglam: { kisa_ad: "AR3 kısa", kapanis_nedeni: "iptal" } });
  r = await callTool("devir_akis_arsivle", { akis: "AR3", geri_al: true }, ctx());
  ok("iptal arşivi geri alınınca aktif, kapanış temizlenir", A("AR3").durum === "aktif" && A("AR3").kapandi_at == null && !A("AR3").baglam.kapanis_nedeni, A("AR3"));
  ok("iptal kararları uyarısı", /kararlar kendiliğinden geri gelmez/.test(r), r);

  // alt akışlar üstle birlikte
  akis("AK1", { baglam: { kisa_ad: "Kalem 1", ust_akis: "id-UST", ust_kod: "UST" } });
  akis("UST", { baglam: { kisa_ad: "Üst", alt_gruplar: [{ id: "G1", adimlar: [1], kalem_turu: "kalem", kalemler: [{ ad: "Kalem 1", akis_id: "id-AK1", kod: "AK1" }] }] } });
  ok("alt akış tek başına arşivlenmez", /alt akış/.test(await hata(() => callTool("devir_akis_arsivle", { akis: "AK1" }, ctx()))));
  await callTool("devir_akis_arsivle", { akis: "UST" }, ctx());
  ok("alt akış üstle arşive gider", A("AK1").durum === "arsiv" && A("UST").durum === "arsiv");
  await callTool("devir_akis_arsivle", { akis: "UST", geri_al: true }, ctx());
  ok("alt akış üstle geri döner", A("AK1").durum === "aktif" && A("UST").durum === "aktif");

  // yeniden adlandırma
  r = await callTool("devir_akis_adlandir", { akis: "AR1", ad: "  Yoga   stüdyosu açılışı " }, ctx());
  ok("ad aynen yazılır, kısa ad da", A("AR1").baslik === "Yoga stüdyosu açılışı" && A("AR1").baglam.kisa_ad === "Yoga stüdyosu açılışı", A("AR1"));
  ok("ad olayı eski adı tutar", T.olay.some((o) => o.akis_id === "id-AR1" && o.veri.tur === "ad" && o.veri.eski === "AR1 başlığı"));
  const uzun = "Kadıköy şubesi için yeni yoga stüdyosu açılış hazırlıkları ve tanıtım planı";
  await callTool("devir_akis_adlandir", { akis: "AR1", ad: uzun }, ctx());
  ok("uzun ad başlığa, kısa adı 40'a sığar", A("AR1").baslik === uzun && A("AR1").baglam.kisa_ad.length <= 40 && A("AR1").baglam.kisa_ad.length > 0, A("AR1").baglam.kisa_ad);
  ok("boş ad reddedilir", /ad gerekli/.test(await hata(() => callTool("devir_akis_adlandir", { akis: "AR1", ad: "  " }, ctx()))));
  ok("dış katılımcı arşivleyemez", /ekip üyeleri/.test(await hata(() => callTool("devir_akis_arsivle", { akis: "AR1" }, ctx("dis")))));
  ok("dış katılımcı adlandıramaz", /ekip üyeleri/.test(await hata(() => callTool("devir_akis_adlandir", { akis: "AR1", ad: "x" }, ctx("dis")))));

  // web API: POST /akis/:kod/arsiv ve /akis/:kod/ad güncel kartı döner
  const taban = { fn: "https://x/fn", link: "https://x/l" };
  const web = () => ({ ...ctx(), kanal: "oturum" });
  let v: any = await apiYonlendir(web(), "POST", ["akis", "AR2", "arsiv"], new URLSearchParams(), {}, taban);
  ok("API arşivler ve kart arşivde döner", v.akis?.durum === "arsiv" && /arşive taşındı/.test(v.mesaj), v.akis?.durum);
  v = await apiYonlendir(web(), "POST", ["akis", "AR2", "arsiv"], new URLSearchParams(), { geri_al: true }, taban);
  ok("API geri alır", v.akis?.durum === "kapandi", v.akis?.durum);
  v = await apiYonlendir(web(), "POST", ["akis", "AR2", "ad"], new URLSearchParams(), { ad: "Yeni ad" }, taban);
  ok("API adlandırır, kartta kısa ad", v.akis?.kisa_ad === "Yeni ad" && v.akis?.baslik === "Yeni ad", v.akis);

  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.31.0 testleri geçti");
  if (hata0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
