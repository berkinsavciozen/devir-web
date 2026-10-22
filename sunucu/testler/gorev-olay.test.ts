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
  const r = await mcp("devir_akis_olustur", { baslik: "Hasat Karadeniz", hedef_tarih: "2026-11-20", adimlar: [
    { ad: "Aday listesi", sahip: "Zeynep", kriter: "liste", sure_tahmin_gun: 2 },
    { ad: "Komisyon oranına karar ver", sahip: "Berkin", kriter: "karar", sure_tahmin_gun: 1, bagimli: [1] },
    { ad: "Sözleşme taslağı", sahip: "Berkin", kriter: "taslak", sure_tahmin_gun: 2, bagimli: [2] },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];
  const r2 = await mcp("devir_akis_olustur", { baslik: "Ege fuarı", hedef_tarih: "2026-12-01", adimlar: [{ ad: "Stant", sahip: "Berkin", kriter: "stant", sure_tahmin_gun: 2 }] });
  const kod2 = /oluşturuldu: (\w+)/.exec(r2)![1];

  // görevler: varsayılan oturumdaki kişi, açık işler
  let g = (await api("GET", "/api/v1/gorevler")).j;
  ok(g.suzgec.kisi === "Berkin" && g.gorevler.length === 1 && g.gorevler[0].ad === "Stant", "görevler: varsayılan kişi ve açık işler");
  g = (await api("GET", "/api/v1/gorevler?kisi=hepsi&durum=hepsi")).j;
  ok(g.gorevler.length === 4 && g.kisiler.some((k: any) => k.ad === "Zeynep" && k.acik === 1), "görevler: hepsi ve kişi sayıları");
  ok(g.gorevler[0].tuttugu === 2 || g.gorevler.find((x: any) => x.ad === "Aday listesi").tuttugu === 2, "görevler: tuttuğu");
  const kom = g.gorevler.find((x: any) => x.ad.startsWith("Komisyon"));
  ok(kom.onceki.map((x: any) => x.sahip).join() === "Zeynep" && kom.sonraki.map((x: any) => x.no).join() === "3", "görevler: kimi bekliyor, kim bekliyor");
  g = (await api("GET", `/api/v1/gorevler?kisi=hepsi&akis=${kod2}`)).j;
  ok(g.gorevler.every((x: any) => x.akis === kod2) && g.akislar.length === 2, "görevler: akış süzgeci");
  ok((await api("GET", "/api/v1/gorevler", undefined, "dv_ekip")).j.gorevler.map((x: any) => x.ad).join() === "Aday listesi", "görevler: ekip üyesinin kendi işi");

  // bildirimler: başkasının hareketi görünür, kendininki görünmez
  await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam" }, "dv_ekip");
  await api("POST", `/api/v1/akis/${kod2}/adim/1`, { durum: "suruyor" });
  let o = (await api("GET", "/api/v1/olaylar")).j;
  const z = o.olaylar.filter((e: any) => e.kim === "Zeynep");
  ok(z.length >= 1 && z[0].akis === kod && z[0].adim_ad === "Aday listesi" && !o.olaylar.some((e: any) => e.kim === "Berkin"), "olaylar: başkasının hareketi, kendininki yok");
  ok(z[0].ilgili === true, "olaylar: bekleyeni sensen ilgili");
  ok(o.okunmamis >= 1 && o.son_okunan === 0 && z[0].okundu === false, "olaylar: okunmamış sayısı");
  const enYeni = o.olaylar[0].id;
  ok((await api("POST", "/api/v1/olaylar/okundu", { son_id: enYeni })).j.son_okunan === enYeni, "okundu yazıldı");
  ok((await api("POST", "/api/v1/olaylar/okundu", { son_id: 1 })).j.son_okunan === enYeni, "okundu geri gitmez");
  o = (await api("GET", "/api/v1/olaylar")).j;
  ok(o.okunmamis === 0 && o.olaylar.every((e: any) => e.okundu), "okundu sonrası okunmamış yok");
  ok((await api("GET", "/api/v1/olaylar", undefined, "dv_ekip")).j.okunmamis >= 1, "okundu kişiye özel");
  ok((await api("POST", "/api/v1/olaylar/okundu", {})).st === 400, "okundu: son_id gerekli");

  // dış katılımcı: yalnız kendi adımları ve onlardaki olaylar
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Zeynep (Kooperatif)", rol: "dis", kapsam: "Zeynep", token_hash: await sha("dv_dis") }]);
  const gd = (await api("GET", "/api/v1/gorevler?kisi=hepsi&durum=hepsi", undefined, "dv_dis")).j;
  ok(gd.gorevler?.length > 0 && gd.gorevler.every((x: any) => x.sahip === "Zeynep") && gd.kisiler.every((k: any) => k.ad === "Zeynep"), "görevler: dış kişi yalnız kendi adımlarını görür");
  const od = (await api("GET", "/api/v1/olaylar", undefined, "dv_dis")).j;
  ok(od.olaylar?.length > 0 && od.olaylar.every((e: any) => e.adim_no != null && e.akis === kod && e.adim_no === 1), "olaylar: dış kişi başkasının adımındaki olayı görmez");

  // toplu detay
  const d = (await api("GET", `/api/v1/akislar/detay?kodlar=${kod},${kod2},YOKK`)).j;
  ok(Object.keys(d.akislar).sort().join() === [kod, kod2].sort().join() && d.akislar[kod].adimlar.length === 3, "toplu detay: var olanlar döner, olmayan atlanır");
  ok((await api("GET", "/api/v1/durum", undefined, "")).j.surum === "0.17.0", "sürüm 0.17.0");
})();
