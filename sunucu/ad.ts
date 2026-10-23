// P1-F ad sözleşmesi: akış ve adımın kısa adı. Arayüz adı kesmez; kısa adı sunucu verir (kayıtlı ad ya da LLM'siz kural).

export const KISA_AD_EN_COK = 40;

const kucuk = (s: string) => s.toLocaleLowerCase("tr");
const BAGLAC = new Set(["ve", "ile", "veya", "ya", "da", "de", "için", "gibi", "bu", "şu", "bir", "her", "olan", "vs", "vb", "göre", "adına", "öncesi", "sonrası"]);
// adın sonunda kalırsa cümleyi yarım bırakan sözcükler
// niteleyen olarak kalabilir ("İlk görüşmeleri yap", "Son teyit")
const NITEL = new Set(["ilk", "son", "yeni"]);
const ASKIDA = new Set([...BAGLAC, "kendi", "ilk", "son", "aynı", "yeni", "mevcut", "ayrıca", "en", "az", "çok", "biz", "mi", "mı", "mu", "mü", "varsa"]);
// belirtme ekine benzeyen sıfatlar (nesne sayılmaz)
const SIFAT = new Set(["mali", "teknik", "genel", "resmi", "yerli", "ticari", "sosyal", "dijital", "fiziki", "hukuki", "idari", "nihai", "ilgili", "gerekli", "revize", "detaylı", "haftalık", "aylık", "günlük", "yıllık"]);
// emir kipindeki fiiller; üçüncü tekil (gönderir, kurar) da tanınır
const FIIL = new Set(("al ver yap hazırla topla gönder iste onayla imzala imzalat öde kur seç belirle netleştir kesinleştir tamamla incele ilet bul gir yaz ayarla " +
  "tasarla yayınla zamanla raporla duyur arşivle bağla çıkar doğrula taslakla kapat başla başvur bekle öğren görüş sağla ata işle ol koş taşı aç kararlaştır paylaş " +
  "planla değerlendir güncelle ekle sil ara hesapla karşılaştır listele derle düzenle oluştur belgele çalıştır izle dene sun anlaş tut getir yükle kaydet üret yürüt " +
  "eğit tanımla teyitle sor çöz bitir dağıt tasla çek düşün seç sat").split(" "));
// isim + yardımcı fiil: "kontrol et", "teslim eder", "karar ver", "teyit yap"
const ISIM_FIIL = new Set(["kontrol", "teslim", "takip", "kabul", "teyit", "rezerve", "organize", "tespit", "talep", "kayıt", "servis", "analiz", "test", "tahsil", "iptal", "sevk", "karar", "revize"]);
const YARDIMCI = new Set(["et", "eder", "yap", "yapar", "ol", "olur", "ver", "verir", "al", "alır"]);

