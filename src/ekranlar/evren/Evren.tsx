import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { GenisSahne, Metin, metinUst, Sahne } from '../../bilesen/Sahne';
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
import { useGezinme, type Bolge } from '../akis/gezinme';
import { bos, type Daire } from '../akis/katman';

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

/** Galaksi yer tutucusu: yakınlaşınca aynı akış ekran koordinatında ayrıntılı çizilir (§4.13: yalnız R, ps ve ayrıntı katmanı değişir). */
const yerTutucu = (kod: string) => `<!--g:${kod}-->`;
const YER_TUTUCU = /<!--g:([^>]*?)-->/g;
type GYer = { x: number; y: number; r: number; pr: number };
type Hap = [number, number, string, Record<string, unknown>];

/**
 * Evren yakınlaşması: usturlap ölçeklenir; ekranda yarıçapı 64 px'i geçen galaksi ayrıntılı çizilir, adımları ve kişileri
 * dokunulur olur. En yakında bir galaksinin üstünde daha da yaklaşmak o akışa girer (Z1).
 */
function useEvrenGezinme(b: Bolge, cizim: { svg: string; konum: Record<string, GYer>; hap: Hap[] } | null, detay: Record<string, any>, kisi: string, now: number, taban = { k: 1, x: 0, y: 0 }) {
  const ref = useRef<(kod: string) => void>(() => {});
  const gz = useGezinme(b, { max: 6, asiri: (p) => ref.current(enYakin(p)) });
  const { k, tx, ty } = gz.g;
  const kucukler = useMemo(() => {
    const m: Record<string, string> = {};
    if (cizim) for (const [kod, g] of Object.entries(cizim.konum)) m[kod] = kucukGalaksi(detay[kod], kisi, g.x, g.y, g.r, g.pr, now);
    return m;
  }, [cizim, detay, kisi, now]);
  // tasarım (390 kare) → pencere: önce taban (geniş düzende ×1.6), sonra yakınlaşma
  const K = k * taban.k, TX = tx + taban.x * k, TY = ty + taban.y * k;
  const ekran = (g: GYer) => ({ x: g.x * K + TX, y: g.y * K + TY, r: g.r * K });
  const enYakin = (p: [number, number]) => {
    let en = '', d0 = 1e9;
    for (const [kod, g] of Object.entries(cizim?.konum || {})) { const e = ekran(g), d = Math.hypot(e.x - p[0], e.y - p[1]); if (d < Math.max(e.r * 1.3, 44) && d < d0) { d0 = d; en = kod; } }
    return en;
  };
  const sonuc = useMemo(() => {
    if (!cizim) return null;
    const sar = (t: string, kk: number, x: number, y: number) => (kk === 1 && !x && !y ? t : `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${kk.toFixed(4)})">${t}</g>`);
    const haplar = (yak: boolean) => cizim.hap.map(([x, y, t, o]) => {
      if (!yak && taban.k === 1) return pill(x, y, t, o);
      const e = ekran({ x, y, r: 1, pr: 0 });
      return yak && !gz.icinde(e.x, e.y, -12) ? '' : `<g transform="translate(${e.x.toFixed(2)},${e.y.toFixed(2)}) scale(${taban.k.toFixed(4)})">${pill(0, 0, t, o)}</g>`;
    }).join('');
    if (!gz.yaklasik) return { svg: sar(cizim.svg.replace(YER_TUTUCU, (_, kod) => kucukler[kod] || ''), taban.k, taban.x, taban.y) + haplar(false), ayrinti: [] as { kod: string; Y: any }[] };
    const ayrinti: { kod: string; Y: any }[] = [];
    const icerde = (x: number, y: number, r: number) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h;
    const tabanSvg = cizim.svg.replace(YER_TUTUCU, (_, kod) => {
      const g = cizim.konum[kod], e = g && ekran(g);
      // küçük çizim yarıçapı r; ayrıntılı çizim kilit parantezinin içini doldurur (r × 1.35)
      const R = e.r * 1.35;
      if (!g || !detay[kod] || R < 64 || !icerde(e.x, e.y, R)) return kucukler[kod] || '';
      ayrinti.push({ kod, Y: yolCiz(akisModeli(detay[kod], { sahip: kisi }), { cx: e.x, cy: e.y, R, ps: Math.max(.36, Math.min(.78, R * .005)), now, x: now, labels: [], shipSc: .9, minR: 6.5, kuleEtiket: false }) });
      return '';
    });
    const svg = `<defs><clipPath id="evren-kirp"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/></clipPath></defs><g clip-path="url(#evren-kirp)"><g class="evren-olcekli${k > 1.6 ? ' yazisiz' : ''}">${sar(tabanSvg, K, TX, TY)}</g>${ayrinti.map((a) => a.Y.svg).join('')}${haplar(true)}</g>`;
    return { svg, ayrinti };
  }, [cizim, kucukler, gz.yaklasik, k, tx, ty, detay, kisi, now, b, taban.k, taban.x, taban.y]); // eslint-disable-line react-hooks/exhaustive-deps
  return { gz, sonuc, ekran, girisRef: ref };
}

