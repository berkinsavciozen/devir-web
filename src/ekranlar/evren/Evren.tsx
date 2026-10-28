import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { SAHTE, simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { useOlaylar, UstDugmeler } from '../../bilesen/Zil';
import { GenisSahne, Metin, Sahne } from '../../bilesen/Sahne';
import { useBoyut } from '../../bilesen/Gok';
import { KabukPanel, masaustu, PANEL_EN, YuzenGezinme, type KabukSekme } from '../../bilesen/Kabuk';
import { useVurgu, vurgula } from '../../bilesen/vurgu';
import { CERCEVE, CERCEVE_HAP, cerceve, evrenOlcek, hapEni, usturlap } from '../../cizim/ekran';
import { akisModeli, gunAy, yolCiz } from '../../cizim/yol.js';
import { C, pill, ship } from '../../cizim/ortak.js';
import { akisAdi, yaziTipleriHazir } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { tanitimGorulmeli } from './Tanitim';
import { yakinlas } from '../../cizim/yakinlas';
import { AvatarAd, BosEvren } from './BosEvren';
import { evrenCumleleri } from './cumleler';
import { evrenTakvimi } from '../../geometri/evren';
import { haritaCercevesi, useGezinme, type Bolge } from '../akis/gezinme';
import { bos, type Daire } from '../akis/katman';
import { evrenSayilari, Lejant, SoruIkon, type OdakAyar } from '../akis/Lejant';
import { hareketAz } from '../../ayar/hareket';
import { PANO_AD, pano, type Pano as PanoV, type PanoTur } from './pano';
import { EvrenPano, panoYerlesimi, sonHareketler, usePanoListeleri } from './Pano';
import { DurumNotu, veriDurumu, type VeriDurumu } from '../../bilesen/VeriDurumu';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { HaritaCipleri, type HaritaCipi } from '../akis/HaritaSuzgec';
import { hedefEtiketi } from '../../bilesen/KararSeridi';
import { akisIlerlemesi, ilerlemeMetni } from '../../api/ilerleme';

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
function useEvrenGezinme(b: Bolge, cizim: { svg: string; konum: Record<string, GYer>; hap: Hap[]; serbest?: boolean } | null, detay: Record<string, any>, kisi: string, now: number, taban = { k: 1, x: 0, y: 0 }, soluk?: Set<string> | null) {
  const ref = useRef<(kod: string) => void>(() => {});
  // en büyük galaksi ekranın yaklaşık yarısını doldurunca yakınlaşma durur; daha da açmak o akışa girer (el notu 6)
  const enR = Math.max(8, ...Object.values(cizim?.konum || {}).map((g) => g.r)) * taban.k;
  // serbest düzen (Akışlar, 3.31): yakınlaşma yok
  const gz = useGezinme(b, { max: cizim?.serbest ? 1 : Math.max(2.5, Math.min(6, b.w * .42 / (enR * 1.35))), asiri: (p) => ref.current(enYakin(p)) });
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
    const svg = `${haritaCercevesi('evren-kirp', b)}<g class="evren-olcekli${k > 1.6 ? ' yazisiz' : ''}">${sar(tabanSvg, K, TX, TY)}</g>${ayrinti.map((a) => sonuk(a.kod, a.Y.svg)).join('')}${haplar(true)}</g>`;
    return { svg, ayrinti };
  }, [cizim, kucukler, gz.yaklasik, k, tx, ty, detay, kisi, now, b, taban.k, taban.x, taban.y, soluk]); // eslint-disable-line react-hooks/exhaustive-deps
  return { gz, sonuc, ekran, girisRef: ref };
}

