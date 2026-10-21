// P0-0 güvenlik testleri (audit S-B2, S-C1, S-C3, N-7): ad eşleşmesi (S-B2), aktör kimliği ve agent kararı (S-C1), sahip-yalnız eylemler (S-C3).
import { adEslesir, norm } from "../core.ts";
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
async function mcp(name: string, args: any, token = "dv_sahip") {
  NOW += 36e5;
  const r = await handle(new Request(B + "/" + token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, { taban: B });
  return (await r.json()).result.content[0].text as string;
}

const adim = (no: number) => T.adim.find((s) => s.no === no);
const sonOlay = (no: number) => [...T.olay].reverse().find((e) => e.adim_no === no && e.tip !== "okuma");

(async () => {
  // birim: ad eşleşmesi alt dizge değil, tam ad (S-B2)
  ok(!adEslesir("Mehmet Ali", norm("Ali")), "ali_mehmet_ali: 'Ali' 'Mehmet Ali'yi kapsamaz");
  ok(adEslesir("Ali", norm("ali")), "aynı ad eşleşir (büyük/küçük harf farkı yok)");
  ok(!adEslesir("Şampirellam (sevgilisi yardım ediyor)", norm("Sevgili")), "parantezli_sahip: 'Sevgili' canlıdaki parantezli adımı kapsamaz");
  ok(adEslesir("Ayşe (Kaya Mali Müşavirlik)", norm("Ayşe")) && adEslesir("Ayşe (Kaya Mali Müşavirlik)", norm("Kaya Mali Müşavirlik")), "parantezli_sahip: ad ya da kurumun tam adı eşleşir");
  ok(adEslesir("ÇAĞRI IŞIK", norm("çağrı ışık")) && !adEslesir("Çağrı Işıkçı", norm("Çağrı Işık")), "turkce_karakter: Türkçe büyük harf eşleşir, ek almış ad eşleşmez");

  const [ws] = await db.insert("kullanici", [{ ad: "Test alanı" }]);
  await db.insert("anahtar", [
    { kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") },
    { kullanici_id: ws.id, kisi: "Zeynep", rol: "ekip", token_hash: await sha("dv_ekip") },
    { kullanici_id: ws.id, kisi: "Ali", rol: "dis", kapsam: "Ali", token_hash: await sha("dv_dis") },
  ]);
  const r = await mcp("devir_akis_olustur", { baslik: "Güvenlik akışı", hedef_tarih: "2026-11-20", adimlar: [
    { ad: "Aday listesi", sahip: "Berkin", kriter: "liste", sure_tahmin_gun: 1 },
    { ad: "Belgeleri gönder", sahip: "Mehmet Ali", sahip_tip: "dis", kriter: "belge", sure_tahmin_gun: 1 },
    { ad: "Faturayı gönder", sahip: "Ali", sahip_tip: "dis", kriter: "fatura", sure_tahmin_gun: 1 },
    { ad: "Komisyon oranına karar ver", sahip: "Berkin", kriter: "karar", sure_tahmin_gun: 1, bagimli: [1] },
    { ad: "Teklife karar ver", sahip: "Ali", sahip_tip: "dis", kriter: "karar", sure_tahmin_gun: 1 },
    { ad: "Hediye seç", sahip: "Şampirellam (sevgilisi yardım ediyor)", sahip_tip: "dis", kriter: "seçim", sure_tahmin_gun: 1 },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];

  // dış kapsam: bağlantı ve dış anahtar yalnız tam adla eşleşen adımı görür
  let x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Ali" });
  ok(x.j.adim_sayisi === 2, "bağlantı 'Ali': yalnız Ali'nin 2 adımı (Mehmet Ali'nin değil)");
  const l = await api("GET", `/l/${x.j.katilimci.link.split("/l/")[1]}`, undefined, "");
  ok(l.st === 200 && l.j.adimlar.every((a: any) => a.sahip !== "Mehmet Ali") && !l.j.adimlar.some((a: any) => a.no === 2), "bağlantı sayfasında Mehmet Ali'nin adımı yok");
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Sevgili" });
  ok(x.j.adim_sayisi === 0 && /adım yok/.test(x.j.uyari || ""), "bağlantı 'Sevgili': 0 adım ve uyarı");
  let m = await mcp("devir_adim_guncelle", { akis: kod, no: 2, durum: "suruyor" }, "dv_dis");
  ok(adim(2).durum !== "suruyor", "dış anahtar Mehmet Ali'nin adımını güncelleyemez");

  // aktör kimliği kimlik bilgisinden (S-C1): MCP'de kim/kim_tip yok sayılır
  m = await mcp("devir_adim_guncelle", { akis: kod, no: 1, durum: "suruyor", kim: "Zeynep", kim_tip: "insan" });
  let e = sonOlay(1);
  ok(e.kim === "Berkin" && e.kim_tip === "agent", "mcp_sahte_kimlik: kim=Zeynep, kim_tip=insan yok sayıldı (Berkin, agent)");
  x = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam", not: "liste hazır", kim: "Zeynep" });
  e = sonOlay(1);
  ok(x.st === 200 && e.kim === "Berkin" && e.kim_tip === "insan", "web isteği insan, kişi anahtardan");

  // agent kararı (S-C1): devir_adim_guncelle ile karar tamamlanamaz, devir_karar_ver gerekir
  m = await mcp("devir_adim_guncelle", { akis: kod, no: 4, durum: "tamam", not: "%10", kim_tip: "insan" });
  ok(adim(4).durum !== "tamam" && /devir_karar_ver/.test(m), "agent karar adımını devir_adim_guncelle ile kapatamaz");
  ok(sonOlay(4)?.tip === "ret" && sonOlay(4)?.kim_tip === "agent", "reddedilen deneme olay kaydında (ret)");
  m = await mcp("devir_karar_ver", { akis: kod, no: 6, not: "x" });
  ok(adim(6).durum !== "tamam" && /karar adımı değil/.test(m), "devir_karar_ver karar olmayan adımı kapatmaz");
  m = await mcp("devir_adim_guncelle", { akis: kod, no: 4, karar_secimi: ["%10"], kim_tip: "insan" });
  ok(!adim(4).karar_secimi && /devir_karar_ver/.test(m), "agent karar_secimi yazamaz");
  const list = await handle(new Request(B + "/dv_sahip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), db, NOW, {});
  const kv = (await list.json()).result.tools.find((t: any) => t.name === "devir_karar_ver");
  ok(kv?.annotations?.destructiveHint === true && kv?.annotations?.readOnlyHint === false, "devir_karar_ver araç listesinde, geri alınamaz olarak işaretli");
  const ac = (await (await handle(new Request(B + "/dv_sahip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), db, NOW, {})).json()).result.tools;
  ok(!JSON.stringify(ac.map((t: any) => t.inputSchema)).includes("kim_tip"), "araç şemalarında kim_tip yok");
  m = await mcp("devir_karar_ver", { akis: kod, no: 4, not: "Berkin %10 dedi" });
  e = sonOlay(4);
  ok(adim(4).durum === "tamam" && T.olay.some((o) => o.adim_no === 4 && o.veri?.tur === "karar_onayi" && o.kim === "Berkin" && o.veri?.kanal === "agent"), "sahibin agent'ı devir_karar_ver ile kaydeder; olayda kanal agent");
  m = await mcp("devir_karar_ver", { akis: kod, no: 5, not: "evet" }, "dv_dis");
  ok(adim(5).durum !== "tamam" && /Devir web|bağlantı/.test(m), "dış kişinin agent'ı karar veremez (beyan), web'e yönlendirilir");

  // yüksek etkili eylemler yalnız sahipte (S-C3)
  x = await api("POST", "/api/v1/karar", { varlik: "Hasat", karar: "Komisyon %10" }, "dv_ekip");
  ok(x.st >= 400 && /sahibi/.test(x.j.hata || x.j.mesaj || JSON.stringify(x.j)), "ekip çalışma alanı kararı yazamaz");
  ok(!(T.karar || []).length, "karar tablosu boş kaldı");
  m = await mcp("devir_sabitle", { akis: kod, ad: "Güvenlik" }, "dv_ekip");
  ok(/yalnızca çalışma alanının sahibi/.test(m) && !(T.standart_surec || []).length, "ekip standart süreç sabitleyemez");
  m = await mcp("devir_dersler", { islem: "onayla", ders: "D1" }, "dv_ekip");
  ok(/yalnızca çalışma alanının sahibi/.test(m), "ekip ders onaylayamaz");
  m = await mcp("devir_akis_kapat", { akis: kod, zorla: true }, "dv_ekip");
  ok(/yalnızca çalışma alanının sahibi/.test(m) && T.akis[0].durum === "aktif", "ekip bitmemiş akışı zorla kapatamaz");
  x = await api("POST", "/api/v1/karar", { varlik: "Hasat", karar: "Komisyon %10" });
  ok(x.st === 200 && T.karar.length === 1, "sahip çalışma alanı kararı yazar");
})();
