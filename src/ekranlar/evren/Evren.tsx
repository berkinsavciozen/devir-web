import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { GenisSahne, Metin, Sahne } from '../../bilesen/Sahne';
import { useBoyut } from '../../bilesen/Gok';
import { Segment } from '../akis/Adim';
import { evrenOlcek, iconCloud, iconRings, usturlap } from '../../cizim/ekran';
import { akisModeli, gunAy, yolCiz } from '../../cizim/yol.js';
import { brackets, C, pill, planet, ship } from '../../cizim/ortak.js';
import { akisAdi, doluSatir, ozelEk, paySure, yaziTipleriHazir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { yakinlas } from '../../cizim/yakinlas';
import { AvatarAd, BosEvren } from './BosEvren';
import { evrenCumleleri } from './cumleler';

const gCloud = iconCloud(1, -3, .42), gRings = iconRings(0, 0, .55);
/** Bu sayıdan çok aktif akışta evren ölçek düzenine geçer (J1). */
const OLCEK = 10;
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
  const boy = useBoyut();
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
    const say = (k: any) => detay[k.kod]?.adimlar ? [detay[k.kod].adimlar.filter((a: any) => ['tamam', 'atlandi', 'ertelendi'].includes(a.durum)).length, detay[k.kod].adimlar.length] : [k.ilerleme?.tamam || 0, k.ilerleme?.toplam || 0];
    const tamam = tum.reduce((a, k) => a + say(k)[0], 0), toplam = tum.reduce((a, k) => a + say(k)[1], 0);
    const kararli = (k: any) => !!detay[k.kod]?.adimlar?.some((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor'));
    // J1: çok akışta ölçek düzeni (§4.14)
    if (kartlar.length > OLCEK) {
      const O = evrenOlcek({
        simdi: NOW,
        akislar: [
          ...kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k) })),
          ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
        ],
        kucuk: (kod, x, y, r, pr) => kucukGalaksi(detay[kod], kisi, x, y, r, pr, NOW),
      });
      let s = O.svg;
      for (const e of O.etiketler) { const k = tum.find((x) => x.kod === e.kod); if (k) s += pill(e.etiket.x, e.etiket.y, akisAdi(k), { fs: 10.5, fw: 650 }); }
      if (O.kapanan) s += pill(O.kapananHap.x, O.kapananHap.y, `${O.kapanan} kapandı`, { fs: 11, fw: 650, stroke: '#FFD27A', col: '#FFE6B0' });
      return { svg: s, U: { yer: O.yer, taslak: null }, olcek: O };
    }
    const U = usturlap({
      simdi: NOW, oran: toplam ? tamam / toplam : 0, taslak: ozet.data.taslaklar?.length || 0,
      akislar: [
        ...kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k), bitti: k.ilerleme && k.ilerleme.tamam === k.ilerleme.toplam })),
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
    return { svg: s, U, olcek: null };
  }, [ozet.data, kap.data, detay, cumleler, NOW]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ozet.isPending) return <Sahne gok={{ tohum: 21, yildiz: 330 }} etiket="Evren"><AvatarAd ad={kisi} /></Sahne>;
  const bos = ozet.data && !kartlar.length && !ozet.data.taslaklar?.length;
  const avatar = () => git('/hesap');
  if (bos) return <BosEvren ad={kisi} avatar={avatar} />;
  if (!cizim) return null;

  if (cizim.olcek) return <EvrenOlcek kisi={kisi} avatar={avatar} cizim={cizim} kartlar={kartlar} kapanan={kapanan} detay={detay} />;
  if (boy.w >= 1280 && boy.h >= 600) return <EvrenGenis W={boy.w} H={boy.h} kisi={kisi} avatar={avatar} cizim={cizim} cumleler={cumleler} kartlar={kartlar} kapanan={kapanan} detay={detay} benim={ozet.data?.benim || []} taslak={ozet.data?.taslaklar?.length || 0} now={NOW} />;
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
          return <button key={g.kod} role="listitem" className="gezegen-hedef" style={{ left: g.x - r, top: g.y - r, width: r * 2, height: r * 2 }} aria-label={etiket} onClick={(e) => yakinlas(g.kod, e.currentTarget)} />;
        })}
        {cizim.U.taslak && <button className="gezegen-hedef" style={{ left: cizim.U.taslak.x - 52, top: cizim.U.taslak.y - 58, width: 104, height: 72 }} aria-label={`${ozet.data.taslaklar.length} taslak`} onClick={() => git('/yeni')} />}
      </div>
      <AltGezinme aktif="evren" git={(s) => git(s === 'evren' ? '/' : '/akislar')} yeni={() => git('/yeni')} />
    </Sahne>
  );
}