/** Evren dokunma katmanı: galaksiler (dokun → Z1), yakınken adımlar ve kişiler. */
function EvrenHedefleri({ E, b, yer, tum, detay, taslak, minR = 22 }: { E: ReturnType<typeof useEvrenGezinme>; b: Bolge; yer: { kod: string; x: number; y: number; rr: number }[]; tum: any[]; detay: Record<string, any>; taslak?: { x: number; y: number; n: number } | null; minR?: number }) {
  const { gz, sonuc, ekran } = E;
  E.girisRef.current = (kod) => { if (!kod) return; const el = document.querySelector<HTMLElement>(`[data-kod="${CSS.escape(kod)}"]`); if (el) yakinlas(kod, el); else git(`/akis/${encodeURIComponent(kod)}`); };
  const hedef: (Daire & { key: string; etiket: string; tikla: (e: any) => void; kod?: string })[] = [];
  const gor = (x: number, y: number) => gz.icinde(x, y, 8);
  const ayrintili = new Set((sonuc?.ayrinti || []).map((a) => a.kod));
  for (const a of sonuc?.ayrinti || []) {
    const d = a.Y, F = tum.find((x) => x.kod === a.kod), byNo = new Map<number, any>((detay[a.kod]?.adimlar || []).map((x: any) => [x.no, x]));
    for (const g of Object.values(d.G.gezegen) as any[]) {
      if (!gor(g.x, g.y)) continue;
      const h = { key: a.kod + g.no, x: g.x, y: g.y, r: Math.max(22, d.radOf(g.no) + 6), etiket: `${F ? akisAdi(F) : a.kod}, ${g.no}. adım: ${byNo.get(g.no)?.ad ?? ''}.`, tikla: () => git(`/akis/${encodeURIComponent(a.kod)}/adim/${g.no}`) };
      if (bos(h, hedef)) hedef.push(h);
    }
    for (const sh of d.gemiler || []) {
      const h = { key: a.kod + sh.ad, x: sh.x, y: sh.y, r: 22, etiket: `${F ? akisAdi(F) : a.kod}: ${sh.ad}. Akışı aç.`, tikla: (e: any) => yakinlas(a.kod, e.currentTarget) };
      if (gor(h.x, h.y) && bos(h, hedef)) hedef.push(h);
    }
  }
  for (const g of yer) {
    const k = tum.find((x) => x.kod === g.kod), e = ekran({ x: g.x, y: g.y, r: g.rr, pr: 0 });
    const etiket = k ? `${akisAdi(k)}. ${k.durum === 'kapandi' ? 'Kapandı.' : `${k.ilerleme?.tamam ?? 0}/${k.ilerleme?.toplam ?? 0} adım tamam. Hedef ${gunAy(tarihMs(k.hedef_tarih))}.`}` : g.kod;
    if (!gor(e.x, e.y)) continue;
    const h = { key: g.kod, kod: g.kod, x: e.x, y: e.y, r: ayrintili.has(g.kod) ? 22 : Math.max(minR, e.r), etiket: ayrintili.has(g.kod) ? `${etiket} Akışı aç.` : etiket, tikla: (ev: any) => yakinlas(g.kod, ev.currentTarget) };
    if (!ayrintili.has(g.kod) || bos(h, hedef)) hedef.push(h);
  }
  return (
    <div ref={gz.ref} className="harita-gezinme" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} {...gz.olaylar}>
      <div role="list" aria-label="Akışlar" className="harita-katman" style={{ left: -b.x, top: -b.y }}>
        {hedef.map((h) => <button key={h.key} role="listitem" data-kod={h.kod} className="gezegen-hedef" style={{ left: h.x - h.r, top: h.y - h.r, width: h.r * 2, height: h.r * 2 }} aria-label={h.etiket} onClick={h.tikla} />)}
        {taslak && (() => { const e = ekran({ x: taslak.x, y: taslak.y, r: 1, pr: 0 }); return gor(e.x, e.y) && <button className="gezegen-hedef" style={{ left: e.x - 52 * e.r, top: e.y - 58 * e.r, width: 104 * e.r, height: 72 * e.r }} aria-label={`${taslak.n} taslak`} onClick={() => git('/yeni')} />; })()}
      </div>
    </div>
  );
}

