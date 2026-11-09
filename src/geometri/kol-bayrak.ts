/**
 * Kol haritası bayrağı (9 Kas, geri dönülebilir geçiş): ?harita=kol açar, ?harita=eski kapatır; seçim bu cihazda saklanır.
 * Kapalıyken eski harita (kur / olcekliKur) aynen çizilir.
 */
const ANAHTAR = 'devir:harita';
let onbellek: boolean | null = null;
export function kolHarita(): boolean {
  if (onbellek != null) return onbellek;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('harita');
    if (q === 'kol') localStorage.setItem(ANAHTAR, 'kol');
    else if (q === 'eski') localStorage.removeItem(ANAHTAR);
    onbellek = localStorage.getItem(ANAHTAR) === 'kol';
  } catch { onbellek = false; }
  return onbellek;
}
/** testler için */
export function kolHaritaAyarla(v: boolean | null) { onbellek = v; }