/** J1 cümlesi: "16 akış sürüyor; 3 karar seni bekliyor. En dar pay Test Bank’te: 6 gün." */
export function olcekCumlesi(kartlar: any[], detay: Record<string, any>): string {
  const karar = kartlar.filter((k) => detay[k.kod]?.adimlar?.some((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor'))).length;
  const dar = kartlar.filter((k) => k.pay_saat != null).sort((a, b) => a.pay_saat - b.pay_saat)[0];
  const bir = `${kartlar.length} akış sürüyor${karar ? `; ${karar} karar seni bekliyor` : ''}.`;
  if (!dar) return bir;
  return `${bir} ${dar.pay_saat >= 0 ? `En dar pay ${ozelEk(akisAdi(dar), 'de')}: ${paySure(dar.pay_saat)}.` : `${ozelEk(akisAdi(dar), 'de')} hedef ${paySure(dar.pay_saat)} geçiyor.`}`;
}

function EvrenOlcek({ kisi, avatar, cizim, kartlar, kapanan, detay }: { kisi: string; avatar: () => void; cizim: any; kartlar: any[]; kapanan: any[]; detay: Record<string, any> }) {
  const tum = [...kartlar, ...kapanan];
  const cumle = doluSatir(olcekCumlesi(kartlar, detay), 340, '17.5px Caladea', 3);
  const O = cizim.olcek;
  return (
    <Sahne gok={{ tohum: 21, yildiz: 330 }} cizim={cizim.svg} etiket="Evren">
      <AvatarAd ad={kisi} ac={avatar} />
      <Metin y={112} fs={17.5} lh={23} serif as="p" style={{ whiteSpace: 'nowrap' }}>{cumle.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
      <div role="list" aria-label="Akışlar" className="harita-katman">
        {O.yer.map((g: any) => {
          const k = tum.find((x) => x.kod === g.kod), r = Math.max(16, g.rr);
          const etiket = k ? `${akisAdi(k)}. ${k.durum === 'kapandi' ? 'Kapandı.' : `${k.ilerleme?.tamam ?? 0}/${k.ilerleme?.toplam ?? 0} adım tamam. Hedef ${gunAy(tarihMs(k.hedef_tarih))}.`}` : g.kod;
          return <button key={g.kod} role="listitem" className="gezegen-hedef" style={{ left: g.x - r, top: g.y - r, width: r * 2, height: r * 2 }} aria-label={etiket} onClick={(e) => yakinlas(g.kod, e.currentTarget)} />;
        })}
        {O.kapanan > 0 && <button className="gezegen-hedef" style={{ left: O.kapananHap.x - 44, top: O.kapananHap.y - 22, width: 88, height: 44 }} aria-label={`${O.kapanan} kapandı`} onClick={() => git('/akislar/arsiv')} />}
      </div>
      <AltGezinme aktif="evren" git={(s) => git(s === 'evren' ? '/' : '/akislar')} yeni={() => git('/yeni')} />
    </Sahne>
  );
}

/** M2 · Masaüstü evren (≥ 1280): solda usturlap ×1.6, iki cümle tek satır; sağda 440 px panel (§5 M2). */
function EvrenGenis({ W, H, kisi, avatar, cizim, cumleler, kartlar, kapanan, detay, benim, taslak, now }: { W: number; H: number; kisi: string; avatar: () => void; cizim: any; cumleler: any[]; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; benim: any[]; taslak: number; now: number }) {
  const PW = 440, X = W - PW, k = 1.6 * Math.min((W - PW) / 1000, H / 900);
  const tx = (W - PW) * .52 - 195 * k, ty = H * .547 - 470 * k;
  const yer = (x: number, y: number) => [tx + x * k, ty + y * k];
  const tum = [...kartlar, ...kapanan];
  const say = (kod: string) => { const a = detay[kod]?.adimlar; return a ? [a.filter((x: any) => ['tamam', 'atlandi', 'ertelendi'].includes(x.durum)).length, a.length] : null; };
  const akislar = kartlar.slice().sort((a, b) => (a.pay_saat ?? 1e9) - (b.pay_saat ?? 1e9));
  const bekl = benim.filter((b) => b.durum !== 'suruyor').slice(0, 5);
  const akY = 132 + Math.max(1, bekl.length) * 64 + 26;
  let svg = `<g transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${k.toFixed(3)})">${cizim.svg}</g>`;
  svg += `<rect x="${X}" y="0" width="${PW}" height="${H}" fill="url(#sheet)"/><rect x="${X}" y="0" width="${PW}" height="${H}" filter="url(#paper)" opacity=".5"/><rect x="${X}" y="0" width="1" height="${H}" fill="#FFC9A3" opacity=".35"/>`;
  svg += `<g transform="translate(${X + 370},52)"><circle r="26" fill="url(#bloom)" opacity=".7"/><circle r="22" fill="url(#btn)"/><path d="M0,-8 L0,8 M-8,0 L8,0" stroke="#2A1D4F" stroke-width="2.6" stroke-linecap="round"/></g>`;
  cumleler.slice(0, 2).forEach((c, i) => { svg += c.tur === 'engel' ? iconCloud(58, 112 + i * 44, .6) : c.tur === 'bekleme' ? iconRings(58, 112 + i * 44, .78) : ''; });
  bekl.forEach((b, i) => {
    const y = 132 + i * 64;
    svg += `<rect x="${X + 20}" y="${y}" width="${PW - 40}" height="56" rx="18" fill="#120B2C" fill-opacity=".72" stroke="#FFFFFF" stroke-opacity=".08"/>` + planet(X + 48, y + 28, 9, b.durum === 'engelli' ? 'block' : 'wait', { waitRings: 1, life: false, karar: b.karar_adimi });
  });
  akislar.forEach((a, i) => {
    const y = akY + 14 + i * 66;
    if (y + 58 > H - 8) return;
    svg += `<rect x="${X + 20}" y="${y}" width="${PW - 40}" height="58" rx="18" fill="#120B2C" fill-opacity=".72" stroke="#FFFFFF" stroke-opacity=".08"/>` + kucukGalaksi(detay[a.kod], kisi, X + 52, y + 29, 20, 2, now);
  });
  const ad = (kod: string) => { const k2 = tum.find((x) => x.kod === kod); return k2 ? akisAdi(k2) : kod; };
  return (
    <GenisSahne gok={{ tohum: 121, yildiz: 330, parilti: 14 }} w={W} h={H} cizim={svg} etiket="Evren">
      <button type="button" className="avatar-dugme genis-geri" style={{ left: 34, top: 36 }} onClick={avatar} aria-label={`${kisi} · hesap ve çalışma alanı`}>
        <svg aria-hidden width="44" height="44" viewBox="-22 -22 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -20, 'insan', (kisi[0] || '?').toLocaleUpperCase('tr'), C.peach, 1.1, { flame: false }) }} />
      </button>
      <Metin y={64} x={80} fs={17} agirlik={650} style={{ right: 'auto', pointerEvents: 'none' }}>{kisi}</Metin>
      {cumleler.slice(0, 2).map((c, i) => <Metin key={c.metin} y={118 + i * 44} x={86} fs={19} lh={25} serif as="p" style={{ whiteSpace: 'nowrap', right: 'auto' }}>{c.metin}</Metin>)}
      <div role="list" aria-label="Akışlar" className="harita-katman">
        {cizim.U.yer.map((g: any) => { const [x, y] = yer(g.x, g.y), r = Math.max(24, g.rr * k); return <button key={g.kod} role="listitem" className="gezegen-hedef" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2 }} aria-label={ad(g.kod)} onClick={(e) => yakinlas(g.kod, e.currentTarget)} />; })}
        {cizim.U.taslak && (() => { const [x, y] = yer(cizim.U.taslak.x, cizim.U.taslak.y); return <button className="gezegen-hedef" style={{ left: x - 52 * k, top: y - 58 * k, width: 104 * k, height: 72 * k }} aria-label={`${taslak} taslak`} onClick={() => git('/yeni')} />; })()}
      </div>
      <div style={{ position: 'absolute', left: X + 4, top: 30, width: 280 }}><Segment secenekler={['Evren', 'Akışlar']} aktif={0} sec={(i) => { if (i) git('/akislar'); }} /></div>
      <button type="button" className="genis-geri" style={{ left: X + 348, top: 30 }} aria-label="Yeni iş" onClick={() => git('/yeni')} />
      <h2 className="genis-bolum" style={{ left: X + 24, top: 118 - 12 }}>SENDEN BEKLENEN</h2>
      {bekl.length ? bekl.map((b, i) => {
        const y = 132 + i * 64, akis = ad(b.akis), t = b.son_tarih ? gunAy(tarihMs(b.son_tarih)) : null;
        return <button key={b.akis + b.no} type="button" className="kart satir-kart" style={{ left: X + 20, top: y, width: PW - 40, height: 56, background: 'none', boxShadow: 'none' }} onClick={() => git(`/akis/${encodeURIComponent(b.akis)}/adim/${b.no}`)}>
          <span className="satir-metin" style={{ left: 54, right: 16 }}><b>{b.ad}</b><small>{akis}{t ? ` · ${t}` : ''}</small></span>
        </button>;
      }) : <Metin y={160} x={X + 24} fs={13} renk="ink3">Şu an senden beklenen iş yok.</Metin>}
      <h2 className="genis-bolum" style={{ left: X + 24, top: akY - 12 }}>AKIŞLAR</h2>
      {akislar.map((a, i) => {
        const y = akY + 14 + i * 66; if (y + 58 > H - 8) return null;
        const n = say(a.kod) || [a.ilerleme?.tamam ?? 0, a.ilerleme?.toplam ?? 0];
        return <button key={a.kod} type="button" className="kart satir-kart" style={{ left: X + 20, top: y, width: PW - 40, height: 58, background: 'none', boxShadow: 'none' }} onClick={() => git(`/akis/${encodeURIComponent(a.kod)}`)}>
          <span className="satir-metin" style={{ left: 66, right: 90 }}><b>{akisAdi(a)}</b><small>{n[0]}/{n[1]} adım{a.hedef_tarih ? ` · hedef ${gunAy(tarihMs(a.hedef_tarih))}` : ''}</small></span>
          {a.pay_saat != null && <span className="satir-not" style={{ right: 20, color: 'var(--renk-metin-altin)', fontSize: 12.5 }}>{a.pay_saat >= 0 ? `${Math.round(a.pay_saat / 24)} g pay` : `${Math.round(-a.pay_saat / 24)} g geç`}</span>}
        </button>;
      })}
    </GenisSahne>
  );
}
