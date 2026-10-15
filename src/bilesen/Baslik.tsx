import type { ReactNode } from 'react';

/** Ekran başlığı: geri düğmesi (36 px daire, merkez x 34 y 62) + Caladea 24 başlık (x 64, taban y 70). */
export function Baslik({ baslik, geri, sag }: { baslik: ReactNode; geri?: () => void; sag?: ReactNode }) {
  return (
    <header className={`baslik ${geri ? 'geri-var' : ''}`}>
      {geri && (
        <button className="geri" onClick={geri} aria-label="Geri">
          <svg width="36" height="36" viewBox="-18 -18 36 36" aria-hidden>
            <circle r="17.5" className="geri-zemin" />
            <path d="M3,-6 L-4,0 L3,6" className="geri-ok" />
          </svg>
        </button>
      )}
      <h1 className="t-ekran-basligi">{baslik}</h1>
      {sag && <div className="baslik-sag">{sag}</div>}
    </header>
  );
}

/** Akıllı cümle: ekranda en fazla 2 tane; Caladea 17/22, ink2. */
export function AkilliCumle({ children, buyuk }: { children: ReactNode; buyuk?: boolean }) {
  return <p className={`akilli-cumle ${buyuk ? 't-akilli-cumle-buyuk' : 't-akilli-cumle'}`}>{children}</p>;
}
