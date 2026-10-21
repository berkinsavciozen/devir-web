// N-3 testleri: dış bağlantı belirteci veritabanında düz durmaz (karma + AES-GCM), adres yolunda gitmez, sahip yine kopyalayabilir.
import { handle } from "../server.ts";
import { sifreKur, karma, bekleyenleriSifrele } from "../baglanti.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-21T09:00:00+03:00");
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "anahtar", "kullanici", "kisi", "katilimci"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(t === "adim" ? { durum: "sirada", ciktilar: [] } : t === "akis" ? { durum: "aktif", kurallar: {}, baglam: {} } : {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const sha = (s: string) => karma(s);
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const anahtarUret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");

(async () => {
  const sifre = (await sifreKur(anahtarUret()))!;
  const baskaSifre = (await sifreKur(anahtarUret()))!;
  const ek: any = { taban: B, sifre };
  async function api(method: string, path: string, body?: any, e = ek) {
    NOW += 6e4;
    const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer dv_sahip" }, body: body ? JSON.stringify(body) : undefined }), db, NOW, e);
    return { st: r.status, j: await r.json() };
  }
  async function ac(belirtec: string, e = ek) {
    NOW += 6e4;
    const r = await handle(new Request(B + "/l", { headers: { "x-devir-baglanti": belirtec } }), db, NOW, e);
    return { st: r.status, j: await r.json() };
  }
  ok(await sifreKur("kisa") === null && await sifreKur("") === null, "geçersiz anahtar sunucuyu düşürmez (düz saklamaya düşülür)");

  const [ws] = await db.insert("kullanici", [{ ad: "Bağlantı alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") }]);
  // eski satır: düz belirteç, karma yok (0.14.0 ve öncesi)
  NOW += 6e4;
  const r = await handle(new Request(B + "/dv_sahip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "devir_akis_olustur", arguments: { baslik: "Bağlantı akışı", hedef_tarih: "2026-11-20", adimlar: [{ ad: "Belge gönder", sahip: "Emre", sahip_tip: "dis", kriter: "belge", sure_tahmin_gun: 1 }, { ad: "Fatura gönder", sahip: "Ayten", sahip_tip: "dis", kriter: "fatura", sure_tahmin_gun: 1 }] } } }) }), db, NOW, { taban: B });
  const kod = /oluşturuldu: (\w+)/.exec((await r.json()).result.content[0].text)![1];
  const akis = T.akis[0];
  await db.insert("katilimci", [{ akis_id: akis.id, ad: "Ayten", link_token: "eskibelirtec0000000000000" }]);

  // yeni bağlantı: veritabanında düz belirteç yok
  let x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Emre" });
  const link = x.j.katilimci.link as string, t = link.split("/l#")[1];
  const satir = T.katilimci.find((k) => k.ad === "Emre");
  ok(x.st === 200 && !!t && satir.link_token == null && satir.link_hash === await sha(t) && satir.link_sifreli?.startsWith("v1:") && !satir.link_sifreli.includes(t), "yeni bağlantının belirteci veritabanında düz durmaz (karma + şifreli)");
  ok(link.includes("/l#") && !link.includes("/l/"), "bağlantı adresinde belirteç # parçasında");
  x = await ac(t);
  ok(x.st === 200 && x.j.adimlar.length === 1, "şifreli bağlantı karmayla açılır");

  // sahip yine kopyalayabilir
  x = await api("GET", `/api/v1/akis/${kod}/katilimcilar`);
  ok(x.j.katilimcilar.find((k: any) => k.ad === "Emre")?.link === link, "sahip bağlantıyı yeniden kopyalayabilir (şifre çözülür)");

  // eski düz satır: ilk istekte şifrelenir, bağlantı açılmaya devam eder
  const eski = T.katilimci.find((k) => k.ad === "Ayten");
  ok(eski.link_token == null && eski.link_hash === await sha("eskibelirtec0000000000000") && !!eski.link_sifreli, "eski düz belirteç sunucu açılışında şifrelendi");
  x = await ac("eskibelirtec0000000000000");
  ok(x.st === 200, "şifrelenen eski bağlantı açılmaya devam eder");
  x = await api("GET", `/api/v1/akis/${kod}/katilimcilar`);
  ok(x.j.katilimcilar.find((k: any) => k.ad === "Ayten")?.link.endsWith("#eskibelirtec0000000000000"), "eski bağlantı sahibin listesinde aynı adresle görünür");

  // yenile: eski belirteç kapanır, yeni belirteç de şifreli
  const id = x.j.katilimcilar.find((k: any) => k.ad === "Emre").id;
  x = await api("POST", `/api/v1/katilimci/${id}/yenile`, {});
  const t2 = x.j.katilimci.link.split("/l#")[1];
  ok(t2 !== t && (await ac(t)).st === 404 && (await ac(t2)).st === 200, "yenilenen bağlantıda eski belirteç kapanır, yenisi açılır");
  ok(T.katilimci.find((k) => k.id === id).link_token == null, "yenilenen belirteç de düz saklanmaz");

  // yanlış anahtar: bağlantı gösterilmez ama açılmaya devam eder (arama karmayla)
  x = await api("GET", `/api/v1/akis/${kod}/katilimcilar`, undefined, { taban: B, sifre: baskaSifre });
  ok(x.j.katilimcilar.every((k: any) => k.link === null), "anahtar değişirse bağlantı gösterilmez (yenilenebilir), sunucu çökmez");
  ok((await ac(t2, { taban: B, sifre: baskaSifre })).st === 200, "anahtar değişse de dışarıdaki bağlantı açılır");

  // anahtarsız sunucu (yükleme sırası): yeni bağlantı karma + düz belirteçle çalışır
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Selim" }, { taban: B });
  const t3 = x.j.katilimci.link.split("/l#")[1];
  ok(T.katilimci.find((k) => k.ad === "Selim").link_hash === await sha(t3) && (await ac(t3, { taban: B })).st === 200, "anahtar yokken bağlantı karmayla çalışır");
  ok(await bekleyenleriSifrele(db, sifre) === 1 && T.katilimci.every((k) => k.link_token == null), "anahtar gelince kalan düz belirteçler şifrelenir");
})();
