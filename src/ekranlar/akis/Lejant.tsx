import { AltSayfa } from '../../bilesen/AltSayfa';
import { planet, ship, tower } from '../../cizim/ortak.js';

// Harita dili (denetim planı, CELISKILER 64): haritadaki işaretlerin ne demek olduğu. "?" düğmesiyle açılır.
const SATIRLAR: [string, string, string][] = [
  [planet(22, 22, 9, 'lit', { life: false }), 'Bitti', 'Işıklı'],
  [planet(22, 22, 9, 'wait', { life: false, waitRings: 1 }), 'Sırası geldi', 'Halkalı; sürüyorsa halka döner'],
  [planet(22, 22, 9, 'block', { life: false, cloudGap: 2 }), 'Engelli', 'Fırtına bulutu ve şimşek'],
  [planet(22, 22, 9, 'dark', { life: false }), 'Sırada', 'Karanlık; önündeki adım bitince yanar'],
  [planet(22, 22, 9, 'ghost', { life: false }), 'Atlandı', 'Kesik çizgili'],
  [planet(22, 22, 9, 'wait', { life: false, waitRings: 1, karar: true }), 'Karar', 'Bayraklı: son söz insanda'],
  [ship(22, 22, -12, 'insan', 'B', '#9EE6CF', .62, { flame: false }), 'İnsan', 'Yuvarlak pencere, baş harf'],
  [ship(22, 22, -12, 'agent', 'C', '#B9A6F2', .62, { flame: false }), 'Agent', 'İki anten, köşeli pencere'],
  [ship(22, 24, 0, 'dis', '', '#F2B8D8', .6), 'Dış katılımcı', 'Yelkenli; yalnız kendi adımlarını görür'],
  [tower(22, 34, .34, true), 'Hedef tarih', 'Kule; dokununca pay ve kritik yol'],
];

export function Lejant({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const y0 = 844 - (SATIRLAR.length * 52 + 96);
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="Harita dili" yukseklik={Math.max(110, y0)} duraklar={['orta']}>
      <div className="lejant">
        <h2 className="lejant-baslik">Harita dili</h2>
        <ul aria-label="Harita işaretleri">
          {SATIRLAR.map(([svg, ad, alt]) => (
            <li key={ad}>
              <svg aria-hidden width="44" height="44" viewBox="0 0 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <span><b>{ad}</b><small>{alt}</small></span>
            </li>
          ))}
        </ul>
      </div>
    </AltSayfa>
  );
}

/** "?" düğmesinin içi */
export const SoruIkon = () => <svg aria-hidden viewBox="-10 -10 20 20"><path d="M-3.2,-3.4 Q-3.2,-7 0,-7 Q3.4,-7 3.4,-3.8 Q3.4,-1.6 0.8,-0.4 Q0,0 0,1.8" /><circle cx="0" cy="5.4" r=".6" /></svg>;