/** Yakınlaşma düğmeleri: geniş düzende hepsi; telefonda yalnız yakınken sığdır. */
function YakinDugmeleri({ gz, x, y, hep }: { gz: ReturnType<typeof useGezinme>; x: number; y: number; hep: boolean }) {
  const tam = hep;
  if (!tam && !gz.yaklasik) return null;
  return (
    <div className="harita-yakin" style={{ left: x, top: y }}>
      {tam && <button type="button" aria-label="Yakınlaştır" onClick={() => gz.yakinlas(1.5)}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,0 H5 M0,-5 V5" /></svg></button>}
      {tam && <button type="button" aria-label="Uzaklaştır" disabled={!gz.yaklasik} onClick={() => gz.yakinlas(1 / 1.5)}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,0 H5" /></svg></button>}
      <button type="button" aria-label="Haritayı sığdır" disabled={!gz.yaklasik} onClick={gz.sigdir}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-6,-2 V-6 H-2 M2,-6 H6 V-2 M6,2 V6 H2 M-2,6 H-6 V2" /></svg></button>
    </div>
  );
}

/** Akıllı cümle → anlattığı adım (cümlenin üstünde saydam hedef; metin okunur kalır). */
function CumleHedef({ c, x, y, w, h }: { c: { kod?: string; no?: number; metin: string }; x: number; y: number; w: number; h: number }) {
  return <button type="button" className="cumle-hedef" style={{ left: x, top: y, width: w, height: Math.max(44, h) }} aria-label={`${c.metin} Adımı aç.`} onClick={() => git(`/akis/${encodeURIComponent(c.kod!)}/adim/${c.no}`)} />;
}

/** Mobil evrende gezinme alanı: cümlelerin altı, alt gezinmenin üstü. */
const EVREN_BOLGE: Bolge = { x: 0, y: 228, w: 390, h: 510 };

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
    const konum: Record<string, GYer> = {};
    // haplar (adlar, bugün, taslak) yakınlaşınca ölçeklenmez: ekran koordinatında ayrı çizilir
    const hap: Hap[] = [];
    const kararli = (k: any) => !!detay[k.kod]?.adimlar?.some((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor'));
    // J1: çok akışta ölçek düzeni (§4.14)
    if (kartlar.length > OLCEK) {
      const O = evrenOlcek({
        simdi: NOW,
        akislar: [
          ...kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k) })),
          ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
        ],
        kucuk: (kod, x, y, r, pr) => { konum[kod] = { x, y, r, pr }; return yerTutucu(kod); },
      });
      let s = O.svg;
      for (const e of O.etiketler) { const k = tum.find((x) => x.kod === e.kod); if (k) hap.push([e.etiket.x, e.etiket.y, akisAdi(k), { fs: 10.5, fw: 650 }]); }
      if (O.kapanan) hap.push([O.kapananHap.x, O.kapananHap.y, `${O.kapanan} kapandı`, { fs: 11, fw: 650, stroke: '#FFD27A', col: '#FFE6B0' }]);
      return { svg: s, U: { yer: O.yer, taslak: null }, olcek: O, konum, hap };
    }
    const U = usturlap({
      simdi: NOW, oran: toplam ? tamam / toplam : 0, taslak: ozet.data.taslaklar?.length || 0,
      akislar: [
        ...kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k), bitti: k.ilerleme && k.ilerleme.tamam === k.ilerleme.toplam })),
        ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
      ],
      kucuk: (kod, x, y, r, pr) => { konum[kod] = { x, y, r, pr }; return yerTutucu(kod); },
    });
    let s = U.svg;
    // haplar: bugün, galaksi adları, taslak
    hap.push([U.hap.x, U.hap.y, gunAy(NOW), { fs: 11.5, fw: 700, bg: '#FFC9A3', bgo: 1, col: '#2A1D4F', w: 54 }]);
    for (const y of U.yer) hap.push([y.etiket.x, y.etiket.y, tum.find((k) => k.kod === y.kod) ? akisAdi(tum.find((k) => k.kod === y.kod)) : y.kod, { fs: 11.5, fw: 650, col: C.ink }]);
    if (U.taslak) hap.push([U.taslak.x, U.taslak.y, `${ozet.data.taslaklar.length} taslak`, { fs: 11, fw: 500, col: C.ink2 }]);
    // en fazla 2 kilit parantezi: cümlelerdeki akışlar
    for (const [kod, tur] of Object.entries(isaret).slice(0, 2)) {
      const y = U.yer.find((q) => q.kod === kod); if (!y) continue;
      const w = y.rr * 2.8, h = y.rr * 2.32;
      s += tur === 'engel' ? brackets(y.x - w / 2, y.y - y.rr * .87, w, h, '#FF8A78', gCloud) : brackets(y.x - w / 2, y.y - y.rr * .87, w, h, '#FFD27A', gRings, true);
    }
    return { svg: s, U, olcek: null, konum, hap };
  }, [ozet.data, kap.data, detay, cumleler, NOW]); // eslint-disable-line react-hooks/exhaustive-deps

  const E = useEvrenGezinme(EVREN_BOLGE, cizim && !cizim.olcek ? cizim : null, detay, kisi, NOW);

  if (ozet.isPending) return <Sahne gok={{ tohum: 21, yildiz: 330 }} etiket="Evren"><AvatarAd ad={kisi} /></Sahne>;
  const bos = ozet.data && !kartlar.length && !ozet.data.taslaklar?.length;
  const avatar = () => git('/hesap');
  if (bos) return <BosEvren ad={kisi} avatar={avatar} />;
  if (!cizim) return null;

  if (cizim.olcek) return <EvrenOlcek kisi={kisi} avatar={avatar} cizim={cizim} kartlar={kartlar} kapanan={kapanan} detay={detay} now={NOW} />;
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
    <Sahne gok={{ tohum: 21, yildiz: 330, sakin: [195, 470, 200] }} cizim={(E.sonuc?.svg ?? '') + satirlar.map(({ c, y: yy }) => c.tur === 'engel' ? iconCloud(32, yy - 5, .55) : c.tur === 'bekleme' ? iconRings(32, yy - 3, .72) : '').join('')} etiket="Evren">
      <AvatarAd ad={kisi} ac={avatar} />
      {satirlar.map(({ c, s, y: yy }) => (
        <Metin key={c.metin} y={yy} x={56} fs={17.5} lh={22} serif as="p" style={{ whiteSpace: s.length > 1 ? 'nowrap' : undefined }}>
          {s.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}
        </Metin>
      ))}
      {satirlar.map(({ c, s, y: yy }) => c.kod && c.no != null && <CumleHedef key={'h' + c.metin} c={c} x={20} y={metinUst(yy, 17.5, 22, true) - 4} w={350} h={s.length * 22 + 8} />)}
      <EvrenHedefleri E={E} b={EVREN_BOLGE} yer={cizim.U.yer} tum={tum} detay={detay} taslak={cizim.U.taslak ? { ...cizim.U.taslak, n: ozet.data.taslaklar.length } : null} minR={24} />
      <YakinDugmeleri gz={E.gz} x={390 - 62} y={EVREN_BOLGE.y + 4} hep={false} />
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

