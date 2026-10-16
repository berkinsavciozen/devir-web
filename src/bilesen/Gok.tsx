import { memo, useEffect, useState } from 'react';
import { grain, sky } from '../cizim/ortak.js';

const TASARIM_ALAN = 390 * 844;

export function useBoyut() {
  const al = () => ({ w: Math.max(320, window.innerWidth), h: Math.max(480, window.innerHeight) });
  const [b, setB] = useState(al);
  useEffect(() => {
    let z = 0;
    const d = () => { clearTimeout(z); z = window.setTimeout(() => setB(al()), 120); };
    window.addEventListener('resize', d);
    return () => window.removeEventListener('resize', d);
  }, []);
  return b;
}

/**
 * Gök: degrade + kâğıt dokusu + bulutsular + tohumlu yıldızlar + kenar karartma (ortak.js → sky).
 * Yıldız sayısı tasarımdaki 390×844 karede verilir; başka boyutta alanla orantılı artar.
 */
export const Gok = memo(function Gok({ tohum = 1, yildiz = 330, parilti, bulutsu, sakin, genis }: { tohum?: number; yildiz?: number; parilti?: number; bulutsu?: Array<[number, number, number, string]>; sakin?: [number, number, number]; genis?: boolean }) {
  const { w, h } = useBoyut();
  const n = Math.round(yildiz * (w * h) / TASARIM_ALAN);
  return (
    <svg className="gok" aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      dangerouslySetInnerHTML={{ __html: sky(w, h, tohum, { stars: n, sparkles: parilti, nebs: bulutsu?.map(([x, y, r, id]) => [x + (w - 390) / 2, y, r, id]), sakin: sakin && (genis ? sakin : [sakin[0] + (w - 390) / 2, sakin[1], sakin[2]]) }) }} />
  );
}, (a, b) => a.tohum === b.tohum && a.yildiz === b.yildiz && a.parilti === b.parilti && a.bulutsu === b.bulutsu && a.genis === b.genis && String(a.sakin) === String(b.sakin));

/** En üst katman gren (feTurbulence .9, alfa .07); dokunmayı engellemez. */
export const Gren = memo(function Gren() {
  const { w, h } = useBoyut();
  return <svg className="gren" aria-hidden width={w} height={h} dangerouslySetInnerHTML={{ __html: grain(w, h) }} />;
});
