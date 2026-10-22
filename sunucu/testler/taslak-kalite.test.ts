// P1-E: 22 Eki TZM8C vakası (e-ticaret girişimi taslağına B2B dersleri, ham adlı denetçi adımları, etkisiz şirket türü sorusu)
import { denetimUygula, kuralDenetimi, sec, turDogrula } from "../tasarim.ts";
import { hatirla, derslerUygula } from "../bellek.ts";

let hata = 0;
const ok = (ad: string, kosul: boolean) => { console.log(`${kosul ? "✓" : "✗"} ${ad}`); if (!kosul) hata++; };
const kopya = (x: any) => JSON.parse(JSON.stringify(x));

const CUMLE = "Beyaz yaka çalışırken şirket kurup Trendyol, Hepsiburada gibi pazaryerlerinde AI agent'larla satış yapmak istiyorum";
const taslak = () => ({
  is_turu: { kod: "musteri-onboarding", ad: "B2B SaaS · kurumsal müşteri onboarding'i (imzadan ilk değere)", mevcut: true },
  baslik: "Beyaz yaka çalışırken e-ticaret girişimi (şirket kuruluşu, pazaryeri entegrasyonu)",
  roller: [{ kod: "girisimci", ad: "Girişimci", tip: "insan", kisi: "Berkin" }, { kod: "mali-musavir", ad: "Mali müşavir", tip: "dis" }],
  sorular: [
    { kod: "sirket_turu", tip: "secim", etki: 3, soru: "Şirket türü?", boyut: "sonuc", guven: 0.7, varsayilan: "ltd", secenekler: [{ deger: "ltd", etiket: "Limited" }, { deger: "as", etiket: "Anonim" }, { deger: "sahis", etiket: "Şahıs" }], ne_zaman: "simdi" },
    { kod: "pazaryeri_secim", tip: "secim", etki: 2, soru: "Hangi pazaryeri?", boyut: "sonuc", guven: 0.7, varsayilan: "hepsi", secenekler: [{ deger: "hepsi" }, { deger: "trendyol" }], ne_zaman: "simdi" },
    { kod: "sertifika", tip: "secim", etki: 2, soru: "Özel sertifika gerekecek mi?", boyut: "girdi", guven: 0.3, varsayilan: "bilinmiyor", secenekler: [{ deger: "gerekiyor", etiket: "Evet" }, { deger: "gerekmiyor", etiket: "Hayır" }, { deger: "bilinmiyor", etiket: "Bilmiyorum" }], ne_zaman: "simdi" },
  ],
  adimlar: [
    { id: "strateji", ad: "Başlangıç pazaryeri stratejisini netleştir", tur_kod: "strateji-belirle", sahip_rol: "girisimci", sure_tahmin_gun: 2, bagimli: [], boyut: "sonuc" },
    { id: "mersis", ad: "Şirket ana sözleşmesini MERSİS'te hazırla", tur_kod: "sozlesme-taslak", sahip_rol: "girisimci", sure_tahmin_gun: 2, bagimli: ["strateji"], kosul: null, dayanak: ["K:sirket-kurulus-ltd-as"] },
    { id: "noter", ad: "Ana sözleşmeyi noterde imzala", tur_kod: "sozlesme-onay", sahip_rol: "girisimci", sure_tahmin_gun: 1, bagimli: ["mersis"], kosul: null },
    { id: "tescil", ad: "Ticaret sicil tescil başvurusu yap", tur_kod: "tescil-basvuru", sahip_rol: "girisimci", sure_tahmin_gun: 2, bagimli: ["noter"] },
    { id: "sertifika-topla", ad: "Sertifika belgelerini topla", tur_kod: "sertifika-topla", sahip_rol: "girisimci", sure_tahmin_gun: 7, bagimli: ["strateji"], kosul: { soru: "sertifika", deger: "gerekiyor" } },
  ],
});
// canlıda denetçinin (gpt-4.1-mini) döndürdüğü yamalar
const DENETCI = {
  bagimlilik: [], soru_ekle: [], notlar: [],
  adim_ekle: [
    { ad: "sirket-turu-sec", tur_kod: "sirketturu-sec", sahip_rol: "girisimci", kriter: "seçildi", sure_tahmin_gun: 1, bagimli: [], neden: "şirket türü kararı yok" },
    { ad: "pazaryeri-secim-soru", tur_kod: "pazaryeri-secim-soru", sahip_rol: "girisimci", kriter: "seçildi", sure_tahmin_gun: 0.5, bagimli: [], neden: "pazaryeri seçimi yok" },
    { ad: "Tescilden önce yasal bekleme süresi", tur_kod: "kapi-iverme", sahip_rol: "girisimci", kriter: "süre doldu", sure_tahmin_gun: 30, bagimli: ["noter"], neden: "30 günlük bekleme" },
  ],
  kosul_ekle: [
    { id: "mersis", soru: "sirket_turu", deger: "ltd|as", neden: "şahıs şirketinde ana sözleşme yok" },
    { id: "noter", soru: "sirket_turu", deger: "ltd|as", neden: "şahıs şirketinde noter imzası yok" },
    { id: "tescil", soru: "sirket_turu", deger: "ltd|as|sahis", neden: "her türde gerekli" },
    { id: "strateji", soru: "yok_boyle_soru", deger: "x", neden: "" },
  ],
};

