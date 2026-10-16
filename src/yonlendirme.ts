import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { hareketAz } from './ayar/hareket';

/**
 * Hash kipi (VITE_HASH=1): yol ve sorgu adresin # kısmında durur ("#/akis/RTD5?hal=karar").
 * Sunucu yönlendirmesi olmayan yerlerde (önizleme sayfası) kullanılır.
 */
const HASH = import.meta.env.VITE_HASH === '1';
const hashParca = () => { const h = location.hash.slice(1); const i = h.indexOf('?'); return i < 0 ? [h, ''] : [h.slice(0, i), h.slice(i)]; };
/** Geçerli yol (/akis/RTD5). */
export const yolAl = () => (HASH ? hashParca()[0] || '/' : location.pathname);
/** Geçerli sorgu (?hal=karar); hash kipinde sayfa adresindeki sorgu da geçerlidir. */
export const arama = () => {
  if (!HASH) return new URLSearchParams(location.search);
  const q = new URLSearchParams(location.search);
  new URLSearchParams(hashParca()[1]).forEach((v, k) => q.set(k, v));
  return q;
};

/**
 * Sayfa geçişi (denetim planı, CELISKILER 63): tek dil, View Transitions ile 280 ms. İleri giderken eski sayfa sola
 * kayıp söner, yenisi sağdan gelir; geri dönüşte tersi; yerinde değişimde (adımdan adıma) yalnız çapraz geçiş.
 * Tarayıcı desteklemiyorsa ya da hareket azaltılmışsa doğrudan değişir.
 */
export type Yon = 'ileri' | 'geri' | 'yer';
let sonrakiYon: Yon | 'yok' | null = null;
export function gecis(yon: Yon, degistir: () => void) {
  const d = document as Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } };
  if (!d.startViewTransition || hareketAz()) { degistir(); return; }
  const kok = document.documentElement;
  kok.dataset.gecis = yon;
  try {
    d.startViewTransition(degistir).finished.finally(() => { if (kok.dataset.gecis === yon) delete kok.dataset.gecis; });
  } catch { delete kok.dataset.gecis; degistir(); }
}

/** Küçük geçmiş tabanlı yönlendirici: /, /akislar, /akis/:kod, /giris, /l/:token … */
export function useYol(): string {
  const [yol, setYol] = useState(yolAl);
  const sonYol = useRefYol(yol);
  useEffect(() => {
    const d = () => {
      const yeni = yolAl(), yon = sonrakiYon ?? 'geri';
      sonrakiYon = null;
      // alt sayfanın kendi geçmiş kaydı ya da aynı yol: geçiş yok
      if (yeni === sonYol.current || yon === 'yok') { setYol(yeni); return; }
      gecis(yon, () => flushSync(() => setYol(yeni)));
    };
    window.addEventListener('popstate', d);
    window.addEventListener('hashchange', d);
    window.addEventListener('devir:yol', d);
    return () => { window.removeEventListener('popstate', d); window.removeEventListener('hashchange', d); window.removeEventListener('devir:yol', d); };
  }, []);
  return yol;
}
function useRefYol(yol: string) {
  const r = useRef(yol);
  r.current = yol;
  return r;
}

/** Yola git. `yerine`: geçmiş kaydı büyümez (çapraz geçiş); `gecissiz`: geçiş animasyonu yok (Z1 kendi çizer). */
export function git(yol: string, o: { yerine?: boolean; gecissiz?: boolean } = {}) {
  const yon = o.gecissiz ? 'yok' : o.yerine ? 'yer' : 'ileri';
  if (HASH) {
    if ('#' + yol === location.hash) return;
    sonrakiYon = yon;
    if (o.yerine) location.replace('#' + yol); else location.hash = yol;
    return;
  }
  if (yol === location.pathname + location.search) return;
  sonrakiYon = yon;
  if (o.yerine) history.replaceState(null, '', yol); else history.pushState(null, '', yol);
  window.dispatchEvent(new Event('devir:yol'));
}

/** '/akis/:kod' kalıbını yola uydurur. */
export function eslestir(kalip: string, yol: string): Record<string, string> | null {
  const k = kalip.split('/').filter(Boolean), y = yol.split('/').filter(Boolean);
  if (k.length !== y.length) return null;
  const p: Record<string, string> = {};
  for (let i = 0; i < k.length; i++) {
    if (k[i].startsWith(':')) p[k[i].slice(1)] = decodeURIComponent(y[i]);
    else if (k[i] !== y[i]) return null;
  }
  return p;
}
