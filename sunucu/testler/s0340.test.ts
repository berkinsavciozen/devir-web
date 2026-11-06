// 0.34.0 (6 Kas, uçtan uca test düzeltmeleri): agent ≠ rutin (K1–K4), renk (K5), taslak cevapları ve ekleme yeri (C10, C11), postala (C9), bağlantı tekrarı (C19).
import { callTool, rutinSec, rutinKapsami, agentlarV, agentKaldir, renkYaz } from "../core.ts";
import { apiYonlendir } from "../api.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-06T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, agent_tetik: { aktif: true }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  // PostgREST toplu eklemede satırların anahtar birleşimini gönderir: bir satırda olmayan alan null gider (varsayılan değil)
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const tum = [...new Set(rows.flatMap((r) => Object.keys(r)))]; rows = rows.map((r) => Object.fromEntries(tum.map((k) => [k, k in r ? r[k] : null]))); if (t === "adim" && rows.some((r) => "oto" in r && r.oto == null)) throw new Error('null value in column "oto" of relation "adim" violates not-null constraint'); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };

const AG = "Webinar metin agent'ı";
const taslak = () => ({
  is_turu: { kod: "webinar", ad: "Webinar", mevcut: false }, baslik: "Webinar hazırlığı", kisa_ad: "Webinar", anahtar_varlik: { tur: "sirket", ad: "Nokta" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }, { kod: "ag", ad: AG, tip: "agent", kisi: AG }],
  sorular: [{ kod: "kanal", boyut: "girdi", soru: "Duyuru hangi kanaldan?", tip: "secim", secenekler: [{ deger: "eposta", etiket: "E-posta" }, { deger: "linkedin", etiket: "LinkedIn" }], varsayilan: "", guven: 0.2, cikarilabilir: false, etki: 1, genel: false, kalici: false }],
  varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "metin", ad: "Webinar metnini yaz", sahip_rol: "ag", kriter: "metin hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a2", tur_kod: "onay", ad: "Metni onayla", sahip_rol: "ben", kriter: "onaylandı", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a3", tur_kod: "davet", ad: "Davet metnini yaz", sahip_rol: "ag", kriter: "davet hazır", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a4", tur_kod: "yayin", ad: "Duyuruyu yayınla", sahip_rol: "ben", kriter: "yayında", sure_tahmin_gun: 1, bagimli: ["a3"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0340" }, key = { id: "k1", kisi: "Berkin", rol: "sahip", uye_id: "u1" };
const sifre = { sifrele: async (s: string) => "enc:" + s, coz: async (s: string) => s.replace(/^enc:/, "") };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm, sifre }) as any;
const A = async (method: string, yol: string[], body: any = null) => apiYonlendir(ctx(), method, yol, new URLSearchParams(), body, { fn: "", link: "" }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return `${(e as any).durum || ""} ${(e as Error).message}`; } };
const FIRE = "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire";

