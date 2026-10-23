/**
 * Web–sunucu sürüm uyumu (N-8). Web ve Edge ayrı yayınlanır: web merge'de çıkar, Edge panelden elle yüklenir.
 * Web bu sunucu sürümüne göre yazıldı; /api/v1/durum daha eski bir sürüm ya da uygulanmamış migration gösterirse Ayarlar söyler.
 */
export const SUNUCU_SURUMU = '0.25.0';

type Durum = { surum?: string; sema?: { beklenen?: string; canli?: string | null; uyumlu?: boolean | null } };

const parca = (s: string) => s.split('.').map((x) => Number(x) || 0);
/** a < b (noktalı sürüm) */
export function eskiMi(a: string, b: string) {
  const [x, y] = [parca(a), parca(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  return false;
}

/** Ayarlar > Bağlantı denetimi satırı: tamam ya da ne eksik */
export function uyumDurumu(d: Durum | undefined, beklenen = SUNUCU_SURUMU): { tamam: boolean; metin: string } {
  if (!d?.surum) return { tamam: false, metin: 'Sunucu sürümü okunamadı' };
  if (eskiMi(d.surum, beklenen)) return { tamam: false, metin: `Sunucu ${d.surum} · web ${beklenen} bekliyor, Edge kodu yüklenmeli` };
  if (d.sema && d.sema.uyumlu === false) return { tamam: false, metin: `Sunucu ${d.surum} · şema güncel değil, migration bekleniyor` };
  return { tamam: true, metin: `Sunucu ${d.surum} · erişim açık` };
}
