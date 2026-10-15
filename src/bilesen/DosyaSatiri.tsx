import type { ReactNode } from 'react';
import { glifTur } from '../api/dosya';

/** Tür glifi (24 × 30): türü yazıyla taşır. Renk dosya türü token'larından. */
export function DosyaGlif({ ad, tur, silindi }: { ad: string; tur?: string; silindi?: boolean }) {
  const t = glifTur(ad, tur);
  const renk = t === 'PDF' ? 'var(--renk-dosya-turu-pdf)' : ['JPG', 'PNG', 'WEBP', 'HEIC'].includes(t) ? 'var(--renk-dosya-turu-gorsel)' : ['XLS', 'XLSX', 'CSV'].includes(t) ? 'var(--renk-dosya-turu-tablo)' : ['DOC', 'DOCX', 'PPT', 'PPTX'].includes(t) ? 'var(--renk-dosya-turu-belge)' : 'var(--renk-dosya-turu-diger)';
  return (
    <svg className="dosya-glif" aria-hidden width="26" height="32" viewBox="-13 -16 26 32" style={{ color: renk }}>
      <path d="M-12,-15 L5,-15 L12,-8 L12,15 L-12,15Z" fill="var(--renk-zemin-hap)" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeDasharray={silindi ? '3 3' : undefined} />
      <path d="M5,-15 L5,-8 L12,-8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <text y="7" textAnchor="middle" fontFamily="Inter" fontWeight="800" fontSize={t.length > 3 ? 6.4 : 7.6} fill="currentColor">{t}</text>
    </svg>
  );
}

export const IndirIkon = () => <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><path d="M0,-8 L0,5 M-6,-1 L0,5 L6,-1 M-8,9 L8,9" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
export const CopIkon = () => <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><path d="M-7,-5 L7,-5 M-3,-5 L-3,-8 L3,-8 L3,-5 M-5,-5 L-4,8 L4,8 L5,-5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
export const CarpiIkon = () => <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><path d="M-5,-5 L5,5 M5,-5 L-5,5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
export const DisAcIkon = () => <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><path d="M-7,7 L7,-7 M-1,-7 L7,-7 L7,1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
export const UyariIkon = () => <svg aria-hidden width="12" height="12" viewBox="-11 -11 22 22"><path d="M0,-10 L10,8 L-10,8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><rect x="-1" y="-4" width="2" height="7" rx="1" fill="currentColor" /><circle cy="5.3" r="1.2" fill="currentColor" /></svg>;
export const YukleIkon = () => <svg aria-hidden width="22" height="22" viewBox="-11 -11 22 22"><path d="M0,6 L0,-8 M-6,-2 L0,-8 L6,-2 M-9,4 L-9,9 L9,9 L9,4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
export const TikIkon = () => <svg aria-hidden width="22" height="22" viewBox="-11 -11 22 22"><circle r="11" fill="var(--renk-vurgu-altin)" /><path d="M-4.5,0 L-1.2,3.4 L4.8,-3.4" stroke="var(--renk-metin-koyu-uzerine)" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;
export const BaglantiIkon = () => <svg aria-hidden width="30" height="30" viewBox="-15 -15 30 30"><circle r="14.5" fill="var(--renk-zemin-hap)" stroke="var(--renk-vurgu-lila)" strokeOpacity=".7" /><path d="M-4,4 l4,-4 a3.4,3.4 0 0 1 5,5 l-6,6 a3.4,3.4 0 0 1 -5,-5" fill="none" stroke="var(--renk-dosya-turu-diger)" strokeWidth="1.5" transform="translate(-1,-3)" /></svg>;

export interface Eylem { ad: string; ikon: ReactNode; ton?: 'lila' | 'mercan'; tikla?: () => void }

/**
 * Dosya satırı (§3.22): 62 px, yarıçap 18. Haller: kayitli, yukleniyor (yuzde), hazir (altın + tik), hata (mercan), silindi.
 */
export function DosyaSatiri({ ad, tur, alt, hal = 'kayitli', yuzde, eylemler = [], ikon }: {
  ad: string; tur?: string; alt: ReactNode; hal?: 'kayitli' | 'yukleniyor' | 'hazir' | 'hata' | 'silindi'; yuzde?: number; eylemler?: Eylem[]; ikon?: ReactNode;
}) {
  return (
    <li className={`dosya-satiri hal-${hal}`} aria-label={`${ad}. ${hal === 'yukleniyor' ? `Yükleniyor yüzde ${Math.round((yuzde || 0) * 100)}` : hal === 'hata' ? `Hata: ${alt}` : hal === 'silindi' ? 'Dosya silindi' : ''}`}>
      <span className="dosya-satiri-glif">{ikon || <DosyaGlif ad={ad} tur={tur} silindi={hal === 'silindi'} />}</span>
      <span className="dosya-satiri-metin">
        <b>{ad}</b>
        {hal === 'yukleniyor' && <span className="ilerleme" role="progressbar" aria-valuenow={Math.round((yuzde || 0) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${(yuzde || 0) * 100}%` }} /></span>}
        <small>{hal === 'hata' && <UyariIkon />}{alt}</small>
      </span>
      <span className="dosya-satiri-eylem">
        {hal === 'hazir' && <TikIkon />}
        {eylemler.map((e) => <button key={e.ad} className={`eylem-dugme ton-${e.ton || 'lila'}`} aria-label={e.ad} onClick={e.tikla}>{e.ikon}</button>)}
      </span>
    </li>
  );
}
