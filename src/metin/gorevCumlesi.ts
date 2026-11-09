/**
 * W4 (6 Kas, K6, C24): görev cümlesi. Her yerde aynı: KİM + NE + NE ZAMAN + durum fiili.
 * "Berkin brifi 16 Eki’ye kadar netleştirecek", "Berkin brifi netleştirdi", "Claude post görselini yazdı, Berkin’in onayını bekliyor".
 * Kural tabanlı: adım adının son sözcüğü emir kipinde fiil (yardımcı fiilli "kontrol et" iki sözcük); öncesi nesne.
 * Fiilsiz adlarda ("App Store onayı") ad olduğu gibi kalır, durum ayrı söylenir. LLM yok, satır başına maliyet yok.
 */
import { adimAdi, ozelEk, tarihEk } from './turkce';

const UNLU = 'aeıioöuü';
const KALIN = 'aıou';
const SERT = 'çfhkpsşt';
const YARDIMCI = new Set(['et', 'ol', 'yap', 'ver', 'al', 'eyle']);
const ISIM_FIIL = /^(kontrol|teslim|takip|kabul|teyit|rezerve|organize|tespit|talep|karar|revize|servis|analiz|iptal|sevk|rapor|ziyaret|davet|tahsil|transfer|test|dikkat|tercih|teklif|sipariş|ilan|teşekkür|yardım)$/i;
/** Emir kipinde olmayan, adın sonunda sık gelen isimler (fiil sanılmasın). */
const FIIL_DEGIL = /(m[ae]|m[ae]si|ma[sk]ı|me[sk]i|lar|ler|ları|leri|sı|si|su|sü|ı|i|u|ü|onay|brif|rapor|metin|görsel|yayın|plan|kit|liste|toplantı|bağlantı|karar|teklif|bütçe|sözleşme|fatura|ödeme|ön|son)$/i;

const sonUnlu = (s: string) => { for (let i = s.length - 1; i >= 0; i--) if (UNLU.includes(s[i])) return s[i]; return 'e'; };
const dortlu = (s: string) => { const u = sonUnlu(s); return 'aı'.includes(u) ? 'ı' : 'ei'.includes(u) ? 'i' : 'ou'.includes(u) ? 'u' : 'ü'; };
const ikili = (s: string) => (KALIN.includes(sonUnlu(s)) ? 'a' : 'e');
/** Tek heceli düzensizler: et → ed-, git → gid-, tat → tad- (ünlüyle başlayan ekten önce). */
const yumusak = (k: string) => (/^(et|git|tat|güt)$/.test(k) ? k.slice(0, -1) + 'd' : k);

/** "netleştir" → "netleştirmeli" */
export const gereklilik = (k: string) => k + 'm' + ikili(k) + 'l' + (ikili(k) === 'a' ? 'ı' : 'i');
/** "netleştir" → "netleştiriyor", "hazırla" → "hazırlıyor", "et" → "ediyor" */
export function simdiki(k: string): string {
  if (UNLU.includes(k[k.length - 1])) { const g = k.slice(0, -1); return g + dortlu(g.length ? g : k) + 'yor'; }
  const y = yumusak(k);
  return y + dortlu(y) + 'yor';
}
/** "netleştir" → "netleştirdi", "et" → "etti", "yaz" → "yazdı" */
export const gecmis = (k: string) => k + (SERT.includes(k[k.length - 1]) ? 't' : 'd') + dortlu(k);
/** "yaz" → "yazacak", "et" → "edecek", "hazırla" → "hazırlayacak" */
export const gelecek = (k: string) => (UNLU.includes(k[k.length - 1]) ? k + 'y' : yumusak(k)) + (ikili(k) === 'a' ? 'acak' : 'ecek');

/** Adı nesne + fiile ayırır; fiil bulunamazsa null. */
export function nesneFiil(ad: string): { nesne: string; fiil: string } | null {
  const w = ad.replace(/[.?!]+$/, '').trim().split(/\s+/);
  if (w.length < 2) return null;
  const son = w[w.length - 1];
  if (!/^[a-zçğıöşü]+$/.test(son)) return null;
  if (YARDIMCI.has(son) && w.length >= 2 && ISIM_FIIL.test(w[w.length - 2])) {
    return w.length >= 3 ? { nesne: w.slice(0, -2).join(' '), fiil: w.slice(-2).join(' ') } : { nesne: '', fiil: w.slice(-2).join(' ') };
  }
  if (FIIL_DEGIL.test(son) && !/^(yaz|çiz|kur|gir|al|ver|seç|iste|bul|aç|kapa|sor|gönder|hazırla|topla|ara|yükle|ekle|düzelt|bitir)$/.test(son)) return null;
  return { nesne: w.slice(0, -1).join(' '), fiil: son };
}
/** Yardımcı fiilli fiilin çekimi: "kontrol et" → "kontrol etmeli". */
const cek = (fiil: string, f: (k: string) => string) => { const p = fiil.split(' '); return [...p.slice(0, -1), f(p[p.length - 1])].join(' '); };
const kucukBas = (s: string) => (s && /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(s) && !/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s[A-ZÇĞİÖŞÜ]/.test(s) ? s[0].toLocaleLowerCase('tr') + s.slice(1) : s);