// 4 · denetçi yamaları doğrulanır
{
  const t = taslak();
  const d = denetimUygula(t, kopya(DENETCI));
  const adlar = t.adimlar.map((s: any) => s.ad);
  ok("ham kod adlı denetçi adımı eklenmez (sirket-turu-sec)", !adlar.includes("sirket-turu-sec"));
  ok("soruyu adım yapan yama eklenmez (pazaryeri-secim-soru)", !adlar.includes("pazaryeri-secim-soru"));
  ok("30 günlük denetçi adımı eklenmez", !adlar.some((a: string) => /bekleme/.test(a)));
  ok("reddedilenler notlarda görünür", d.not.filter((x: string) => /eklenmedi/.test(x)).length === 3);
  ok("kosul_ekle: MERSİS ve noter yalnızca ltd|as", t.adimlar.find((s: any) => s.id === "mersis").kosul?.deger === "ltd|as" && t.adimlar.find((s: any) => s.id === "noter").kosul?.deger === "ltd|as");
  ok("kosul_ekle: her seçenekte gerekli adıma koşul konmaz", !t.adimlar.find((s: any) => s.id === "tescil").kosul);
  ok("kosul_ekle: bilinmeyen soruya koşul konmaz", !t.adimlar.find((s: any) => s.id === "strateji").kosul);
  const t2 = taslak();
  denetimUygula(t2, { adim_ekle: [{ ad: "Mali müşavirle sözleşme yap", tur_kod: "musavir-sozlesme", sahip_rol: "girisimci", kriter: "imzalandı", sure_tahmin_gun: 1, bagimli: [], bekleyen: ["tescil"], neden: "" }] });
  ok("insan adlı, bağlı, kısa denetçi adımı eklenir", t2.adimlar.some((s: any) => s.ad === "Mali müşavirle sözleşme yap"));
  const t3 = taslak();
  denetimUygula(t3, { adim_ekle: [{ ad: "Bağımsız bir iş yap", tur_kod: "bagimsiz", sahip_rol: "girisimci", kriter: "tamam", sure_tahmin_gun: 1, bagimli: [], neden: "" }] });
  ok("hiçbir adıma bağlanmayan denetçi adımı eklenmez", !t3.adimlar.some((s: any) => s.ad === "Bağımsız bir iş yap"));
}

// 5 · etkisiz soru sorulmaz, varsayım olarak görünür
{
  const t = taslak();
  const n = kuralDenetimi(t);
  ok("koşulsuz akışta sirket_turu etkisiz işaretlenir", n.some((x) => x.startsWith("[sirket_turu]")) && t.sorular[0]._etkisiz === true);
  ok("koşulda geçen sertifika etkisiz değil", !t.sorular[2]._etkisiz);
  const s = sec(t, new Map(), new Map(), {});
  ok("etkisiz soru sorulmaz", !s.secilen.some((q: any) => q.kod === "sirket_turu"));
  ok("etkisiz soru varsayım olarak listelenir", s.varsayim.some((q: any) => q.kod === "sirket_turu" && q.kaynak === "olu" && q.cevap === "ltd"));
  const t2 = taslak();
  denetimUygula(t2, kopya(DENETCI));
  kuralDenetimi(t2);
  const s2 = sec(t2, new Map(), new Map(), {});
  ok("denetçi koşul bağlayınca sirket_turu sorulur", s2.secilen.some((q: any) => q.kod === "sirket_turu"));
  const t3 = taslak(); t3.sorular[1].dayanak = ["D7"];
  kuralDenetimi(t3);
  ok("dersten gelen soru etkisiz sayılmaz", !t3.sorular[1]._etkisiz);
}

