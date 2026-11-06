/**
 * Değişiklik sinyali (K7, 0.34.0): sunucu çalışma alanında bir yazım olunca `devir-<alan>` kanalına verisiz
 * "degisti" yayınlar; web açık sorguları yeniden çeker. Yayında veri yok: yetki her zamanki gibi API'de kalır.
 * Sinyal gelmezse (Realtime kapalı, ağ) eski yol sürer: pencereye dönünce ve aralıklı yenileme.
 */
import { useEffect } from 'react';
import { SAHTE } from './ortam';
import { supabaseAl } from './kimlik';
import { sorguIstemcisi } from './sorgular';

export const kanalAdi = (alanId: string) => `devir-${alanId}`;

/** Art arda gelen sinyalleri tek yenilemeye toplar. */
export function toplayici(fn: () => void, ms = 400) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return () => { if (t) clearTimeout(t); t = setTimeout(() => { t = null; fn(); }, ms); };
}

export function useDegisimSinyali(alanId: string | null | undefined) {
  useEffect(() => {
    if (!alanId || SAHTE) return;
    let kapandi = false, kapat: (() => void) | null = null;
    const yenile = toplayici(() => void sorguIstemcisi.invalidateQueries({ type: 'active' }));
    void supabaseAl().then((sb) => {
      if (kapandi) return;
      const k = sb.channel(kanalAdi(alanId)).on('broadcast', { event: 'degisti' }, yenile).subscribe();
      kapat = () => void sb.removeChannel(k);
    }).catch(() => undefined);
    return () => { kapandi = true; kapat?.(); };
  }, [alanId]);
}
