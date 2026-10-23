// Ekrandaki kısa metinler: Türkçe ekler, kısa adlar, tarih ve pay ifadeleri.

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const SESLI = 'aeıioöuü', KALIN = 'aıou', SERT = 'fstkçşhp';

const sonSesli = (s: string) => { for (let i = s.length - 1; i >= 0; i--) if (SESLI.includes(s[i].toLocaleLowerCase('tr'))) return s[i].toLocaleLowerCase('tr'); return 'e'; };

/**
 * Ad + hâl eki (ünlü uyumu, sertleşme, iyelikten sonra kaynaştırma "n").
 * tur: 'den' (ayrılma), 'de' (bulunma), 'e' (yönelme), 'in' (ilgi).
 * "App Store onayı" + den → "App Store onayından"; "Görsel" + den → "Görselden"; "Rapor" + in → "Raporun".
 */
const RAKAM = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
/** Sayının okunuşunun son kelimesi (ek uyumu için): 4 → dört, 30 → otuz, 100 → yüz. */
function sayiOkunus(n: string): string {
  const k = Number(n);
  if (k % 1000 === 0 && k) return 'bin';
  if (k % 100 === 0 && k) return 'yüz';
  if (k % 10 === 0 && k) return ONLAR[(k % 100) / 10];
  return RAKAM[k % 10];
}

/** Yabancı kelimelerin okunuşu (ek uyumu): "Test Bank’te", "App Store’dan". */
const OKUNUS: Record<string, string> = { bank: 'benk', store: 'stor', claude: 'klod', drive: 'drayv', slack: 'slek', app: 'ep' };