export interface CumleGirdisi {
  ad: string; kisa_ad?: string | null; sahip: string; sahip_tip?: string; agent_sahibi?: string | null; durum: string;
  bitis?: string | null; tamam_at?: string | null; oto?: boolean; oto_durum?: string | null; karar_adimi?: boolean; gecikme_gun?: number | null;
}
export interface GorevCumlesi { cumle: string; durum: string; ton: 'bitti' | 'sende' | 'surer' | 'risk' | 'bekler' | 'ai' }

/**
 * Görev cümlesi. `gun` tarih biçimleyici ("16 Eki"), `kisa` kişi adını kısaltır.
 * Durum ayrıca kısa ad olarak döner (ekran okuyucu ve rozet için).
 */
export function gorevCumlesi(a: CumleGirdisi, o: { gun: (iso: string) => string; kisa?: (ad: string) => string } = { gun: (x) => x }): GorevCumlesi {
  const kisa = o.kisa || ((x: string) => x);
  const kim = a.sahip_tip === 'agent' ? a.sahip : kisa(a.sahip);
  const ad = adimAdi(a);
  const nf = nesneFiil(ad);
  const nesne = nf ? kucukBas(nf.nesne) : '';
  const govde = (f: string) => (nf ? [kim, nesne, f].filter(Boolean).join(' ') : `${ad}: ${kim}`);
  const tarih = a.bitis ? o.gun(a.bitis) : null;
  const kadar = tarih ? ` ${tarihEk(tarih, 'e')} kadar` : '';
  const ai = a.oto && !['tamam', 'atlandi', 'ertelendi'].includes(a.durum) ? a.oto_durum : null;
  const onaylayan = a.agent_sahibi ? kisa(a.agent_sahibi) : null;
  if (a.durum === 'tamam') return { cumle: nf ? govde(cek(nf.fiil, gecmis)) : `${ad}: ${kim} bitirdi`, durum: 'bitti', ton: 'bitti' };
  if (a.durum === 'atlandi') return { cumle: `${ad} atlandı`, durum: 'atlandı', ton: 'bitti' };
  if (a.durum === 'ertelendi') return { cumle: `${ad} ertelendi`, durum: 'ertelendi', ton: 'bitti' };
  if (ai === 'bakilacak') return { cumle: nf ? `${govde(cek(nf.fiil, gecmis))}, ${onaylayan ? ozelEk(onaylayan, 'in') : 'senin'} onayını bekliyor` : `${ad}: ${kim} yazdı, ${onaylayan ? ozelEk(onaylayan, 'in') + ' ' : ''}onayını bekliyor`, durum: 'onay bekliyor', ton: 'ai' };
  if (ai === 'calisiyor') return { cumle: nf ? govde(cek(nf.fiil, simdiki)) : `${ad}: ${kim} çalışıyor`, durum: 'AI çalışıyor', ton: 'ai' };
  if (ai === 'hata') return { cumle: nf ? `${kim} ${nesne ? nesne + ' ' : ''}${cek(nf.fiil, gelecek)}${ikili(nf.fiil) === 'a' ? 'tı' : 'ti'}; yapamadı` : `${ad}: ${kim} yapamadı`, durum: 'AI yapamadı', ton: 'risk' };
  if (ai === 'bekliyor') return { cumle: nf ? `${govde(cek(nf.fiil, gelecek))}${onaylayan ? `, ${onaylayan} onaylayacak` : ''}` : `${ad}: ${kim}`, durum: 'AI yapsın', ton: 'ai' };
  if (a.durum === 'engelli') return { cumle: nf ? `${govde(cek(nf.fiil, gelecek))}; engelde` : `${ad}: ${kim} · engelde`, durum: 'engelli', ton: 'risk' };
  if (a.durum === 'suruyor') return { cumle: nf ? `${[kim, nesne].filter(Boolean).join(' ')}${kadar} ${cek(nf.fiil, simdiki)}` : `${ad}: ${kim} sürdürüyor`, durum: 'sürüyor', ton: 'surer' };
  const gec = a.gecikme_gun && a.gecikme_gun > 0 ? `; ${a.gecikme_gun} gün gecikti` : '';
  // 9 Kas (Berkin): sırası gelen ve sıradaki iş gelecek zamanla: "Berkin kapsamı 16 Eki’ye kadar netleştirecek"
  const f = nf ? `${[kim, nesne].filter(Boolean).join(' ')}${kadar} ${cek(nf.fiil, gelecek)}${gec}` : `${ad}: ${kim}${tarih ? `, ${tarihEk(tarih, 'e')} kadar` : ''}${gec}`;
  return { cumle: f, durum: a.durum === 'hazir' ? 'sırası geldi' : 'sırada', ton: gec ? 'risk' : a.durum === 'hazir' ? 'sende' : 'bekler' };
}
