/**
 * Harita biçimi (13 Kas, sentez U5): akış haritasında varsayılan Kişi Yörüngeleri. ?harita=spiral önceki zaman spiralini,
 * ?harita=kol kol haritasını, ?harita=eski en eski haritayı bu cihazda seçer; ?harita=yorunge seçimi siler (varsayılana döner).
 * Küçük galaksiler ve kapanmış akış özeti her durumda spiral çizilir (yol.js 'yorunge'yi 'spiral' sayar).
 */
export type HaritaBicimi = 'eski' | 'kol' | 'spiral' | 'yorunge';
const ANAHTAR = 'devir:harita';
let onbellek: HaritaBicimi | null = null;
export function haritaBicimi(): HaritaBicimi {
  if (onbellek != null) return onbellek;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('harita');
    if (q === 'kol' || q === 'eski' || q === 'spiral') localStorage.setItem(ANAHTAR, q);
    else if (q === 'yorunge') localStorage.removeItem(ANAHTAR);
    const v = localStorage.getItem(ANAHTAR);
    onbellek = v === 'kol' || v === 'eski' || v === 'spiral' ? v : 'yorunge';
  } catch { onbellek = 'yorunge'; }
  return onbellek;
}
/** Yeni haritalardan biri açık mı (evrende zaman içten dışa da bununla açılır). */
export const kolHarita = (): boolean => haritaBicimi() !== 'eski';
/** testler için */
export function kolHaritaAyarla(v: HaritaBicimi | boolean | null) { onbellek = v === true ? 'kol' : v === false ? 'eski' : v; }
/** Akış haritası Kişi Yörüngeleri mi (13 Kas, sentez; varsayılan). */
export const yorungeHarita = (): boolean => haritaBicimi() === 'yorunge';
