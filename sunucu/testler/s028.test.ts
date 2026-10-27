// 0.28.0 (27 Eki arayüz planı): P3 taslakta görev → alt görev, agent sahibi, P7 referans / onay listesi / agent bağlantıları,
// P8 kişi başı aylık yapay zekâ sınırı ve Devir AI sohbeti (önizleme → Uygula).
import { handle } from "../server.ts";
import { maliyet, FIYAT, ayOf } from "../islem.ts";
import { oneriOzeti } from "../api.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-27T09:00:00+03:00");
const UUID = ["adim", "akis", "taslak", "anahtar", "kullanici", "uye", "kisi", "bekleme", "agent_baglanti", "katilimci"];
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [] }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) {
    T[t] = T[t] || [];
    if (t === "referans" && rows.some((r) => T[t].some((x) => x.kod === r.kod || x.uye_id === r.uye_id))) throw new Error("23505 duplicate");
    const now = new Date(NOW).toISOString();
    const out = rows.map((r) => ({ id: UUID.includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r }));
    T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r)));
  },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
  async delete(t: string, w: any) { T[t] = (T[t] || []).filter((r) => !match(r, w)); },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
let hata = 0;
const ok = (c: boolean, m: string, x?: unknown) => { console.log(`${c ? "✓" : "✗"} ${m}${c || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!c) hata++; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";

// ---- sahte motorlar ----
const KULLANIM = { girdi: 20000, onbellek: 0, cikti: 4000 }; // sonnet: 0.04 + 0.04 = 0.08 USD
const taslak = () => ({
  is_turu: { kod: "lansman", ad: "Lansman", mevcut: false }, baslik: "Ürün lansmanı", kisa_ad: "Ürün lansmanı", anahtar_varlik: { tur: "urun", ad: "Devir" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }, { kod: "ai", ad: "Claude", tip: "agent", arac: "Claude" }, { kod: "tas", ad: "Tasarımcı", tip: "insan", kisi: "Selin" }],
  sorular: [], varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "hedef", ad: "Lansman hedefini belirle", sahip_rol: "ben", kriter: "hedef yazılı", sure_tahmin_gun: 1, bagimli: [], boyut: "sonuc", karar_gerekli: true, cikti_bekleniyor: false },
    { id: "a2", tur_kod: "site", ad: "Lansman sayfasını yayına al", sahip_rol: "ben", kriter: "sayfa yayında", sure_tahmin_gun: 0, bagimli: ["a1", "a3"], boyut: "sonuc", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a3", tur_kod: "metin", ad: "Sayfa metnini yaz", sahip_rol: "ai", kriter: "metin hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true, ust: "a2" },
    { id: "a4", tur_kod: "gorsel", ad: "Sayfa görsellerini hazırla", sahip_rol: "tas", kriter: "görseller hazır", sure_tahmin_gun: 2, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true, ust: "a2" },
    { id: "a5", tur_kod: "alt-alt", ad: "Görselleri sıkıştır", sahip_rol: "tas", kriter: "küçük", sure_tahmin_gun: 0.5, bagimli: ["a4"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false, ust: "a4" },
    { id: "a6", tur_kod: "duyuru", ad: "Duyuruyu gönder", sahip_rol: "ben", kriter: "gönderildi", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "sonuc", karar_gerekli: false, cikti_bekleniyor: false },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "claude-sonnet-5-5", ms: 10, kullanim: KULLANIM };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "claude-haiku-5-5", ms: 5, kullanim: { girdi: 1000, onbellek: 0, cikti: 100 } };
  return { input: { tur_kod: "ek", boyut: "genel" }, model: "claude-haiku-5-5", ms: 5 };
};
// sohbet motoru: istenen araçları sırayla çağırır, sonra cevap yazar
let SENARYO: { ad: string; girdi: any }[] = [];
const SONUCLAR: string[] = [];
const sohbet = async (req: any) => {
  for (const c of SENARYO) { const r = await req.calistir(c.ad, c.girdi); SONUCLAR.push(r.metin); }
  return { metin: "Tamam.", model: "claude-haiku-5-5", kullanim: { girdi: 3000, onbellek: 0, cikti: 300 }, tur: 2 };
};
const jeton = (yuk: any) => `h.${Buffer.from(JSON.stringify(yuk)).toString("base64url")}.imza`;
const KIM: Record<string, { id: string; email: string }> = {};
const oturum = (auth: string, email: string, yuk: any = {}) => { const j = jeton({ sub: auth, ...yuk }); KIM[j] = { id: auth, email }; return j; };
const GIDEN: any[] = [];
const EK: any = { taban: B, llm, sohbet, modeller: { taslak: "claude-sonnet-5-5", hizli: "claude-haiku-5-5" }, kimlik: async (j: string) => KIM[j] || null, posta: { async girisBaglantisi(e: string, y: string | null) { GIDEN.push({ e, y }); } } };

async function api(method: string, path: string, body?: any, token = "dv_sahip") {
  NOW += 6e4;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: body ? JSON.stringify(body) : undefined }), db, NOW, EK);
  return { st: r.status, j: await r.json() };
}
async function mcp(name: string, args: any, token = "dv_sahip", ua = "Claude-User") {
  NOW += 6e4;
  const r = await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token, "user-agent": ua }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, EK);
  const j = await r.json();
  return { st: r.status, metin: (j.result?.content?.[0]?.text || j.error?.message || "") as string };
}

(async () => {
  const [ws] = await db.insert("kullanici", [{ ad: "Devir alanı" }]);
  const [uye] = await db.insert("uye", [{ kullanici_id: ws.id, auth_id: "auth-berkin", eposta: "berkin@ornek.com", kisi: "Berkin", rol: "sahip" }]);
  await db.insert("uye", [{ kullanici_id: ws.id, auth_id: "auth-dis", eposta: "dis@ornek.com", kisi: "Lab", rol: "dis", kapsam: "Lab" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip"), uye_id: uye.id }]);
  await db.insert("ayar", [{ anahtar: "web_adresi", deger: "https://devir.ornek" }]);
  const WEB = oturum("auth-berkin", "berkin@ornek.com");

  // ---------- P3: taslakta görev → alt görev ----------
  let m = await mcp("devir_tasla", { cumle: "Ürün lansmanı yapmam lazım", baglam: { varlik: "Devir", iliski: "kendi" } });
  const tkod = /\b(T[A-Z0-9]{3,})\b/.exec(m.metin)?.[1];
  ok(!!tkod, "taslak çıktı", m.metin.slice(0, 200));
  ok(/↳ 3\. Sayfa metnini yaz \(2\. adımın alt görevi\)/.test(m.metin), "taslak listesi alt görevi üstünün altında gösteriyor", m.metin.split("\n").filter((l) => /Sayfa metnini/.test(l)));
  const tv = await api("GET", `/api/v1/taslak/${tkod}`);
  ok(tv.j.adimlar?.find((x: any) => x.id === "a3")?.ust === "a2", "taslak görünümü ust alanını taşıyor");
  m = await mcp("devir_akis_olustur", { taslak: tkod, cevaplar: {} });
  const kod = /oluşturuldu: (\w+)/.exec(m.metin)?.[1]!;
  ok(!!kod, "akış kuruldu", m.metin.slice(0, 300));
  const ak = T.akis.find((a) => a.kisa_kod === kod);
  const A = (ad: string) => T.adim.find((s) => s.akis_id === ak.id && s.ad === ad);
  const site = A("Lansman sayfasını yayına al"), metin = A("Sayfa metnini yaz"), gorsel = A("Sayfa görsellerini hazırla"), sik = A("Görselleri sıkıştır"), hedef = A("Lansman hedefini belirle");
  ok(metin.ust_adim === site.no && gorsel.ust_adim === site.no, "alt görevler ana göreve bağlandı", [metin.ust_adim, gorsel.ust_adim, site.no]);
  ok(sik.ust_adim == null, "alt görevin alt görevi düzleşti (tek düzey)", sik.ust_adim);
  ok(!site.bagimli.includes(metin.no), "ana görev kendi alt görevine bağımlı kalmadı", site.bagimli);
  ok(metin.bagimli.includes(hedef.no) && gorsel.bagimli.includes(hedef.no), "alt görevler ana görevin öncülünü bekliyor", [metin.bagimli, gorsel.bagimli]);
  ok(metin.agent_sahibi === "Berkin" && !hedef.agent_sahibi, "agent adımına kurarken agent sahibi yazıldı", [metin.agent_sahibi, hedef.agent_sahibi]);
  const ad0 = await api("GET", `/api/v1/akis/${kod}/adim/${metin.no}`);
  ok(ad0.j.adim?.agent_sahibi === "Berkin" && ad0.j.adim?.ust_adim === site.no, "adım görünümü agent sahibini ve üst görevi veriyor", ad0.j.adim);

  // elle kurulan akışta geçersiz ust_adim hatadır; döngü kuran hiyerarşi reddedilir
  m = await mcp("devir_akis_olustur", { baslik: "Elle", baglam: { musteri: "Elle A.Ş." }, adimlar: [
    { ad: "Ana işi bitir", sahip: "Berkin", kriter: "bitti", sure_tahmin_gun: 0 },
    { ad: "Parçayı yap", sahip: "Berkin", kriter: "yapıldı", sure_tahmin_gun: 1, ust_adim: 1 },
    { ad: "Yanlış bağ", sahip: "Berkin", kriter: "x", sure_tahmin_gun: 1, ust_adim: 2 },
  ] });
  ok(/alt görevin alt görevi olmaz/.test(m.metin), "elle verilen iç içe ust_adim reddedildi", m.metin.slice(0, 200));
  m = await mcp("devir_akis_olustur", { baslik: "Elle 2", baglam: { musteri: "Elle B A.Ş." }, adimlar: [
    { ad: "Ana işi bitir", sahip: "Berkin", kriter: "bitti", sure_tahmin_gun: 0 },
    { ad: "Parçayı yap", sahip: "Berkin", kriter: "yapıldı", sure_tahmin_gun: 1, ust_adim: 1 },
    { ad: "Sonraki iş", sahip: "Berkin", kriter: "y", sure_tahmin_gun: 1, bagimli: [1] },
  ] });
  ok(/oluşturuldu/.test(m.metin), "elle verilen geçerli ust_adim kuruldu", m.metin.slice(0, 200));

  // ---------- agent sahibi: agent ilk yazdığında bağlantının kişisi ----------
  const ak2 = T.akis.find((a) => a.baslik === "Elle 2");
  await mcp("devir_adim_guncelle", { akis: ak2.kisa_kod, no: 3, sahip: "Claude", sahip_tip: "agent" });
  ok(T.adim.find((s) => s.akis_id === ak2.id && s.no === 3).agent_sahibi === "Berkin", "adım agent'a verilince agent sahibi yazıldı");
  await mcp("devir_adim_guncelle", { akis: ak2.kisa_kod, no: 3, agent_sahibi: "Selin" });
  ok(T.adim.find((s) => s.akis_id === ak2.id && s.no === 3).agent_sahibi === "Selin", "agent sahibi açıkça değişiyor");

  // ---------- P8: kullanım sayacı ve aylık sınır ----------
  ok(Math.abs(maliyet(FIYAT["claude-sonnet-5-5"], KULLANIM) - 0.08) < 1e-9, "maliyet: sonnet 20k girdi + 4k çıktı = 0.08 USD");
  ok(ayOf(Date.parse("2026-12-15T12:00:00+03:00")).sonraki === "2027-01-01" && ayOf(Date.parse("2026-10-31T23:30:00+03:00")).sonrakiMetin === "1 Kasım'da", "ay hesabı İstanbul saatiyle, yıl dönümü doğru");
  const kl = (T.ai_kullanim || []).filter((x) => x.kimlik === `u:${uye.id}`);
  ok(kl.some((x) => x.tur === "taslak" && Math.abs(x.usd - 0.08) < 1e-9), "taslak çağrısı kişinin sayacına yazıldı", kl.map((x) => [x.tur, x.usd]));
  let k = await api("GET", "/api/v1/kullanim");
  ok(k.j.kullanim && k.j.kullanim.oran > 0 && k.j.kullanim.oran < 1 && !("usd" in k.j.kullanim) && k.j.kullanim.yenilenme === "2026-11-01", "kullanım oran olarak dönüyor, tutar yok", k.j);

  // ---------- P8: sohbet ----------
  SENARYO = [{ ad: "devir_akis", girdi: { akis: kod } }, { ad: "devir_adim_guncelle", girdi: { akis: kod, no: hedef.no, durum: "suruyor" } }, { ad: "devir_akis_kapat", girdi: { akis: ak2.kisa_kod } }];
  let s = await api("POST", "/api/v1/sohbet", { mesajlar: [{ rol: "kullanici", metin: "Lansman nerede?" }], sayfa: { akis: kod } }, WEB);
  ok(s.st === 200 && s.j.mesaj === "Tamam.", "sohbet cevap verdi", s.j);
  ok(/Lansman/.test(SONUCLAR[0] || ""), "okuma aracı hemen çalıştı", (SONUCLAR[0] || "").slice(0, 80));
  ok(s.j.oneriler?.length === 2 && T.adim.find((x) => x.id === hedef.id).durum !== "suruyor", "yazan araç yazmadı, önizleme döndü", s.j.oneriler);
  ok(s.j.oneriler?.[0]?.ozet === `${kod} · ${hedef.no}. adım: durum → sürüyor` && s.j.oneriler?.[1]?.onay_gerekir === true, "önizleme özeti ve kapatmada ayrı onay", s.j.oneriler);
  ok((T.ai_kullanim || []).some((x) => x.tur === "sohbet"), "sohbet maliyeti sayaca yazıldı");
  let u = await api("POST", "/api/v1/sohbet/uygula", { oneriler: s.j.oneriler }, WEB);
  ok(u.st === 409, "kapatma onaysız uygulanmadı", u.j);
  u = await api("POST", "/api/v1/sohbet/uygula", { oneriler: [s.j.oneriler[0]] }, WEB);
  ok(u.st === 200 && !u.j.sonuclar[0].hata && T.adim.find((x) => x.id === hedef.id).durum === "suruyor", "Uygula ile adım yazıldı", u.j);
  ok(T.olay.some((e) => e.akis_id === ak.id && e.arac === "Devir AI"), "olay kaydında araç Devir AI");
  u = await api("POST", "/api/v1/sohbet/uygula", { oneriler: [{ arac: "devir_dersler", girdi: {} }] }, WEB);
  ok(u.st === 400, "listede olmayan araç uygulanmaz");
  s = await api("POST", "/api/v1/sohbet", { mesajlar: [{ rol: "kullanici", metin: "x" }] });
  ok(s.st === 403, "sohbet anahtarla açılmaz (yalnız web oturumu)", s.j);
  const DIS = oturum("auth-dis", "dis@ornek.com");
  s = await api("POST", "/api/v1/sohbet", { mesajlar: [{ rol: "kullanici", metin: "x" }] }, DIS);
  ok(s.st === 403, "dış katılımcıda sohbet yok (5.D)", s.j);
  // sınır dolunca sohbet ve taslak kapanır
  await db.insert("ai_kullanim", [{ ws_id: ws.id, kimlik: `u:${uye.id}`, ay: "2026-10-01", tur: "sohbet", model: "x", usd: 5 }]);
  s = await api("POST", "/api/v1/sohbet", { mesajlar: [{ rol: "kullanici", metin: "x" }] }, WEB);
  ok(s.st === 429 && /1 Kasım'da yenilenir/.test(s.j.hata), "sınır dolunca sohbet kapalı", s.j);
  m = await mcp("devir_tasla", { cumle: "Bir iş daha" });
  ok(/kullanım sınırına ulaştın/.test(m.metin), "sınır dolunca taslak da kapalı (5.B)", m.metin.slice(0, 120));
  k = await api("GET", "/api/v1/kullanim");
  ok(k.j.kullanim.doldu === true && k.j.kullanim.oran === 1, "kullanım dolu görünüyor");
  NOW = Date.parse("2026-11-01T00:30:00+03:00");
  k = await api("GET", "/api/v1/kullanim");
  ok(k.j.kullanim.doldu === false && k.j.kullanim.oran === 0, "yeni ayda sayaç sıfırdan");

  // ---------- P7: referans ve onay listesi ----------
  let r = await api("GET", "/api/v1/referans", null, WEB);
  ok(r.st === 200 && /^https:\/\/devir\.ornek\/katil\/[A-Z0-9]{6}$/.test(r.j.link) && r.j.gelen === 0, "referans bağlantısı üretildi", r.j);
  const rkod = r.j.kod;
  r = await api("GET", "/api/v1/referans", null, WEB);
  ok(r.j.kod === rkod, "aynı kişiye aynı kod");
  NOW += 6e4;
  const pub = await handle(new Request(B + `/api/v1/referans/${rkod}`), db, NOW, EK);
  const pj = await pub.json();
  ok(pj.ok && pj.davet_eden === "Berkin", "kimliksiz referans sayfası davet edeni gösteriyor", pj);
  const YENI = oturum("auth-yeni", "yeni@ornek.com");
  r = await api("POST", "/api/v1/kayit", { referans: rkod, kisi: "Deniz" }, YENI);
  ok(r.j.bekleme?.durum === "bekliyor", "referansla gelen onaya düştü", r.j);
  r = await api("GET", "/api/v1/ben", null, YENI);
  ok(r.j.kayit_gerekli && r.j.bekleme?.durum === "bekliyor", "ben: onay bekliyor");
  r = await api("GET", "/api/v1/bekleme", null, WEB);
  const bk = r.j.bekleme?.[0];
  ok(bk?.eposta === "yeni@ornek.com" && bk.referans_veren === "Berkin", "sahip onay listesini görüyor", r.j);
  r = await api("POST", `/api/v1/bekleme/${bk.id}/onayla`, {}, "dv_sahip");
  ok(r.st === 403, "onay anahtarla verilemez");
  r = await api("POST", `/api/v1/bekleme/${bk.id}/onayla`, {}, WEB);
  ok(r.j.bekleme?.durum === "onaylandi" && GIDEN.some((g) => g.e === "yeni@ornek.com"), "onaylandı, giriş e-postası gitti", r.j);
  r = await api("POST", "/api/v1/kayit", { kisi: "Deniz" }, YENI);
  ok(r.j.acildi?.rol === "sahip" && /Deniz/.test(r.j.acildi.alan), "onaylanan kişi kendi alanını açtı", r.j);
  ok(T.bekleme.find((x) => x.id === bk.id).durum === "katildi", "bekleme katıldı oldu");
  r = await api("GET", "/api/v1/referans", null, WEB);
  ok(r.j.gelen === 1 && r.j.onaylanan === 0, "referans sayacı (katılan onaylanan sayılmaz, gelen sayılır)", r.j);

  // ---------- P7: agent bağlantıları ----------
  const OA1 = oturum("auth-berkin", "berkin@ornek.com", { client_id: "claude-ai", iat: Math.floor(NOW / 1000) });
  m = await mcp("devir_akislar", {}, OA1, "Claude-User/1.0");
  ok(!/Hata/.test(m.metin) && m.st === 200, "OAuth ile MCP çalışıyor", m);
  r = await api("GET", "/api/v1/ben/agentlar", null, WEB);
  const ag = r.j.agentlar?.[0];
  ok(ag?.ad === "Claude" && ag.istemci === "claude-ai", "Agent'larım listesinde Claude", r.j);
  r = await api("POST", `/api/v1/ben/agent/${ag.id}/kaldir`, {}, WEB);
  ok(r.j.kaldirildi === true, "bağlantı kaldırıldı");
  m = await mcp("devir_akislar", {}, OA1, "Claude-User/1.0");
  ok(m.st === 401, "kaldırılan bağlantının eski jetonu reddedildi", m);
  r = await api("GET", "/api/v1/ben/agentlar", null, WEB);
  ok(r.j.agentlar.length === 0, "kaldırılan bağlantı listede yok");
  NOW += 6e4;
  const OA2 = oturum("auth-berkin", "berkin@ornek.com", { client_id: "claude-ai", iat: Math.floor(NOW / 1000) + 5 });
  m = await mcp("devir_akislar", {}, OA2, "Claude-User/1.0");
  ok(m.st === 200, "yeniden bağlanınca (yeni jeton) çalışıyor", m);

  ok(oneriOzeti("devir_alt_gorev", { akis: "AB12", adim: 3, alt_gorevler: [{}, {}] }) === "AB12 · 3. adıma 2 alt görev eklenecek", "alt görev önizleme özeti");
  console.log(hata ? `\n${hata} test başarısız` : "\n0.28.0 testleri geçti");
  if (hata) process.exit(1);
})();
