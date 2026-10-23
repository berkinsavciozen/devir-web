import { useSyncExternalStore } from 'react';

/**
 * Masaüstü kabuğunda liste ile harita arasındaki ortak vurgu (N15): paneldeki satırın üzerine gelince
 * soldaki galaksi parlar, galaksinin üzerine gelince satır vurgulanır. Değer akış kodu ya da null.
 */
let deger: string | null = null;
const dinleyenler = new Set<() => void>();

export function vurgula(kod: string | null) {
  if (kod === deger) return;
  deger = kod;
  for (const d of dinleyenler) d();
}

export function useVurgu(): string | null {
  return useSyncExternalStore((d) => { dinleyenler.add(d); return () => { dinleyenler.delete(d); }; }, () => deger, () => null);
}
