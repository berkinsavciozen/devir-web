// 0.33.0 (5 Kas, P3/P4): yürütme tasarımı (yurutme/inceleme/karar_tur), insan payı, kontrol katlama, AI çıktısını reddet/yorumla geri gönder.
import { callTool } from "../core.ts";
import { apiYonlendir } from "../api.ts";
import { yurutmeDoldur, kontrolKatla, insanPayi, kararEkonomisi, secenekler, geriBildirimSatirlari } from "../yurutme.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-05T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, agent_tetik: { aktif: true }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const tum = [...new Set(rows.flatMap((r) => Object.keys(r)))]; rows = rows.map((r) => Object.fromEntries(tum.map((k) => [k, k in r ? r[k] : null]))); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...Object.fromEntries(Object.entries(r).filter(([k, v]) => !(v == null && k in (DEF[t] || {})))) })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };

const taslak = () => ({
  is_turu: { kod: "tedarikci", ad: "Tedarikçi seçimi", mevcut: false }, baslik: "Ambalaj tedarikçisi seçimi", kisa_ad: "Ambalaj tedarikçisi", anahtar_varlik: { tur: "sirket", ad: "Nokta" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }, { kod: "claude", ad: "Berkin'in Claude'u", tip: "dis", kisi: "Berkin'in Claude'u" }, { kod: "ted", ad: "Tedarikçi", tip: "dis", kisi: "Tedarikçi" }],
  sorular: [], varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "ted-arastir", ad: "Ambalaj tedarikçilerini karşılaştır", sahip_rol: "claude", kriter: "5 tedarikçi tablosu", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a2", tur_kod: "kontrol", ad: "Karşılaştırma tablosunu kontrol et", sahip_rol: "ben", kriter: "kontrol edildi", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: false },
    { id: "a3", tur_kod: "ted-sec", ad: "Tedarikçiyi seç", sahip_rol: "ben", kriter: "tedarikçi belli", sure_tahmin_gun: 1, bagimli: ["a2"], boyut: "karar", karar_gerekli: true, karar_kriteri: "fiyat ve teslim", cikti_bekleniyor: false, karar_tur: "secim", karar_secenekleri: ["Ambalajcı A", "Ambalajcı B", "Ambalajcı B", "Ambalajcı C"] },
    { id: "a4", tur_kod: "teklif", ad: "Teklifi gönder", sahip_rol: "ted", kriter: "teklif geldi", sure_tahmin_gun: 2, bagimli: ["a3"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a5", tur_kod: "sozlesme", ad: "Sözleşme taslağını hazırla", sahip_rol: "claude", kriter: "taslak hazır", sure_tahmin_gun: 1, bagimli: ["a4"], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true, yurutme: "ai_hazirlar_insan_bitirir" },
  ],
});
let sonIstem = "";
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") { sonIstem = JSON.stringify(req.messages ?? req.user ?? req); return { input: taslak(), model: "sahte", ms: 10 }; }
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0330" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const tetik = async () => ({ ok: true, durum: 200, oturum: "https://claude.ai/code/session_x" });
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm, tetik }) as any;
const agentCtx = () => ({ ...ctx(), kanal: "mcp", ua: "Claude-User" }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };

