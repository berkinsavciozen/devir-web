/**
 * Harita biçimi bayrağı (9 Kas, geri dönülebilir geçiş): ?harita=spiral (zaman spirali) ya da ?harita=kol açar,
 * ?harita=eski kapatır; seçim bu cihazda saklanır. Kapalıyken eski harita (kur / olcekliKur) aynen çizilir.
 */
export type HaritaBicimi = 'eski' | 'kol' | 'spiral';
const ANAHTAR = 'devir:harita';
let onbellek: HaritaBicimi | null = null;
export function haritaBicimi(): HaritaBicimi {
  if (onbellek != null) return onbellek;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('harita');
    if (q === 'kol' || q === 'spiral') localStorage.setItem(ANAHTAR, q);
    else if (q === 'eski') localStorage.removeItem(ANAHTAR);
    const v = localStorage.getItem(ANAHTAR);
    onbellek = v === 'kol' || v === 'spiral' ? v : 'eski';
  } catch { onbellek = 'eski'; }
  return onbellek;
}
/** Yeni haritalardan biri açık mı (evrende zaman içten dışa da bununla açılır). */
export const kolHarita = (): boolean => haritaBicimi() !== 'eski';
/** testler için */
export function kolHaritaAyarla(v: HaritaBicimi | boolean | null) { onbellek = v === true ? 'kol' : v === false ? 'eski' : v; }
