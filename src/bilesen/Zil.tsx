import { usePanelIcinde } from './Kabuk';
import { useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from '../api/istemci';
import { git } from '../yonlendirme';

/** Bildirimler akışı (sunucu 0.12.0 /olaylar). Yoksa 404: zil sayısız durur, sayfa eski görünüme düşer. */
export function useOlaylar() {
  return useQuery({
    queryKey: ['olaylar'], queryFn: () => api.get<any>('/olaylar?sinir=100'), staleTime: 60_000,
    retry: (n, e) => !(e instanceof ApiHatasi && e.durum === 404) && n < 2,
  });
}

/**
 * Bildirim zili (el notu 18, karar 3): alt çubukta değil, sayfa başında. Evrenin diliyle çizilir: lila çan,
 * dilinde küçük bir yıldız; okunmamış varsa altın çan ve şeftali rozet.
 */
/** x verilmezse sağ kenara 8 px yaslanır (dar telefonda da görünür). */
export function Zil({ x, y, stil, kabukta }: { x?: number; y: number; stil?: React.CSSProperties; kabukta?: boolean }) {
  const panelde = usePanelIcinde();
  const n = useOlaylar().data?.okunmamis ?? 0;
  // masaüstü panelinde zil üst çubukta bir kez (sayfanın kendi zili çizilmez)
  if (panelde && !kabukta) return null;
  const r = n ? 'var(--renk-vurgu-altin)' : 'var(--renk-vurgu-lila)';
  return (
    <button type="button" className="zil-dugme" style={{ ...(x == null ? { right: 8 } : { left: x }), top: y, ...stil }} aria-label={n ? `Bildirimler: ${n} okunmamış` : 'Bildirimler'} onClick={() => git('/bildirimler')}>
      <svg aria-hidden width="26" height="26" viewBox="-13 -13 26 26">
        {n > 0 && <circle r="13" fill="url(#glowGold)" opacity=".45" />}
        <path d="M-7.5,5 C-6,3.5 -6,1 -6,-1.5 C-6,-5.5 -3.5,-8 0,-8 C3.5,-8 6,-5.5 6,-1.5 C6,1 6,3.5 7.5,5 Z" fill="var(--renk-zemin-kart)" stroke={r} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M0,-10.5 L0,-8" stroke={r} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0,6.2 l1.1,2.3 2.4,.4 -1.8,1.6 .5,2.4 -2.2,-1.2 -2.2,1.2 .5,-2.4 -1.8,-1.6 2.4,-.4 Z" transform="scale(.62) translate(0,4)" fill={n ? 'var(--renk-vurgu-seftali)' : r} />
      </svg>
      {n > 0 && <b className="zil-sayi" aria-hidden>{n > 99 ? '99+' : n}</b>}
    </button>
  );
}

/**
 * Sayfa üstündeki düğme kümesi (plan 27 Eki, 2.8): yeni iş, bildirim zili ve ayarlar, sağ üstte yan yana.
 * Telefonda alt gezinmeden çıkan + ve Ayarlar buraya taşındı; masaüstü panelinde PanelUst aynı üçlüyü çizer.
 */
export function UstDugmeler({ y, aktif }: { y: number; aktif?: 'ayarlar' | 'bildirimler' }) {
  const panelde = usePanelIcinde();
  if (panelde) return null;
  return (
    <div className="ust-dugmeler" style={{ top: y }}>
      <button type="button" className="zil-dugme ust-arti" aria-label="Yeni iş" onClick={() => git('/yeni')}>
        <svg aria-hidden width="26" height="26" viewBox="-13 -13 26 26"><circle r="11" fill="url(#btn)" /><path d="M0,-5 L0,5 M-5,0 L5,0" stroke="var(--renk-metin-koyu-uzerine)" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </button>
      {aktif !== 'bildirimler' && <Zil y={0} stil={{ position: 'relative', top: 'auto', right: 'auto', left: 'auto' }} />}
      {aktif !== 'ayarlar' && <button type="button" className="zil-dugme" aria-label="Ayarlar" onClick={() => git('/ayarlar')}>
        <svg aria-hidden width="24" height="24" viewBox="-12 -12 24 24"><path d="M-7,-4 L7,-4 M-7,4 L7,4" stroke="var(--renk-vurgu-lila)" strokeWidth="1.5" strokeLinecap="round" /><circle cx="-2.5" cy="-4" r="2.4" fill="var(--renk-zemin-kart)" stroke="var(--renk-vurgu-lila)" strokeWidth="1.5" /><circle cx="3" cy="4" r="2.4" fill="var(--renk-zemin-kart)" stroke="var(--renk-vurgu-lila)" strokeWidth="1.5" /></svg>
      </button>}
    </div>
  );
}