/** Evren dokunma katmanı: galaksiler (dokun → Z1), yakınken adımlar ve kişiler. */
function EvrenHedefleri({ E, b, yer, tum, detay, taslak, merkez, minR = 22 }: { E: ReturnType<typeof useEvrenGezinme>; b: Bolge; yer: { kod: string; x: number; y: number; rr: number }[]; tum: any[]; detay: Record<string, any>; taslak?: { x: number; y: number; n: number } | null; merkez?: { x: number; y: number; n: number } | null; minR?: number }) {
  const { gz, sonuc, ekran } = E;
  // en yakında daha da yaklaşmak akışa kendiliğinden girmez; önce sorulur (plan 27 Eki, 3.28)
  const [gecis, setGecis] = useState<string | null>(null);
  E.girisRef.current = (kod) => { if (kod) setGecis(kod); };
  const gec = (kod: string) => { setGecis(null); const el = document.querySelector<HTMLElement>(`[data-kod="${CSS.escape(kod)}"]`); if (el) yakinlas(kod, el); else git(`/akis/${encodeURIComponent(kod)}`); };
  const gecisAd = gecis ? (() => { const k = tum.find((x) => x.kod === gecis); return k ? akisAdi(k) : gecis; })() : '';
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
    <div ref={gz.ref} className="harita-gezinme" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} {...gz.olaylar}>
      <div role="list" aria-label="Akışlar" className="harita-katman" style={{ left: -b.x, top: -b.y }}>
        {hedef.map((h) => <button key={h.key} role="listitem" data-kod={h.kod} className="gezegen-hedef" style={{ left: h.x - h.r, top: h.y - h.r, width: h.r * 2, height: h.r * 2 }} aria-label={h.etiket} data-ipucu={h.ipucu} onClick={h.tikla}
          onMouseEnter={h.kod ? () => vurgula(h.kod!) : undefined} onMouseLeave={h.kod ? () => vurgula(null) : undefined} />)}
        {/* merkez = bitti (karar 3.I): dokununca kapanan akışlar */}
        {merkez && merkez.n > 0 && (() => { const e = ekran({ x: merkez.x, y: merkez.y, r: 1, pr: 0 }); return gor(e.x, e.y) && <button role="listitem" className="gezegen-hedef" style={{ left: e.x - 22, top: e.y - 22, width: 44, height: 44 }} aria-label={`${merkez.n} akış bitti. Biten akışları aç.`} data-ipucu={`${merkez.n} akış bitti`} onClick={() => git('/akislar/arsiv')} />; })()}
        {taslak && (() => { const e = ekran({ x: taslak.x, y: taslak.y, r: 1, pr: 0 }); return gor(e.x, e.y) && <button className="gezegen-hedef" style={{ left: e.x - 52 * e.r, top: e.y - 58 * e.r, width: 104 * e.r, height: 72 * e.r }} aria-label={`${taslak.n} taslak`} onClick={() => git('/yeni')} />; })()}
      </div>
      {gecis && (
        <div className="gecis-onay" role="dialog" aria-label="Akışa geçiş" style={{ bottom: 12 }} onPointerDown={(e) => e.stopPropagation()}>
          <p>{gecisAd} akışına geçilsin mi?</p>
          <button type="button" onClick={() => setGecis(null)}>Kal</button>
          <button type="button" className="birincil" onClick={() => gec(gecis)}>Geç</button>
        </div>
      )}
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


