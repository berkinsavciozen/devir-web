/** Sahte kip: `vite --mode sahte` (VITE_SAHTE=1). Örnek veri, sabit saat 14 Eki 2026 10:00. */
export const SAHTE = import.meta.env.VITE_SAHTE === '1';
export const API_TABAN = (import.meta.env.VITE_DEVIR_API as string) || '';
/** "Şimdi": sahte kipte tasarımın bugünü */
export const simdi = () => (SAHTE ? Date.parse('2026-10-14T10:00:00+03:00') : Date.now());
