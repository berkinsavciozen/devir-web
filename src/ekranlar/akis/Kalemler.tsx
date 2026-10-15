import { useMemo, useState } from 'react';
import { simdi } from '../../api/ortam';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { akisModeli, uydular, yolCiz } from '../../cizim/yol.js';
import { planet } from '../../cizim/ortak.js';
import { adimAdi, akisAdi, ek } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { useAkis } from './Galaksi';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const buyuk = (s: string) => s[0].toLocaleUpperCase('tr') + s.slice(1);

/** Adım adından nesne öbeği: "Çiftçilerden kimlik, vergi levhası ve IBAN belgelerini topla" → "Kimlik, vergi levhası ve IBAN". */
export function nesne(ad: string): string {
  let w = ad.replace(/\s*\(.*\)\s*/g, ' ').trim().split(/\s+/);
  if (w.length > 3 && /(lar|ler)?(dan|den|tan|ten)$/.test(w[0])) w = w.slice(1); // baştaki ayrılma hâli
  if (w.length > 3) w = w.slice(0, -1); // sondaki fiil
  if (w.length > 3 && /(larını|lerini|ını|ini|unu|ünü)$/.test(w[w.length - 1])) w = w.slice(0, -1); // "…belgelerini"
  return buyuk(w.join(' '));
}

/** Kalemin aşama yazısı: "Belgeler tamam", "IBAN eksik", "Belgelerde", "Görüşmede", "Bitti". */
export function asamaYazisi(k: any, ad: (ustNo: number) => string): { metin: string; engelli: boolean } {
  if (k.bitti) return { metin: 'Bitti', engelli: false };
  const a = k.asama; if (!a) return { metin: '', engelli: false };
  if (a.durum === 'engelli') return { metin: buyuk((a.engel || 'Engelli').split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '')), engelli: true };
  if (a.durum === 'sirada' || a.durum === 'hazir') {
    const son = [...(k.adimlar || [])].reverse().find((x: any) => BITTI(x.durum));
    return { metin: son ? `${ad(son.ust_no)} tamam` : `${ad(a.ust_no)} sırada`, engelli: false };
  }
  return { metin: ek(ad(a.ust_no), 'de'), engelli: false };
}

