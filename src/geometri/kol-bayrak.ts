/**
 * Harita biçimi (9 Kas; 12 Kas D5): varsayılan zaman spirali. ?harita=eski eski haritayı (kur / olcekliKur), ?harita=kol kol
 * haritasını, ?harita=yorunge Kişi Yörüngeleri'ni (13 Kas, sentez; akış haritasında) bu cihazda seçer; ?harita=spiral seçimi siler. Geri dönüş tek adres.
 */
export type HaritaBicimi = 'eski' | 'kol' | 'spiral' | 'yorunge';
const ANAHTAR = 'devir:harita';
let onbellek: HaritaBicimi | null = null;
export function haritaBicimi(): HaritaBicimi {
  if (onbellek != null) return onbellek;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('harita');
    // 12 Kas (D5): zaman spirali varsayılan; ?harita=eski ya da ?harita=kol bu cihazda seçilir, ?harita=spiral seçimi siler
    if (q === 'kol' || q === 'eski' || q === 'yorunge') localStorage.setItem(ANAHTAR, q);
    else if (q === 'spiral') localStorage.removeItem(ANAHTAR);
    const v = localStorage.getItem(ANAHTAR);
    onbellek = v === 'kol' || v === 'eski' || v === 'yorunge' ? v : 'spiral';
  } catch { onbellek = 'spiral'; }
  return onbellek;
}
/** Yeni haritalardan biri açık mı (evrende zaman içten dışa da bununla açılır). */
export const kolHarita = (): boolean => haritaBicimi() !== 'eski';
/** testler için */
export function kolHaritaAyarla(v: HaritaBicimi | boolean | null) { onbellek = v === true ? 'kol' : v === false ? 'eski' : v; }
/** Akış haritası Kişi Yörüngeleri mi (13 Kas, sentez; deneme bayrağı). */
export const yorungeHarita = (): boolean => haritaBicimi() === 'yorunge';
