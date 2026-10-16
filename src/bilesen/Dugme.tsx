import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tur = 'birincil' | 'ikincil' | 'tehlike';
/** İkincil düğmede çerçeve rengi anlam taşır ve metinle tekrarlanır: altın = olumlu, mercan = engel/iptal, lila = nötr. */
type Ton = 'altin' | 'mercan' | 'lila';

export interface DugmeOz extends ButtonHTMLAttributes<HTMLButtonElement> {
  tur?: Tur;
  ton?: Ton;
  ikon?: ReactNode;
  /** yazma sürerken metin yerinde üç noktalı nabız */
  mesgul?: boolean;
  yukseklik?: number;
  /** ikonun merkezi, düğmenin sol kenarından (tasarımdaki gibi metinden bağımsız durur) */
  ikonX?: number;
  /** metnin ortadan kayması (px) */
  kayma?: number;
  /** yazı boyu (tasarımda düğmeye göre 14–17) */
  fs?: number;
}

export function Dugme({ tur = 'birincil', ton = 'lila', ikon, mesgul, yukseklik, ikonX, kayma, fs, children, className = '', disabled, style, ...p }: DugmeOz) {
  return (
    <button
      {...p}
      disabled={disabled || mesgul}
      aria-busy={mesgul || undefined}
      className={`dugme dugme-${tur} ${tur === 'ikincil' ? `ton-${ton}` : ''} ${className}`}
      style={{ ...style, ...(yukseklik ? { height: yukseklik } : {}), ...(fs ? { fontSize: fs } : {}) }}
    >
      {ikon && !mesgul && <span className={`dugme-ikon ${ikonX != null ? 'dugme-ikon-yerli' : ''}`} style={ikonX != null ? { left: ikonX } : undefined} aria-hidden>{ikon}</span>}
      <span className="dugme-metin" style={kayma ? { transform: `translateX(${kayma}px)` } : undefined}>{mesgul ? <span className="nabiz" aria-label="Kaydediliyor"><i /><i /><i /></span> : children}</span>
    </button>
  );
}
