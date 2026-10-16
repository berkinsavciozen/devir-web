// Görünüm ayarı: hareket. "sistem" işletim sisteminin hareket azaltma tercihine uyar; "az" her durumda azaltır.
// Seçim bu cihazda kalır (localStorage); kök öğede data-hareket="az" CSS döngülerini ve geçişlerini durdurur.
export type Hareket = 'sistem' | 'az';
const ANAHTAR = 'devir:hareket';

export function hareketSecimi(): Hareket {
  try { return localStorage.getItem(ANAHTAR) === 'az' ? 'az' : 'sistem'; } catch { return 'sistem'; }
}
export function hareketUygula(h: Hareket = hareketSecimi()) {
  if (typeof document === 'undefined') return;
  if (h === 'az') document.documentElement.dataset.hareket = 'az'; else delete document.documentElement.dataset.hareket;
}
export function hareketKoy(h: Hareket) {
  try { localStorage.setItem(ANAHTAR, h); } catch { /* yok */ }
  hareketUygula(h);
}
/** Hareket azaltılmalı mı (ayar ya da sistem tercihi) */
export function hareketAz(): boolean {
  if (hareketSecimi() === 'az') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
