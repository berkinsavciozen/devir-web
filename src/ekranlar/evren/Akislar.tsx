import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { Zil } from '../../bilesen/Zil';
import { Metin, metinUst, Sahne } from '../../bilesen/Sahne';
import { iconCloud, iconRings, TAKVIM1 } from '../../cizim/ekran';
import { uydular } from '../../cizim/yol.js';
import { brackets, f, shareRing, sparkle, tower } from '../../cizim/ortak.js';
import { akisAdi, doluSatir, ozelEk, paySure, yaziTipleriHazir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { isPayi } from '../akis/Adim';
import { evrenCumleleri } from './cumleler';
import { kucukGalaksi, useDetaylar } from './Evren';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const GUN = 864e5;
const gCloud = iconCloud(1, -3, .42), gRings = iconRings(0, 0, .55);
const Y0 = 150, RH = 76;

/** Biten adım oranı: detay varsa tamam + atlandı + ertelendi, yoksa kartın ilerlemesi. */
export function bitenOrani(k: any, d?: any) {
  if (d?.adimlar?.length) return d.adimlar.filter((a: any) => BITTI(a.durum)).length / d.adimlar.length;
  return k.ilerleme?.toplam ? k.ilerleme.tamam / k.ilerleme.toplam : 0;
}
const boncukRenk = (d: string) => (BITTI(d) && d !== 'atlandi' ? ['#FFE29A', 2.4] : d === 'atlandi' ? ['#FFE29A', 2.4] : d === 'engelli' ? ['#FF8A78', 1.8] : d === 'hazir' || d === 'suruyor' ? ['#E9C8FF', 1.8] : ['#4B4380', 1.8]) as [string, number];

/** "5 akış sürüyor; en dar pay Test Bank’te: 6 gün." */
export function listeCumlesi(kartlar: any[]): string {
  const n = kartlar.length;
  const dar = kartlar.filter((k) => k.pay_saat != null).sort((a, b) => a.pay_saat - b.pay_saat)[0];
  if (!dar) return `${n} akış sürüyor.`;
  if (dar.pay_saat < 0) return `${n} akış sürüyor; ${ozelEk(akisAdi(dar), 'de')} hedef ${paySure(dar.pay_saat)} geçiyor.`;
  return `${n} akış sürüyor; en dar pay ${ozelEk(akisAdi(dar), 'de')}: ${paySure(dar.pay_saat)}.`;
}

/** B2 · Akışlar: akış kartları pay sırasına göre, kapananlar sonda; taslak ve Arşiv satırı (§5 B2, §3.19). */
export function Akislar({ ben }: { ben: Ben }) {
  const ozet = useOzet();
  const hepsi = useQuery({ queryKey: ['akislar', 'hepsi'], queryFn: () => api.get<any>('/akislar?durum=hepsi') });
  const NOW = simdi(), kisi = ben.kisi || '';
  const [, setYazi] = useState(0);
  useEffect(() => { void yaziTipleriHazir().then(() => setYazi(1)); }, []);
  const kartlar: any[] = useMemo(() => [...(ozet.data?.akislar || [])].sort((a, b) => (a.pay_saat ?? 1e9) - (b.pay_saat ?? 1e9)), [ozet.data]);
  const kapanan: any[] = (hepsi.data?.akislar || []).filter((k: any) => k.durum === 'kapandi');
  const arsiv: any[] = (hepsi.data?.akislar || []).filter((k: any) => k.durum === 'arsiv');
  const satirlar = [...kartlar, ...kapanan].slice(0, 7);
  const kodlar = useMemo(() => [...satirlar.map((k) => k.kod), ...arsiv.slice(0, 1).map((k) => k.kod)], [ozet.data, hepsi.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const detay = useDetaylar(kodlar);
  const isaret = useMemo(() => {
    const m: Record<string, 'engel' | 'bekleme'> = {};
    for (const c of evrenCumleleri(kartlar, detay, kisi)) if (c.kod && (c.tur === 'engel' || c.tur === 'bekleme') && !m[c.kod]) m[c.kod] = c.tur;
    return m;
  }, [kartlar, detay, kisi]);

  const cizim = useMemo(() => {
    const tA = Math.min(...satirlar.map((k) => tarihMs(k.olusturuldu)), NOW) , tA0 = Math.floor((tA + 3 * 36e5) / GUN) * GUN - 3 * 36e5;
    const tB = Math.max(TAKVIM1, ...satirlar.map((k) => tarihMs((k.hedef_tarih || '2000-01-01') + 'T23:59:00+03:00')));
    const tx = (ms: number) => 108 + (ms - tA0) / (tB - tA0) * 246;
    let s = '';
    satirlar.forEach((k, i) => {
      const y = Y0 + i * RH, cy = y + 34, d = detay[k.kod], fr = bitenOrani(k, d);
      if (isaret[k.kod] === 'engel') s += brackets(14, y + 6, 350, RH - 14, '#FF8A78', gCloud);
      if (isaret[k.kod] === 'bekleme') s += brackets(14, y + 4, 350, RH - 14, '#FFD27A', gRings);
      s += `<circle cx="50" cy="${cy}" r="34" fill="url(#bloom)" opacity="${f(.1 + fr * .9)}"/>`;
      s += kucukGalaksi(d, kisi, 50, cy, 27, 2.4, NOW);
      const pay = d ? isPayi(d.olaylar) : [];
      if (pay.length) s += shareRing(50, cy, 31, pay, { w: 2.2, bead: 1.3, beads: false });
      // zaman ipliği: kuruluş → hedef; biten oranda ışık
      const a = tx(tarihMs(k.olusturuldu)), b = tx(tarihMs((k.hedef_tarih || k.kapandi_at?.slice(0, 10)) + 'T23:59:00+03:00'));
      s += `<line x1="${f(a)}" y1="${cy + 12}" x2="${f(b)}" y2="${cy + 12}" stroke="#4B4380" stroke-width="4" stroke-linecap="round"/>`;
      if (fr > 0) s += `<line x1="${f(a)}" y1="${cy + 12}" x2="${f(a + (b - a) * fr)}" y2="${cy + 12}" stroke="#FFD27A" stroke-width="4" stroke-linecap="round"/><line x1="${f(a)}" y1="${cy + 12}" x2="${f(a + (b - a) * fr)}" y2="${cy + 12}" stroke="#FFB47F" stroke-width="10" opacity=".3" filter="url(#blur2)"/>`;
      // adım boncukları
      const adimlar: any[] = d?.adimlar ? [...d.adimlar].sort((p, q) => p.no - q.no) : [];
      const ara = Math.min(7.5, 240 / Math.max(1, adimlar.length));
      adimlar.forEach((st, j) => {
        const [renk, r] = boncukRenk(st.durum), bekl = st.durum === 'hazir' || st.durum === 'suruyor';
        s += `<circle cx="${f(108 + j * ara)}" cy="${cy + 2}" r="${r}" fill="${renk}" ${bekl ? 'stroke="#FFD27A" stroke-width=".8"' : ''}/>`;
      });
      s += tower(b, cy + 16, .17, k.durum === 'kapandi');
      s += `<rect x="${f(tx(NOW) - 1)}" y="${cy + 4}" width="2" height="16" rx="1" fill="#FFC9A3"/>`;
      // alt akışlı kart: mini uydular + "N kalem"
      const t = d?.tekrar?.[0];
      if (t?.kalemler?.length) s += `<g transform="translate(246,${cy - 11})">` + uydular(0, 0, 3, t.kalemler.map((x: any) => ({ ad: x.ad, durum: x.durum || 'sirada' })), .55, { gap: 6, mr: 3.2 }) + `</g>`;
    });
    // taslak + arşiv
    const yd = Y0 + satirlar.length * RH + 8;
    s += `<rect x="16" y="${yd}" width="358" height="64" rx="22" fill="#120B2C" fill-opacity=".6" stroke="#FFFFFF" stroke-opacity=".07"/>`;
    for (const [ox, oy, r] of [[44, 32, 12], [62, 42, 8]]) s += `<circle cx="${ox}" cy="${yd + oy}" r="${r * 2.2}" fill="url(#glowLilac)"/><circle cx="${ox}" cy="${yd + oy}" r="${r}" fill="#B9A6F2" fill-opacity=".12" stroke="#D9CCFF" stroke-dasharray="1.5 3"/>` + sparkle(ox, yd + oy, r * .4, '#FFF1D6', .95);
    s += `<g opacity=".55">${kucukGalaksi(arsiv[0] ? detay[arsiv[0].kod] : null, kisi, 232, yd + 32, 18, 1.8, NOW)}</g>`;
    return { svg: s, yd };
  }, [satirlar, detay, isaret, kisi, NOW, arsiv]);

  if (ozet.isPending) return <Sahne gok={{ tohum: 52, yildiz: 260 }} etiket="Akışlar"><Metin y={70} fs={26} serif agirlik={700} as="h1">Akışlar</Metin></Sahne>;
  const cumle = kartlar.length ? doluSatir(listeCumlesi(kartlar), 300, '17px Caladea', 2) : ['Henüz akış yok.'];
  const taslakN = ozet.data?.taslaklar?.length || 0;

  return (
    <Sahne gok={{ tohum: 52, yildiz: 260 }} cizim={cizim.svg} etiket="Akışlar">
      <Metin y={70} fs={26} serif agirlik={700} as="h1">Akışlar</Metin>
      <Zil x={338} y={36} />
      <Metin y={106} fs={17} lh={22} serif renk="ink2" style={cumle.length > 1 ? { whiteSpace: 'nowrap' } : undefined}>{cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
      <ul className="akis-liste" aria-label="Akışlar">
        {satirlar.map((k, i) => {
          const cy = Y0 + i * RH + 34, d = detay[k.kod], t = d?.tekrar?.[0];
          const tamam = d ? d.adimlar.filter((a: any) => BITTI(a.durum)).length : k.ilerleme?.tamam ?? 0, toplam = d ? d.adimlar.length : k.ilerleme?.toplam ?? 0;
          const etiket = `${akisAdi(k)}. ${k.durum === 'kapandi' ? 'Kapandı. ' : ''}${tamam}/${toplam} adım tamam.${k.pay_saat != null && k.durum !== 'kapandi' ? ` Hedefe ${paySure(k.pay_saat)} ${k.pay_saat >= 0 ? 'pay' : 'gecikme'}.` : ''}${isaret[k.kod] === 'engel' ? ' Engel sende.' : ''}`;
          return (
            <li key={k.kod} style={{ position: 'absolute', left: 14, top: cy - 34, width: 362, height: RH - 4 }}>
              <button className="akis-satir" aria-label={etiket} onClick={() => git(`/akis/${encodeURIComponent(k.kod)}`)}>
                <span className="akis-satir-ad" style={{ top: metinUst(28, 15, 18) }}>{akisAdi(k)}</span>
                {t?.kalemler?.length ? <span className="akis-satir-kalem" style={{ top: metinUst(28, 12, 16) }}>{t.kalemler.length} kalem</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <button className="liste-alt taslak" style={{ top: cizim.yd, left: 16, width: 180, height: 64 }} aria-label={`${taslakN} taslak`} onClick={() => git('/yeni')}><span style={{ left: 72, top: metinUst(38, 14, 18) }}>{taslakN} taslak</span></button>
      <button className="liste-alt arsiv" style={{ top: cizim.yd, left: 196, width: 178, height: 64 }} aria-label="Arşiv" onClick={() => git('/akislar/arsiv')}><span style={{ left: 66, top: metinUst(38, 14, 18) }}>Arşiv</span></button>
      <AltGezinme aktif="akislar" yeni={() => git('/yeni')} />
    </Sahne>
  );
}