/** D2 · Kalem listesi: tekrarlanan adımın kalemleri, aşama izi, arama (§5 D2). */
export function Kalemler({ kod, no, ben }: { kod: string; no: number; ben: string }) {
  const q = useAkis(kod), d = q.data;
  const [ara, setAra] = useState('');
  const NOW = simdi();
  const g = d?.tekrar?.find((x: any) => (x.adimlar || []).includes(no));
  const arka = useMemo(() => {
    if (!d) return '';
    const Y = yolCiz(akisModeli(d, { sahip: ben }), { cx: 195, cy: 160, R: 105, ps: .62, now: NOW, kuleEtiket: false, labels: [] });
    let s = `<g opacity=".5">${Y.svg}</g><rect width="390" height="844" fill="#07051A" opacity=".35"/>`;
    const p = Y.G.gezegen[no];
    if (p && g) s += planet(p.x, p.y, 13, 'wait', { waitRings: 2 }) + uydular(p.x, p.y, 13, g.kalemler.map((k: any) => ({ ad: k.ad, durum: k.adimlar?.find((x: any) => x.ust_no === no)?.durum || 'sirada' })), .9);
    return s;
  }, [d, no, ben, NOW, g]);
  if (!d) return <Sahne gok={{ tohum: 51, yildiz: 260 }} etiket="Kalemler" />;
  const ust = d.adimlar.find((a: any) => a.no === no);
  const adOf = (n: number) => { const a = d.adimlar.find((x: any) => x.no === n); return a ? adimAdi(a) : `Adım ${n}`; };
  const ks: any[] = g?.kalemler || [];
  const tamam = ks.filter((k) => BITTI(k.adimlar?.find((x: any) => x.ust_no === no)?.durum || '')).length;
  const tur = g?.kalem_turu || 'kalem';
  const filtre = ara.trim() ? ks.filter((k) => k.ad.toLocaleLowerCase('tr').includes(ara.trim().toLocaleLowerCase('tr'))) : ks;
  const geri = () => (history.length > 1 ? history.back() : git(`/akis/${encodeURIComponent(kod)}`));
  const asamalar: number[] = g?.adimlar || [];
  const Y0 = 268 + 28, P = (y: number) => y - Y0;
  // açıklama: üst adımın kriterinden kısa bir nesne öbeği yoksa adın kendisi
  const aciklama = `${nesne(ust?.ad || '')} · ${ks.length} ${tur}`;
  return (
    <>
      <Sahne gok={{ tohum: 51, yildiz: 260 }} cizim={arka} etiket={akisAdi(d.akis)}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={akisAdi(d.akis)} geri={geri} /></Kutu>
      </Sahne>
      <AltSayfa acik kapat={geri} baslik={adOf(no)} yukseklik={268} duraklar={['orta', 'yuksek']} perdesiz>
        <div className="karar-panel kalem-panel" style={{ minHeight: P(268 + 150) + filtre.length * 72 + 60 }}>
          <Metin y={P(268 + 52)} fs={23} lh={28} serif agirlik={700} as="h2">{adOf(no)}</Metin>
          <span className="kalem-hap" style={{ top: P(268 + 46) - 14 }}>{tamam}/{ks.length} tamam</span>
          <Metin y={P(268 + 74)} fs={12.5} lh={16} renk="ink3" className="tek-satir">{aciklama}</Metin>
          <label className="kalem-ara" style={{ top: P(268 + 92) }}>
            <span className="gorunmez">{buyuk(tur)} ara</span>
            <input className="alan" type="search" placeholder={`${buyuk(tur)} ara`} value={ara} onChange={(e) => setAra(e.target.value)} />
            <svg aria-hidden width="22" height="22" viewBox="-11 -11 22 22"><circle cx="-2" cy="-2" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5,2.5 L7,7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </label>
          <ul className="kalem-liste" style={{ top: P(268 + 150) }}>
            {filtre.map((k) => {
              const y = asamaYazisi(k, adOf);
              const idx = asamalar.findIndex((n) => n === k.asama?.ust_no);
              return (
                <li key={k.akis}>
                  <button className={`kalem-satir ${y.engelli ? 'engelli' : ''}`} onClick={() => git(`/akis/${encodeURIComponent(k.akis)}`)} aria-label={`${k.ad}. ${y.metin}.`}>
                    <b>{k.ad}</b>
                    <svg className="kalem-iz" aria-hidden width="100" height="20" viewBox="20 -10 100 20">
                      {asamalar.map((n, j) => {
                        const dur = k.adimlar?.find((x: any) => x.ust_no === n)?.durum || 'sirada', bx = 40 + j * 22;
                        const cur = j === idx && !k.bitti;
                        const cizgi = j ? <line x1={bx - 16} y1={0} x2={bx - 6} y2={0} stroke={BITTI(dur) || cur ? '#FFD27A' : '#4B4380'} strokeWidth={1.4} /> : null;
                        const top = BITTI(dur) ? <circle cx={bx} r={5} fill="url(#pLit2)" />
                          : dur === 'engelli' ? <><circle cx={bx} r={5} fill="url(#pBlock)" /><path d={`M${bx - 3},-3 L${bx + 3},3`} stroke="#1A1238" strokeWidth={1.5} /></>
                          : dur === 'suruyor' || dur === 'hazir' ? <><circle cx={bx} r={7.5} fill="none" stroke="#FFD27A" strokeWidth={1} strokeDasharray="2 1.6" /><circle cx={bx} r={4.5} fill="#2A2452" /><path d={`M${bx},-4.5 A4.5,4.5 0 0 1 ${bx},4.5Z`} fill="#FFE29A" /></>
                          : <circle cx={bx} r={4.5} fill="#1A1238" stroke="#B9A6F2" strokeWidth={1.1} />;
                        return <g key={n}>{cizgi}{top}</g>;
                      })}
                    </svg>
                    <small>{y.metin}</small>
                    <svg className="kalem-ok" aria-hidden width="12" height="16" viewBox="349 25 12 16"><path d="M350,26 L356,32 L350,38" stroke="#B9A6F2" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
                  </button>
                </li>
              );
            })}
          </ul>
          {!filtre.length && <Metin y={P(268 + 180)} fs={14} renk="ink3" hiza="orta">{ks.length ? 'Bu adla kalem yok.' : 'Kalem bekleniyor.'}</Metin>}
          <Metin y={P(268 + 150) + filtre.length * 72 + 20} fs={11.5} lh={14} agirlik={600} renk="ink3" hiza="orta">{asamalar.map(adOf).join(' · ')}</Metin>
        </div>
      </AltSayfa>
    </>
  );
}