function EvrenOlcek({ kisi, avatar, cizim, kartlar, kapanan, detay, now }: { kisi: string; avatar: () => void; cizim: any; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; now: number }) {
  const tum = [...kartlar, ...kapanan];
  const cumle = doluSatir(olcekCumlesi(kartlar, detay), 340, '17.5px Caladea', 3);
  const O = cizim.olcek;
  const E = useEvrenGezinme(EVREN_BOLGE, cizim, detay, kisi, now);
  return (
    <Sahne gok={{ tohum: 21, yildiz: 330, sakin: [195, 452, 190] }} cizim={E.sonuc?.svg ?? ''} etiket="Evren">
      <AvatarAd ad={kisi} ac={avatar} />
      <Metin y={112} fs={17.5} lh={23} serif as="p" style={{ whiteSpace: 'nowrap' }}>{cumle.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
      <EvrenHedefleri E={E} b={EVREN_BOLGE} yer={O.yer} tum={tum} detay={detay} minR={16} />
      {O.kapanan > 0 && <button className="gezegen-hedef" style={{ left: O.kapananHap.x - 44, top: O.kapananHap.y - 22, width: 88, height: 44 }} aria-label={`${O.kapanan} kapandı`} onClick={() => git('/akislar/arsiv')} />}
      <YakinDugmeleri gz={E.gz} x={390 - 62} y={EVREN_BOLGE.y + 4} hep={false} />
      <AltGezinme aktif="evren" git={(s) => git(s === 'evren' ? '/' : '/akislar')} yeni={() => git('/yeni')} />
    </Sahne>
  );
}

/** M2 · Masaüstü evren (≥ 1280): solda usturlap ×1.6, iki cümle tek satır; sağda 440 px panel (§5 M2). */
function EvrenGenis({ W, H, kisi, avatar, cizim, cumleler, kartlar, kapanan, detay, benim, taslak, now }: { W: number; H: number; kisi: string; avatar: () => void; cizim: any; cumleler: any[]; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; benim: any[]; taslak: number; now: number }) {
  const PW = 440, X = W - PW, k = 1.6 * Math.min((W - PW) / 1000, H / 900);
  const tx = (W - PW) * .52 - 195 * k, ty = H * .547 - 470 * k;
  const tum = [...kartlar, ...kapanan];
  const say = (kod: string) => { const a = detay[kod]?.adimlar; return a ? [a.filter((x: any) => ['tamam', 'atlandi', 'ertelendi'].includes(x.durum)).length, a.length] : null; };
  const akislar = kartlar.slice().sort((a, b) => (a.pay_saat ?? 1e9) - (b.pay_saat ?? 1e9));
  const bekl = benim.filter((b) => b.durum !== 'suruyor').slice(0, 5);
  const akY = 132 + Math.max(1, bekl.length) * 64 + 26;
  const B: Bolge = useMemo(() => ({ x: 0, y: 190, w: X, h: H - 190 }), [X, H]);
  const taban = useMemo(() => ({ k, x: tx, y: ty }), [k, tx, ty]);
  const E = useEvrenGezinme(B, cizim, detay, kisi, now, taban);
  let svg = E.sonuc?.svg ?? '';
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
      {cumleler.slice(0, 2).map((c, i) => c.kod && c.no != null && <CumleHedef key={'h' + c.metin} c={c} x={40} y={metinUst(118 + i * 44, 19, 25, true) - 6} w={Math.min(X - 80, 760)} h={36} />)}
      <EvrenHedefleri E={E} b={B} yer={cizim.U.yer} tum={tum} detay={detay} taslak={cizim.U.taslak ? { ...cizim.U.taslak, n: taslak } : null} minR={24} />
      <YakinDugmeleri gz={E.gz} x={X - 68} y={B.y + 8} hep />
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
