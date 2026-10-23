import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { SAHTE, simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { useOlaylar, Zil } from '../../bilesen/Zil';
import { GenisSahne, Metin, metinUst, Sahne } from '../../bilesen/Sahne';
import { useBoyut } from '../../bilesen/Gok';
import { KabukPanel, masaustu, PANEL_EN, PanelUst, YuzenGezinme, type KabukSekme } from '../../bilesen/Kabuk';
import { useVurgu, vurgula } from '../../bilesen/vurgu';
import { CERCEVE, CERCEVE_HAP, cerceve, evrenOlcek, iconCloud, iconRings, usturlap } from '../../cizim/ekran';
import { akisModeli, gunAy, yolCiz } from '../../cizim/yol.js';
import { brackets, C, pill, planet, ship } from '../../cizim/ortak.js';
import { adimAdi, akisAdi, doluSatir, ozelEk, paySure, yaziTipleriHazir } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { tanitimGorulmeli } from './Tanitim';
import { yakinlas } from '../../cizim/yakinlas';
import { AvatarAd, BosEvren } from './BosEvren';
import { evrenCumleleri } from './cumleler';
import { evrenTakvimi } from '../../geometri/evren';
import { useGezinme, type Bolge } from '../akis/gezinme';
import { bos, type Daire } from '../akis/katman';
import { evrenSayilari, Lejant, SoruIkon } from '../akis/Lejant';
import { hareketAz } from '../../ayar/hareket';
import { PANO_AD, pano, type Pano as PanoV, type PanoTur } from './pano';
import { EvrenPano, panoYerlesimi, sonHareketler, usePanoListeleri } from './Pano';
import { DurumNotu, veriDurumu, type VeriDurumu } from '../../bilesen/VeriDurumu';
import { aralikMetni, hedefEtiketi, hedefParcasi, KararSeridi, oncelikliAkis, seritYuksekligi } from '../../bilesen/KararSeridi';
import { akisIlerlemesi, ilerlemeMetni } from '../../api/ilerleme';

const gCloud = iconCloud(1, -3, .42), gRings = iconRings(0, 0, .55);
/** Bu sayıdan çok aktif akışta evren ölçek düzenine geçer (J1). */
const OLCEK = 10;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

/** Kapanan akışlar (dış halka). */
const useKapananlar = () => useQuery({ queryKey: ['akislar', 'kapandi'], queryFn: () => api.get<any>('/akislar?durum=kapandi') });

/** Sunucu toplu detayı biliyor mu (0.12.0 /akislar/detay); 404 görülünce bu oturumda tek tek çağrıya dönülür. */
let topluDetay: boolean | null = null;
/**
 * Akış detayları (küçük galaksiler için). 0.12.0'da 30'arlı toplu çağrı; dönenler tek akış önbelleğine de yazılır,
 * böylece galaksiye geçince yeniden çekilmez. Eski sunucuda akış başına bir çağrı.
 */
export function useDetaylar(kodlar: string[]) { return useDetaylarDurum(kodlar).d; }

/** Detaylar ve yükleme durumu (P1-B2, M-M3): kaçı eksik, kalıcı hata var mı, yeniden dene. */
export function useDetaylarDurum(kodlar: string[]) {
  const qc = useQueryClient();
  const [toplu, setToplu] = useState(topluDetay);
  const parcalar: string[][] = [];
  for (let i = 0; i < kodlar.length; i += 30) parcalar.push(kodlar.slice(i, i + 30));
  const tq = useQueries({ queries: parcalar.map((P) => ({
    queryKey: ['akislar-detay', P.join(',')], enabled: toplu !== false,
    retry: (n: number, e: unknown) => !(e instanceof ApiHatasi && e.durum === 404) && n < 2,
    queryFn: async () => {
      try {
        const r = await api.get<any>(`/akislar/detay?kodlar=${P.map(encodeURIComponent).join(',')}`);
        topluDetay = true;
        for (const [k, v] of Object.entries(r.akislar || {})) qc.setQueryData(['akis', k], v);
        return r;
      } catch (e) { if (e instanceof ApiHatasi && e.durum === 404) { topluDetay = false; setToplu(false); } throw e; }
    },
  })) });
  const qs = useQueries({ queries: kodlar.map((kod) => ({ queryKey: ['akis', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}`), enabled: toplu === false })) });
  const d: Record<string, any> = {};
  qs.forEach((q, i) => { if (q.data) d[kodlar[i]] = q.data; });
  const eksik = (k: string[]) => k.filter((x) => !d[x]).length;
  // toplu çağrının 404'ü hata değil (eski sunucu: tek tek çağrıya dönülür)
  const hata = tq.some((q) => q.isError && !(q.error instanceof ApiHatasi && q.error.durum === 404)) || qs.some((q) => q.isError);
  const yeniden = () => { for (const q of tq) if (q.isError) void q.refetch(); for (const q of qs) if (q.isError) void q.refetch(); };
  return { d, eksik, hata, yeniden };
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
function useEvrenGezinme(b: Bolge, cizim: { svg: string; konum: Record<string, GYer>; hap: Hap[] } | null, detay: Record<string, any>, kisi: string, now: number, taban = { k: 1, x: 0, y: 0 }, soluk?: Set<string> | null) {
  const ref = useRef<(kod: string) => void>(() => {});
  // en büyük galaksi ekranın yaklaşık yarısını doldurunca yakınlaşma durur; daha da açmak o akışa girer (el notu 6)
  const enR = Math.max(8, ...Object.values(cizim?.konum || {}).map((g) => g.r)) * taban.k;
  const gz = useGezinme(b, { max: Math.max(2.5, Math.min(6, b.w * .42 / (enR * 1.35))), asiri: (p) => ref.current(enYakin(p)) });
  const { k, tx, ty } = gz.g;
  const kucukler = useMemo(() => {
    const m: Record<string, string> = {};
    if (cizim) for (const [kod, g] of Object.entries(cizim.konum)) m[kod] = sonuk(kod, kucukGalaksi(detay[kod], kisi, g.x, g.y, g.r, g.pr, now));
    return m;
  }, [cizim, detay, kisi, now, soluk]); // eslint-disable-line react-hooks/exhaustive-deps
  // pano süzgeci (el notu 3): eşleşmeyen galaksi sönükleşir
  function sonuk(kod: string, t: string) { return soluk?.has(kod) ? `<g opacity=".22">${t}</g>` : t; }
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
    const svg = `<defs><clipPath id="evren-kirp"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/></clipPath></defs><g clip-path="url(#evren-kirp)"><g class="evren-olcekli${k > 1.6 ? ' yazisiz' : ''}">${sar(tabanSvg, K, TX, TY)}</g>${ayrinti.map((a) => sonuk(a.kod, a.Y.svg)).join('')}${haplar(true)}</g>`;
    return { svg, ayrinti };
  }, [cizim, kucukler, gz.yaklasik, k, tx, ty, detay, kisi, now, b, taban.k, taban.x, taban.y, soluk]); // eslint-disable-line react-hooks/exhaustive-deps
  return { gz, sonuc, ekran, girisRef: ref };
}

/** Evren dokunma katmanı: galaksiler (dokun → Z1), yakınken adımlar ve kişiler. */
function EvrenHedefleri({ E, b, yer, tum, detay, taslak, minR = 22, kaydir }: { E: ReturnType<typeof useEvrenGezinme>; b: Bolge; yer: { kod: string; x: number; y: number; rr: number }[]; tum: any[]; detay: Record<string, any>; taslak?: { x: number; y: number; n: number } | null; minR?: number; kaydir?: boolean }) {
  const { gz, sonuc, ekran } = E;
  E.girisRef.current = (kod) => { if (!kod) return; const el = document.querySelector<HTMLElement>(`[data-kod="${CSS.escape(kod)}"]`); if (el) yakinlas(kod, el); else git(`/akis/${encodeURIComponent(kod)}`); };
  const hedef: (Daire & { key: string; etiket: string; tikla: (e: any) => void; kod?: string; ipucu?: string })[] = [];
  const gor = (x: number, y: number) => gz.icinde(x, y, 8);
  const ayrintili = new Set((sonuc?.ayrinti || []).map((a) => a.kod));
  for (const a of sonuc?.ayrinti || []) {
    const d = a.Y, F = tum.find((x) => x.kod === a.kod), byNo = new Map<number, any>((detay[a.kod]?.adimlar || []).map((x: any) => [x.no, x]));
    for (const g of Object.values(d.G.gezegen) as any[]) {
      if (!gor(g.x, g.y)) continue;
      const h = { key: a.kod + g.no, x: g.x, y: g.y, r: Math.max(22, d.radOf(g.no) + 6), etiket: `${F ? akisAdi(F) : a.kod}, ${g.no}. adım: ${byNo.get(g.no)?.ad ?? ''}.`, ipucu: `${g.no}. ${byNo.get(g.no)?.kisa_ad || byNo.get(g.no)?.ad || ''} · ${byNo.get(g.no)?.durum_etiket || byNo.get(g.no)?.durum || ''}`, tikla: () => git(`/akis/${encodeURIComponent(a.kod)}/adim/${g.no}`) };
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
    const ipucu = k ? `${akisAdi(k)} · ${k.durum === 'kapandi' ? 'kapandı' : `${ilerlemeMetni(akisIlerlemesi(k, detay[g.kod]))}${k.hedef_tarih ? ` · hedef ${gunAy(tarihMs(k.hedef_tarih))}` : ''}${hedefEtiketi(k.karar_ozeti) ? ` · ${hedefEtiketi(k.karar_ozeti)}` : ''}`}` : g.kod;
    const h = { key: g.kod, kod: g.kod, x: e.x, y: e.y, r: ayrintili.has(g.kod) ? 22 : Math.max(minR, e.r), etiket: ayrintili.has(g.kod) ? `${etiket} Akışı aç.` : etiket, ipucu, tikla: (ev: any) => yakinlas(g.kod, ev.currentTarget) };
    if (!ayrintili.has(g.kod) || bos(h, hedef)) hedef.push(h);
  }
  return (
    <div ref={gz.ref} className={`harita-gezinme${kaydir && !gz.yaklasik ? ' kaydirilir' : ''}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} {...gz.olaylar}>
      <div role="list" aria-label="Akışlar" className="harita-katman" style={{ left: -b.x, top: -b.y }}>
        {hedef.map((h) => <button key={h.key} role="listitem" data-kod={h.kod} className="gezegen-hedef" style={{ left: h.x - h.r, top: h.y - h.r, width: h.r * 2, height: h.r * 2 }} aria-label={h.etiket} data-ipucu={h.ipucu} onClick={h.tikla}
          onMouseEnter={h.kod ? () => vurgula(h.kod!) : undefined} onMouseLeave={h.kod ? () => vurgula(null) : undefined} />)}
        {taslak && (() => { const e = ekran({ x: taslak.x, y: taslak.y, r: 1, pr: 0 }); return gor(e.x, e.y) && <button className="gezegen-hedef" style={{ left: e.x - 52 * e.r, top: e.y - 58 * e.r, width: 104 * e.r, height: 72 * e.r }} aria-label={`${taslak.n} taslak`} onClick={() => git('/yeni')} />; })()}
      </div>
    </div>
  );
}

/** Yakınlaşma düğmeleri: geniş düzende hepsi; telefonda yalnız yakınken sığdır. */
function YakinDugmeleri({ gz, x, y, hep, lejant }: { gz: ReturnType<typeof useGezinme>; x: number; y: number; hep: boolean; lejant?: () => void }) {
  const tam = hep;
  if (!tam && !gz.yaklasik && !lejant) return null;
  return (
    <div className="harita-yakin" style={{ left: x, top: y }}>
      {lejant && <button type="button" className="lejant-dugme" aria-label="Evren dili" aria-haspopup="dialog" onClick={lejant}><SoruIkon /></button>}
      {tam && <button type="button" aria-label="Yakınlaştır" onClick={() => gz.yakinlas(1.5)}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,0 H5 M0,-5 V5" /></svg></button>}
      {tam && <button type="button" aria-label="Uzaklaştır" disabled={!gz.yaklasik} onClick={() => gz.yakinlas(1 / 1.5)}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,0 H5" /></svg></button>}
      {(tam || gz.yaklasik) && <button type="button" aria-label="Haritayı sığdır" disabled={!gz.yaklasik} onClick={gz.sigdir}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-6,-2 V-6 H-2 M2,-6 H6 V-2 M6,2 V6 H2 M-2,6 H-6 V2" /></svg></button>}
    </div>
  );
}

/** Akıllı cümle → anlattığı adım (cümlenin üstünde saydam hedef; metin okunur kalır). */
function CumleHedef({ c, x, y, w, h }: { c: { kod?: string; no?: number; metin: string }; x: number; y: number; w: number; h: number }) {
  return <button type="button" className="cumle-hedef" style={{ left: x, top: y, width: w, height: Math.max(44, h) }} aria-label={`${c.metin} Adımı aç.`} onClick={() => git(`/akis/${encodeURIComponent(c.kod!)}/adim/${c.no}`)} />;
}

/** Mobil evrende gezinme alanı: cümlelerin altı, alt gezinmenin üstü. */
const EVREN_BOLGE: Bolge = { x: 0, y: 228, w: 390, h: 510 };
const LEJANT_ANAHTAR = 'devir:evren-dili';
/** Ayarlar · "Evren dilini yeniden göster": evren bir sonraki açılışta dili yeniden tanıtır. */
export function evrenDiliniSifirla() { try { localStorage.removeItem(LEJANT_ANAHTAR); } catch { /* depolama kapalı */ } }
/** Pano bölümünün başı: ilk ekranın hemen altı. */
const PANO_Y = 852;
/** Evren dili ilk açılışta bir kez: genel tanıtım görüldükten sonra (sahte kipte yalnız ?lejant=1). */
function evrenDiliGorulmeli(): boolean {
  if (SAHTE) return arama().get('lejant') === '1';
  try { return !localStorage.getItem(LEJANT_ANAHTAR) && !tanitimGorulmeli(); } catch { return false; }
}

/**
 * B1 · Evren: bütün aktif akışlar tek bakışta (§5 B1, §3.10).
 * Masaüstünde (≥ 1024 × 600) solda evren, sağda pano; `panel` verilirse panelde o sayfa açılır (N13).
 * `serbest`: Akışlar sayfasının haritası; takvim halkası ve ipler yok, galaksiler serbest dizilir (N15).
 */
export function Evren({ ben, panel, konum, geri, aktif = 'evren', serbest }: { ben: Ben; panel?: ReactNode; konum?: string; geri?: () => void; aktif?: KabukSekme; serbest?: boolean }) {
  const ozet = useOzet();
  const kap = useKapananlar();
  const NOW = simdi(), kisi = ben.kisi || '';
  const boy = useBoyut();
  const genis = masaustu(boy.w, boy.h);
  const [, setYazi] = useState(0);
  useEffect(() => { void yaziTipleriHazir().then(() => setYazi(1)); }, []);
  const kartlar: any[] = ozet.data?.akislar || [];
  const kapanan: any[] = (kap.data?.akislar || []).filter((k: any) => k.durum === 'kapandi');
  const kodlar = useMemo(() => [...kartlar, ...kapanan].map((k) => k.kod), [ozet.data, kap.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const DD = useDetaylarDurum(kodlar), detay = DD.d;

  const cumleler = useMemo(() => evrenCumleleri(kartlar, detay, kisi, ozet.data?.ozet), [ozet.data, detay, kisi]); // eslint-disable-line react-hooks/exhaustive-deps
  const cizim = useMemo(() => {
    if (!ozet.data) return null;
    const isaret: Record<string, 'engel' | 'bekleme'> = {};
    for (const c of cumleler) if (c.kod && (c.tur === 'engel' || c.tur === 'bekleme') && !isaret[c.kod]) isaret[c.kod] = c.tur;
    const tum = [...kartlar, ...kapanan];
    const say = (k: any) => { const i = akisIlerlemesi(k, detay[k.kod]); return [i.tamam, i.toplam]; };
    const tamam = tum.reduce((a, k) => a + say(k)[0], 0), toplam = tum.reduce((a, k) => a + say(k)[1], 0);
    const konum: Record<string, GYer> = {};
    // haplar (adlar, bugün, taslak) yakınlaşınca ölçeklenmez: ekran koordinatında ayrı çizilir
    const hap: Hap[] = [];
    const kararli = (k: any) => !!detay[k.kod]?.adimlar?.some((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor'));
    // Akışlar haritası (N15): halkasız ve ipsiz serbest dizilim, en riskli sol üstte
    if (serbest && genis) {
      const sira = [...kartlar].sort((a, b) => (a.pay_saat ?? 1e9) - (b.pay_saat ?? 1e9));
      const S = serbestDizilim([...sira, ...kapanan.slice(0, 6)].map((k) => ({ kod: k.kod, adim: say(k)[1] })));
      let s = '';
      for (const g of S) { konum[g.kod] = { x: g.x, y: g.y, r: g.r, pr: 1.8 }; s += cerceve(g.x, g.y, g.r) + yerTutucu(g.kod); }
      for (const g of S) { const k = tum.find((x) => x.kod === g.kod); if (k) hap.push([g.x, g.y + g.r + CERCEVE, akisAdi(k), { fs: 11.5, fw: 650, col: C.ink, stroke: CERCEVE_HAP }]); }
      return { svg: s, U: { yer: S.map((g) => ({ kod: g.kod, x: g.x, y: g.y, rr: g.r })), taslak: null }, olcek: null, konum, hap };
    }
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
    // evren matematiği (madde 5): başlangıç, pay, adım sayısı, biten ve kişiler; takvim veriden
    const kisileri = (k: any) => [...new Set<string>((detay[k.kod]?.adimlar || []).map((a: any) => a.sahip))];
    const aktifler = kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k), bitti: k.ilerleme && k.ilerleme.tamam === k.ilerleme.toplam,
      t0: tarihMs(k.olusturuldu || k.son_hareket || k.hedef_tarih), payGun: k.pay_saat == null ? null : k.pay_saat / 24, adim: say(k)[1], biten: say(k)[0], kisiler: kisileri(k) }));
    const takvim = evrenTakvimi([...aktifler, ...kapanan.filter((k) => k.kapandi_at && tarihMs(k.kapandi_at) > NOW - 45 * 864e5).map((k) => ({ t0: tarihMs(k.kapandi_at), hedef: tarihMs(k.kapandi_at) }))], NOW);
    const U = usturlap({
      simdi: NOW, oran: toplam ? tamam / toplam : 0, taslak: ozet.data.taslaklar?.length || 0, takvim,
      akislar: [
        ...aktifler,
        ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
      ],
      kucuk: (kod, x, y, r, pr) => { konum[kod] = { x, y, r, pr }; return yerTutucu(kod); },
    });
    let s = U.svg;
    // haplar: bugün, galaksi adları, taslak
    hap.push([U.hap.x, U.hap.y, gunAy(NOW), { fs: 11.5, fw: 700, bg: '#FFC9A3', bgo: 1, col: '#2A1D4F', w: 54 }]);
    for (const y of U.yer) { const k = tum.find((q) => q.kod === y.kod); hap.push([y.etiket.x, y.etiket.y, k ? akisAdi(k) : y.kod, { fs: 11.5, fw: 650, col: C.ink, ...(k?.durum === 'kapandi' ? {} : { stroke: CERCEVE_HAP }) }]); }
    if (U.taslak) hap.push([U.taslak.x, U.taslak.y, `${ozet.data.taslaklar.length} taslak`, { fs: 11, fw: 500, col: C.ink2 }]);
    // en fazla 2 kilit parantezi: cümlelerdeki akışlar
    for (const [kod, tur] of Object.entries(isaret).slice(0, 2)) {
      const y = U.yer.find((q) => q.kod === kod); if (!y) continue;
      const w = y.rr * 2.8, h = y.rr * 2.32;
      s += tur === 'engel' ? brackets(y.x - w / 2, y.y - y.rr * .87, w, h, '#FF8A78', gCloud) : brackets(y.x - w / 2, y.y - y.rr * .87, w, h, '#FFD27A', gRings, true);
    }
    return { svg: s, U, olcek: null, konum, hap };
  }, [ozet.data, kap.data, detay, cumleler, NOW, serbest, genis]); // eslint-disable-line react-hooks/exhaustive-deps

  // pano (el notu 3–4): tutanak, durum süzgeci; seçilen süzgeç haritada eşleşmeyenleri söndürür
  const P = useMemo(() => pano(kartlar, detay, kisi), [ozet.data, detay, kisi]); // eslint-disable-line react-hooks/exhaustive-deps
  // pano listesi: detaylar gelmeden "iş yok" denmez (M-M3)
  const panoDurum: VeriDurumu = veriDurumu({ hata: DD.hata && P.eksik > 0, eksik: P.eksik });
  const [suz, setSuz] = useState<PanoTur | null>(null);
  const vurgu = useVurgu();
  useEffect(() => () => vurgula(null), []);
  const soluk = useMemo(() => {
    // masaüstünde paneldeki satırın üzerine gelinen akış dışındakiler söner (N15)
    if (genis && vurgu) return new Set([...kartlar, ...kapanan].map((k) => k.kod).filter((kod) => kod !== vurgu));
    return suz ? new Set(kartlar.map((k) => k.kod).filter((kod) => !P.adimlar[suz].some((a) => a.kod === kod))) : null;
  }, [suz, P, genis, vurgu]); // eslint-disable-line react-hooks/exhaustive-deps
  const panoRef = useRef<HTMLHeadingElement>(null);
  const olaylar = useOlaylar();
  const PL = usePanoListeleri(kartlar, detay, kisi);
  useEffect(() => { document.documentElement.classList.add('kaydir-otur'); return () => document.documentElement.classList.remove('kaydir-otur'); }, []);
  const E = useEvrenGezinme(EVREN_BOLGE, cizim && !cizim.olcek ? cizim : null, detay, kisi, NOW, undefined, soluk);
  // evren dili (madde 2, 3): "?" ile; ilk açılışta bir kez kendiliğinden tanıtılır
  const [lejant, setLejant] = useState(false);
  useEffect(() => { if (cizim && !cizim.olcek && evrenDiliGorulmeli()) setLejant(true); }, [!!cizim]); // eslint-disable-line react-hooks/exhaustive-deps
  const lejantKapat = () => { setLejant(false); try { localStorage.setItem(LEJANT_ANAHTAR, '1'); } catch { /* depolama kapalı */ } };

  if (ozet.isPending || (ozet.isError && !ozet.data)) return (
    <Sahne gok={{ tohum: 21, yildiz: 330 }} etiket="Evren">
      <AvatarAd ad={kisi} />
      <DurumNotu durum={ozet.isError ? 'hata' : 'yukleniyor'} ne="Akışlar" y={420} x={0} style={{ right: 0, justifyContent: 'center' }} yeniden={() => void ozet.refetch()} />
    </Sahne>
  );
  const bos = ozet.data && !kartlar.length && !ozet.data.taslaklar?.length;
  const avatar = () => git('/ayarlar?bolum=ben');
  if (bos) return <BosEvren ad={kisi} avatar={avatar} />;
  if (!cizim) return null;

  const panoOz = { P, suz, setSuz, soluk, durum: panoDurum, yeniden: DD.yeniden };
  // masaüstü kabuğu: ölçek düzeninde de aynı (K2); cümle ölçek cümlesi olur
  if (genis) return <EvrenGenis W={boy.w} H={boy.h} kisi={kisi} avatar={avatar} cizim={cizim} cumleler={cizim.olcek ? [{ metin: olcekCumlesi(kartlar, detay) }] : serbest ? [] : cumleler} kartlar={kartlar} kapanan={kapanan} detay={detay} taslak={ozet.data?.taslaklar?.length || 0} now={NOW} pano={panoOz} panel={panel} konum={konum} geri={geri} aktif={aktif} />;
  if (cizim.olcek) return <EvrenOlcek kisi={kisi} avatar={avatar} cizim={cizim} kartlar={kartlar} kapanan={kapanan} detay={detay} now={NOW} pano={panoOz} />;
  // cümleler: glif + en çok iki satır (Caladea 17.5/22, x 56)
  let y = 113;
  const satirlar = cumleler.slice(0, 2).map((c) => {
    const s = doluSatir(c.metin, 316), y0 = y;
    y += s.length * 22 + 10;
    return { c, s, y: y0 };
  });
  const tum = [...kartlar, ...kapanan];
  const goster = suz ?? P.varsayilan;
  const PY = panoYerlesimi(P, goster ? P.adimlar[goster].length : 0, PANO_Y, sonHareketler(olaylar.data?.olaylar).length, 54, PL.katilimcilar.length, PL.akislar.length);
  const panoAc = () => panoRef.current?.scrollIntoView({ behavior: hareketAz() ? 'auto' : 'smooth', block: 'start' });

  return (
    <Sahne yukseklik={Math.max(PY.son + 110, PANO_Y + 844)} gok={{ tohum: 21, yildiz: 330, sakin: [195, 470, 200] }} cizim={(E.sonuc?.svg ?? '') + satirlar.map(({ c, y: yy }) => c.tur === 'engel' ? iconCloud(32, yy - 5, .55) : c.tur === 'bekleme' ? iconRings(32, yy - 3, .72) : '').join('')} etiket="Evren">
      <span className="kaydir-durak" style={{ top: 0 }} aria-hidden />
      <AvatarAd ad={kisi} ac={avatar} />
      <Zil y={36} />
      {satirlar.map(({ c, s, y: yy }) => (
        <Metin key={c.metin} y={yy} x={56} fs={17.5} lh={22} serif as="p" style={{ whiteSpace: s.length > 1 ? 'nowrap' : undefined }}>
          {s.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}
        </Metin>
      ))}
      {satirlar.map(({ c, s, y: yy }) => c.kod && c.no != null && <CumleHedef key={'h' + c.metin} c={c} x={20} y={metinUst(yy, 17.5, 22, true) - 4} w={350} h={s.length * 22 + 8} />)}
      <EvrenHedefleri E={E} b={EVREN_BOLGE} yer={cizim.U.yer} tum={tum} detay={detay} taslak={cizim.U.taslak ? { ...cizim.U.taslak, n: ozet.data.taslaklar.length } : null} minR={24} kaydir />
      <YakinDugmeleri gz={E.gz} x={390 - 62} y={EVREN_BOLGE.y + 4} hep={false} lejant={() => setLejant(true)} />
      {suz && <button type="button" className="harita-suzgec" style={{ top: EVREN_BOLGE.y + 8 }} onClick={() => setSuz(null)} aria-label={`Süzgeç: ${PANO_AD[suz]}. Kaldır.`}>{PANO_AD[suz]} · {P.adimlar[suz].length}</button>}
      <button type="button" className="bolum-ipucu nav-ustu" style={{ '--ust': '724px' } as React.CSSProperties} onClick={panoAc}>Pano ve bekleyen işler</button>
      <EvrenPano ref={panoRef} P={P} y0={PANO_Y} ben={kisi} kartlar={kartlar} detay={detay} goster={goster} secili={suz} sec={setSuz} durum={panoDurum} yeniden={DD.yeniden} />
      <AltGezinme aktif="evren" yeni={() => git('/yeni')} />
      <Lejant acik={lejant} kapat={lejantKapat} yuzey="evren" sayilar={evrenSayilari(kartlar, detay)} />
    </Sahne>
  );
}

/** J1 cümlesi: "16 akış sürüyor; 3 karar seni bekliyor. En dar pay Test Bank’te: 6 gün." */
export function olcekCumlesi(kartlar: any[], detay: Record<string, any>): string {
  const karar = kartlar.filter((k) => detay[k.kod]?.adimlar?.some((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor'))).length;
  const bir = `${kartlar.length} akış sürüyor${karar ? `; ${karar} karar seni bekliyor` : ''}.`;
  const p = hedefParcasi(kartlar);
  return p ? `${bir} ${p[0].toLocaleUpperCase('tr')}${p.slice(1)}.` : bir;
}

type PanoOz = { P: ReturnType<typeof pano>; suz: PanoTur | null; setSuz: (t: PanoTur | null) => void; soluk: Set<string> | null; durum: VeriDurumu; yeniden: () => void };
function EvrenOlcek({ kisi, avatar, cizim, kartlar, kapanan, detay, now, pano: { P, suz, setSuz, soluk, durum, yeniden } }: { kisi: string; avatar: () => void; cizim: any; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; now: number; pano: PanoOz }) {
  const tum = [...kartlar, ...kapanan];
  const cumle = doluSatir(olcekCumlesi(kartlar, detay), 340, '17.5px Caladea', 3);
  const O = cizim.olcek;
  const E = useEvrenGezinme(EVREN_BOLGE, cizim, detay, kisi, now, undefined, soluk);
  const panoRef = useRef<HTMLHeadingElement>(null);
  const olaylar = useOlaylar();
  const PL = usePanoListeleri(kartlar, detay, kisi);
  const goster = suz ?? P.varsayilan, PY = panoYerlesimi(P, goster ? P.adimlar[goster].length : 0, PANO_Y, sonHareketler(olaylar.data?.olaylar).length, 54, PL.katilimcilar.length, PL.akislar.length);
  return (
    <Sahne yukseklik={Math.max(PY.son + 110, PANO_Y + 844)} gok={{ tohum: 21, yildiz: 330, sakin: [195, 452, 190] }} cizim={E.sonuc?.svg ?? ''} etiket="Evren">
      <span className="kaydir-durak" style={{ top: 0 }} aria-hidden />
      <AvatarAd ad={kisi} ac={avatar} />
      <Zil y={36} />
      <Metin y={112} fs={17.5} lh={23} serif as="p" style={{ whiteSpace: 'nowrap' }}>{cumle.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
      <EvrenHedefleri E={E} b={EVREN_BOLGE} yer={O.yer} tum={tum} detay={detay} minR={16} kaydir />
      {O.kapanan > 0 && <button className="gezegen-hedef" style={{ left: O.kapananHap.x - 44, top: O.kapananHap.y - 22, width: 88, height: 44 }} aria-label={`${O.kapanan} kapandı`} onClick={() => git('/akislar/arsiv')} />}
      <YakinDugmeleri gz={E.gz} x={390 - 62} y={EVREN_BOLGE.y + 4} hep={false} />
      {suz && <button type="button" className="harita-suzgec" style={{ top: EVREN_BOLGE.y + 8 }} onClick={() => setSuz(null)} aria-label={`Süzgeç: ${PANO_AD[suz]}. Kaldır.`}>{PANO_AD[suz]} · {P.adimlar[suz].length}</button>}
      <button type="button" className="bolum-ipucu nav-ustu" style={{ '--ust': '724px' } as React.CSSProperties} onClick={() => panoRef.current?.scrollIntoView({ behavior: hareketAz() ? 'auto' : 'smooth', block: 'start' })}>Pano ve bekleyen işler</button>
      <EvrenPano ref={panoRef} P={P} y0={PANO_Y} ben={kisi} kartlar={kartlar} detay={detay} goster={goster} secili={suz} sec={setSuz} durum={durum} yeniden={yeniden} />
      <AltGezinme aktif="evren" yeni={() => git('/yeni')} />
    </Sahne>
  );
}

/** M2 · Masaüstü evren (≥ 1280): solda usturlap ×1.6, iki cümle tek satır; sağda 440 px panel (§5 M2). */
/** Masaüstü paneli (N10): telefondaki pano bölümü aynen; başlık, cümle, süzgeç, bekleyen işler, akışlar, katılımcılar. */
function PanoPanel({ P, kisi, kartlar, detay, suz, setSuz, durum, yeniden }: { P: PanoV; kisi: string; kartlar: any[]; detay: Record<string, any>; suz: PanoTur | null; setSuz: (t: PanoTur | null) => void; durum: VeriDurumu; yeniden: () => void }) {
  const olaylar = useOlaylar();
  const PL = usePanoListeleri(kartlar, detay, kisi);
  const goster = suz ?? P.varsayilan;
  const Y = panoYerlesimi(P, goster ? P.adimlar[goster].length : 0, 8, sonHareketler(olaylar.data?.olaylar).length, 54, PL.katilimcilar.length, PL.akislar.length);
  return (
    <Sahne gok={{}} etiket="Pano" yukseklik={Y.son + 40}>
      <EvrenPano P={P} y0={8} ben={kisi} kartlar={kartlar} detay={detay} goster={goster} secili={suz} sec={setSuz} durum={durum} yeniden={yeniden} />
    </Sahne>
  );
}

function EvrenGenis({ W, H, kisi, avatar, cizim, cumleler, kartlar, kapanan, detay, taslak, now, pano: { P, suz, setSuz, soluk, durum, yeniden }, panel, konum, geri, aktif }: { W: number; H: number; kisi: string; avatar: () => void; cizim: any; cumleler: any[]; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; taslak: number; now: number; pano: PanoOz; panel?: ReactNode; konum?: string; geri?: () => void; aktif: KabukSekme }) {
  // usturlap cümlelerin altında kalır (N7): halka + ay adları (tasarımda R + 30) cümle alanına ve alttaki gezinmeye binmez;
  // yer yetmezse küçülür
  const PW = PANEL_EN, X = W - PW, cumleAlti = cumleler.length ? 118 + (Math.min(2, cumleler.length) - 1) * 44 + 26 : 96, DIS = 200;
  const k = Math.min(1.6 * Math.min((W - PW) / 1000, H / 900), (H - 76 - cumleAlti) / (2 * DIS));
  const tx = (W - PW) * .52 - 195 * k, ty = Math.max(H * .547, cumleAlti + DIS * k) - 470 * k;
  const tum = [...kartlar, ...kapanan];
  const [lejant, setLejant] = useState(false);
  const B: Bolge = useMemo(() => ({ x: 0, y: Math.min(190, cumleAlti), w: X, h: H - Math.min(190, cumleAlti) }), [X, H, cumleAlti]);
  const taban = useMemo(() => ({ k, x: tx, y: ty }), [k, tx, ty]);
  const E = useEvrenGezinme(B, cizim, detay, kisi, now, taban, soluk);
  let svg = E.sonuc?.svg ?? '';
  svg += `<rect x="${X}" y="0" width="${PW}" height="${H}" fill="url(#sheet)"/><rect x="${X}" y="0" width="${PW}" height="${H}" filter="url(#paper)" opacity=".5"/><rect x="${X}" y="0" width="1" height="${H}" fill="#FFC9A3" opacity=".35"/>`;
  cumleler.slice(0, 2).forEach((c, i) => { svg += c.tur === 'engel' ? iconCloud(58, 112 + i * 44, .6) : c.tur === 'bekleme' ? iconRings(58, 112 + i * 44, .78) : ''; });
  return (
    <GenisSahne gok={{ tohum: 121, yildiz: 330, parilti: 14 }} w={W} h={H} cizim={svg} etiket="Evren">
      <button type="button" className="avatar-dugme genis-geri" style={{ left: 34, top: 36 }} onClick={avatar} aria-label={`${kisi} · hesap ve çalışma alanı`}>
        <svg aria-hidden width="44" height="44" viewBox="-22 -22 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -20, 'insan', (kisi[0] || '?').toLocaleUpperCase('tr'), C.peach, 1.1, { flame: false }) }} />
      </button>
      <Metin y={64} x={80} fs={17} agirlik={650} style={{ right: 'auto', pointerEvents: 'none' }}>{kisi}</Metin>
      {cumleler.slice(0, 2).map((c, i) => <Metin key={c.metin} y={118 + i * 44} x={86} fs={19} lh={25} serif as="p" style={{ whiteSpace: 'nowrap', right: 'auto' }}>{c.metin}</Metin>)}
      {cumleler.slice(0, 2).map((c, i) => c.kod && c.no != null && <CumleHedef key={'h' + c.metin} c={c} x={40} y={metinUst(118 + i * 44, 19, 25, true) - 6} w={Math.min(X - 80, 760)} h={36} />)}
      <EvrenHedefleri E={E} b={B} yer={cizim.U.yer} tum={tum} detay={detay} taslak={cizim.U.taslak ? { ...cizim.U.taslak, n: taslak } : null} minR={24} />
      <YakinDugmeleri gz={E.gz} x={X - 68} y={B.y + 8} hep lejant={() => setLejant(true)} />
      {suz && <button type="button" className="harita-suzgec" style={{ top: B.y + 8, left: 40 }} onClick={() => setSuz(null)} aria-label={`Süzgeç: ${PANO_AD[suz]}. Kaldır.`}>{PANO_AD[suz]} · {P.adimlar[suz].length}</button>}
      <Lejant acik={lejant} kapat={() => setLejant(false)} yuzey="evren" sayilar={evrenSayilari(kartlar, detay)} />
      <YuzenGezinme aktif={aktif} solEn={X} />
      {/* pano (N10): telefondaki panoyla aynı bölüm, panelde kayar */}
      {panel ? <KabukPanel X={X} H={H} geri={geri} konum={konum}>{panel}</KabukPanel>
        : <KabukPanel X={X} H={H} konum="Pano"><PanoPanel P={P} kisi={kisi} kartlar={kartlar} detay={detay} suz={suz} setSuz={setSuz} durum={durum} yeniden={yeniden} /></KabukPanel>}
    </GenisSahne>
  );
}

/**
 * Akışlar haritası (N15): galaksiler 390 tasarım karesinde serbest dizilir (sıra: verilen sıra, sol üstten);
 * boy adım sayısıyla, satırlar yarım hücre kayık (bal peteği), konum akış koduna bağlı küçük sapmayla.
 */
export function serbestDizilim(G: { kod: string; adim: number }[]): { kod: string; x: number; y: number; r: number }[] {
  const n = G.length; if (!n) return [];
  const kx = 20, ky = 250, kw = 350, kh = 440;
  const sutun = Math.max(1, Math.round(Math.sqrt(n * kw / kh))), satir = Math.ceil(n / sutun);
  const hw = kw / sutun, hh = kh / satir, enAdim = Math.max(1, ...G.map((g) => g.adim));
  const rMax = Math.min(hw, hh) * .3;
  const sapma = (kod: string, i: number) => { let h = 7 + i; for (const c of kod) h = (h * 31 + c.charCodeAt(0)) % 997; return (h / 997 - .5); };
  return G.map((g, i) => {
    const sa = Math.floor(i / sutun), su = i % sutun, kayik = sa % 2 ? hw / 4 : -hw / 4;
    const x = kx + hw * (su + .5) + (sutun > 1 ? kayik : 0) + sapma(g.kod, 1) * hw * .18;
    const y = ky + hh * (sa + .5) - 8 + sapma(g.kod, 2) * hh * .16;
    return { kod: g.kod, x, y, r: rMax * (.62 + .38 * Math.sqrt(g.adim / enAdim)) };
  });
}
