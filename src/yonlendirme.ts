import { useEffect, useState } from 'react';

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

/** Küçük geçmiş tabanlı yönlendirici: /, /akislar, /akis/:kod, /giris, /l/:token … */
export function useYol(): string {
  const [yol, setYol] = useState(yolAl);
  useEffect(() => {
    const d = () => setYol(yolAl());
    window.addEventListener('popstate', d);
    window.addEventListener('hashchange', d);
    window.addEventListener('devir:yol', d);
    return () => { window.removeEventListener('popstate', d); window.removeEventListener('hashchange', d); window.removeEventListener('devir:yol', d); };
  }, []);
  return yol;
}

export function git(yol: string, o: { yerine?: boolean } = {}) {
  if (HASH) {
    if ('#' + yol === location.hash) return;
    if (o.yerine) location.replace('#' + yol); else location.hash = yol;
    return;
  }
  if (yol === location.pathname + location.search) return;
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
