/**
 * Akışın zaman ufku (3 Kas, NM8R): hedef tarih sunucuda isteğe bağlı; yoksa evren, Akışlar çubuğu ve harita
 * ufuk olarak en erken bitişi kullanır, o da yoksa kuruluştan 30 gün sonrasını. Dönen değer YYYY-AA-GG.
 */
const GUN = 864e5;
const gunu = (ms: number) => new Date(ms + 3 * 36e5).toISOString().slice(0, 10);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

export interface UfukGirdi {
  hedef_tarih?: string | null; en_erken_bitis?: string | null; olusturuldu?: string | null; kapandi_at?: string | null;
  olcu?: { en_erken_bitis?: string | null } | null; [k: string]: unknown;
}

/** Hedef tarih yok ve akış açık. */
export const hedefsiz = (k: UfukGirdi | null | undefined) => !!k && !k.hedef_tarih && !k.kapandi_at;

/** Ufuk günü: hedef → kapanış günü → en erken bitiş → kuruluş + 30 gün. Hiçbiri yoksa null. */
export function akisUfku(k: UfukGirdi | null | undefined, adimlar?: { durum?: string; en_erken_bitis?: string | null; durum_at?: string | null }[]): string | null {
  if (!k) return null;
  if (k.hedef_tarih) return k.hedef_tarih;
  if (k.kapandi_at) return k.kapandi_at.slice(0, 10);
  const ee = k.en_erken_bitis || k.olcu?.en_erken_bitis;
  if (ee) return ee.slice(0, 10);
  const son = Math.max(-Infinity, ...(adimlar || []).map((a) => Date.parse(a.en_erken_bitis || a.durum_at || '')).filter(Number.isFinite));
  if (Number.isFinite(son)) return gunu(son);
  if (k.olusturuldu) return gunu(tarihMs(k.olusturuldu) + 30 * GUN);
  return null;
}