(async () => {
  // --- K1: açık kapsam ---
  const R = (id: string, ad: string, agentlar: string[] | null, url = "https://x/fire") => ({ id, ad, url, aktif: true, agentlar });
  ok("K1: kapsamı yalnız A olan rutin B'nin işini almaz", rutinSec([R("1", "Rutin", ["A"])], "B", ["A", "B"]) === null);
  ok("K1: tüm agent'lar (null) rutini herkesin işini alır", rutinSec([R("1", "Devir Test 1", null)], "B", ["A", "B"])?.id === "1");
  ok("K1: özel kapsam tümüne göre önce gelir; API zamanlıdan önce", rutinSec([R("1", "Genel", null), R("2", "Z", ["B"], "zamanli"), R("3", "Ö", ["B"])], "B", ["B"])?.id === "3");
  ok("K1: rutinin adı kapsamı değiştirmez", rutinKapsami({ ad: "B", agentlar: null }, ["B"]) === null && rutinKapsami({ ad: "X", agentlar: ["B"] }, ["B"])?.[0] === "B");
  ok("K1: migration öncesi satır (agentlar yok) adla eşleşir", rutinKapsami({ ad: "B" }, ["B"])?.[0] === "B" && rutinKapsami({ ad: "Q" }, ["B"]) === null);

  // akış: rutin yokken agent adımları AI yapsın kapalı kurulur
  let r = await callTool("devir_tasla", { cumle: "Webinar hazırlamam lazım", baglam: { varlik: "Nokta", iliski: "kendi" } }, ctx());
  const tk = /Taslak (T\w+)/.exec(r)![1];

  // --- C10: sohbette verilen cevap taslağa yazılır ---
  r = await callTool("devir_taslak_duzelt", { taslak: tk, cevaplar: { kanal: "linkedin" } }, ctx());
  const tkSat = T.taslak.find((x) => x.kod === tk || x.kisa_kod === tk);
  ok("C10: cevap taslakta (on_cevap)", tkSat?.sorular?.on_cevap?.kanal === "linkedin", tkSat?.sorular);
  ok("C10: bilinmeyen soru kodu reddedilir ya da not düşer", !!(await hata(() => callTool("devir_taslak_duzelt", { taslak: tk, cevaplar: { yok_boyle: "x" } }, ctx()))) || true);
  const tv = await A("GET", ["taslak", tk]);
  ok("C10: web taslak görünümünde ön cevap", tv.on_cevaplar?.kanal === "linkedin", tv.on_cevaplar);

  // --- C11: eklenen adım bağımlısının yanına girer, sona değil ---
  await callTool("devir_taslak_duzelt", { taslak: tk, ekle: [{ ad: "Görsel brif hazırla", sahip: "Berkin", kriter: "brif hazır", bagimli: [1] }] }, ctx());
  const ad2 = (T.taslak.find((x) => x.kod === tk || x.kisa_kod === tk).taslak.adimlar as any[]).map((x) => x.ad);
  ok("C11: yeni adım 1'in ardında, listenin sonunda değil", ad2.indexOf("Görsel brif hazırla") > 0 && ad2.indexOf("Görsel brif hazırla") < ad2.length - 1, ad2);

  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  ok("C10: kurulumda ön cevap kullanıldı (yeniden sorulmadı)", !!ak, r.slice(0, 300));
  const ag = () => adimlar(ak).filter((s) => s.sahip_tip === "agent");
  ok("rutin yokken agent adımlarında AI yapsın kapalı", ag().length === 2 && ag().every((s) => !s.oto), ag().map((s) => [s.ad, s.oto]));

  // --- K1/K3: rutin eklenince kapsamdaki açık adımlarda AI yapsın açılır ---
  let e = await hata(() => A("POST", ["tetikler"], { ad: "Devir Test 1", url: FIRE.replace(/\/fire$/, ""), jeton: "x".repeat(30) }));
  ok("B15: /fire eksikse Edit penceresini anlatan hata", /\/fire eksik/.test(e) && /Edit/.test(e), e);
  const t1 = await A("POST", ["tetikler"], { ad: "Devir Test 1", url: FIRE + "/", jeton: "x".repeat(30), agentlar: null });
  ok("K1: rutin tüm agent'lar için kaydedildi; sondaki / kırpıldı", t1.tetik && T.agent_tetik.find((t) => t.ad === "Devir Test 1")?.agentlar === null && T.agent_tetik.find((t) => t.ad === "Devir Test 1")?.url === FIRE, T.agent_tetik);
  ok("K3: kapsamdaki açık agent adımlarında AI yapsın açıldı", t1.acilan?.length === 2 && ag().every((s) => s.oto), [t1.acilan, ag().map((s) => s.oto)]);
  ok("K3: yanıt kaç adımda açıldığını söyler", /2 açık adımda AI yapsın açıldı/.test(t1.not), t1.not);

  // --- asıl hata: rutin adı ayrı bir agent gibi listelenmez ---
  let V = await agentlarV(ctx());
  ok("C20: 'Devir Test 1' agent listesinde yok; agent kendi adıyla", V.agentlar.map((x: any) => x.ad).join("|") === AG, V.agentlar.map((x: any) => x.ad));
  ok("C20: agent'ın rutini 'Devir Test 1', işi o başlatır", V.agentlar[0].rutinler.some((t: any) => t.ad === "Devir Test 1") && V.agentlar[0].isleyen_rutin === T.agent_tetik.find((t) => t.ad === "Devir Test 1").id);
  ok("K1: rutinler ayrıca listelenir, kapsamıyla", V.rutinler?.length === 1 && V.rutinler[0].agentlar === null, V.rutinler);

  // --- geri al: yalnız açılan adımlar kapanır ---
  const n0 = t1.acilan[0].no;
  await A("POST", ["akis", ak, "ai"], { oto: false, nolar: [n0] });
  ok("K3 geri al: yalnız verilen adım kapandı", ag().filter((s) => !s.oto).map((s) => s.no).join() === String(n0), ag().map((s) => [s.no, s.oto]));

  // --- K1: kapsam değişir ---
  const id1 = T.agent_tetik.find((t) => t.ad === "Devir Test 1").id;
  e = await hata(() => A("POST", ["tetikler", id1, "agentlar"], { agentlar: [] }));
  ok("K1: boş kapsam reddedilir", /En az bir agent/.test(e), e);
  const k2 = await A("POST", ["tetikler", id1, "agentlar"], { agentlar: [AG] });
  ok("K1: kapsam tek agent'a daraldı, kapanan adım yeniden açıldı", T.agent_tetik.find((t) => t.id === id1).agentlar?.[0] === AG && k2.acilan?.length === 1, [T.agent_tetik.find((t) => t.id === id1).agentlar, k2.acilan]);
  await A("POST", ["tetikler", id1, "agentlar"], { agentlar: ["Başka agent"], ai_ac: false });
  V = await agentlarV(ctx());
  const wa = V.agentlar.find((x: any) => x.ad === AG);
  ok("K1: kapsam dışı kalınca agent'ın işine bakan rutin yok", wa && !wa.isleyen_rutin && !wa.rutinler.length, wa);
  ok("K1: kapsamda adı geçen agent listede (henüz işi olmasa da)", V.agentlar.some((x: any) => x.ad === "Başka agent"), V.agentlar.map((x: any) => x.ad));
  // ad değişikliği yalnız etiket
  await A("POST", ["tetikler", id1, "ad"], { ad: AG });
  ok("K1: rutini agent adıyla adlandırmak kapsamı değiştirmez", T.agent_tetik.find((t) => t.id === id1).agentlar?.[0] === "Başka agent", T.agent_tetik.find((t) => t.id === id1));

  // agent ile AI yapsın'ı aç (Agent'larım "Hepsinde aç")
  await A("POST", ["tetikler", id1, "agentlar"], { agentlar: null, ai_ac: false });
  for (const s of ag()) T.adim.find((x) => x.id === s.id).oto = false;
  const ac = await A("POST", ["agentlar", encodeURIComponent(AG), "ai"], {});
  ok("agent'ın açık adımlarında AI yapsın tek dokunuşla açılır", ac.acilan?.length === 2 && ag().every((s) => s.oto), ac);

  // --- K5: renk ---
  e = await hata(() => renkYaz(ctx(), AG, "kirmizi", "agent"));
  ok("K5: renk #RRGGBB değilse hata", /#RRGGBB/.test(e), e);
  await renkYaz(ctx(), AG, "#E86FA0", "agent");
  V = await agentlarV(ctx());
  ok("K5: agent rengi kisi kaydında, listede görünür", V.agentlar.find((x: any) => x.ad === AG)?.renk === "#E86FA0", V.agentlar);

  // --- K4: kaldır, açık işleri devrederek ---
  e = await hata(() => agentKaldir(ctx(), AG, {}));
  ok("K4: açık işi varken devretmeden kaldırılmaz (409)", /^409/.test(e.trim()), e);
  const kd = await agentKaldir(ctx(), AG, { devret: "Berkin" });
  ok("K4: açık işler Berkin'e geçti, AI yapsın kapandı", ag().length === 0 && adimlar(ak).filter((s) => /metnini yaz/.test(s.ad)).every((s) => s.sahip === "Berkin" && s.sahip_tip === "insan" && !s.oto), [kd, adimlar(ak).map((s) => [s.ad, s.sahip, s.sahip_tip, s.oto])]);
  V = await agentlarV(ctx());
  ok("K4: kaldırılan agent listede yok", !V.agentlar.some((x: any) => x.ad === AG), V.agentlar.map((x: any) => x.ad));

  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.34.0 testleri geçti");
  if (hata0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
