import { useEffect, useRef, useState } from 'react';
import { SAHTE } from '../../api/ortam';
import { galaxy, planet, ship, kapi } from '../../cizim/ortak.js';
import { arama } from '../../yonlendirme';

// İlk açılış tanıtımı (denetim planı, CELISKILER 65): üç kart, bir kez. Seçim bu cihazda kalır.
// Sahte kipte (önizleme, testler) yalnız ?tanitim=1 ile açılır.
const ANAHTAR = 'devir:tanitim';
const KARTLAR: { cizim: string; baslik: string; metin: string }[] = [
  {
    cizim: `<circle cx="120" cy="80" r="70" fill="url(#bloom)" opacity=".5"/>` + galaxy(120, 80, [{ state: 'lit' }, { state: 'lit' }, { state: 'wait' }, { state: 'dark' }, { state: 'dark' }], { scale: 1.5, seed: 4, rot: -14, pr: 2.8 }),
    baslik: 'Her iş bir harita',
    metin: 'Adımlar sırayla yanar: ışıklı olan bitti, halkalı olanın sırası geldi.',
  },
  {
    cizim: ship(78, 82, -12, 'insan', 'B', '#FFC9A3', 1.1, { flame: false }) + ship(124, 66, -12, 'agent', 'C', '#B9A6F2', 1.05, { flame: false }) + ship(166, 92, 0, 'dis', '', '#F2B8D8', 1) + kapi(206, 112, .45, true),
    baslik: 'Kimde, ne zaman',
    metin: 'Her kişinin ve agent’ın yolu ayrı renkte; kule hedef tarihi gösterir.',
  },
  {
    cizim: `<circle cx="120" cy="80" r="44" fill="url(#bloom)" opacity=".7"/><circle cx="120" cy="80" r="30" fill="url(#btn)"/><path d="M120,68 L120,92 M108,80 L132,80" stroke="#2A1D4F" stroke-width="3.4" stroke-linecap="round"/>` + planet(56, 52, 7, 'wait', { life: false, waitRings: 1 }) + planet(186, 112, 6, 'dark', { life: false }),
    baslik: 'Yeni işi tek cümleyle',
    metin: 'Ortadaki + ile işi anlat; Devir adımları, sahipleri ve soruları önerir.',
  },
];

export function tanitimGorulmeli(): boolean {
  if (SAHTE) return arama().get('tanitim') === '1';
  try { return !localStorage.getItem(ANAHTAR); } catch { return false; }
}

export function Tanitim({ bitti }: { bitti: () => void }) {
  const [i, setI] = useState(0);
  const kutu = useRef<HTMLDivElement>(null);
  const kapat = () => { try { localStorage.setItem(ANAHTAR, '1'); } catch { /* yok */ } bitti(); };
  const ileri = () => (i < KARTLAR.length - 1 ? setI(i + 1) : kapat());
  useEffect(() => { kutu.current?.focus(); }, []);
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat();
      if (e.key === 'ArrowRight') setI((x) => Math.min(KARTLAR.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    addEventListener('keydown', t); return () => removeEventListener('keydown', t);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const k = KARTLAR[i];
  return (
    <div className="tanitim-kok">
      <div ref={kutu} className="tanitim" role="dialog" aria-modal="true" aria-labelledby="tanitim-baslik" tabIndex={-1}>
        <svg key={'c' + i} className="tanitim-cizim" aria-hidden width="240" height="160" viewBox="0 0 240 160" dangerouslySetInnerHTML={{ __html: k.cizim }} />
        <h2 id="tanitim-baslik" key={'b' + i} className="tanitim-baslik">{k.baslik}</h2>
        <p className="tanitim-metin" key={'m' + i}>{k.metin}</p>
        <div className="tanitim-noktalar" aria-label={`${i + 1} / ${KARTLAR.length}`} role="img">
          {KARTLAR.map((_, j) => <i key={j} className={j === i ? 'secili' : ''} />)}
        </div>
        <div className="tanitim-dugmeler">
          <button type="button" className="tanitim-gec" onClick={kapat}>Geç</button>
          <button type="button" className="tanitim-ileri" onClick={ileri}>{i < KARTLAR.length - 1 ? 'İleri' : 'Başla'}</button>
        </div>
      </div>
    </div>
  );
}
