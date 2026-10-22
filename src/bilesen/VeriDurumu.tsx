// Veri durumu (P1-B2, M-M3): yükleniyor, kısmi, hata ve boş ayrı gösterilir. Yükleme sürerken hiçbir boş ya da sıfır sonuç
// gerçek durum gibi yazılmaz; 300 ms'den uzun süren yükleme görünür ve ekran okuyucuya duyurulur.
import { useEffect, useState } from 'react';

export type VeriDurumu = 'yukleniyor' | 'kismi' | 'hata' | 'bos' | 'hazir';

/** bekliyor: ana sorgu sürüyor; eksik: detayı henüz gelmemiş öğe sayısı; hata: bir sorgu kalıcı hata verdi; bos: hepsi geldi ve liste boş. */
export function veriDurumu(o: { bekliyor?: boolean; hata?: boolean; eksik?: number; bos?: boolean }): VeriDurumu {
  if (o.hata) return 'hata';
  if (o.bekliyor) return 'yukleniyor';
  if (o.eksik) return 'kismi';
  return o.bos ? 'bos' : 'hazir';
}

/** aktif ms'den uzun sürünce true (kısa yüklemede titreşim olmasın). */
export function useGecikmeli(aktif: boolean, ms = 300) {
  const [g, setG] = useState(false);
  useEffect(() => {
    if (!aktif) { setG(false); return; }
    const t = setTimeout(() => setG(true), ms);
    return () => clearTimeout(t);
  }, [aktif, ms]);
  return g;
}

/** Sahnede konumlu durum notu. Yüklenirken (300 ms sonra) nabız ve "… yükleniyor"; hatada yeniden dene. Boş ve hazırda hiçbir şey. */
export function DurumNotu({ durum, y, x = 20, ne = 'İşler', yeniden, style }: { durum: VeriDurumu; y: number; x?: number; ne?: string; yeniden?: () => void; style?: React.CSSProperties }) {
  const yukleniyor = durum === 'yukleniyor' || durum === 'kismi';
  const goster = useGecikmeli(yukleniyor);
  const st = { top: y, left: x, ...style };
  if (durum === 'hata') return (
    <div className="veri-durumu hata" role="alert" style={st}>
      {ne} yüklenemedi.{yeniden && <button type="button" className="metin-baglanti" onClick={yeniden}>Yeniden dene</button>}
    </div>
  );
  if (!yukleniyor) return null;
  return (
    <div className="veri-durumu" role="status" aria-live="polite" style={st}>
      {goster && <><span className="nabiz" aria-hidden><i /><i /><i /></span>{ne} yükleniyor…</>}
    </div>
  );
}
