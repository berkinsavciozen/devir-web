import { QueryClient, useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from './istemci';
import { kimlik } from './kimlik';
import type { Ben } from './turler';

export const sorguIstemcisi = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (n, e) => !(e instanceof ApiHatasi && e.durum >= 400 && e.durum < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
});

/** Oturumdaki kişi. Belirteç yoksa `null` (giriş ekranı). */
export function useBen() {
  return useQuery({
    queryKey: ['ben'],
    queryFn: async (): Promise<Ben | null> => {
      if (!(await kimlik.belirtec())) return null;
      try { return await api.get<Ben>('/ben'); } catch (e) { if (e instanceof ApiHatasi && e.durum === 401) return null; throw e; }
    },
    staleTime: 60_000,
  });
}

/** Sayfayı açan kişinin özeti: akıllı cümle, akış kartları, taslaklar. */
export function useOzet(etkin = true) {
  return useQuery({ queryKey: ['ozet'], queryFn: () => api.get<any>('/ozet'), enabled: etkin });
}

/** Giriş/çıkış sonrası her şeyi baştan al. */
export function oturumDegisti() { void sorguIstemcisi.resetQueries(); }
