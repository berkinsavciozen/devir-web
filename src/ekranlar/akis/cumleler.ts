// Haritanın zaman sürgüsü cümleleri (S1–S3): sürgü bırakılınca x anına göre kurulur; en fazla 2 cümle.
import type { Galaksi } from '../../geometri/galaksi-geometri';
import type { Model } from '../../cizim/yol.js';
import { adimAdi, ek, gunAyUzun, ozelEk, paySure } from '../../metin/turkce';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const SAYI = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'];

/** Liste içinde küçük harf: "Görsel" → "görsel"; "App Store onayı", "TestFlight" olduğu gibi. */
const kucuk = (s: string) => { const w = s.split(' '); return /^[A-ZÇĞİÖŞÜ][^A-ZÇĞİÖŞÜ]*$/.test(w[0]) && !(w[1] && /^[A-ZÇĞİÖŞÜ]/.test(w[1])) ? s[0].toLocaleLowerCase('tr') + s.slice(1) : s; };
const ve = (xs: string[]) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' ve ' + xs[xs.length - 1];
const tarihEk = (t: string, tur: 'de' | 'e') => t + '’' + ek(t, tur).slice(t.length);
const dilim = (ms: number) => { const h = new Date(ms + 3 * 36e5).getUTCHours(); return h < 6 ? 'gecesi' : h < 12 ? 'sabahı' : h < 17 ? 'öğleden sonra' : h < 22 ? 'akşamı' : 'gecesi'; };

/** Satırlar: 2 eleman = tasarımdaki satır kırılımı; 1 eleman = doğal kırılım. */
export function zamanCumlesi(d: any, M: Model, G: Galaksi, X: number, NOW: number): string[] | null {
  const by = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const ad = (no: number) => adimAdi(by.get(no));
  const t0 = G.T0;
  if (X < NOW) {
    // geçmiş: "12 Ekim akşamı kuruldu; ilk saatte brif, metin ve iki atlama bitti."
    const biten = M.F.steps.filter((s) => BITTI(s.durum) && G.byNo[s.no] && G.byNo[s.no].t <= X);
    const tamam = biten.filter((s) => s.durum === 'tamam').sort((a, b) => G.byNo[a.no].t - G.byNo[b.no].t).map((s) => kucuk(ad(s.no)));
    const atla = biten.filter((s) => s.durum !== 'tamam').length;
    const parca = [...tamam, ...(atla ? [`${SAYI[atla] || atla} atlama`] : [])];
    const bas = `${gunAyUzun(t0)} ${dilim(t0)} kuruldu`;
    if (!parca.length) return [`${bas}; ${gunAyUzun(X)} itibarıyla henüz biten adım yok.`];
    const ilkSaat = biten.every((s) => G.byNo[s.no].t - t0 <= 36e5 * 1.5);
    return [`${bas}; ${ilkSaat ? 'ilk saatte' : tarihEk(gunAyUzun(X), 'e') + ' kadar'} ${ve(parca)} ${parca.length > 1 || atla ? 'bitti' : 'bitti'}.`];
  }
  const acik = M.F.steps.filter((s) => !BITTI(s.durum) && G.byNo[s.no]);
  const biter = acik.filter((s) => G.durumAn(s.no, X) === 'tahmin').sort((a, b) => G.byNo[a.no].t - G.byNo[b.no].t);
  const kalan = acik.filter((s) => !biter.includes(s));
  const tarih = `${gunAyUzun(X)} tahmini:`;
  if (!kalan.length && biter.length) {
    // son adımdan sonra: "22 Ekim tahmini: rapor 21 Ekim’de biter; hedefe 11 gün pay kalır."
    const son = biter[biter.length - 1];
    const pay = d.akis.pay_saat;
    return [`${tarih} ${kucuk(ad(son.no))} ${tarihEk(gunAyUzun(G.byNo[son.no].t), 'de')} biter;`, pay == null ? '' : pay >= 0 ? `hedefe ${paySure(pay)} pay kalır.` : `hedef ${paySure(pay)} geçer.`].filter(Boolean);
  }
  // ileri: "17 Ekim tahmini: görsel ve onay biter, sıra App Store onayında."
  const kritik = new Set<number>(d.kritik_yol || []);
  const sira = kalan.sort((a, b) => Number(kritik.has(b.no)) - Number(kritik.has(a.no)) || G.byNo[a.no].t - G.byNo[b.no].t)[0];
  if (!biter.length) return sira ? [`${tarih} sıra ${ek(ad(sira.no), 'de')}.`] : null;
  // x'ten önce biten en son iki adım (öncekiler zaten yanık görünür)
  return [`${tarih} ${ve(biter.slice(-2).map((s) => kucuk(ad(s.no))))} biter,`, sira ? `sıra ${ek(ad(sira.no), 'de')}.` : ''].filter(Boolean);
}

/** B6 kişi odağı: "{kişi}'de {n} adım hazır; {kritik adım} kritik yolda ve {m} adımı tutuyor." */
export function odakCumlesi(d: any, kisi: string): string | null {
  const ad = kisi.replace(/\s*\(.*\)$/, '');
  const benim = d.adimlar.filter((a: any) => a.sahip === kisi);
  const hazir = benim.filter((a: any) => a.durum === 'hazir' || a.durum === 'suruyor');
  const kritik = new Set<number>(d.kritik_yol || []);
  const kr = benim.find((a: any) => kritik.has(a.no) && !BITTI(a.durum));
  // geçişli bekleyen sayısı
  const tutar = (no: number) => { const g = new Set<number>(), q = [no]; while (q.length) { const x = q.pop()!; for (const b of d.adimlar) if ((b.bagimli || []).includes(x) && !g.has(b.no) && !BITTI(b.durum)) { g.add(b.no); q.push(b.no); } } return g.size; };
  const bas = hazir.length ? `${ozelEk(ad, 'de')} ${hazir.length} adım hazır` : `${ozelEk(ad, 'de')} hazır adım yok`;
  if (kr) { const m = tutar(kr.no); return `${bas}; ${adimAdi(kr)} kritik yolda${m ? ` ve ${m} adımı tutuyor` : ''}.`; }
  const acik = benim.filter((a: any) => !BITTI(a.durum)).length;
  return `${bas}; ${acik} açık adımı var.`;
}