/** Mobil evrende gezinme alanı: üst düğmelerin altı, pano ipucunun üstü (plan 27 Eki, 2.3: üst cümleler kalktı). */
const EVREN_BOLGE: Bolge = { x: 0, y: 92, w: 390, h: 624 };
/** Mobil usturlap ve J1 ölçek merkezi: gezinme alanının ortası */
const EVREN_MERKEZ = { cx: 195, cy: 410, R: 170 }, OLCEK_MERKEZ = { cx: 195, cy: 404, R: 158 };
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
  // akış süzgeci (3.30, karar 3.J): 10'dan çok akışta ilk açılışta en riskli 10; seçim 10'u aşarsa ölçek düzeni
  const [akisSecim, setAkisSecim] = useState<string[] | null>(null);
  const [secimAcik, setSecimAcik] = useState(false);
  const riskSirasi = useMemo(() => enRiskliSirasi(kartlar, detay, cumleler), [ozet.data, detay, cumleler]); // eslint-disable-line react-hooks/exhaustive-deps
  const secili = kartlar.length > OLCEK ? new Set(akisSecim ?? riskSirasi.slice(0, OLCEK)) : null;
  const tumKartlar = kartlar;
  const cizim = useMemo(() => {
    const kartlar = secili ? tumKartlar.filter((k) => secili.has(k.kod)) : tumKartlar;
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
      const S = serbestDizilim([...sira, ...kapanan.slice(0, 6)].map((k) => ({ kod: k.kod, adim: say(k)[1], ad: akisAdi(k) })));
      let s = '';
      for (const g of S) { konum[g.kod] = { x: g.x, y: g.y, r: g.r, pr: 1.8 }; s += cerceve(g.x, g.y, g.r) + yerTutucu(g.kod); }
      for (const g of S) { const k = tum.find((x) => x.kod === g.kod); if (k) hap.push([g.x, g.y + g.r + CERCEVE, akisAdi(k), { fs: 11.5, fw: 650, col: C.ink, stroke: CERCEVE_HAP }]); }
      return { svg: s, U: { yer: S.map((g) => ({ kod: g.kod, x: g.x, y: g.y, rr: g.r })), taslak: null, merkez: null }, olcek: null, konum, hap, serbest: true };
    }
    // J1: çok akışta ölçek düzeni (§4.14)
    if (kartlar.length > OLCEK) {
      // takvim veriden (J1 sarma hatası: sabit Eki–Ara penceresinde 2027 hedefi başa dolanırdı)
      const takvim = evrenTakvimi(kartlar.filter((k) => k.hedef_tarih).map((k) => ({ t0: tarihMs(k.olusturuldu || k.son_hareket || k.hedef_tarih), hedef: tarihMs(k.hedef_tarih) })), NOW);
      const O = evrenOlcek({
        simdi: NOW, takvim, c: genis ? undefined : OLCEK_MERKEZ,
        akislar: [
          ...kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k) })),
          ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
        ],
        kucuk: (kod, x, y, r, pr) => { konum[kod] = { x, y, r, pr }; return yerTutucu(kod); },
      });
      let s = O.svg;
      for (const e of O.etiketler) { const k = tum.find((x) => x.kod === e.kod); if (k) hap.push([e.etiket.x, e.etiket.y, akisAdi(k), { fs: 10.5, fw: 650 }]); }
      return { svg: s, U: { yer: O.yer, taslak: null, merkez: O.merkez }, olcek: O, konum, hap };
    }
    // evren matematiği (madde 5): başlangıç, pay, adım sayısı, biten ve kişiler; takvim veriden
    const kisileri = (k: any) => [...new Set<string>((detay[k.kod]?.adimlar || []).map((a: any) => a.sahip))];
    const aktifler = kartlar.filter((k) => k.hedef_tarih).map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih), isaret: isaret[k.kod], karar: kararli(k), bitti: k.ilerleme && k.ilerleme.tamam === k.ilerleme.toplam,
      t0: tarihMs(k.olusturuldu || k.son_hareket || k.hedef_tarih), payGun: k.pay_saat == null ? null : k.pay_saat / 24, adim: say(k)[1], biten: say(k)[0], kisiler: kisileri(k) }));
    const takvim = evrenTakvimi([...aktifler, ...kapanan.filter((k) => k.kapandi_at && tarihMs(k.kapandi_at) > NOW - 45 * 864e5).map((k) => ({ t0: tarihMs(k.kapandi_at), hedef: tarihMs(k.kapandi_at) }))], NOW);
    const U = usturlap({
      simdi: NOW, oran: toplam ? tamam / toplam : 0, taslak: ozet.data.taslaklar?.length || 0, takvim, c: genis ? undefined : EVREN_MERKEZ,
      akislar: [
        ...aktifler,
        ...kapanan.map((k) => ({ kod: k.kod, ad: akisAdi(k), hedef: tarihMs(k.hedef_tarih || k.kapandi_at), kapandi: tarihMs(k.kapandi_at || k.son_hareket), bitti: true })),
      ],
      kucuk: (kod, x, y, r, pr) => { konum[kod] = { x, y, r, pr }; return yerTutucu(kod); },
    });
    let s = U.svg;
    // haplar: bugün, galaksi adları, taslak
    hap.push([U.hap.x, U.hap.y, gunAy(NOW), { fs: 11.5, fw: 700, bg: '#FFC9A3', bgo: 1, col: '#2A1D4F', w: 54 }]);
    for (const y of U.yer) { const k = tum.find((q) => q.kod === y.kod); if (!y.etiket.w) continue; hap.push([y.etiket.x, y.etiket.y, k ? akisAdi(k) : y.kod, { fs: 11.5, fw: 650, col: C.ink, ...(k?.durum === 'kapandi' ? {} : { stroke: CERCEVE_HAP }) }]); }
    if (U.taslak) hap.push([U.taslak.x, U.taslak.y, `${ozet.data.taslaklar.length} taslak`, { fs: 11, fw: 500, col: C.ink2 }]);
    return { svg: s, U, olcek: null, konum, hap };
  }, [ozet.data, kap.data, detay, cumleler, NOW, serbest, genis, akisSecim]); // eslint-disable-line react-hooks/exhaustive-deps
  const secimOz: AkisSecimOz | null = secili && !(serbest && genis) ? { kartlar: riskSirasi.map((kod) => tumKartlar.find((k) => k.kod === kod)).filter(Boolean), secili, sec: setAkisSecim, acik: secimAcik, ac: setSecimAcik } : null;

  // pano (el notu 3–4): tutanak, durum süzgeci; seçilen süzgeç haritada eşleşmeyenleri söndürür
  const P = useMemo(() => pano(kartlar, detay, kisi), [ozet.data, detay, kisi]); // eslint-disable-line react-hooks/exhaustive-deps
  // pano listesi: detaylar gelmeden "iş yok" denmez (M-M3)
  const panoDurum: VeriDurumu = veriDurumu({ hata: DD.hata && P.eksik > 0, eksik: P.eksik });
  const [suz, setSuz] = useState<PanoTur | null>(null);
  // kişi odağı (plan 27 Eki, 2.C): o kişinin işi olmayan akışlar söner
  const [kisiOdak, setKisiOdak] = useState<string | null>(null);
  const vurgu = useVurgu();
  useEffect(() => () => vurgula(null), []);
  const soluk = useMemo(() => {
    // masaüstünde paneldeki satırın üzerine gelinen akış dışındakiler söner (N15)
    if (genis && vurgu) return new Set([...kartlar, ...kapanan].map((k) => k.kod).filter((kod) => kod !== vurgu));
    if (!suz && !kisiOdak) return null;
    return new Set(kartlar.map((k) => k.kod).filter((kod) => (suz && !P.adimlar[suz].some((a) => a.kod === kod))
      || (kisiOdak && !(detay[kod]?.adimlar || []).some((a: any) => a.sahip === kisiOdak && !['tamam', 'atlandi', 'ertelendi'].includes(a.durum)))));
  }, [suz, kisiOdak, P, genis, vurgu, detay]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const odak: OdakAyar = {
    kisiler: [...new Set<string>(kartlar.flatMap((k) => (detay[k.kod]?.adimlar || []).map((a: any) => a.sahip)))].sort((a, b) => a.localeCompare(b, 'tr')),
    kisi: kisiOdak, kisiSec: setKisiOdak,
    durumlar: (Object.keys(PANO_AD) as PanoTur[]).map((k) => ({ k, ad: PANO_AD[k], n: P.adimlar[k].length })),
    durum: suz, durumSec: (k) => setSuz(k as PanoTur | null),
  };
  const panoOz = { P, suz, setSuz, soluk, durum: panoDurum, yeniden: DD.yeniden, odak };
  // masaüstü kabuğu: ölçek düzeninde de aynı (K2); cümle ölçek cümlesi olur
  if (genis) return <EvrenGenis W={boy.w} H={boy.h} kisi={kisi} avatar={avatar} cizim={cizim} kartlar={kartlar} kapanan={kapanan} detay={detay} taslak={ozet.data?.taslaklar?.length || 0} now={NOW} pano={panoOz} panel={panel} konum={konum} geri={geri} aktif={aktif} secim={secimOz} />;
  if (cizim.olcek) return <EvrenOlcek kisi={kisi} avatar={avatar} cizim={cizim} kartlar={kartlar} kapanan={kapanan} detay={detay} now={NOW} pano={panoOz} secim={secimOz} />;
  const tum = [...kartlar, ...kapanan];
  const goster = suz ?? P.varsayilan;
  const PY = panoYerlesimi(P, goster ? P.adimlar[goster].length : 0, PANO_Y, sonHareketler(olaylar.data?.olaylar).length, 54, PL.katilimcilar.length, PL.akislar.length);
  const panoAc = () => panoRef.current?.scrollIntoView({ behavior: hareketAz() ? 'auto' : 'smooth', block: 'start' });

  return (
    <Sahne yukseklik={Math.max(PY.son + 110, PANO_Y + 844)} gok={{ tohum: 21, yildiz: 330, sakin: [195, EVREN_MERKEZ.cy, 200] }} cizim={E.sonuc?.svg ?? ''} etiket="Evren">
      <span className="kaydir-durak" style={{ top: 0 }} aria-hidden />
      <AvatarAd ad={kisi} ac={avatar} />
      <UstDugmeler y={36} />
      <EvrenHedefleri E={E} b={EVREN_BOLGE} yer={cizim.U.yer} tum={tum} detay={detay} taslak={cizim.U.taslak ? { ...cizim.U.taslak, n: ozet.data.taslaklar.length } : null} merkez={cizim.U.merkez} minR={24} />
      <YakinDugmeleri gz={E.gz} x={390 - 62} y={EVREN_BOLGE.y + 4} hep={false} />
      <EvrenCipleri o={odak} P={P} secim={secimOz} x={12} y={EVREN_BOLGE.y + 4} en={390 - 82} lejant={() => setLejant(true)} />
      <button type="button" className="bolum-ipucu nav-ustu" style={{ '--ust': '724px' } as React.CSSProperties} onClick={panoAc}>Pano ve bekleyen işler</button>
      <EvrenPano ref={panoRef} P={P} y0={PANO_Y} ben={kisi} kartlar={kartlar} detay={detay} goster={goster} secili={suz} sec={setSuz} durum={panoDurum} yeniden={DD.yeniden} />
      <AltGezinme aktif="evren" yeni={() => git('/yeni')} />
      <Lejant acik={lejant} kapat={lejantKapat} yuzey="evren" sayilar={evrenSayilari(kartlar, detay)} odak={odak} />
    </Sahne>
  );
}

