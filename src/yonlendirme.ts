import { useEffect, useState } from 'react';

/** Küçük geçmiş tabanlı yönlendirici: /, /akislar, /akis/:kod, /giris, /l/:token … */
export function useYol(): string {
  const [yol, setYol] = useState(() => location.pathname);
  useEffect(() => {
    const d = () => setYol(location.pathname);
    window.addEventListener('popstate', d);
    window.addEventListener('devir:yol', d);
    return () => { window.removeEventListener('popstate', d); window.removeEventListener('devir:yol', d); };
  }, []);
  return yol;
}

export function git(yol: string, o: { yerine?: boolean } = {}) {
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