// 6 · "bilinmiyor" seçenek ya da varsayılan değildir
{
  const t = taslak();
  const s = sec(t, new Map(), new Map(), {});
  const q = [...s.secilen, ...s.varsayim].find((x: any) => x.kod === "sertifika");
  ok("bilinmiyor varsayılan olmaz; ilk gerçek seçenek", q.varsayilan === "gerekiyor");
  ok("bilinmiyor seçeneği tek biçimde sonda", q.secenekler.map((o: any) => o.deger).join(",") === "gerekiyor,gerekmiyor,bilmiyorum");
  ok("varsayılanı bilinmeyen soru sorulur", s.secilen.some((x: any) => x.kod === "sertifika"));
  ok("bilinmiyor içermeyen soruya seçenek eklenmez", [...s.secilen, ...s.varsayim].find((x: any) => x.kod === "pazaryeri_secim").secenekler.length === 2);
}

// 3 · iş türü etiketi işle uyuşmalı
{
  const turler = [{ kod: "musteri-onboarding", ad: "B2B SaaS · kurumsal müşteri onboarding'i (imzadan ilk değere)" }, { kod: "tedarikci-kazanimi", ad: "Tedarikçi kazanımı" }];
  const t = taslak();
  const n = turDogrula(t, turler, CUMLE);
  ok("ortak kökü olmayan mevcut tür reddedilir, yeni tür açılır", n.length === 1 && t.is_turu.kod !== "musteri-onboarding" && t.is_turu.mevcut === false);
  const t2 = { ...taslak(), is_turu: { kod: "tedarikci-kazanimi", ad: "Tedarikçi kazanımı" }, baslik: "Karadeniz'den üç tedarikçi kazan" };
  ok("uyan mevcut tür korunur", turDogrula(t2, turler, "Karadeniz'den 3 tedarikçi kazanmam lazım").length === 0 && t2.is_turu.kod === "tedarikci-kazanimi");
  const t3 = { ...taslak(), is_turu: { kod: "yeni-tur", ad: "Yeni" } };
  ok("listede olmayan tür dokunulmaz", turDogrula(t3, turler, CUMLE).length === 0 && t3.is_turu.kod === "yeni-tur");
}

// 1 · uzak benzer işin kesin dersi zorla eklenmez
{
  const vek = (c: number) => [c, Math.sqrt(1 - c * c)];
  const satir = (puan: number) => ({
    deneyim: [{ id: 1, ws_id: "w", akis_kod: "T1", varlik: "Nova Sigorta", is_turu: "musteri-onboarding", gomme: vek(puan) }],
    ders: [{ id: 1, ws_id: "w", durum: "kesin", kapsam: "ekip", guven: 1, etki: "adim_ekle", metin: "SDK onboarding'inde IP izin listesi talebi açılmalı", kanit: [{ akis: "T1" }, { akis: "T2" }], adim: { ad: "IP izin listesi talebi", tur_kod: "ip-izin-listesi", sahip_tip: "dis" }, gomme: vek(0.3) }],
  });
  const ctx = (T: any) => ({ ws: { id: "w" }, now: Date.now(), gom: async (m: string[]) => m.map(() => [1, 0]), db: { many: async (t: string) => T[t] || [], update: async () => {}, one: async () => null, insert: async (_t: string, r: any[]) => r } });
  const uzak = await hatirla(ctx(satir(0.54)) as any, { cumle: CUMLE });
  const t = taslak();
  derslerUygula(t, uzak.ders);
  ok("0,54 benzer işin dersi ipucu kalır, zorla eklenmez (TZM8C)", uzak.ders.length === 1 && uzak.ders[0]._yakin === false && !t.adimlar.some((s: any) => s.ad === "IP izin listesi talebi"));
  const yakin = await hatirla(ctx(satir(0.8)) as any, { cumle: CUMLE });
  const t2 = taslak();
  derslerUygula(t2, yakin.ders);
  ok("gerçekten yakın işin kesin dersi eklenir", yakin.ders[0]?._yakin === true && t2.adimlar.some((s: any) => s.ad === "IP izin listesi talebi"));
}

if (hata) { console.error(`${hata} test başarısız`); process.exit(1); }