/** En riskli sıra (karar 3.J): engelli, karar bekleyen, sonra payı en az olan. */
export function enRiskliSirasi(kartlar: any[], detay: Record<string, any>, cumleler: { kod?: string; tur?: string }[]): string[] {
  const engel = new Set(cumleler.filter((c) => c.tur === 'engel' && c.kod).map((c) => c.kod!));
  const engelli = (k: any) => engel.has(k.kod) || !!detay[k.kod]?.adimlar?.some((a: any) => a.durum === 'engelli');
  const karar = (k: any) => !!detay[k.kod]?.adimlar?.some((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor'));
  const puan = (k: any) => (engelli(k) ? 0 : karar(k) ? 1 : 2);
  return [...kartlar].sort((a, b) => puan(a) - puan(b) || (a.pay_saat ?? 1e9) - (b.pay_saat ?? 1e9) || String(a.kod).localeCompare(String(b.kod))).map((k) => k.kod);
}
type AkisSecimOz = { kartlar: any[]; secili: Set<string>; sec: (k: string[] | null) => void; acik: boolean; ac: (a: boolean) => void };
/** Akış süzgeci kutusu (3.30): sıra en riskliden; 10'dan çok seçilirse ölçek düzeni. Seçim Uygula ile geçer (plan 28 Eki, B6). */
function AkisSecimKutusu({ s }: { s: AkisSecimOz }) {
  const N = s.kartlar.length;
  const [b, setB] = useState<Set<string>>(s.secili);
  useEffect(() => { if (s.acik) setB(new Set(s.secili)); }, [s.acik]); // eslint-disable-line react-hooks/exhaustive-deps
  const degistir = (kod: string) => { const y = new Set(b); if (y.has(kod)) { if (y.size > 1) y.delete(kod); } else y.add(kod); setB(y); };
  const enRiskli = () => setB(new Set(s.kartlar.slice(0, OLCEK).map((k) => k.kod)));
  const kapat = () => s.ac(false);
  const ayni = b.size === s.secili.size && [...b].every((k) => s.secili.has(k));
  const alt = <><Dugme tur="ikincil" yukseklik={48} onClick={kapat}>Vazgeç</Dugme><Dugme yukseklik={48} onClick={() => { if (!ayni) s.sec([...b]); kapat(); }}>Uygula</Dugme></>;
  return (
    <AltSayfa acik={s.acik} kapat={kapat} baslik="Haritadaki akışlar" yukseklik="yuksek" kutu alt={alt}>
      <div className="akis-secim">
        <div className="odak-cipler">
          <button type="button" className="filtre-cip" onClick={enRiskli}>En riskli {OLCEK}</button>
          <button type="button" className="filtre-cip" aria-pressed={b.size === N} onClick={() => setB(new Set(s.kartlar.map((k) => k.kod)))}>Hepsi</button>
        </div>
        <p className="lejant-not">{OLCEK} akışa kadar usturlap tam görünür; daha çoğu seçilince kalabalık düzene geçer. {b.size}/{N} seçili.</p>
        <ul aria-label="Akışlar">
          {s.kartlar.map((k) => <li key={k.kod}><button type="button" className="akis-secim-satir" aria-pressed={b.has(k.kod)} onClick={() => degistir(k.kod)}><span aria-hidden className="akis-secim-kutu" />{akisAdi(k)}</button></li>)}
        </ul>
      </div>
    </AltSayfa>
  );
}

type PanoOz = { P: ReturnType<typeof pano>; suz: PanoTur | null; setSuz: (t: PanoTur | null) => void; soluk: Set<string> | null; durum: VeriDurumu; yeniden: () => void; odak: OdakAyar };
/** Evrenin süzgeç satırı: "N/M akış ▾", evren dili, kişi ve durum çipleri (plan 28 Eki, B10, K9). */
function EvrenCipleri({ o, P, secim, x, y, en, lejant }: { o: OdakAyar; P: PanoV; secim: AkisSecimOz | null; x: number; y: number; en: number; lejant: () => void }) {
  const t = o.durum as PanoTur | null;
  const cipler = [o.kisi && { ad: o.kisi.replace(/\s*\(.*\)$/, ''), etiket: 'Kişi', kaldir: () => o.kisiSec(null) }, t && { ad: `${PANO_AD[t]} · ${P.adimlar[t].length}`, etiket: 'Durum', kaldir: () => o.durumSec(null) }].filter(Boolean) as HaritaCipi[];
  const n = secim?.secili.size ?? 0, N = secim?.kartlar.length ?? 0;
  return (
    <>
      <HaritaCipleri x={x} y={y} en={en} lejantAc={lejant} lejantEtiket="Evren dili" cipler={cipler}
        secici={secim ? { yazi: `${n}/${N} akış`, etiket: `Haritada ${n} / ${N} akış. Seç.`, ac: () => secim.ac(true) } : undefined} />
      {secim && <AkisSecimKutusu s={secim} />}
    </>
  );
}
function EvrenOlcek({ kisi, avatar, cizim, kartlar, kapanan, detay, now, pano: { P, suz, setSuz, soluk, durum, yeniden, odak }, secim }: { kisi: string; avatar: () => void; cizim: any; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; now: number; pano: PanoOz; secim: AkisSecimOz | null }) {
  const tum = [...kartlar, ...kapanan];
  const O = cizim.olcek;
  const E = useEvrenGezinme(EVREN_BOLGE, cizim, detay, kisi, now, undefined, soluk);
  const panoRef = useRef<HTMLHeadingElement>(null);
  const olaylar = useOlaylar();
  const PL = usePanoListeleri(kartlar, detay, kisi);
  const goster = suz ?? P.varsayilan, PY = panoYerlesimi(P, goster ? P.adimlar[goster].length : 0, PANO_Y, sonHareketler(olaylar.data?.olaylar).length, 54, PL.katilimcilar.length, PL.akislar.length);
  const [lejant, setLejant] = useState(false);
  return (
    <Sahne yukseklik={Math.max(PY.son + 110, PANO_Y + 844)} gok={{ tohum: 21, yildiz: 330, sakin: [195, OLCEK_MERKEZ.cy, 190] }} cizim={E.sonuc?.svg ?? ''} etiket="Evren">
      <span className="kaydir-durak" style={{ top: 0 }} aria-hidden />
      <AvatarAd ad={kisi} ac={avatar} />
      <UstDugmeler y={36} />
      <EvrenHedefleri E={E} b={EVREN_BOLGE} yer={O.yer} tum={tum} detay={detay} merkez={O.merkez} minR={16} />
      <YakinDugmeleri gz={E.gz} x={390 - 62} y={EVREN_BOLGE.y + 4} hep={false} />
      <EvrenCipleri o={odak} P={P} secim={secim} x={12} y={EVREN_BOLGE.y + 4} en={390 - 82} lejant={() => setLejant(true)} />
      <button type="button" className="bolum-ipucu nav-ustu" style={{ '--ust': '724px' } as React.CSSProperties} onClick={() => panoRef.current?.scrollIntoView({ behavior: hareketAz() ? 'auto' : 'smooth', block: 'start' })}>Pano ve bekleyen işler</button>
      <EvrenPano ref={panoRef} P={P} y0={PANO_Y} ben={kisi} kartlar={kartlar} detay={detay} goster={goster} secili={suz} sec={setSuz} durum={durum} yeniden={yeniden} />
      <AltGezinme aktif="evren" yeni={() => git('/yeni')} />
      <Lejant acik={lejant} kapat={() => setLejant(false)} yuzey="evren" sayilar={evrenSayilari(kartlar, detay)} odak={odak} />
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

function EvrenGenis({ W, H, kisi, avatar, cizim, kartlar, kapanan, detay, taslak, now, pano: { P, suz, setSuz, soluk, durum, yeniden, odak }, panel, konum, geri, aktif, secim }: { W: number; H: number; kisi: string; avatar: () => void; cizim: any; kartlar: any[]; kapanan: any[]; detay: Record<string, any>; taslak: number; now: number; pano: PanoOz; panel?: ReactNode; konum?: string; geri?: () => void; aktif: KabukSekme; secim: AkisSecimOz | null }) {
  // usturlap üst satırın altında kalır (N7; plan 27 Eki, 2.3: cümleler kalktı): halka + ay adları üst satıra ve alttaki
  // gezinmeye binmez; yer yetmezse küçülür
  const PW = PANEL_EN, X = W - PW, cumleAlti = 96, DIS = 200;
  const k = Math.min(1.6 * Math.min((W - PW) / 1000, H / 900), (H - 76 - cumleAlti) / (2 * DIS));
  const tx = (W - PW) * .52 - 195 * k, ty = Math.max(H * .547, cumleAlti + DIS * k) - 470 * k;
  const tum = [...kartlar, ...kapanan];
  const [lejant, setLejant] = useState(false);
  const B: Bolge = useMemo(() => ({ x: 0, y: Math.min(190, cumleAlti), w: X, h: H - Math.min(190, cumleAlti) }), [X, H, cumleAlti]);
  const taban = useMemo(() => ({ k, x: tx, y: ty }), [k, tx, ty]);
  const E = useEvrenGezinme(B, cizim, detay, kisi, now, taban, soluk);
  let svg = E.sonuc?.svg ?? '';
  svg += `<rect x="${X}" y="0" width="${PW}" height="${H}" fill="url(#sheet)"/><rect x="${X}" y="0" width="${PW}" height="${H}" filter="url(#paper)" opacity=".5"/><rect x="${X}" y="0" width="1" height="${H}" fill="#FFC9A3" opacity=".35"/>`;
  return (
    <GenisSahne gok={{ tohum: 121, yildiz: 330, parilti: 14 }} w={W} h={H} cizim={svg} etiket="Evren">
      <button type="button" className="avatar-dugme genis-geri" style={{ left: 34, top: 36 }} onClick={avatar} aria-label={`${kisi} · hesap ve çalışma alanı`}>
        <svg aria-hidden width="44" height="44" viewBox="-22 -22 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -20, 'insan', (kisi[0] || '?').toLocaleUpperCase('tr'), C.peach, 1.1, { flame: false }) }} />
      </button>
      <Metin y={64} x={80} fs={17} agirlik={650} style={{ right: 'auto', pointerEvents: 'none' }}>{kisi}</Metin>
      <EvrenHedefleri E={E} b={B} yer={cizim.U.yer} tum={tum} detay={detay} taslak={cizim.U.taslak ? { ...cizim.U.taslak, n: taslak } : null} merkez={cizim.U.merkez} minR={24} />
      <YakinDugmeleri gz={E.gz} x={X - 68} y={B.y + 8} hep={!cizim.serbest} />
      <EvrenCipleri o={odak} P={P} secim={secim} x={40} y={B.y + 8} en={X - 128} lejant={() => setLejant(true)} />
      <Lejant acik={lejant} kapat={() => setLejant(false)} yuzey="evren" sayilar={evrenSayilari(kartlar, detay)} odak={odak} />
      <YuzenGezinme aktif={aktif} solEn={X} />
      {/* pano (N10): telefondaki panoyla aynı bölüm, panelde kayar */}
      {panel ? <KabukPanel X={X} H={H} geri={geri} konum={konum}>{panel}</KabukPanel>
        : <KabukPanel X={X} H={H} konum="Pano"><PanoPanel P={P} kisi={kisi} kartlar={kartlar} detay={detay} suz={suz} setSuz={setSuz} durum={durum} yeniden={yeniden} /></KabukPanel>}
    </GenisSahne>
  );
}

/**
 * Akışlar haritası (N15; plan 27 Eki 3.31): galaksiler sabit boşluk (BOSLUK) ve kenar payıyla ızgaraya dizilir; sütun sayısı
 * galaksileri en büyük yapan değer seçilir. Boşluklar akış sayısından bağımsız sabit, değişen yalnız boy. Yakınlaşma yok.
 * Sıra verilen sıra (en riskli sol üstte); boy adım sayısıyla hafifçe değişir (en küçük en büyüğün %80'i).
 */
export const SERBEST = { kx: 20, ky: 230, kw: 350, kh: 410, BOSLUK: 30, AD: 26 } as const;
export function serbestDizilim(G: { kod: string; adim: number; ad?: string }[]): { kod: string; x: number; y: number; r: number }[] {
  const n = G.length; if (!n) return [];
  const { kx, ky, kw, kh, BOSLUK: g, AD } = SERBEST;
  // sütun en az en uzun ad hapı kadar geniş (adlar birbirine binmesin)
  const adEn = Math.max(0, ...G.map((x) => (x.ad ? hapEni(x.ad, 11.5) : 0)));
  let en = { sutun: 1, r: 0 };
  for (let c = 1; c <= n; c++) {
    const satir = Math.ceil(n / c), hw = (kw - (c - 1) * g) / c, hh = (kh - (satir - 1) * g) / satir;
    if (c > 1 && hw + g < adEn + 6) break;
    const r = Math.min(hw / 2, (hh - AD) / 2);
    if (r > en.r) en = { sutun: c, r };
  }
  const { sutun, r } = en, satir = Math.ceil(n / sutun), enAdim = Math.max(1, ...G.map((x) => x.adim));
  // sütun adımı: galaksi çapı + boşluk, ad hapından dar değil
  const adim = Math.max(2 * r + g, adEn + 6), hh = (kh - (satir - 1) * g) / satir, ox = kx + (kw - ((sutun - 1) * adim + 2 * r)) / 2;
  return G.map((x, i) => {
    const sa = Math.floor(i / sutun), su = i % sutun;
    // son satır eksikse ortalanır
    const buSatir = sa === satir - 1 ? n - sa * sutun : sutun, kay = (sutun - buSatir) * adim / 2;
    return { kod: x.kod, x: ox + kay + r + su * adim, y: ky + sa * (hh + g) + r, r: r * (.8 + .2 * Math.sqrt(x.adim / enAdim)) - 4 };
  });
}
