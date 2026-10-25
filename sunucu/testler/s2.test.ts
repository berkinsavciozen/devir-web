// 0.26.0 (S2, 23 Eki test bulguları): çoklu seçim cevapları (C2), zorunlu işler ve kartlar (M5), soru-adım bağı (M6),
// taslak düzeltme ve kurulu adımın tanımı (M8), kısa ad yanıtlarda (m1), dil (m2), sahiplik (m3), benzer iş (m5), karar/çıktı alanları (K11, N17).
import { callTool, kararAdimi, alanDoldur } from "../core.ts";
import { cevapDegerleri, cevapCoz, kosulEslesir, kuralDenetimi, sec, uygula, denetimUygula, soruAdimlari, dilDuzelt, sahipAdi, sahiplikUyarilari } from "../tasarim.ts";
import { zorunluIsler, kartSatiri, hatirlatmaSatirlari } from "../bellek.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-23T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [] }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata++; };

const SERT = { kod: "sertifika", tip: "secim", boyut: "girdi", soru: "Hangi sertifika gerekecek?", neden: "", etki: 2, guven: 0.3, varsayilan: "gida-kalite", ne_zaman: "simdi", secenekler: [{ deger: "gida-kalite", etiket: "Gıda kalite" }, { deger: "organik", etiket: "Organik" }, { deger: "her-ikisi", etiket: "Her ikisi" }] };
const ODEME = { kod: "odeme", tip: "secim", boyut: "kapi", soru: "Ödeme nasıl alınacak?", neden: "", etki: 2, guven: 0.3, varsayilan: "pesin", ne_zaman: "simdi", secenekler: [{ deger: "pesin", etiket: "Peşin" }, { deger: "akreditif", etiket: "Akreditif" }, { deger: "vadeli", etiket: "Vadeli" }] };
const KONTRAT = { kod: "kontrat", tip: "secim", boyut: "kapi", soru: "Alıcıyla yazılı kontrat var mı?", neden: "", etki: 2, guven: 0.4, varsayilan: "evet", ne_zaman: "simdi", secenekler: [{ deger: "evet" }, { deger: "hayir" }] };
const taslak = () => ({
  is_turu: { kod: "ilk-ihracat", ad: "İlk ihracat (gıda, AB)", mevcut: false }, baslik: "Kooperatifin ilk zeytinyağı ihracatı", kisa_ad: "Zeytinyağı ihracatı", anahtar_varlik: { tur: "kooperatif", ad: "Ege Kooperatif" },
  roller: [{ kod: "ben", ad: "Kooperatif müdürü", tip: "insan", kisi: "Berkin" }, { kod: "muh", ad: "Muhasebeci", tip: "insan", kisi: "Ayşe" }, { kod: "gm", ad: "Gümrük Müşaviri (Mert)", tip: "dis", kisi: "Mert" }],
  sorular: [JSON.parse(JSON.stringify(SERT)), JSON.parse(JSON.stringify(ODEME)), JSON.parse(JSON.stringify(KONTRAT))],
  varsayimlar: [{ boyut: "dis", metin: "Alıcı Almanya'da  Almanya'da." }],
  adimlar: [
    { id: "a1", tur_kod: "ihtiyac", ad: "İhracat ihtiyaçlarını (belge, girdi, belge, kanal) listele", sahip_rol: "ben", kriter: "liste hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a2", tur_kod: "sertifika-gida", ad: "Gıda kalite sertifikasını al", sahip_rol: "ben", kriter: "sertifika alındı", sure_tahmin_gun: 5, bagimli: ["a1"], boyut: "girdi", kosul: { soru: "sertifika", deger: "gida-kalite" } },
    { id: "a3", tur_kod: "sertifika-organik", ad: "Organik sertifikayı al", sahip_rol: "ben", kriter: "sertifika alındı", sure_tahmin_gun: 10, bagimli: ["a1"], boyut: "girdi", kosul: { soru: "sertifika", deger: "organik" } },
    { id: "a4", tur_kod: "etiket", ad: "AB etiket uyumunu kontrol et", sahip_rol: "muh", kriter: "etiket uygun", sure_tahmin_gun: 2, bagimli: ["a1"], boyut: "kisit" },
    { id: "a5", tur_kod: "fatura", ad: "Ticari faturayı hazırla", sahip_rol: "muh", kriter: "fatura hazır", sure_tahmin_gun: 1, bagimli: ["a4"], boyut: "girdi", kosul: { soru: "kontrat", deger: "evet" } },
    { id: "a6", tur_kod: "odeme-al", ad: "Ödemeyi al: peşin ya da akreditif veya vadeli", sahip_rol: "ben", kriter: "ödeme alındı", sure_tahmin_gun: 3, bagimli: ["a5"], boyut: "kapi" },
    { id: "a7", tur_kod: "ithalat-gumruk", ad: "Almanya ithalat gümrüğünü tamamla", sahip_rol: "gm", kriter: "mal çekildi", sure_tahmin_gun: 2, bagimli: ["a6"], boyut: "dis" },
    { id: "a8", tur_kod: "fiyat-karari", ad: "Fiyat teklifini onayla", sahip_rol: "ben", kriter: "fiyat onaylandı", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "karar", karar_gerekli: false },
  ],
});
const KART = {
  kod: "ilk-ihracat-ab-gida", baslik: "İlk ihracat: AB'ye gıda", alan: "ihracat", kural: "İlk ihracatta birlik kaydı, menşe ve fatura her durumda gerekir.", kaynak_ad: "Ticaret Bakanlığı", kaynak_url: "https://www.trade.gov.tr", _puan: 0.62,
  adimlar: [
    "Fiyat ve teslim şeklini belirle",
    { ad: "İhracatçı birliğine kaydol", tur_kod: "ihracatci-birligi-kaydi", anahtar: ["ihracatçı birliği", "birlik kaydı"], zorunlu: true, sahip_tip: "insan", sure: 3, kriter: "üyelik onaylandı", bekleyen_anahtar: ["fatura"] },
    { ad: "Ticari faturayı hazırla", tur_kod: "ticari-fatura", anahtar: ["fatura"], zorunlu: true, sahip_tip: "insan" },
  ],
};
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte", ms: 5 };
  if (req.tool.name === "adim_turu") return { input: { tur_kod: "ek-is", boyut: "genel" }, model: "sahte", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-s2" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "test", now: (NOW += 6e4), kanal: "oturum", llm }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimOf = (kod: string, no: number) => T.adim.find((s) => s.akis_id === akisOf(kod).id && s.no === no);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);

(async () => {
  // C2 · çoklu seçim cevapları
  {
    ok("'her-ikisi' seçeneği bütün olumlu seçenekleri karşılar", JSON.stringify(cevapDegerleri(SERT, "her-ikisi").sort()) === JSON.stringify(["gida-kalite", "her-ikisi", "organik"]), cevapDegerleri(SERT, "her-ikisi"));
    ok("serbest 'ikisi de' de karşılar", cevapDegerleri(SERT, "ikisi de").includes("organik") && cevapDegerleri(SERT, "ikisi de").includes("gida-kalite"), cevapDegerleri(SERT, "ikisi de"));
    ok("'organik, gıda kalite' iki seçeneğe eşlenir", cevapCoz(SERT, "organik, gıda kalite") === "organik|gida-kalite", cevapCoz(SERT, "organik, gıda kalite"));
    ok("tek cevap tek değer", JSON.stringify(cevapDegerleri(SERT, "Organik")) === JSON.stringify(["organik"]));
    ok("koşul çoklu cevapta sağlanır", kosulEslesir(SERT, "organik", "gida-kalite|organik") && !kosulEslesir(SERT, "organik", "gida-kalite"));
    ok("evet/hayır sorusunda 'hepsi' hayırı kapsamaz", JSON.stringify(cevapDegerleri(KONTRAT, "hepsi")) === JSON.stringify(["evet"]), cevapDegerleri(KONTRAT, "hepsi"));
    const t = taslak();
    const u = uygula(t, [t.sorular[0]], [], { sertifika: "her-ikisi" }, "Berkin");
    const adlar = u.adimlar.map((s: any) => s.ad);
    ok("her-ikisi iki sertifika adımını da kurar", adlar.includes("Gıda kalite sertifikasını al") && adlar.includes("Organik sertifikayı al"), adlar);
    const u2 = uygula(taslak(), [t.sorular[0]], [], { sertifika: "organik" }, "Berkin");
    ok("tek seçenek yalnız kendi dalını kurar", !u2.adimlar.some((s: any) => s.ad.startsWith("Gıda kalite")) && u2.adimlar.some((s: any) => s.ad.startsWith("Organik")));
  }

  // M6 · seçenek sayan adım soruyu etkili yapar; cevap adıma işlenir
  {
    const t = taslak();
    kuralDenetimi(t);
    const od = t.sorular.find((q: any) => q.kod === "odeme");
    ok("ödeme sorusu etkisiz sayılmaz (adım seçenekleri sayıyor)", !od._etkisiz && JSON.stringify(od._ilgili) === JSON.stringify(["a6"]), od);
    const s = sec(t, new Map(), new Map(), {});
    ok("ödeme sorusu sorulur", s.secilen.some((q: any) => q.kod === "odeme"), s.secilen.map((q: any) => q.kod));
    const u = uygula(t, s.secilen, s.varsayim, { odeme: "akreditif", sertifika: "gida-kalite" }, "Berkin");
    const a6 = u.adimlar.find((x: any) => x._tur === "odeme-al");
    ok("cevap adın içindeki seçenek listesine işlenir", a6.ad === "Ödemeyi al: Akreditif", a6.ad);
    const e = u.etkiler.find((x: any) => x.kod === "odeme");
    ok("etki kaydında değişen adım var", e && e.degisen.includes("a6"), e);
  }

  // M5 · kartın zorunlu işleri
  {
    const t = taslak();
    const n = zorunluIsler(t, [KART]);
    const fat = t.adimlar.find((s: any) => s.id === "a5");
    ok("zorunlu fatura koşuldan çıkar, dayanağı kart", !fat.kosul && fat.dayanak.includes("K:ilk-ihracat-ab-gida"), fat);
    const bir = t.adimlar.find((s: any) => s.tur_kod === "ihracatci-birligi-kaydi");
    ok("eksik zorunlu iş eklenir", !!bir && bir.dayanak[0] === "K:ilk-ihracat-ab-gida" && bir.sure_tahmin_gun === 3, bir);
    ok("eklenen işi bekleyen bağlanır (fatura birliği bekler)", fat.bagimli.includes(bir.id), fat.bagimli);
    ok("eklenen iş muhasebeciye verilmez", bir.sahip_rol === "ben", bir.sahip_rol);
    ok("notlar söylenir", n.some((x) => /koşulu kaldırıldı/.test(x)) && n.some((x) => /bilgi kartından eklendi/.test(x)), n);
    const t2 = taslak();
    ok("zayıf eşleşen kart zorlanmaz", zorunluIsler(t2, [{ ...KART, _puan: 0.35 }]).length === 0 && t2.adimlar.length === 8);
    ok("kart satırı nesne adımları okur", /tipik adımlar: Fiyat ve teslim şeklini belirle; İhracatçı birliğine kaydol \(zorunlu\)/.test(kartSatiri(KART)), kartSatiri(KART));
  }

  // m2 · dil ve sahip adı; m3 · sahiplik uyarısı; m5 · benzer iş
  {
    ok("parantez içi tekrar silinir", dilDuzelt("İhracat ihtiyaçlarını (belge, girdi, belge, kanal) listele") === "İhracat ihtiyaçlarını (belge, girdi, kanal) listele");
    ok("art arda aynı kelime tekleşir", dilDuzelt("Alıcı Almanya'da  Almanya'da.") === "Alıcı Almanya'da.", dilDuzelt("Alıcı Almanya'da  Almanya'da."));
    ok("iç içe parantezli sahip adı düzelir", sahipAdi({ ad: "Gümrük Müşaviri (Mert)", tip: "dis", kisi: "Mert" }) === "Mert (Gümrük Müşaviri)", sahipAdi({ ad: "Gümrük Müşaviri (Mert)", tip: "dis", kisi: "Mert" }));
    const n = sahiplikUyarilari(taslak());
    ok("etiket işi muhasebecide uyarılır", n.some((x) => /AB etiket/.test(x) && /üreticinin/.test(x)), n);
    ok("ithalat gümrüğü Türk müşavirde uyarılır", n.some((x) => /ithalat gümrüğü/.test(x) && /alıcının/.test(x)), n);
    const zayif = hatirlatmaSatirlari(taslak(), { deneyim: [{ akis_kod: "GKX8", varlik: "Hasat", _puan: 0.36 }], ders: [], kart: [], standart: null, gommeli: false }, [], new Map());
    ok("zayıf benzer iş 'dayandığım' diye gösterilmez", !zayif.some((x) => /Dayandığım/.test(x)) && zayif.some((x) => /GKX8/.test(x)), zayif);
    const guclu = hatirlatmaSatirlari(taslak(), { deneyim: [{ akis_kod: "Q3XB", varlik: "Ege", _puan: 0.7 }], ders: [], kart: [], standart: null, gommeli: false }, [], new Map());
    ok("güçlü benzer iş dayanak olarak söylenir", guclu.some((x) => /Dayandığım benzer geçmiş işler: Q3XB/.test(x)), guclu);
  }

  // K11 · karar ve çıktı alanları
  {
    ok("karar_gerekli=false addaki 'onay'ı ezer", kararAdimi({ ad: "Fiyat teklifini onayla", karar_gerekli: false }) === false);
    ok("karar_gerekli=true kesin", kararAdimi({ ad: "Listeyi incele", karar_gerekli: true }) === true);
    ok("boşsa kural (eski adımlar)", kararAdimi({ ad: "Bütçe onayı" }) === true && kararAdimi({ ad: "Logo tasarımı" }) === false);
    ok("çıktı: beklenen çıktı yazılmışsa", alanDoldur({ ad: "Toplantı yap", beklenen_cikti: "toplantı notu" }).cikti_bekleniyor === true);
    ok("çıktı: üreten fiil", alanDoldur({ ad: "Teklif mektubunu hazırla" }).cikti_bekleniyor === true && alanDoldur({ ad: "Kargonun gelmesini bekle" }).cikti_bekleniyor === false);
    ok("karar adımı varsayılan olarak çıktı beklemez", alanDoldur({ ad: "Bütçe kararı ver" }).cikti_bekleniyor === false);
  }

  // Uçtan uca: taslak → düzelt → kur (C2, M5 kart yok, M8, m1)
  {
    let r = await callTool("devir_tasla", { cumle: "Kooperatifin zeytinyağını ilk kez Almanya'ya ihraç etmem lazım", baglam: { varlik: "Ege Kooperatif", iliski: "kendi" } }, ctx());
    const kod = /Taslak (T\w+)/.exec(r)![1];
    ok("taslak yanıtı akışın kısa adını verir", /kısa ad: Zeytinyağı ihracatı/.test(r), r.split("\n").slice(0, 2));
    ok("taslak yanıtı devir_taslak_duzelt'i söyler", /devir_taslak_duzelt\(\{ taslak: "/.test(r));
    ok("taslak sahip adı iç içe parantezsiz", /Mert \(Gümrük Müşaviri\)/.test(r) && !/\(Mert\)\)/.test(r), r.split("\n").filter((l) => /Mert/.test(l)));
    ok("taslakta dil tekrarı düzeltildi", /\(belge, girdi, kanal\)/.test(r));
    ok("taslakta sahiplik uyarısı var", /AB etiket uyumunu kontrol et" Ayşe/.test(r), r.split("\n").filter((l) => /Ayşe/.test(l)));
    // düzelt: 4. adımın sahibi, 8. adım sil, yeni adım ekle (fatura onu bekler), 5. adımın koşulu kalkar
    r = await callTool("devir_taslak_duzelt", { taslak: kod, duzelt: [{ no: 4, sahip: "Berkin", kriter: "etiket AB 2022/2104'e uygun" }, { no: 5, kosul: null }], sil: [8], ekle: [{ ad: "EUR.1 menşe belgesini al", kisa_ad: "EUR.1 belgesini al", sahip: "Berkin", kriter: "EUR.1 onaylı", sure_tahmin_gun: 1, bagimli: [1], bekleyenler: [5], cikti_bekleniyor: true }] }, ctx());
    ok("düzeltme yanıtı değişiklikleri sayar", /4\. AB etiket uyumunu kontrol et: kriter, sahip → Berkin/.test(r) && /koşul kaldırıldı/.test(r) && /\+ EUR\.1/.test(r) && /− Fiyat teklifini onayla/.test(r), r);
    const tk = T.taslak.find((x) => x.kisa_kod === kod);
    const A = tk.taslak.adimlar;
    ok("silinen adım taslaktan çıktı", !A.some((s: any) => s.id === "a8") && A.length === 8, A.map((s: any) => s.id));
    ok("eklenen adım bağlandı", A.find((s: any) => s.id === "a5").bagimli.includes(A.find((s: any) => /EUR/.test(s.ad)).id));
    ok("sahip kişi role bağlandı", A.find((s: any) => s.id === "a4").sahip_rol === "ben");
    let hataMsg = "";
    try { await callTool("devir_taslak_duzelt", { taslak: kod, duzelt: [{ no: 2, kosul: { soru: "sertifika", deger: "yok-boyle" } }], sil: [3] }, ctx()); } catch (e) { hataMsg = (e as Error).message; }
    const A2 = T.taslak.find((x) => x.kisa_kod === kod).taslak.adimlar;
    ok("geçersiz koşul reddedilir, hiçbir şey yazılmaz", /seçeneklerinden olmalı/.test(hataMsg) && A2.some((s: any) => s.id === "a3"), hataMsg);
    // kur: sertifika iki değer
    r = await callTool("devir_akis_olustur", { taslak: kod, cevaplar: { sertifika: "organik, gıda kalite", odeme: "akreditif", kontrat: "hayir" } }, ctx());
    const ak = /oluşturuldu: (\w+)/.exec(r)![1];
    const S = adimlar(ak);
    ok("iki sertifika adımı da kuruldu", S.some((s) => /Gıda kalite/.test(s.ad)) && S.some((s) => /Organik/.test(s.ad)), S.map((s) => s.ad));
    ok("fatura kontrat=hayır olsa da kuruldu (koşul taslakta kaldırıldı)", S.some((s) => /faturayı/.test(s.ad)));
    ok("ödeme adımı cevaba göre yazıldı", S.some((s) => s.ad === "Ödemeyi al: Akreditif"), S.map((s) => s.ad));
    ok("kurulum yanıtı kısa adları verir", /kısa ad: EUR\.1 belgesini al/.test(r) && /Kısa ad: Zeytinyağı ihracatı/.test(r), r);
    ok("karar/çıktı alanları kuruluşta dolu", S.every((s) => typeof s.karar_gerekli === "boolean" && typeof s.cikti_bekleniyor === "boolean"), S.map((s) => [s.ad, s.karar_gerekli, s.cikti_bekleniyor]));
    const eur = S.find((s) => /EUR/.test(s.ad));
    ok("verilen çıktı alanı korunur", eur.cikti_bekleniyor === true && eur.karar_gerekli === false);
    ok("ihtiyaç listesi: motorun karar_gerekli=false, cikti=true", S[0].karar_gerekli === false && S[0].cikti_bekleniyor === true, S[0]);
    let dz = "";
    try { await callTool("devir_taslak_duzelt", { taslak: kod, sil: [1] }, ctx()); } catch (e) { dz = (e as Error).message; }
    ok("kurulmuş taslak düzeltilemez; kurulu akış araçları önerilir", /akış kuruldu/.test(dz) && /devir_adim_guncelle/.test(dz), dz);

    // m1 · devir_akis ve devir_adim_oku kısa adı söyler
    r = await callTool("devir_akis", { akis: ak }, ctx());
    ok("devir_akis başlığında akışın kısa adı", new RegExp(`${ak} · .* · kısa ad: Zeytinyağı ihracatı`).test(r), r.split("\n")[0]);
    ok("devir_akis satırında adımın kısa adı", /EUR\.1 menşe belgesini al \(kısa ad: EUR\.1 belgesini al\)/.test(r));
    r = await callTool("devir_adim_oku", { akis: ak, no: eur.no }, ctx());
    ok("devir_adim_oku kısa adı verir", /Kısa ad: EUR\.1 belgesini al/.test(r), r.split("\n").slice(0, 3));
    r = await callTool("devir_adim_guncelle", { akis: ak, no: eur.no, kisa_ad: "Menşe belgesini al" }, ctx());
    ok("kısa ad düzeltmesinin yanıtı yeni adı söyler", /kısa ad → Menşe belgesini al/.test(r), r);

    // M8 · kurulu adımda ad, kriter, açıklama; karar alanı
    r = await callTool("devir_adim_guncelle", { akis: ak, no: eur.no, ad: "EUR.1 dolaşım belgesini al", kriter: "EUR.1 gümrükte onaylandı", aciklama: "İhracatçı birliği üzerinden" }, ctx());
    const e2 = adimOf(ak, eur.no);
    ok("ad, kriter ve açıklama değişir", e2.ad === "EUR.1 dolaşım belgesini al" && e2.kriter === "EUR.1 gümrükte onaylandı" && e2.aciklama === "İhracatçı birliği üzerinden", e2);
    ok("yanıt değişikliği söyler", /ad → EUR\.1 dolaşım belgesini al/.test(r) && /kriter güncellendi/.test(r), r);
    let bos = "";
    try { await callTool("devir_adim_guncelle", { akis: ak, no: eur.no, ad: "  " }, ctx()); } catch (e) { bos = (e as Error).message; }
    ok("boş ad reddedilir", /boş olamaz/.test(bos), bos);
    const od = S.find((s) => /Ödemeyi al/.test(s.ad));
    await callTool("devir_adim_guncelle", { akis: ak, no: od.no, karar_gerekli: false }, ctx());
    ok("karar_gerekli=false yazılır ve karar adımı olmaz", adimOf(ak, od.no).karar_gerekli === false && !kararAdimi(adimOf(ak, od.no)));
    await callTool("devir_adim_guncelle", { akis: ak, no: eur.no, karar_kriteri: "belge türü seçimi" }, ctx());
    ok("karar kriteri yazılan adım karar adımı olur", adimOf(ak, eur.no).karar_gerekli === true);
    // adim_ekle alanları
    r = await callTool("devir_adim_ekle", { akis: ak, ad: "Sigorta poliçesini al", sahip: "Berkin", kriter: "poliçe var", neden: "unutulmuştu", cikti_bekleniyor: true, beklenen_cikti: "poliçe PDF" }, ctx());
    const son = adimlar(ak).at(-1);
    ok("adım eklerken çıktı alanları yazılır", son.cikti_bekleniyor === true && son.beklenen_cikti === "poliçe PDF" && son.karar_gerekli === false, son);
  }

  // C2 · sonradan cevaplanan çoklu cevap: iki dal da kalır
  {
    let r = await callTool("devir_tasla", { cumle: "İkinci ihracat partisi", baglam: { varlik: "Batı Kooperatif", iliski: "kendi" } }, ctx());
    const kod = /Taslak (T\w+)/.exec(r)![1];
    r = await callTool("devir_akis_olustur", { taslak: kod, cevaplar: { sertifika: "bilmiyorum" } }, ctx());
    const ak = /oluşturuldu: (\w+)/.exec(r)![1];
    r = await callTool("devir_cevapla", { akis: ak, soru: "sertifika", cevap: "ikisi de" }, ctx());
    const S = adimlar(ak);
    const g = S.find((s) => /Gıda kalite/.test(s.ad)), o = S.find((s) => /Organik/.test(s.ad));
    ok("'ikisi de' cevabı iki sertifika adımını da korur", g.durum !== "atlandi" && o.durum !== "atlandi" && !g.kosul && !o.kosul, [g.durum, o.durum, r]);
    ok("cevap seçenek değerleriyle kaydedilir", /her-ikisi\|gida-kalite\|organik/.test(akisOf(ak).baglam.cevaplar.sertifika), akisOf(ak).baglam.cevaplar);
  }

  // 0.26.1 · canlı deneme (TP8RW) bulguları
  {
    // EUR.1 adımı koşulda kalmıştı: faturanın açıklamasında "EUR.1" geçtiği için kart o adımı eşlemişti
    const t: any = { roller: [{ kod: "ben", ad: "Kooperatif", tip: "insan" }], adimlar: [
      { id: "f", tur_kod: "fatura-duzenle", ad: "Ticari faturayı düzenle", aciklama: "EUR.1 ve menşe için gerekli", sahip_rol: "ben", bagimli: [] },
      { id: "e", tur_kod: "eur1-duzenle", ad: "EUR.1 dolaşım belgesini hazırlat", sahip_rol: "ben", bagimli: ["f"], kosul: { soru: "fatura_modeli", deger: "evet" } },
    ] };
    const K = { kod: "k", adimlar: [{ ad: "EUR.1 belgesini al", tur_kod: "eur1-mense", anahtar: ["eur.1", "eur1", "menşe"], zorunlu: true }] };
    zorunluIsler(t, [K]);
    const e = t.adimlar.find((s: any) => s.id === "e");
    ok("zorunlu iş adında geçen adımı eşler, açıklamada geçeni değil", !e.kosul && e.dayanak.includes("K:k") && !(t.adimlar[0].dayanak || []).includes("K:k"), t.adimlar);
    // denetçi var olan işi başka sözlerle yeniden eklemesin
    const t2: any = { roller: [{ kod: "ben", ad: "Kooperatif", tip: "insan" }], sorular: [], adimlar: [{ id: "a", tur_kod: "analiz", ad: "Zeytinyağının kimyasal ve duyusal analizini akredite laboratuvara yaptır ve sonucu al", sahip_rol: "ben", bagimli: [] }] };
    const r = denetimUygula(t2, { adim_ekle: [{ ad: "Zeytinyağının kimyasal ve duyusal analiz raporunu akredite laboratuvarından al", tur_kod: "belge", bagimli: ["a"] }] });
    ok("denetçinin aynı işi yeniden eklemesi reddedilir", t2.adimlar.length === 1 && JSON.stringify(r).includes("aynı iş"), r);
    // "İhracatçı" seçeneği küçük harfle yazılmış adımda da bulunur
    const L = { kod: "lojistik", tip: "secim", soru: "Taşımayı kim üstlenecek?", varsayilan: "ihracatci", secenekler: [{ deger: "ihracatci", etiket: "İhracatçı" }, { deger: "alici", etiket: "Alıcı" }, { deger: "disaridan", etiket: "Dışarıdan lojistikçi" }] };
    ok("Türkçe büyük İ'li seçenek adımda eşleşir", JSON.stringify(soruAdimlari({ adimlar: [{ id: "x", ad: "Taşımayı kesinleştir (ihracatçı, alıcı veya dış lojistikçi ile)" }] }, L)) === '["x"]');
    // bilinmiyor varsayılanlı ölü soru: not, varsayımlarla aynı değeri söyler
    const t3: any = { adimlar: [{ id: "a", ad: "Hazırla", bagimli: [] }], sorular: [{ kod: "lucid", tip: "secim", soru: "LUCID kaydı var mı?", varsayilan: "bilinmiyor", secenekler: [{ deger: "evet", etiket: "Evet" }, { deger: "hayir", etiket: "Hayır" }, { deger: "bilinmiyor", etiket: "Bilinmiyor" }] }] };
    const n3 = kuralDenetimi(t3), s3 = sec(t3, new Map(), new Map(), {});
    const v3 = s3.varsayim.find((q: any) => q.kod === "lucid");
    ok("ölü sorunun notu ile varsayım aynı değeri söyler", n3.some((x) => x.includes('"Evet" varsayıldı')) && v3?.cevap === "evet", [n3, v3?.cevap]);
    // hatırlatma satırı uzun adım listesini kısaltır, kısa adı kullanır
    const t4: any = { adimlar: [1, 2, 3, 4, 5].map((i) => ({ id: `s${i}`, ad: `Uzun adım adı ${i}`, kisa_ad: `Adım ${i}`, dayanak: ["K:k"] })) };
    const h4 = hatirlatmaSatirlari(t4, { deneyim: [], ders: [], kart: [{ kod: "k", kural: "Kural.", kaynak_ad: "Kaynak" }], standart: null, gommeli: false } as any, [], new Map());
    ok("hatırlatma ilk üç adımı ve kalan sayıyı yazar", h4[0]?.startsWith('"Adım 1", "Adım 2", "Adım 3", 2 adım daha: Kural.'), h4);
  }

  console.log(hata ? `\n${hata} hata` : "\nS2 testleri geçti");
  if (hata) process.exitCode = 1;
})();
