// 0.30.0 (4 Kas, AI yapsın test bulguları): planlama düzeltmeleri, agent = kişinin desteği, varsayılan AI yapsın, rutin ↔ agent, AI olayları.
import { callTool, rutinSec, otoToplu, aiGecmisi, agentlarV } from "../core.ts";
import { apiYonlendir } from "../api.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-23T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, agent_tetik: { aktif: true }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };

const taslak = () => ({
  is_turu: { kod: "kahve", ad: "Kahveci açılışı", mevcut: false }, baslik: "Nokta Kahve açılışı", kisa_ad: "Nokta Kahve açılışı", anahtar_varlik: { tur: "sirket", ad: "Nokta Kahve" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }, { kod: "claude", ad: "Berkin'in Claude'u", tip: "dis", kisi: "Berkin'in Claude'u" }],
  sorular: [{ kod: "acilis_butcesi", boyut: "kisit", soru: "Açılış bütçesi ne kadar olacak?", tip: "metin", varsayilan: "", guven: 0.2, cikarilabilir: false, etki: 1, genel: false, kalici: false, ne_zaman: "sonra", cevaplayan_adim: "a2" }],
  varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "rakip", ad: "Rakip kahvecileri analiz et: fiyat, saat, öne çıkan ürün ve Instagram dili", sahip_rol: "claude", kriter: "tablo hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a2", tur_kod: "butce-secenek", ad: "Açılış bütçesi seçeneklerini hazırla", sahip_rol: "claude", kriter: "üç seçenek", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a3", tur_kod: "butce-karar", ad: "Açılış bütçesine karar ver", sahip_rol: "ben", kriter: "bütçe belli", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "karar", karar_gerekli: true, karar_kriteri: "bütçe", cikti_bekleniyor: false },
    { id: "a4", tur_kod: "duyuru", ad: "Açılış duyurusunu Instagram'da yayınla", sahip_rol: "ben", kriter: "yayında", sure_tahmin_gun: 1, bagimli: ["a3"], boyut: "girdi", karar_gerekli: true, cikti_bekleniyor: false },
    { id: "a5", tur_kod: "gonderi", ad: "Gönderi metinlerini yaz", sahip_rol: "claude", kriter: "metinler hazır", sure_tahmin_gun: 1, bagimli: ["a3"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0300" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const atis: { url: string; jeton: string; metin: string }[] = [];
const tetik = async (url: string, jeton: string, metin: string) => { atis.push({ url, jeton, metin }); return url.includes("/fail/") ? { ok: false, durum: 500, hata: "sunucu" } : { ok: true, durum: 200, oturum: "https://claude.ai/code/session_x" }; };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm, tetik }) as any;
const agentCtx = () => ({ ...ctx(), kanal: "mcp", ua: "Claude-User" }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimOf = (kod: string, no: number) => T.adim.find((s) => s.akis_id === akisOf(kod).id && s.no === no);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };


(async () => {
  // --- rutin ↔ agent seçimi (K3) ---
  const R = (id: string, ad: string, url = "https://x/fire") => ({ id, ad, url, aktif: true });
  ok("tek rutin her agent'ın işini alır", rutinSec([R("1", "Devir AI Yapsın")], "Berkin'in Claude'u")?.id === "1");
  ok("adla eşleşen rutin seçilir", rutinSec([R("1", "Devir AI Yapsın"), R("2", "Berkin'in Claude'u", "zamanli")], "Berkin'in Claude'u")?.id === "2");
  ok("başka agent'a ayrılmış rutin ötekinin işini almaz; tek API tetiği alır", rutinSec([R("1", "Gönderi agent'ı"), R("2", "Genel", "https://y/fire"), R("3", "Zamanlanmış rutin", "zamanli")], "Araştırma agent'ı", ["Gönderi agent'ı", "Araştırma agent'ı"])?.id === "2");
  ok("API yoksa genel zamanlanmış rutin alır", rutinSec([R("1", "Gönderi agent'ı", "zamanli"), R("3", "Zamanlanmış rutin", "zamanli")], "Araştırma agent'ı", ["Gönderi agent'ı"])?.id === "3");

  // rutin önceden bağlı: zamanlanmış rutin "Berkin'in Claude'u" adıyla uğrar
  let r = await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx());
  ok("ai_isler agent adıyla rutin satırı açar", (T.agent_tetik || []).some((t) => t.url === "zamanli" && t.ad === "Berkin'in Claude'u"), T.agent_tetik);

  r = await callTool("devir_tasla", { cumle: "Nokta Kahve'yi açmam lazım", baglam: { varlik: "Nokta Kahve", iliski: "kendi" } }, ctx());
  ok("B1: taslak metninde motor adı yok", !/sahte|yedek motor/.test(r), r.slice(0, 200));
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const L = adimlar(ak);
  const by = (re: RegExp) => L.find((s) => re.test(s.ad));
  const s1 = by(/Rakip/), s2 = by(/seçenek/), s3 = by(/karar ver/), s4 = by(/yayınla/), s5 = by(/Gönderi/);
  ok("C2: \"Berkin'in Claude'u\" agent sayılır", s1.sahip_tip === "agent" && s2.sahip_tip === "agent", [s1.sahip_tip, s1.sahip]);
  ok("K1: agent'ın desteklediği kişi Berkin", s1.agent_sahibi === "Berkin" && s5.agent_sahibi === "Berkin", s1.agent_sahibi);
  ok("C4: uzun ad iki noktadan bölünür, ayrıntı açıklamada", s1.ad === "Rakip kahvecileri analiz et" && /fiyat, saat/.test(s1.aciklama || ""), [s1.ad, s1.aciklama]);
  ok("C3: yayınlamak karar değil", s4.karar_gerekli === false, s4.karar_gerekli);
  ok("C5/C14: sonra sorusu karar adımına bağlanır, hazırlık adımına değil", s3.cevap_soru === "acilis_butcesi" && !s2.cevap_soru, [s2.cevap_soru, s3.cevap_soru]);
  ok("K2: rutin bağlıyken agent adımları AI yapsın açık kurulur", s1.oto && s2.oto && s5.oto && !s3.oto && !s4.oto, L.map((s) => [s.no, s.oto]));
  ok("K2: ilk mesaj AI yapsın'ı ve kimin ne yaptığını söyler", /AI yapsın \d+ agent adımında açık/.test(r) && /Kim ne yapıyor/.test(r) && /Berkin için çalışır/.test(r), r);

  // ai_isler: adım 1 hazır, Berkin'in Claude'u rutini alır
  r = await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx());
  ok("adla bağlı zamanlanmış rutin işi alır", /Aldığın AI yapsın işleri \(1/.test(r) && adimOf(ak, s1.no).oto_durum === "tetiklendi", r);
  ok("rutin talimatında doğrulama maddesi var", /dogrulama listesine/.test(r));
  r = await callTool("devir_ai_isler", { agent: "Gönderi agent'ı" }, agentCtx());
  ok("başka adla gelen rutin bu agent'ın işini almaz", /hazır AI yapsın işi yok/.test(r), r);

  // agent çıktı + doğrulama yazar → AI yaptı olayı, doğrulama alt görevi
  r = await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, cikti: { ad: "Rakip tablosu", icerik: "| kahveci | fiyat |" }, dogrulama: ["Hafta sonu çalışma saatleri", "Filtre kahve fiyatı"] }, agentCtx());
  const s1b = adimOf(ak, s1.no);
  ok("çıktı → bakılacak", s1b.oto_durum === "bakilacak", s1b.oto_durum);
  const alt = adimlar(ak).filter((x) => x.ust_adim === s1.no);
  ok("C16: doğrulama notları Berkin'e alt görev", alt.length === 2 && alt.every((x) => x.sahip === "Berkin" && x.sahip_tip === "insan" && /^Doğrula: /.test(x.ad)), alt.map((x) => [x.ad, x.sahip]));
  const ev = T.olay.filter((e) => e.akis_id === akisOf(ak).id && e.adim_no === s1.no);
  ok("B8: AI yaptı olayı düşer", ev.some((e) => e.veri?.tur === "oto_bakilacak" && /AI yaptı/.test(e.ozet)), ev.map((e) => e.veri?.tur));
  const g = await aiGecmisi(ctx(), ak, s1.no);
  ok("adımın AI geçmişi: başladı + agent + yaptı", g.olaylar.some((o: any) => o.tur === "oto_tetik") && g.olaylar.some((o: any) => o.tur === "oto_bakilacak") && g.adim.oto_durum === "bakilacak", g.olaylar.map((o: any) => o.tur));
  const bil: any = await apiYonlendir({ ...ctx(), kanal: "oturum" }, "GET", ["olaylar"], new URLSearchParams(), null, { fn: "", link: "" });
  const aiB = (bil.olaylar || []).find((o: any) => o.ai === "bakilacak");
  ok("bildirimde AI satırı ve Berkin'e ilgili", !!aiB && aiB.ilgili === true, (bil.olaylar || []).slice(0, 4));

  // Görevler: "ben" agent işlerini de getirir; onay bekleyen üstte
  const gv: any = await apiYonlendir(ctx(), "GET", ["gorevler"], new URLSearchParams("kisi=Berkin&durum=acik"), null, { fn: "", link: "" });
  const gs = gv.gorevler.find((x: any) => x.akis === ak && x.no === s1.no);
  ok("W6: Berkin'in görevlerinde agent işi (destek)", !!gs && gs.destek === true && gs.oto_durum === "bakilacak", gv.gorevler.map((x: any) => [x.no, x.sahip]));

  // Agent'larım
  const ag: any = await agentlarV(ctx());
  const bc = ag.agentlar.find((x: any) => x.ad === "Berkin'in Claude'u");
  ok("agent'larım: rutin, onay bekleyen, sıradaki", !!bc && bc.rutinler.some((t: any) => t.tur === "zamanli") && bc.bakilacak.length === 1 && bc.sirada >= 1, bc);

  // alt görev mirası
  r = await callTool("devir_alt_gorev", { akis: ak, adim: s5.no, alt_gorevler: ["Gönderi 1", "Gönderi 2"] }, ctx());
  const g5 = adimlar(ak).filter((x) => x.ust_adim === s5.no);
  ok("C11: alt görev agent sahibini ve AI yapsın'ı miras alır", g5.length === 2 && g5.every((x) => x.agent_sahibi === "Berkin" && x.oto === true), g5.map((x) => [x.agent_sahibi, x.oto]));

  // toplu kapat / aç
  let t = await otoToplu(ctx(), ak, { oto: false });
  ok("toplu kapatma", t.degisen.length >= 3 && adimlar(ak).every((x) => !x.oto || x.oto_durum === "bakilacak" || x.no === s1.no), t);
  t = await otoToplu(ctx(), ak, {});
  ok("B10: toplu açma çıktısı olanı atlar, karar ve yayın açılmaz", !t.degisen.includes(s1.no) && t.atlanan.some((x: any) => x.no === s1.no && x.neden === "çıktısı var") && !adimOf(ak, s3.no).oto && !adimOf(ak, s4.no).oto && adimOf(ak, s2.no).oto, t);
  ok("agent toplu açamaz", /yalnız ekipten/.test(await hata(() => otoToplu(agentCtx(), ak, {}))));

  // rutin adını değiştir (K3)
  const zt = T.agent_tetik.find((x) => x.ad === "Berkin'in Claude'u");
  const ren: any = await apiYonlendir(ctx(), "POST", ["tetikler", zt.id, "ad"], new URLSearchParams(), { ad: "Berkin'in asistanı" }, { fn: "", link: "" });
  ok("rutin adı değişir", ren.tetik.ad === "Berkin'in asistanı");
  const zm: any = await apiYonlendir(ctx(), "GET", ["tetikler"], new URLSearchParams("agent=Berkin'in Claude'u"), null, { fn: "", link: "" });
  ok("rutin istemi agent adını taşır", /agent: "Berkin'in Claude'u"/.test(zm.zamanli_metni), zm.zamanli_metni);

  // ai_yapsin: false
  r = await callTool("devir_tasla", { cumle: "Moda şubesini açmam lazım", baglam: { varlik: "Moda şube", iliski: "kendi" } }, ctx());
  const tk2 = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_akis_olustur", { taslak: tk2, cevaplar: {}, ai_yapsin: false }, ctx());
  const ak2 = /oluşturuldu: (\w+)/.exec(r)![1];
  ok("ai_yapsin:false → hiçbir adım açık değil", adimlar(ak2).every((x) => !x.oto), adimlar(ak2).map((x) => x.oto));

  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.30.0 testleri geçti");
  if (hata0) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