const harfBuyut = (s: string) => (s ? s[0].toLocaleUpperCase("tr") + s.slice(1) : s);
const harfKucult = (s: string) => (s && !/^[A-ZÇĞİÖŞÜ0-9]{2,}/.test(s) && !/^[A-ZÇĞİÖŞÜ]\S*[A-Z]/.test(s) ? kucuk(s[0]) + s.slice(1) : s);
const sigar = (s: string) => s.length <= KISA_AD_EN_COK;
const sayiyla = (w: string) => /^[\d≥≤+]/.test(w);
const ozel = (w: string) => /^[A-ZÇĞİÖŞÜ]/.test(w);
// -ın/-in/-un/-ün, -nın/-nin… tamlayan eki (mektubunun, kooperatiflerinin)
const tamlayan = (w: string) => w.length > 4 && /(n[ıiuü]n|[^aeıioöuü'][ıiuü]n)$/i.test(w);
// belirtme / iyelik eki: -ı -i -u -ü (yı, nı, sı, ları…)
const belirtme = (w: string) => w.length > 3 && /[ıiuü]$/i.test(w) && !ASKIDA.has(kucuk(w)) && !SIFAT.has(kucuk(w));
const ayrilma = (w: string) => /('?(d|t)[ae]n|'?y?l[ae]|'?(d|t)[ae])$/i.test(w) && w.length > 3;
const yonelme = (w: string) => /('?(y|n)?[ae])$/i.test(w) && w.length > 3 && !belirtme(w);
// i/ı/u/ü ile biten yalın adlar (iyelik sanılmasın)
const YALIN = new Set(["koşu", "bilgi", "yetki", "müşteri", "ölçü", "örtü", "kayıtlı", "süreli"]);
// tamlama öğesindeki iyelik: fiyatı → fiyat, sözleşmesi → sözleşme, kartı → kart; tedarikçi, koşu yalın kalır
const iyeliksiz = (w: string) => YALIN.has(kucuk(w)) || /[cç][ıiuü]$/i.test(w) ? w : w.replace(/(?<=[aeıioöuü])s[ıiuü]$|(?<=[^aeıioöuü'])[ıiuü]$/i, "").replace(/ğ$/, "k");

function fiilMi(w: string): boolean {
  const k = kucuk(w);
  if (FIIL.has(k)) return true;
  for (const f of FIIL) if (k.startsWith(f) && /^[ıiuüae]?r$/.test(k.slice(f.length))) return true;
  return false;
}
/** Sondaki fiilin sözcük sayısı (0: fiil yok). */
function fiilBoyu(w: string[]): number {
  const n = w.length;
  if (n >= 2 && ISIM_FIIL.has(kucuk(w[n - 2])) && (YARDIMCI.has(kucuk(w[n - 1])) || fiilMi(w[n - 1]))) return 2;
  return n >= 1 && fiilMi(w[n - 1]) ? 1 : 0;
}

/** Ad metnini temizler: parantez, uzun tire sonrası açıklama, boşluk. */
function temizle(ad: string): string {
  return String(ad || "")
    .replace(/\s*\([^)]*\)?/g, " ")
    .replace(/\s+[–—]\s+.*$/, "")
    .replace(/(\S+) edip etmeyeceğine karar ver/i, "$1 kararını ver")
    .replace(/\bson \d+ gün\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;:.]+$/, "");
}

/** Askıda kalan sözcükleri iki uçtan at. */
function uclariDuzelt(w: string[]): string[] {
  const x = w.map((v) => v.replace(/,$/, ""));
  while (x.length > 1 && (ASKIDA.has(kucuk(x[x.length - 1])) || tamlayan(x[x.length - 1]) || sayiyla(x[x.length - 1]))) x.pop();
  while (x.length > 1 && (BAGLAC.has(kucuk(x[0])) || sayiyla(x[0]))) x.shift();
  return x;
}

/** İsim tamlamasında baş sondadır: sığan en uzun son; ilk öğenin iyeliği düşer ("yemeği hazırlama planı" → "Yemek hazırlama planı"). */
function sondan(w: string[]): string {
  let i = 0;
  while (i < w.length - 1 && w.slice(i).join(" ").length > KISA_AD_EN_COK) i++;
  const x = uclariDuzelt(w.slice(i));
  while (i > 0 && x.length > 1 && ayrilma(x[0])) x.shift(); // "müşavirle kuruluş görüşmesi" → "kuruluş görüşmesi"
  if (i > 0 && x.length > 1 && belirtme(x[0]) && !ozel(x[0])) x[0] = iyeliksiz(x[0]);
  return x.join(" ");
}

/** Fiille biten adım: [niteleyen] nesne [yönelme] fiil ("Teminat mektubunu al", "Ürünleri platforma gir"). */
function nesneFiil(w: string[], f: number, soru: boolean): string | null {
  const fiil = soru ? [] : w.slice(w.length - f);
  let n = w.length - f - 1;
  const yon = n >= 1 && yonelme(w[n]) && !ayrilma(w[n]) ? w[n] : null;
  while (n >= 0 && (ayrilma(w[n]) || !belirtme(w[n]) || BAGLAC.has(kucuk(w[n])))) n--;
  const adaylar: string[][] = [];
  if (n < 0) {
    // belirtme eksiz nesne: "teklif al", "numune gönderir", "yönetimleriyle görüş"
    const b = w.length - f - 1;
    if (b < 0 || BAGLAC.has(kucuk(w[b]))) return null;
    const on = b - 1 >= 0 && !ayrilma(w[b - 1]) && !BAGLAC.has(kucuk(w[b - 1])) && !sayiyla(w[b - 1]) && !/s$|ler$|lar$/.test(kucuk(w[b - 1])) ? [w[b - 1]] : [];
    adaylar.push([...on, w[b], ...fiil], [w[b], ...fiil]);
  } else {
    const nesne = w[n];
    const araYon = yon && w.indexOf(yon) > n ? [yon] : [];
    let m = n - 1;
    // "salon ve süit teklifi al": bağlaçlı iki öğe sığarsa ikisi
    if (m >= 1 && kucuk(w[m - 1]) === "ve" && m - 2 >= 0 && !ayrilma(w[m - 2]) && !belirtme(w[m - 2]) && !tamlayan(w[m - 2]) && /^\p{L}/u.test(w[m - 2])) adaylar.push([w[m - 2], "ve", w[m], nesne, ...araYon, ...fiil]);
    if (m >= 0 && BAGLAC.has(kucuk(w[m]))) {
      // "hava durumu ve yol durumunu" → sol öğe iki sözcükse o
      const sol = w.slice(Math.max(0, m - 2), m).filter((v) => !ayrilma(v) && !/,$/.test(v));
      if (sol.length === 2) adaylar.push([...sol, ...fiil]);
      m -= 2;
    }
    if (m >= 0 && tamlayan(w[m])) m--; // "teminat mektubunun iadesini" → "teminat iadesini"
    const modOlur = (v: string) => /^[\p{L}\d]/u.test(v) && !ayrilma(v) && !sayiyla(v) && (!ASKIDA.has(kucuk(v)) || NITEL.has(kucuk(v))) && !tamlayan(v) && !/,$/.test(v);
    if (m >= 0 && modOlur(w[m])) {
      const mod = w[m];
      if (m - 1 >= 0 && modOlur(w[m - 1]) && !BAGLAC.has(kucuk(w[m - 1])) && !/m[ae]$/i.test(w[m - 1]) && !belirtme(mod)) adaylar.push([w[m - 1], mod, nesne, ...araYon, ...fiil]); // "Geçici teminat mektubunu al"
      if (m - 1 >= 0 && ozel(mod) && ozel(w[m - 1]) && !ayrilma(w[m - 1])) adaylar.push([w[m - 1], mod, nesne, ...araYon, ...fiil]); // "App Store onayını"
      if (belirtme(mod) && m - 1 >= 0 && !ayrilma(w[m - 1]) && !/m[ae]$/i.test(w[m - 1]) && !BAGLAC.has(kucuk(w[m - 1])) && !tamlayan(w[m - 1])) adaylar.push([w[m - 1], mod, nesne, ...araYon, ...fiil]);
      const modYalin = belirtme(mod) && !ozel(mod) ? iyeliksiz(mod) : mod;
      adaylar.push([modYalin, nesne, ...araYon, ...fiil], [modYalin, nesne, ...fiil]);
      // "fizibilite karşılaştırması hazırla" sığmazsa fiilsiz tamlama
      if (/[aeıioöuü]s[ıiuü]$/i.test(nesne)) adaylar.push([modYalin, nesne]);
    }
    adaylar.push([nesne, ...araYon, ...fiil], [nesne, ...fiil]);
  }
  for (const a of adaylar) {
    for (const v of [a, a.map((x) => (/^[^/\s]+(\/[^/\s]+)+$/.test(x) ? x.split("/")[0] : /^[^\s-]{2,}(-[^\s-]+){2,}$/.test(x) ? x.split("-")[0] : x))]) {
      const s = v.join(" ").replace(/,/g, "") + (soru ? "?" : "");
      if (sigar(s)) return s;
    }
  }
  return null;
}

/** İsim öbeği (fiilsiz ad): "A ve B" / "A, B, C" listesinde iki sözcüklü ilk öğe; tek sözcükse son öğe. */
function isimObegi(t: string): string {
  const parca = t.split(/,\s*|\s+ve\s+|\s+veya\s+/).map((p) => p.trim()).filter(Boolean);
  if (parca.length > 1) {
    const ilk = parca[0].split(" ");
    if (ilk.length >= 2 && sigar(parca[0])) return parca[0];
    if (ilk.length >= 2) return sondan(ilk);
    const son = parca[parca.length - 1];
    if (sigar(son)) return son;
    return sondan(son.split(" "));
  }
  return sondan(t.split(" "));
}

/** Adımın kısa adı (LLM'siz). Sığan ad olduğu gibi kalır. */
export function kisaAdim(ad: string): string {
  let t = temizle(ad);
  const net = /^netleştir:\s*/i.test(t);
  if (net) t = t.replace(/^netleştir:\s*/i, "");
  const soru = net || /\?$/.test(t);
  t = t.replace(/\?$/, "").trim();
  if (!soru && sigar(t)) return harfBuyut(t).replace(/ · (\p{Ll})/u, (_, h) => ` · ${h.toLocaleUpperCase("tr")}`);
  // "M2 · İlk 100 sipariş ve…", "Faz 1: temel dayanıklılık", "Mali müşavirle kuruluş görüşmesi: şirket türü…": önek taşır
  const nokta = /^([A-ZÇĞİÖŞÜ]?\d+)\s·\s(.+)$/.exec(t);
  if (nokta) { const k = isimObegi(nokta[2].split(":")[0]); const s = `${nokta[1]} · ${harfBuyut(k)}`; if (sigar(s)) return s; }
  const iki = /^([^:]{2,60}):\s*(.+)$/.exec(t);
  if (iki && !soru) {
    const [, on, son] = iki;
    const cekirdek = son.split(/[,;]/)[0].trim();
    if (/^(faz|aşama|adım)\s*\d+$/i.test(on) && cekirdek.split(" ").length <= 3 && !sayiyla(cekirdek)) { const s = `${on} · ${cekirdek}`; if (sigar(s)) return harfBuyut(s); }
    if (sigar(on)) return harfBuyut(on);
    return harfBuyut(sondan(on.split(" ")));
  }
  // "X'i hazırla ve Y'yi imzala": ilk iş yeter
  const ilkIs = /^(.+?)(?:,\s*|\s+ve\s+)(.+)$/;
  let p = t;
  for (let s = t, kes = 0; (kes = s.search(/,\s|\sve\s/)) > 0; ) {
    const sol = t.slice(0, t.length - s.length + kes).trim();
    if (fiilBoyu(sol.split(" ")) > 0) { p = sol; break; }
    s = s.slice(kes + 2);
  }
  void ilkIs;
  if (!soru && sigar(p)) return harfBuyut(p);
  const w = p.split(" ").filter(Boolean);
  const f = soru ? 1 : fiilBoyu(w);
  if (f > 0 && w.length > f) {
    const nf = nesneFiil(w, f, soru);
    if (nf) return harfBuyut(nf);
  }
  if (soru) return harfBuyut(sondan(uclariDuzelt(w.slice(0, -1)))) + "?";
  return harfBuyut(isimObegi(p));
}

/** Akışın kısa adı (LLM'siz): "Varlık: iş" başlığında varlık + işin başı; uzun ad tamlamanın başıyla. */
export function kisaAkis(baslik: string): string {
  const t = temizle(baslik);
  const sade = (s: string) => {
    const w = s.split(" ").filter(Boolean);
    // "6 aylık koşu programı" → "koşu programı": sayı ve ardındaki ölçü sözcüğü düşer
    const x = w.filter((v, i) => !sayiyla(v) && !(i > 0 && sayiyla(w[i - 1]) && /l[ıiuü]k$/i.test(v)));
    return x.length ? x : w;
  };
  const iki = /^([^:]{2,60}):\s*(.+)$/.exec(t);
  if (iki) {
    const on = sade(iki[1]), son = sade(iki[2].split(/[,;]/)[0]);
    if (on.length === 1) {
      // "Hasat: Karadeniz'den 5 çiftçi kazanımı" → "Hasat çiftçi kazanımı"
      const bas = son.filter((v) => !ayrilma(v) && !/'/.test(v));
      for (let k = Math.min(3, bas.length); k >= 1; k--) { const s = `${on[0]} ${bas.slice(-k).map(harfKucult).join(" ")}`; if (sigar(s)) return harfBuyut(s); }
      return harfBuyut(on[0]);
    }
    const s = on.join(" ");
    return harfBuyut(sigar(s) ? s : sondan(on));
  }
  const w = sade(t);
  const s = w.join(" ");
  if (sigar(s)) return harfBuyut(s);
  // "İzmir müşteri etkinliği": ilk sözcük özel adsa korunur, gerisi tamlamanın başından
  if (ozel(w[0]) && !BAGLAC.has(kucuk(w[0])) && kucuk(w[0]) !== w[0]) {
    for (let k = Math.min(3, w.length - 1); k >= 1; k--) { const c = `${w[0]} ${w.slice(-k).map(harfKucult).join(" ")}`; if (sigar(c) && !BAGLAC.has(kucuk(w[w.length - k]))) return c; }
  }
  return harfBuyut(sondan(w.filter((v) => !BAGLAC.has(kucuk(v)))));
}

/** Çakışan ada ayırt edici ön: özgün adın ilk sözcüğü + kısa adın fiilsiz sonu ("Yemek karşılaştırması" / "Ses karşılaştırması"). */
function ayirtEdici(ad: string, kisa: string): string | null {
  const ilk = temizle(ad).split(" ").map((v) => v.split(/[/-]/)[0].replace(/'.*$/, "")).find((v) => v && !ASKIDA.has(kucuk(v)) && !sayiyla(v) && !ayrilma(v));
  if (!ilk) return null;
  const w = kisa.replace(/\?$/, "").split(" ");
  const govde = w.slice(0, w.length - fiilBoyu(w));
  if (govde.some((v) => kucuk(v) === kucuk(ilk))) return null;
  const fiil = w.slice(govde.length).join(" ");
  for (const ek of fiil ? [` ${fiil}`, ""] : [""]) {
    for (let k = govde.length; k >= 1; k--) {
      // fiilsiz kalan ad belirtme ekiyle bitmesin ("… modelini")
      if (!ek && !/[aeıioöuü]s[ıiuü]$/i.test(govde[govde.length - 1]) && fiil) continue;
      const s = `${harfBuyut(ilk)} ${govde.slice(-k).map(harfKucult).join(" ")}${ek}`;
      if (sigar(s)) return s;
    }
  }
  return null;
}

/** Akış içinde tekil kısa adlar: çakışan ada önce ayırt edici ön, olmazsa sıra eki ("… 2"). Kayıtlı (elle verilmiş) ad önce yer alır. */
export function tekillestir(adlar: { no: number; kisa: string; sabit?: boolean; ad?: string }[]): Map<number, string> {
  const out = new Map<number, string>();
  const kullanildi = new Set<string>();
  const sayi = new Map<string, number>();
  const altlar = new Map<string, Set<string>>();
  for (const a of adlar) {
    sayi.set(kucuk(a.kisa), (sayi.get(kucuk(a.kisa)) || 0) + 1);
    if (!a.sabit && a.ad) { const g = altlar.get(kucuk(a.kisa)) || new Set(); g.add(kucuk(ayirtEdici(a.ad, a.kisa) || "")); altlar.set(kucuk(a.kisa), g); }
  }
  for (const a of [...adlar].sort((x, y) => Number(!!y.sabit) - Number(!!x.sabit) || x.no - y.no)) {
    let s = a.kisa;
    const grup = sayi.get(kucuk(a.kisa)) || 0;
    if (!a.sabit && a.ad && grup > 1 && altlar.get(kucuk(a.kisa))?.size === grup && !altlar.get(kucuk(a.kisa))?.has("")) {
      const alt = ayirtEdici(a.ad, a.kisa);
      if (alt && !kullanildi.has(kucuk(alt))) s = alt;
    }
    for (let n = 2; kullanildi.has(kucuk(s)); n++) s = `${a.kisa.replace(/\?$/, "")} ${n}${a.kisa.endsWith("?") ? "?" : ""}`;
    kullanildi.add(kucuk(s));
    out.set(a.no, s);
  }
  return out;
}

/** Kısa ad kuralı: boş değil, ≤ 26 karakter, üç noktasız, bağlaçla bitmez. */
export function kisaAdGecerli(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t || t.length > KISA_AD_EN_COK || /…|\.\.\.$/.test(t)) return false;
  const son = kucuk(t.replace(/\?$/, "").split(" ").pop()!);
  return !BAGLAC.has(son);
}

/** Akışın bütün adımları için kısa ad: kayıtlı (baglam.kisa_adlar) ya da üretilen; akış içinde tekil. */
export function adimKisaAdlari(akis: any, steps: { no: number; ad: string }[]): Map<number, string> {
  const kayit: Record<string, string> = akis?.baglam?.kisa_adlar || {};
  return tekillestir(steps.map((s) => {
    const k = kayit[String(s.no)];
    return kisaAdGecerli(k) ? { no: s.no, kisa: k.trim(), sabit: true } : { no: s.no, kisa: kisaAdim(s.ad), ad: s.ad };
  }));
}

/** Akışın kısa adı: kayıtlı (baglam.kisa_ad) ya da üretilen. */
export function akisKisaAdi(akis: any): string {
  const k = akis?.baglam?.kisa_ad;
  return kisaAdGecerli(k) ? k.trim() : kisaAkis(akis?.baslik || "");
}

// bir istekte aynı akış nesnesi için bir kez hesaplanır
const onbellek = new WeakMap<object, Map<number, string>>();
/** Adımın kısa adı (akış içinde tekil). */
export function adimKisaAdi(akis: any, steps: { no: number; ad: string }[], no: number): string | null {
  if (!akis || typeof akis !== "object") return null;
  let m = onbellek.get(akis);
  if (!m || !m.has(no)) { m = adimKisaAdlari(akis, steps); onbellek.set(akis, m); }
  return m.get(no) ?? null;
}
