import { useSyncExternalStore } from 'react';

/**
 * W3 (B8): masaüstünde taslak sayfası iki bölmedir: solda taslak haritası, sağda sorular. Kişinin henüz kurulmamış
 * cevapları ikisi arasında bu küçük depoda paylaşılır: cevaplanan soru haritada dolar, haritada "?" e basınca
 * paneldeki soru açılır.
 */
export interface TaslakDurum { cevap: Record<string, string>; odak: string | null; n: number }
const D = new Map<string, TaslakDurum>();
const dinleyen = new Set<() => void>();
const BOS: TaslakDurum = { cevap: {}, odak: null, n: 0 };
const duyur = () => dinleyen.forEach((f) => f());

export const taslakDurumu = (kod: string) => D.get(kod) || BOS;
export function cevaplariYaz(kod: string, cevap: Record<string, string>) { D.set(kod, { ...taslakDurumu(kod), cevap }); duyur(); }
/** Haritadan soruya git: `n` her istekte artar (aynı soruya ikinci basış da açar). */
export function soruyaOdaklan(kod: string, soru: string) { const d = taslakDurumu(kod); D.set(kod, { ...d, odak: soru, n: d.n + 1 }); duyur(); }

export function useTaslakDurumu(kod: string): TaslakDurum {
  return useSyncExternalStore((f) => { dinleyen.add(f); return () => { dinleyen.delete(f); }; }, () => taslakDurumu(kod));
}
