import { useEffect, useState } from 'react';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { SoruIkon } from './Lejant';

export type HaritaCipi = { ad: string; etiket: string; kaldir: () => void };
/**
 * Haritanın üstündeki süzgeç satırı (plan 28 Eki, Q1 · B6, B10, K9): seçici kutuyu açan düğme (akışta "Kişiler", evrende
 * "10/16 akış"), harita dili ("?") ve seçili süzgeçler çip olarak; çipe dokununca o süzgeç kalkar. Üç nokta menüsünün yerini alır.
 */
export function HaritaCipleri({ x, y, en, secici, lejantAc, lejantEtiket = 'Harita dili', cipler, ai, soru }: {
  x: number; y: number; en: number; secici?: { yazi: string; etiket?: string; ikon?: boolean; ac: () => void };
  /** W2: akıştaki AI etkinliği (onay bekleyen varsa çip camgöbeği flamalı) */
  ai?: { yazi: string; onay: boolean; ac: () => void } | null;
  lejantAc: () => void; lejantEtiket?: string; cipler: HaritaCipi[];
  /** açık soru (Kişi Yörüngeleri): dokununca sorunun sayfası */
  soru?: { yazi: string; ipucu?: string; ac: () => void } | null;
}) {
  return (
    <div className="harita-ciplar" role="toolbar" aria-label="Harita süzgeçleri" style={{ left: x, top: y, maxWidth: en }}>
      {secici && <button type="button" className="harita-cip ana" aria-haspopup="dialog" aria-label={secici.etiket} onClick={secici.ac}>
        {secici.ikon && <svg aria-hidden width="18" height="18" viewBox="-9 -9 18 18"><circle cx="-2.5" cy="-2.5" r="3" /><path d="M-8,6 C-7,1.5 2,1.5 3,6" /><circle cx="4" cy="-3.5" r="2.2" /><path d="M3.5,1 C6,1 7.5,3 8,5.5" /></svg>}
        {secici.yazi}<span aria-hidden className="harita-cip-ok">▾</span>
      </button>}
      <button type="button" className="harita-cip ana yuvarlak lejant-dugme" aria-label={lejantEtiket} aria-haspopup="dialog" onClick={lejantAc}><SoruIkon /></button>
      {ai && <button type="button" className={`harita-cip ana ai-cip${ai.onay ? ' onay' : ''}`} aria-haspopup="dialog" aria-label={`AI etkinliği: ${ai.yazi.replace(/^AI · /, '')}`} onClick={ai.ac}>
        <svg aria-hidden width="16" height="16" viewBox="-8 -8 16 16">{ai.onay
          ? <><rect x="-5.6" y="-7" width="1.3" height="14" fill="currentColor" /><path d="M-4.3,-7 H6 L3.4,-4.6 L6,-2.2 H-4.3Z" fill="#5FE3F0" stroke="#08222E" strokeWidth=".8" /></>
          : <path d="M0,-6 Q1,-1 6,0 Q1,1 0,6 Q-1,1 -6,0 Q-1,-1 0,-6Z" fill="currentColor" />}</svg>
        {ai.yazi}
      </button>}
      {soru && <button type="button" className="harita-cip ana soru-cip" aria-label={`${soru.yazi}. ${soru.ipucu || ''} Cevapla.`} title={soru.ipucu} onClick={soru.ac}><b aria-hidden>?</b>{soru.yazi}</button>}
      {cipler.map((c) => <button key={c.etiket} type="button" className="harita-cip secili" aria-label={`${c.etiket}: ${c.ad}. Kaldır.`} onClick={c.kaldir}>{c.ad}<span aria-hidden>×</span></button>)}
    </div>
  );
}

export type KisiSatiri = { ad: string; tip: 'insan' | 'agent' | 'dis'; acik: number; adim: number; durum?: string };
const TIP: Record<KisiSatiri['tip'], string> = { insan: 'insan', agent: 'agent', dis: 'dış katılımcı' };

/** Kişi süzgeci kutusu: bir kişi seçilir, Uygula haritaya geçirir; satırın oku kişi sayfasına gider. */
export function KisiSuzgec({ acik, kapat, kisiler, secili, uygula, kisiSayfasi }: {
  acik: boolean; kapat: () => void; kisiler: KisiSatiri[]; secili: string | null;
  uygula: (k: string | null) => void; kisiSayfasi: (ad: string) => void;
}) {
  const [b, setB] = useState<string | null>(secili);
  useEffect(() => { if (acik) setB(secili); }, [acik]); // eslint-disable-line react-hooks/exhaustive-deps
  const alt = <><Dugme tur="ikincil" yukseklik={48} onClick={kapat}>Vazgeç</Dugme><Dugme yukseklik={48} onClick={() => { uygula(b); kapat(); }}>Uygula</Dugme></>;
  const satir = (ad: string | null, ust: string, altYazi?: string) => (
    <li key={ad ?? '-'} className="kisi-secim-satir">
      <button type="button" role="radio" aria-checked={b === ad} className="kisi-secim-sec" onClick={() => setB(ad)}>
        <span aria-hidden className="kisi-secim-nokta" />
        <span><b>{ust}</b>{altYazi && <small>{altYazi}</small>}</span>
      </button>
      {ad && <button type="button" className="kisi-secim-git" aria-label={`${ad}: kişi sayfası`} onClick={() => { kapat(); setTimeout(() => kisiSayfasi(ad), 0); }}>
        <svg aria-hidden width="12" height="16" viewBox="-6 -8 12 16"><path d="M-3,-6 L3,0 L-3,6" /></svg>
      </button>}
    </li>
  );
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="Kişiler" yukseklik={Math.max(150, 844 - 160 - kisiler.length * 60)} kutu alt={alt}>
      <div className="kisi-secim">
        <h2 className="lejant-baslik">Kişiler</h2>
        <p className="lejant-not">Seçtiğin kişinin yolu haritada öne çıkar.</p>
        <ul role="radiogroup" aria-label="Haritada göster">
          {satir(null, 'Herkes')}
          {kisiler.map((k) => satir(k.ad, k.ad.replace(/\s*\(.*\)$/, ''), `${TIP[k.tip]}${k.durum ? ' · ' + k.durum : ''} · ${k.acik} açık · ${k.adim} görev`))}
        </ul>
      </div>
    </AltSayfa>
  );
}
