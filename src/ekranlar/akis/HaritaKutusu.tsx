import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { planet } from '../../cizim/ortak.js';
import { kisaAd, otoRozet } from '../../cizim/yol.js';
import { adimAdi } from '../../metin/turkce';
import { EylemCubugu } from './EylemCubugu';
import { ajanMi, BITTI, eylemPlani } from './eylemler';

const DURUM: Record<string, string> = { tamam: 'bitti', atlandi: 'atlandı', ertelendi: 'ertelendi', engelli: 'engelli', suruyor: 'sürüyor', hazir: 'başlayabilir', sirada: 'sırada' };
const AI: Record<string, string> = { calisiyor: 'AI çalışıyor', bakilacak: 'AI yazdı, onayını bekliyor', hata: 'AI yapamadı', bekliyor: 'AI yapsın · sırada' };
const gor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'suruyor' ? 'run' : a.durum === 'hazir' ? 'wait' : 'dark');

/**
 * W5 (4 Kas, K4): telefonda gezegene dokununca harita ona yakınlaşır ve altta küçük kutu açılır. Metin yalnız bu kutuda:
 * ad, durum, sahip, AI durumu ve tek ana eylem. Ayrıntılar tam görevi açar.
 */
export function HaritaKutusu({ a, kod, ben, acikAlt, ayrinti, kapat, style }: {
  a: any; kod: string; ben: string; acikAlt: number; ayrinti: () => void; kapat: () => void; style?: React.CSSProperties;
}) {
  const tetikler = useQuery({ queryKey: ['tetikler'], queryFn: () => api.get<any>('/tetikler'), retry: false, staleTime: 60_000 });
  const tetikYok = !!tetikler.data && !(tetikler.data.tetikler || []).length;
  const p = eylemPlani({ a, ben, acikAlt, tetikYok });
  const plan = { ana: p.ana, ikincil: null, menu: [] };
  const r = otoRozet(a);
  const alt = [DURUM[a.durum] || a.durum_etiket || a.durum, a.sahip === ben ? 'senin' : ajanMi(a.sahip, a.sahip_tip) ? a.sahip : kisaAd(a.sahip), acikAlt ? `${acikAlt} alt görev açık` : null].filter(Boolean).join(' · ');
  return (
    <section className="harita-kutu" role="dialog" aria-label={`${a.no}. ${adimAdi(a)}`} style={style}>
      <div className="harita-kutu-ust">
        <svg aria-hidden width="30" height="30" viewBox="-15 -15 30 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: planet(0, 0, 11, gor(a), { life: false, cloudGap: 2, oto: BITTI(a.durum) ? null : r }) }} />
        <div className="harita-kutu-ad">
          <b>{a.no}. {adimAdi(a)}</b>
          <small>{alt}</small>
          {r && !BITTI(a.durum) && <small className={`harita-kutu-ai ${r}`}>{AI[r]}</small>}
          <button type="button" className="metin-baglanti harita-kutu-ayrinti" onClick={ayrinti}>Ayrıntılar ›</button>
        </div>
        <button type="button" className="harita-kutu-kapat" aria-label="Kutuyu kapat" onClick={kapat}>
          <svg aria-hidden viewBox="-8 -8 16 16"><path d="M-4,-4 L4,4 M4,-4 L-4,4" /></svg>
        </button>
      </div>
      {plan.ana && <div className="harita-kutu-eylem"><EylemCubugu a={a} kod={kod} plan={plan} ciktiEkle={ayrinti} baglantiAc={ayrinti} /></div>}
    </section>
  );
}