export function ek(ad: string, tur: 'den' | 'de' | 'e' | 'in' | 'i'): string {
  const s = ad.trim(), sayi = /(\d+)$/.exec(s)?.[1], sonK = s.split(' ').pop()!.toLocaleLowerCase('tr');
  const oku = sayi ? sayiOkunus(sayi) : OKUNUS[sonK] ?? s;
  const son = oku.slice(-1).toLocaleLowerCase('tr'), v = sonSesli(oku), kalin = KALIN.includes(v);
  const sesliyle = SESLI.includes(son);
  // iyelik ekiyle biten çok kelimeli ad ("… onayı", "… raporu"): kaynaştırma n
  const iyelik = !sayi && sesliyle && 'ıiuü'.includes(son) && s.includes(' ') && !SESLI.includes(s.slice(-2, -1).toLocaleLowerCase('tr'));
  const tirnak = /[A-ZÇĞİÖŞÜ]{2,}$|\d$/.test(s) ? '’' : '';
  if (tur === 'den' || tur === 'de') {
    const d = !sesliyle && SERT.includes(son) ? 't' : 'd', e = kalin ? 'a' : 'e';
    return s + tirnak + (iyelik ? 'n' : '') + d + e + (tur === 'den' ? 'n' : '');
  }
  if (tur === 'i') { const i = 'ıa'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü'; return s + tirnak + (iyelik ? 'n' + i : sesliyle ? 'y' + i : i); }
  if (tur === 'e') { const e = kalin ? 'a' : 'e'; return s + tirnak + (iyelik ? 'n' + e : sesliyle ? 'y' + e : e); }
  const i = 'ıa'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü';
  return s + tirnak + (sesliyle ? 'n' : '') + i + 'n';
}

/** Özel ad + ek, kesme işaretiyle: "Berkin’de", "Emre’nin". */
export const ozelEk = (ad: string, tur: 'den' | 'de' | 'e' | 'in' | 'i') => ad + '’' + ek(ad, tur).slice(ad.length).replace(/^’/, '');

/** Tarih + ek, kesme işaretiyle; ek son kelimeye göre: "12 Eki’de", "9 Kasım’a", "12 Ekim’den". */
export const tarihEk = (t: string, tur: 'den' | 'de' | 'e' | 'in') => { const w = t.trim().split(' ').pop() || t; return t.trim() + '’' + ek(w, tur).slice(w.length).replace(/^’/, ''); };

/** Tarih + ek-fiil (geçmiş), kesme işaretiyle: "1 Kasım’dı", "9 Eylül’dü", "3 Ağustos’tu". */
export const tarihDi = (t: string) => {
  const w = t.trim().split(' ').pop() || t, son = w.slice(-1).toLocaleLowerCase('tr'), v = sonSesli(w);
  const i = 'ıa'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü';
  return t.trim() + '’' + (SESLI.includes(son) ? 'y' : '') + (!SESLI.includes(son) && SERT.includes(son) ? 't' : 'd') + i;
};

/** Akışın ekran adı (P1-F): sunucunun verdiği kisa_ad; yoksa başlığın açıklamasız kısmı. Ad kesilmez. */
export function akisAdi(akis: { kisa_ad?: string | null; baslik?: string | null }): string {
  if (akis.kisa_ad) return akis.kisa_ad;
  return (akis.baslik || '').split(/:|\s\(|\s[–—]\s/)[0].trim();
}

/** Adımın ekran adı (P1-F): sunucunun verdiği kisa_ad; yoksa parantezsiz tam ad. Ad kesilmez. */
export function adimAdi(a: { kisa_ad?: string | null; ad: string }): string {
  if (a.kisa_ad) return a.kisa_ad;
  return a.ad.replace(/\s*\([^)]*\)?/g, '').trim();
}
// kısa adın sonundaki fiil ("… al", "… kontrol et", "… teslim eder")
const YARDIMCI = /^(et|eder|yap|yapar|ver|verir|al|alır|ol|olur)$/;
const ISIM_FIIL = /^(kontrol|teslim|takip|kabul|teyit|rezerve|organize|tespit|talep|karar|revize|servis|analiz|iptal|sevk)$/i;
/** Harita etiketi: kısa adın fiilsiz en çok iki kelimesi ("Teminat mektubunu al" → "Teminat mektubunu", "App Store onayı" → "App Store"). */
export function adimEtiketi(a: { kisa_ad?: string | null; ad: string }): string {
  let w = adimAdi(a).replace(/\?$/, '').split(' ');
  const n = w.length, fiilli = n >= 3 && /^[a-zçğıöşü]/.test(w[n - 1]);
  if (fiilli) w = n >= 4 && YARDIMCI.test(w[n - 1]) && ISIM_FIIL.test(w[n - 2]) ? w.slice(0, n - 2) : w.slice(0, n - 1);
  if (w.length > 2) w = /^[A-ZÇĞİÖŞÜ]/.test(w[1]) ? w.slice(0, 2) : w.slice(-2);
  if (!fiilli && w.length === 2 && /^[a-zçğıöşü]/.test(w[1])) {
    // "Post görseli" → "Görsel", "Yayın onayı" → "Onay": tamlamanın başı, iyelik ekinden arınmış
    const s = w[1].replace(/(?<=[^aeıioöuü])[ıiuü]$|(?<=[aeıioöuü])s[ıiuü]$/, '');
    return s[0].toLocaleUpperCase('tr') + s.slice(1);
  }
  const k = w.join(' ');
  return k ? k[0].toLocaleUpperCase('tr') + k.slice(1) : k;
}

const tl = (ms: number) => new Date(ms + 3 * 36e5);
/** "21 Ekim" */
export const gunAyUzun = (t: number | string) => { const d = tl(typeof t === 'number' ? t : Date.parse(String(t).length === 10 ? t + 'T12:00:00+03:00' : t)); return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]}`; };
/** pay_saat → "11 gün" / "6 saat" */
export function paySure(saat: number | null | undefined): string {
  if (saat == null) return '';
  const s = Math.abs(saat);
  return s >= 24 ? `${Math.floor(s / 24)} gün` : `${Math.max(1, Math.round(s))} saat`;
}

let tuval: CanvasRenderingContext2D | null = null;
/** Metin genişliği (px); tarayıcı yoksa yaklaşık. */
export function genislik(metin: string, font = '17px Caladea'): number {
  if (typeof document === 'undefined') return metin.length * 7.4;
  tuval = tuval || document.createElement('canvas').getContext('2d');
  if (!tuval) return metin.length * 7.4;
  tuval.font = font;
  return tuval.measureText(metin).width;
}
/**
 * Akıllı cümleyi iki satıra böler: ortaya yakın noktalama (; ,) önce, yoksa ortaya en yakın boşluk; iki satır da sığmalı.
 * Sığmazsa tek satır döner (tarayıcı kırar).
 */
export function ikiSatir(metin: string, en = 350, font = '17px Caladea'): string[] {
  if (genislik(metin, font) <= en) return [metin];
  const yarim = metin.length / 2, aday: { i: number; puan: number }[] = [];
  for (let i = 1; i < metin.length - 1; i++) {
    if (metin[i] !== ' ') continue;
    const onceki = metin[i - 1], d = Math.abs(i - yarim);
    aday.push({ i, puan: d - (/[;,:]/.test(onceki) ? 9 : 0) - (i > yarim ? .5 : 0) });
  }
  aday.sort((a, b) => a.puan - b.puan);
  for (const { i } of aday) { const a = metin.slice(0, i), b = metin.slice(i + 1); if (genislik(a, font) <= en && genislik(b, font) <= en) return [a, b]; }
  return [metin];
}

/** Açgözlü iki satır: ilk satıra sığan en çok kelime, ikinci satırda en az 4 kelime (B1 cümleleri tasarımda böyle kırılır). */
export function doluSatir(metin: string, en: number, font = '17.5px Caladea', enAzSon = 4): string[] {
  const w = metin.split(' ');
  if (genislik(metin, font) <= en) return [metin];
  // ikinci satır en az enAzSon kelime taşır (kısa kuyruk kalmaz)
  for (let i = Math.min(w.length - 1, Math.max(1, w.length - enAzSon)); i > 0; i--) { const a = w.slice(0, i).join(' '); if (genislik(a, font) <= en) return [a, w.slice(i).join(' ')]; }
  return [metin];
}

/** Açgözlü çok satır: her satıra sığan en çok kelime. */
export function sarSatir(metin: string, en: number, font = '17px Caladea'): string[] {
  const L: string[] = [];
  for (const w of metin.split(' ')) { const s = L.length ? `${L[L.length - 1]} ${w}` : w; if (L.length && genislik(s, font) <= en) L[L.length - 1] = s; else L.push(w); }
  return L;
}

/** Yazı tipleri yüklenince yeniden ölçmek için: yüklenene dek canvas yedek yazı tipini ölçer. */
export function yaziTipleriHazir(): Promise<unknown> {
  return typeof document !== 'undefined' && document.fonts ? Promise.all([document.fonts.load('17px Caladea'), document.fonts.load('italic 17px Caladea').catch(() => null), document.fonts.ready]) : Promise.resolve();
}

/** Sayı + iyelik: 2 → "2’si", 3 → "3’ü", 5 → "5’i", 10 → "10’u" (okunuşa göre). */
export function sayiIyelik(n: number): string {
  const BIR: Record<number, string> = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u' };
  const ON: Record<number, string> = { 1: 'u', 2: 'si', 3: 'u', 4: 'ı', 5: 'si', 6: 'ı', 7: 'i', 8: 'i', 9: 'ı' };
  const e = n % 10 ? BIR[n % 10] : n % 100 ? ON[(n % 100) / 10] : n % 1000 ? 'ü' : 'i';
  return `${n}’${e}`;
}
