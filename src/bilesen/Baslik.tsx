import type { CSSProperties, ReactNode } from 'react';

/** Ekran başlığı: geri düğmesi (36 px daire, merkez x 34 y 62) + Caladea 24 başlık (x 64, taban y 70). */
export function Baslik({ baslik, geri, sag, sagBos = 0 }: { baslik: ReactNode; geri?: () => void; sag?: ReactNode; sagBos?: number }) {
  // P1-F: uzun ad kesilmez; başlık satıra sığana dek küçülür (--n karakter, --bos geri düğmesi, kenarlar ve sağdaki ayrılmış yer)
  const st = typeof baslik === 'string' ? ({ '--n': baslik.length, '--bos': `${(geri ? 62 : 20) + 20 + sagBos + (sag ? 50 : 0)}px` } as CSSProperties) : undefined;
  return (
    <header className={`baslik ${geri ? 'geri-var' : ''}`} style={st}>
      {geri && (
        <button className="geri" onClick={geri} aria-label="Geri">
          <svg width="36" height="36" viewBox="-18 -18 36 36" aria-hidden>
            <circle r="17.5" className="geri-zemin" />
            <path d="M3,-6 L-4,0 L3,6" className="geri-ok" />
          </svg>
        </button>
      )}
      <h1 className="t-ekran-basligi">{baslik}</h1>
      {sagBos > 0 && <span aria-hidden style={{ width: sagBos, flex: 'none' }} />}
      {sag && <div className="baslik-sag">{sag}</div>}
    </header>
  );
}

/** Akıllı cümle: ekranda en fazla 2 tane; Caladea 17/22, ink2. */
export function AkilliCumle({ children, buyuk }: { children: ReactNode; buyuk?: boolean }) {
  return <p className={`akilli-cumle ${buyuk ? 't-akilli-cumle-buyuk' : 't-akilli-cumle'}`}>{children}</p>;
}
