// Son bakıştan beri değişenler (plan 2 Kas, durum dili 2): haritayı açınca, bu cihazda son açılıştan beri durumu değişen
// adımlar bir kez parlar ve haritanın üstünde bir cümle çıkar ("Son bakıştan beri: 2 bitti, 1 takıldı").
// Görülen durumlar cihazda tutulur (localStorage); boş ya da erişilemezse hiçbir şey vurgulanmaz, harita yine çalışır.

type Adim = { no: number; durum: string; ust_adim?: number | null };
export type Gorulen = Record<string, string>;
export type Degisim = { no: number; gezegen: number; eski: string; yeni: string };

const anahtar = (kod: string) => `devir:gorulen:${kod}`;

export function gorulenOku(kod: string): Gorulen | null {
  try {
    const v = localStorage.getItem(anahtar(kod));
    if (!v) return null;
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? (o as Gorulen) : null;
  } catch { return null; }
}

export function gorulenYaz(kod: string, adimlar: Adim[]) {
  try { localStorage.setItem(anahtar(kod), JSON.stringify(anlik(adimlar))); } catch { /* yok */ }
}

export const anlik = (adimlar: Adim[]): Gorulen => Object.fromEntries(adimlar.map((a) => [String(a.no), a.durum]));

/** Önceki görüşte de olan ve durumu değişen adımlar; alt görev haritada üst görevinin gezegeninde vurgulanır. */
export function degisenler(onceki: Gorulen | null, adimlar: Adim[]): Degisim[] {
  if (!onceki) return [];
  const out: Degisim[] = [];
  for (const a of adimlar) {
    const eski = onceki[String(a.no)];
    if (eski != null && eski !== a.durum) out.push({ no: a.no, gezegen: a.ust_adim ?? a.no, eski, yeni: a.durum });
  }
  return out;
}

const FIIL: Record<string, string> = { tamam: 'bitti', engelli: 'takıldı', suruyor: 'başladı', hazir: 'sırası geldi', atlandi: 'atlandı', ertelendi: 'ertelendi', sirada: 'yeniden açıldı' };
const SIRA = ['tamam', 'engelli', 'hazir', 'suruyor', 'atlandi', 'ertelendi', 'sirada'];

/** "Son bakıştan beri: 2 bitti, 1 takıldı" (engel her zaman söylenir; en çok 3 parça) */
export function degisimCumlesi(ds: Degisim[]): string | null {
  if (!ds.length) return null;
  const say: Record<string, number> = {};
  for (const d of ds) say[d.yeni] = (say[d.yeni] || 0) + 1;
  const parca = SIRA.filter((k) => say[k]).map((k) => `${say[k]} ${FIIL[k]}`).slice(0, 3);
  return `Son bakıştan beri: ${parca.join(', ')}`;
}
