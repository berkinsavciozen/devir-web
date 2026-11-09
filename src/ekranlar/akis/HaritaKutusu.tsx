import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { planet } from '../../cizim/ortak.js';
import { kisaAd, otoRozet } from '../../cizim/yol.js';
import { adimAdi } from '../../metin/turkce';
import { EylemCubugu } from './EylemCubugu';
import { GorevKart } from '../../bilesen/GorevKart';
import { hamle } from '../../cizim/hamle';
import { simdi } from '../../api/ortam';
import { ajanMi, BITTI, eylemPlani } from './eylemler';
import { useSohbet } from './sohbet';
import { useBen } from '../../api/sorgular';

const DURUM: Record<string, string> = { tamam: 'bitti', atlandi: 'atlandı', ertelendi: 'ertelendi', engelli: 'engelli', suruyor: 'sürüyor', hazir: 'başlayabilir', sirada: 'sırada' };
const AI: Record<string, string> = { calisiyor: 'AI çalışıyor', bakilacak: 'AI yazdı, onayını bekliyor', hata: 'AI yapamadı', bekliyor: 'AI yapsın · sırada' };
const gor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'suruyor' ? 'run' : a.durum === 'hazir' ? 'wait' : 'dark');

/**
 * W5 (4 Kas, K4): telefonda gezegene dokununca harita ona yakınlaşır ve altta küçük kutu açılır. Metin yalnız bu kutuda:
 * ad, durum, sahip, AI durumu ve tek ana eylem. Ayrıntılar tam görevi açar.
 */
export function HaritaKutusu({ a, d, kod, ben, acikAlt, ayrinti, kapat, style }: {
  a: any; d?: any; kod: string; ben: string; acikAlt: number; ayrinti: () => void; kapat: () => void; style?: React.CSSProperties;
}) {
  const tetikler = useQuery({ queryKey: ['tetikler'], queryFn: () => api.get<any>('/tetikler'), retry: false, staleTime: 60_000 });
  const tetikYok = !!tetikler.data && !(tetikler.data.tetikler || []).length;
  const { claudeYok } = useSohbet();
  const akisSahibi = useBen().data?.rol === 'sahip';
  const p = eylemPlani({ a, ben, acikAlt, tetikYok, claudeYok, akisSahibi });
  const plan = { ana: p.ana, ikincil: null, menu: [] };
  // W4 (B17): kutuda tek görev bileşeni; kutuya dokunmak detayı açar ("Ayrıntılar" yok), hızlı eylem hamle renginde
  const h = hamle(a, { ben, rutinYok: tetikYok });
  return (
    <section className="harita-kutu" role="dialog" aria-label={`${a.no}. ${adimAdi(a)}`} style={style}>
      <div className="harita-kutu-ust">
        <GorevKart a={a} d={d} ben={ben} now={simdi()} ac={ayrinti} className="harita-kutu-kart" hamleGizli={!!plan.ana} />
        <button type="button" className="harita-kutu-kapat" aria-label="Kutuyu kapat" onClick={kapat}>
          <svg aria-hidden viewBox="-8 -8 16 16"><path d="M-4,-4 L4,4 M4,-4 L-4,4" /></svg>
        </button>
      </div>
      {plan.ana && <div className="harita-kutu-eylem"><EylemCubugu a={a} kod={kod} plan={plan} ciktiEkle={ayrinti} baglantiAc={ayrinti} kararAc={ayrinti} hamle={h} /></div>}
    </section>
  );
}
