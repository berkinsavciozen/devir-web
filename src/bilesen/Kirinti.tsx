import { adimAdi } from '../metin/turkce';

/**
 * Üst görev kırıntısı (plan 27 Eki, 1.5): alt görev her listede üst göreviyle görünür, "Üst görev › Alt görev".
 * Pano, Görevler, Bildirimler, akış listesi ve dış bağlantı sayfası aynı bileşeni kullanır.
 */
export function ustGorev(a: { ust_adim?: number | null; no?: number; adim_no?: number | null } | null | undefined, adimlar: any[] | undefined): any | null {
  if (!a || !adimlar) return null;
  const no = a.no ?? a.adim_no;
  const ust = a.ust_adim ?? adimlar.find((x) => x.no === no)?.ust_adim;
  return ust != null ? adimlar.find((x) => x.no === ust) || null : null;
}
// başkasının adımı adsız gelebilir (dış bağlantı haritası): adı yoksa kırıntı yok
export const ustAdi = (a: any, adimlar: any[] | undefined) => { const u = ustGorev(a, adimlar); return u?.ad ? adimAdi(u) : null; };
export function GorevAdi({ ad, ust }: { ad: string; ust?: string | null }) {
  return <>{ust && <span className="ust-kirinti">{ust} › </span>}{ad}</>;
}
