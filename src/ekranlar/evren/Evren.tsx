import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { Metin, Sahne } from '../../bilesen/Sahne';
import { iconCloud, iconRings, usturlap } from '../../cizim/ekran';
import { akisModeli, gunAy, yolCiz } from '../../cizim/yol.js';
import { brackets, C, pill } from '../../cizim/ortak.js';
import { akisAdi, doluSatir, yaziTipleriHazir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { AvatarAd, BosEvren } from './BosEvren';
import { evrenCumleleri } from './cumleler';

const gCloud = iconCloud(1, -3, .42), gRings = iconRings(0, 0, .55);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

/** Kapanan akışlar (dış halka). */
const useKapananlar = () => useQuery({ queryKey: ['akislar', 'kapandi'], queryFn: () => api.get<any>('/akislar?durum=kapandi') });

/** Akış detayları (küçük galaksiler için; §9-15 gelene kadar N çağrı, önbellekli). */
export function useDetaylar(kodlar: string[]) {
  const qs = useQueries({ queries: kodlar.map((kod) => ({ queryKey: ['akis', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}`) })) });
  const d: Record<string, any> = {};
  qs.forEach((q, i) => { if (q.data) d[kodlar[i]] = q.data; });
  return d;
}

/** Küçük galaksi: aynı yol geometrisinin küçük çizimi (§4.13). */
export function kucukGalaksi(d: any, ben: string, x: number, y: number, r: number, pr: number, now: number) {
  if (!d) return `<circle cx="${x}" cy="${y}" r="${r * .5}" fill="url(#glowLilac)" opacity=".5"/>`;
  return yolCiz(akisModeli(d, { sahip: ben }), { lod: 'kucuk', cx: x, cy: y, R: r, now, pr }).svg;
}

/** B1 · Evren: bütün aktif akışlar tek bakışta (§5 B1, §3.10). */
export function Evren({ ben }: { ben: Ben }) {
  const ozet = useOzet();
  const kap = useKapananlar();
  const NOW = simdi(), kisi = ben.kisi || '';
  const [, setYazi] = useState(0);
  useEffect(() => { void yaziTipleriHazir().then(() => setYazi(1)); }, []);
  const kartlar: any[] = ozet.data?.akislar || [];
  const kapanan: any[] = (kap.data?.akislar || []).filter((k: any) => k.durum === 'kapandi');
  const kodlar = useMemo(() => [...kartlar, ...kapanan].map((k) => k.kod), [ozet.data, kap.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const detay = useDetaylar(kodlar);

  const cumleler = useMemo(() => evrenCumleleri(kartlar, detay, kisi, ozet.data?.ozet), [ozet.data, detay, kisi]); // eslint-disable-line react-hooks/exhaustive-deps
  const cizim = useMemo(() => {
    if (!ozet.data) return null;
    const isaret: Record<string, 'engel' | 'bekleme'> = {};
    for (const c of cumleler) if (c.kod && (c.tur === 'engel' || c.tur === 'bekleme') && !isaret[c.kod]) isaret[c.kod] = c.tur;
    const tum = [...kartlar, ...kapanan];
    const tamam = tum.reduce((a, k) => a + (k.ilerleme?.tamam || 0), 0), toplam = tum.reduce((a, k) => a + (k.ilerleme?.toplam || 0), 0);
    const U = usturlap({
      simdi: NOW, oran: toplam ? tamam / toplam : 0, taslak: ozet.data.taslaklar?.length || 0,
      akislar: [
        ...kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], bitti: k.ilerleme && k.ilerleme.tamam === k.ilerleme.toplam })),
        ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
      ],
      kucuk: (kod, x, y, r, pr) => kucukGalaksi(detay[kod], kisi, x, y, r, pr, NOW),
    });
    let s = U.svg;
    // haplar: bugün, galaksi adları, taslak
    s += pill(U.hap.x, U.hap.y, gunAy(NOW), { fs: 11.5, fw: 700, bg: '#FFC9A3', bgo: 1, col: '#2A1D4F', w: 54 });
    for (const y of U.yer) s += pill(y.etiket.x, y.etiket.y, tum.find((k) => k.kod === y.kod) ? akisAdi(tum.find((k) => k.kod === y.kod)) : y.kod, { fs: 11.5, fw: 650, col: C.ink });
    if (U.taslak) s += pill(U.taslak.x, U.taslak.y, `${ozet.data.taslaklar.length} taslak`, { fs: 11, fw: 500, col: C.ink2 });
    // en fazla 2 kilit parantezi: cümlelerdeki akışlar
    for (const [kod, tur] of Object.entries(isaret).slice(0, 2)) {
      const y = U.yer.find((q) => q.kod === kod); if (!y) continue;
      const w = y.rr * 2.8, h = y.rr * 2.32;
      s += tur === 'engel' ? brackets(y.x - w / 2, y.y - y.rr * .87, w, h, '#FF8A78', gCloud) : brackets(y.x - w / 2, y.y - y.rr * .87, w, h, '#FFD27A', gRings, true);
    }
    return { svg: s, U };
  }, [ozet.data, kap.data, detay, cumleler, NOW]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ozet.isPending) return <Sahne gok={{ tohum: 21, yildiz: 330 }} etiket="Evren"><AvatarAd ad={kisi} /></Sahne>;
  const bos = ozet.data && !kartlar.length && !ozet.data.taslaklar?.length;
  const avatar = () => git('/hesap');
  if (bos) return <BosEvren ad={kisi} avatar={avatar} />;
  if (!cizim) return null;

  // cümleler: glif + en çok iki satır (Caladea 17.5/22, x 56)
  let y = 113;
  const satirlar = cumleler.slice(0, 2).map((c) => {
    const s = doluSatir(c.metin, 316), y0 = y;
    y += s.length * 22 + 10;
    return { c, s, y: y0 };
  });
  const tum = [...kartlar, ...kapanan];

  return (
    <Sahne gok={{ tohum: 21, yildiz: 330 }} cizim={cizim.svg + satirlar.map(({ c, y: yy }) => c.tur === 'engel' ? iconCloud(32, yy - 5, .55) : c.tur === 'bekleme' ? iconRings(32, yy - 3, .72) : '').join('')} etiket="Evren">
      <AvatarAd ad={kisi} ac={avatar} />
      {satirlar.map(({ c, s, y: yy }) => (
        <Metin key={c.metin} y={yy} x={56} fs={17.5} lh={22} serif as="p" style={{ whiteSpace: s.length > 1 ? 'nowrap' : undefined }}>
          {s.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}
        </Metin>
      ))}
      <div role="list" aria-label="Akışlar" className="harita-katman">
        {cizim.U.yer.map((g) => {
          const k = tum.find((x) => x.kod === g.kod), r = Math.max(24, g.rr);
          const etiket = k ? `${akisAdi(k)}. ${k.durum === 'kapandi' ? 'Kapandı.' : `${k.ilerleme?.tamam ?? 0}/${k.ilerleme?.toplam ?? 0} adım tamam. Hedef ${gunAy(tarihMs(k.hedef_tarih))}.`}` : g.kod;
          return <button key={g.kod} role="listitem" className="gezegen-hedef" style={{ left: g.x - r, top: g.y - r, width: r * 2, height: r * 2 }} aria-label={etiket} onClick={() => git(`/akis/${encodeURIComponent(g.kod)}`)} />;
        })}
        {cizim.U.taslak && <button className="gezegen-hedef" style={{ left: cizim.U.taslak.x - 52, top: cizim.U.taslak.y - 58, width: 104, height: 72 }} aria-label={`${ozet.data.taslaklar.length} taslak`} onClick={() => git('/yeni')} />}
      </div>
      <AltGezinme aktif="evren" git={(s) => git(s === 'evren' ? '/' : '/akislar')} yeni={() => git('/yeni')} />
    </Sahne>
  );
}
