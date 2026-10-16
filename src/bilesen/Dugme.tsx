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
}

export function Dugme({ tur = 'birincil', ton = 'lila', ikon, mesgul, yukseklik, children, className = '', disabled, style, ...p }: DugmeOz) {
  return (
    <button
      {...p}
      disabled={disabled || mesgul}
      aria-busy={mesgul || undefined}
      className={`dugme dugme-${tur} ${tur === 'ikincil' ? `ton-${ton}` : ''} ${className}`}
      style={yukseklik ? { ...style, height: yukseklik } : style}
    >
      {ikon && <span className="dugme-ikon" aria-hidden>{ikon}</span>}
      <span className="dugme-metin">{mesgul ? <span className="nabiz" aria-label="Kaydediliyor"><i /><i /><i /></span> : children}</span>
    </button>
  );
}
