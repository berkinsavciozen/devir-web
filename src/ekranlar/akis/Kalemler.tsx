import { useMemo, useState } from 'react';
import { simdi } from '../../api/ortam';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { DURUM_RENK, durumG, kalemUydulari, miniYorunge } from '../../cizim/yorunge/mini';
import { isSimge } from '../../cizim/yorunge/simge';
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
    // arka: haritanın küçüğü; kalemli iş öne çıkar, kalemler onun uyduları
    const Y = miniYorunge(d, ben, { cx: 195, cy: 182, R: 78, now: NOW, ayrinti: true });
    let s = `<g opacity=".5">${Y.svg}</g><rect width="390" height="844" fill="#020B10" opacity=".35"/>`;
    const p = Y.G.gezegen[no], a = d.adimlar.find((x: any) => x.no === no);
    if (p && a && g) s += isSimge(a, p.x, p.y, 11) + kalemUydulari(p.x, p.y, 11, g.kalemler.map((k: any) => ({ ad: k.ad, durum: k.adimlar?.find((x: any) => x.ust_no === no)?.durum || 'sirada' })));
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
                        const G = durumG(dur), renk = DURUM_RENK[G];
                        const cizgi = j ? <line x1={bx - 16} y1={0} x2={bx - 6} y2={0} stroke={BITTI(dur) || cur ? DURUM_RENK.lit : '#3A5566'} strokeWidth={1.4} /> : null;
                        const top = <>
                          {cur && <circle cx={bx} r={7.5} fill="none" stroke="#FFB59A" strokeWidth={1.2} />}
                          {G === 'block' && <circle cx={bx} r={7.5} fill={renk} opacity={.28} />}
                          {G === 'ghost' || G === 'ertele'
                            ? <circle cx={bx} r={4} fill="none" stroke={renk} strokeWidth={1} strokeDasharray="1.5 1.5" />
                            : <circle cx={bx} r={4.6} fill={renk} opacity={G === 'dark' ? .55 : 1} stroke="#08222E" strokeWidth={.8} />}
                        </>;
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
