import { planet, ship, kapi } from '../../cizim/ortak.js';
import { kisaAd } from '../../cizim/yol.js';
import type { Cip, CipTur } from './ozet';

// Başlık çipleri (el notu 7): lejanttaki işaretlerle aynı simge; dokununca ilgili adım ya da kişi odağı açılır.
const SIMGE: Record<CipTur, (ben: string) => string> = {
  engel: () => planet(11, 12, 6, 'block', { life: false, cloudGap: 1 }),
  karar: () => planet(11, 12, 6, 'wait', { life: false, waitRings: 1, karar: true }),
  risk: () => kapi(11, 19, .2, false),
  sira: () => planet(11, 11, 6, 'wait', { life: false, waitRings: 1 }),
  sende: (ben) => ship(11, 11, -12, 'insan', kisaAd(ben)[0] || '', '#9EE6CF', .4, { flame: false }),
  bitti: () => planet(11, 11, 6, 'lit', { life: false }),
};

export function BaslikCipleri({ cipler, ben, sec, style }: { cipler: Cip[]; ben: string; sec: (c: Cip) => void; style?: React.CSSProperties }) {
  if (!cipler.length) return null;
  return (
    <ul className="baslik-cipler" aria-label="Akışın durumu" style={style}>
      {cipler.map((c) => (
        <li key={c.tur}>
          <button type="button" className={`baslik-cip cip-${c.tur}`} aria-label={c.etiket} onClick={() => sec(c)} disabled={c.tur === 'bitti' || c.tur === 'sira'}>
            <svg aria-hidden width="22" height="22" viewBox="0 0 22 22" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: SIMGE[c.tur](ben) }} />
            {c.metin}
          </button>
        </li>
      ))}
    </ul>
  );
}
