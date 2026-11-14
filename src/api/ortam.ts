import { arama } from '../yonlendirme';
/** Sahte kip: `vite --mode sahte` (VITE_SAHTE=1). Örnek veri, sabit saat 14 Eki 2026 10:00. */
export const SAHTE = import.meta.env.VITE_SAHTE === '1';
export const API_TABAN = (import.meta.env.VITE_DEVIR_API as string) || '';
/** Sahte kipte hal örnekleri (§10): örnek veriye eklenen yazmalar ve o halin "bugün"ü. ?hal=karar */
export const HAL_SIMDI: Record<string, string> = { nm8r: '2026-11-03T12:51:00+03:00', 'nm8r-hedef': '2026-11-03T12:51:00+03:00', karar: '2026-11-07T12:00:00+03:00', uydu: '2026-11-04T12:00:00+03:00', gecikme: '2026-11-04T12:00:00+03:00', alt: '2026-10-14T10:00:00+03:00', rk8r: '2026-11-09T16:20:00+03:00', 'rk8r-g4': '2026-11-13T11:00:00+03:00', 'rk8r-g12': '2026-11-21T11:00:00+03:00', 'rk8r-iz': '2026-11-21T11:00:00+03:00', 'rk8r-gec': '2026-11-25T11:00:00+03:00', 'rk8r-son': '2026-12-02T11:00:00+03:00' };
export function hal(): string | null {
  if (!SAHTE || typeof location === 'undefined') return null;
  const q = arama();
  try { if (q.has('hal')) sessionStorage.setItem('devir:hal', q.get('hal') || ''); else if (q.has('senaryo')) sessionStorage.removeItem('devir:hal'); return q.get('hal') || sessionStorage.getItem('devir:hal') || null; } catch { return q.get('hal'); }
}
const SAHTE_SIMDI = (() => { const h = SAHTE ? hal() : null; return Date.parse(h && HAL_SIMDI[h] ? HAL_SIMDI[h] : '2026-10-14T10:00:00+03:00'); })();
/** "Şimdi": sahte kipte tasarımın bugünü (ya da halin bugünü) */
export const simdi = () => (SAHTE ? SAHTE_SIMDI : Date.now());