(async () => {
  // --- saf kurallar ---
  ok("seçenekler: tekrarsız, en çok 6", JSON.stringify(secenekler(["A", "A", " B ", "", 3, "C", "D", "E", "F", "G"])) === JSON.stringify(["A", "B", "C", "D", "E", "F"]), secenekler(["A", "A", " B ", "", 3, "C", "D", "E", "F", "G"]));
  ok("agent adımı varsayılan: AI yapar + hızlı onay", JSON.stringify(yurutmeDoldur({ sahip_tip: "agent", cikti_bekleniyor: true }, false)) === JSON.stringify({ yurutme: "ai_yapar", inceleme: "hizli_onay", karar_tur: null, karar_secenekleri: [] }), yurutmeDoldur({ sahip_tip: "agent", cikti_bekleniyor: true }, false));
  ok("agent + karar → AI hazırlar, yorumlu inceleme", (({ yurutme, inceleme }) => yurutme === "ai_hazirlar_insan_bitirir" && inceleme === "yorumlu_inceleme")(yurutmeDoldur({ sahip_tip: "agent", ad: "Bütçe önerisi" }, true)));
  ok("insan adımı inceleme yok", yurutmeDoldur({ sahip_tip: "insan", inceleme: "hizli_onay" }, false).inceleme === "yok");
  ok("dış adım: dis", yurutmeDoldur({ sahip_tip: "dis" }, false).yurutme === "dis");
  ok("karar: 2+ seçenek → seçim", yurutmeDoldur({ sahip_tip: "insan", karar_secenekleri: ["A", "B"] }, true).karar_tur === "secim");
  ok("geçersiz değer kuralla düzelir", yurutmeDoldur({ sahip_tip: "agent", yurutme: "uydurma", inceleme: "x" }, false).yurutme === "ai_yapar");
  ok("karar ekonomisi: 6 karar anı uyarı", !!kararEkonomisi({ karar: 6 }) && !kararEkonomisi({ karar: 5 }));
  const gb = geriBildirimSatirlari([{ tur: "red", metin: "Fiyatlar eski", kim: "Berkin", tarih: "2026-11-05", cikti: "Tablo" }]);
  ok("geri bildirim satırları yeni sürüm ister", gb.some((l) => /Fiyatlar eski/.test(l)) && gb.some((l) => /sürüm 2/.test(l)), gb);
  const ajanli = () => { const t = taslak(); t.roller[1].tip = "agent"; return t; };
  const kt = ajanli(); const notlar = kontrolKatla(kt);
  ok("ilke 35: AI ardındaki kontrol adımı katlanır", !kt.adimlar.some((a: any) => a.id === "a2") && kt.adimlar.find((a: any) => a.id === "a3")!.bagimli.includes("a1") && (kt.adimlar.find((a: any) => a.id === "a1") as any).inceleme === "yorumlu_inceleme" && notlar.length === 1, [kt.adimlar.map((a: any) => [a.id, a.bagimli]), notlar]);
  const kt2 = ajanli(); kt2.adimlar[1].ad = "Karşılaştırmayı kontrol et ve ödemeyi onayla"; kontrolKatla(kt2);
  ok("para geçen kontrol adımı katlanmaz", kt2.adimlar.some((a: any) => a.id === "a2"));
  const pay = insanPayi([{ sahip_tip: "insan", sahip: "Berkin", karar_gerekli: true, karar_tur: "secim" }, { sahip_tip: "agent", agent_sahibi: "Berkin", inceleme: "hizli_onay" }, { sahip_tip: "dis", sahip: "Tedarikçi" }], (x) => ({ tip: x.sahip_tip, kisi: x.sahip || x.agent_sahibi }), "Berkin");
  ok("insan payı: 1 karar, 1 bakış, 1 AI, 1 dış", pay.karar === 1 && pay.bakis === 1 && pay.ai === 1 && pay.dis === 1, pay);

  // --- tasla → kur ---
  let r = await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx());
  r = await callTool("devir_tasla", { cumle: "Ambalaj tedarikçisi seçmem lazım", baglam: { varlik: "Nokta", iliski: "kendi" } }, ctx());
  ok("planlayıcıya yetenek envanteri gider", /Yetenekler/.test(sonIstem) && /Berkin'in Claude'u/.test(sonIstem), sonIstem.slice(0, 300));
  ok("taslakta 'Senin payın' satırı", /Senin payın: \d+ karar anı/.test(r), r.slice(0, 600));
  ok("taslakta katlama notu", /kontrol/i.test(r) && !/\d\. Karşılaştırma tablosunu kontrol et/.test(r), r);
  ok("taslak satırında yürütme rozeti", /AI yapar/.test(r) && /karar: seçim \(Ambalajcı A \/ Ambalajcı B \/ Ambalajcı C\)/.test(r), r);
  const tk = /Taslak (T\w+)/.exec(r)![1];
  r = await callTool("devir_taslak_duzelt", { taslak: tk, duzelt: [{ no: 1, inceleme: "yorumlu_inceleme" }] }, ctx());
  ok("taslak düzelt: inceleme değişir", /yorumlu inceleme/.test(r), r);
  r = await callTool("devir_akis_olustur", { taslak: tk, cevaplar: {} }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(r)![1];
  const L = adimlar(ak);
  const s1 = L.find((s) => /karşılaştır/i.test(s.ad))!, s3 = L.find((s) => /seç/.test(s.ad) && s.karar_gerekli)!, s4 = L.find((s) => /Teklif/.test(s.ad))!, s5 = L.find((s) => /Sözleşme/.test(s.ad))!;
  ok("kurulan akışta 4 adım", L.length === 4, L.map((s) => s.ad));
  ok("sütunlar yazılır", s1.yurutme === "ai_yapar" && s1.inceleme === "yorumlu_inceleme" && s3.karar_tur === "secim" && s4.yurutme === "dis" && s5.yurutme === "ai_hazirlar_insan_bitirir", L.map((s) => [s.no, s.yurutme, s.inceleme, s.karar_tur]));
  const kr = akisOf(ak).baglam?.kararlar?.[String(s3.no)];
  ok("plan seçenekleri karar kartına tohumlanır", kr?.kaynak === "plan" && kr?.bicim === "secim" && kr?.secenekler?.length === 3 && kr?.tur === "seçenek", kr);

  // devir_adim_guncelle ile yürütme değişikliği
  r = await callTool("devir_adim_guncelle", { akis: ak, no: s3.no, karar_tur: "onay_red" }, ctx());
  ok("karar_tur güncellenir", adimlar(ak).find((s) => s.no === s3.no)!.karar_tur === "onay_red", r);
  ok("dış kullanıcı/agent yürütmeyi değiştiremez", !!(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: s1.no, yurutme: "insan" }, agentCtx()))) || adimlar(ak).find((s) => s.no === s1.no)!.yurutme === "ai_yapar");

  // --- P4: inceleme döngüsü ---
  r = await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx());
  ok("agent işi alır", adimlar(ak).find((s) => s.no === s1.no)!.oto_durum === "tetiklendi", r);
  ok("çıktı yokken reddedilemez", /çıktı/i.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: s1.no, reddet: "Eksik" }, ctx()))));
  await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, cikti: { ad: "Tedarikçi tablosu", icerik: "| A | 10 TL |" } }, agentCtx());
  ok("çıktı → bakılacak", adimlar(ak).find((s) => s.no === s1.no)!.oto_durum === "bakilacak");
  ok("agent kendi çıktısını reddedemez", !!(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: s1.no, reddet: "kötü" }, agentCtx()))));
  ok("boş red nedeni hata", !!(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: s1.no, reddet: "  " }, ctx()))));
  r = await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, reddet: "Bilgi yanlış ya da eksik: fiyatlar eski" }, ctx());
  let a1 = adimlar(ak).find((s) => s.no === s1.no)!;
  ok("red → AI yeniden sıraya", a1.oto_durum == null && a1.oto_deneme === 0 && a1.durum === "hazir", [a1.oto_durum, a1.durum, r]);
  ok("red geçmişe yazılır", akisOf(ak).baglam.inceleme[String(s1.no)].length === 1 && akisOf(ak).baglam.inceleme[String(s1.no)][0].tur === "red");
  ok("red olayı düşer", T.olay.some((e) => e.veri?.tur === "oto_red"));
  r = await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx());
  ok("yeniden alınan işin talimatında geri bildirim", /fiyatlar eski/.test(r) && /sürüm 2/.test(r), r);
  await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, cikti: { ad: "Tedarikçi tablosu v2", icerik: "| A | 12 TL |" } }, agentCtx());
  r = await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, geri_gonder: "B'nin teslim süresini de ekle" }, ctx());
  ok("yorumla geri gönder", akisOf(ak).baglam.inceleme[String(s1.no)].at(-1).tur === "yorum" && T.olay.some((e) => e.veri?.tur === "oto_yorum"), r);
  const oku = await callTool("devir_adim_oku", { akis: ak, no: s1.no }, ctx());
  ok("adım okumada yürütme ve inceleme geçmişi", /Yürütme: AI yapar · yorumlu inceleme/.test(oku) && /İnceleme geçmişi \(2\/4\)/.test(oku), oku);
  const av: any = await apiYonlendir(ctx(), "GET", ["akis", ak], new URLSearchParams(), null, { fn: "", link: "" });
  const v1 = (av.adimlar || av.akis?.adimlar || []).find((x: any) => x.no === s1.no);
  ok("API: yurutme + inceleme_gecmisi", v1?.yurutme === "ai_yapar" && v1?.inceleme_gecmisi?.length === 2, v1 && { y: v1.yurutme, g: v1.inceleme_gecmisi });
  for (let i = 0; i < 2; i++) { await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx()); await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, cikti: { ad: `v${i + 3}`, icerik: "x" } }, agentCtx()); await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, geri_gonder: `tur ${i + 3}` }, ctx()); }
  await callTool("devir_ai_isler", { agent: "Berkin'in Claude'u" }, agentCtx()); await callTool("devir_adim_guncelle", { akis: ak, no: s1.no, cikti: { ad: "v5", icerik: "x" } }, agentCtx());
  ok("4 turdan sonra geri gönderme kapanır", /4/.test(await hata(() => callTool("devir_adim_guncelle", { akis: ak, no: s1.no, geri_gonder: "bir daha" }, ctx()))));

  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.33.0 testleri geçti");
  if (hata0) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
