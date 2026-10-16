import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { Baslik } from '../../bilesen/Baslik';
import { GenisSahne, Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { useBoyut } from '../../bilesen/Gok';
import { genisDuzen, GenisKart, kartCizimi, panelZemini, useAdimOlaylari, varsayilanSecim } from './Genis';
import { akisModeli, gunAy, gunAyHafta, sans, saat, seritler, yolCiz, zamanCubugu, GUN, type Model } from '../../cizim/yol.js';
import { C, f, pill, planet } from '../../cizim/ortak.js';
import { adimAdi, adimEtiketi, akisAdi, doluSatir, ek, gunAyUzun, ikiSatir, paySure, sayiIyelik, tarihDi } from '../../metin/turkce';
import { git, arama } from '../../yonlendirme';
import { odakCumlesi, tekrarAsamasi, tekrarCumlesi, uydular, zamanCumlesi } from './cumleler';
import { dalHaric, soruCumlesi, soruKatmani } from './soru';
import { BaglantiGonder } from './BaglantiGonder';
import { KapaliGalaksi } from './Kapali';
import { useBen } from '../../api/sorgular';
import { haritaGelisi } from '../../cizim/yakinlas';

export const useAkis = (kod: string) => useQuery({ queryKey: ['akis', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}`) });

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
/** Harita düzeni (mobil, §5 B3) */
export const HARITA = { cx: 195, cy: 322, R: 156, ps: .78 };
const SURGU = { x: 16, y: 512, w: 358 };
const SERIT = { x: 12, y: 554, w: 366, h: 250 };

/** B3 cümlesi: "Kritik yol {kısa ad}ndan geçiyor; en erken {tarih}, hedefe {pay} pay." */
export function haritaCumlesi(d: any): string[] | null {
  const k = d.akis, by = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const ilk = (d.kritik_yol || []).map((no: number) => by.get(no)).find((a: any) => a && !BITTI(a.durum));
  if (k.kapandi_at) return null;
  // bağımlılıksız akış: kritik yol anlamsız; kaç adım bitti, kaç kişide iş var (J2)
  if (d.adimlar.length > 1 && d.adimlar.every((a: any) => !(a.bagimli || []).length)) {
    const tm = d.adimlar.filter((a: any) => BITTI(a.durum)).length, kisi = new Set(d.adimlar.map((a: any) => a.sahip)).size;
    const hz = new Set(d.adimlar.filter((a: any) => ['hazir', 'engelli', 'suruyor'].includes(a.durum)).map((a: any) => a.sahip)).size;
    return [`${d.adimlar.length} adımdan ${tm ? `${sayiIyelik(tm)} tamam` : 'hiçbiri bitmedi'};`, hz ? `${hz === kisi ? `${kisi} kişinin hepsinde` : `${hz} kişide`} sırası gelmiş iş var.` : 'sırası gelmiş iş yok.'];
  }
  const tarih = k.en_erken_bitis ? gunAyUzun(k.en_erken_bitis) : null;
  const pay = k.pay_saat == null ? '' : k.pay_saat >= 0 ? `hedefe ${paySure(k.pay_saat)} pay` : `hedef ${paySure(k.pay_saat)} geçiyor`;
  if (ilk && tarih) return [`Kritik yol ${ek(adimAdi(ilk), 'den')} geçiyor;`, `en erken ${tarih}${pay ? ', ' + pay : ''}.`];
  if (tarih) return [`En erken ${tarih} biter;`, `${pay}.`];
  return null;
}

/** I2 cümlesi: "Hedef 1 Kasım’dı; 3 gün geçti. App Store onayı bekleniyor; en erken 7 Kasım." Hedef geçmediyse null. */
export function gecikmeCumlesi(d: any, now: number): string | null {
  const k = d.akis;
  if (k.kapandi_at || !k.hedef_tarih) return null;
  const gecen = Math.floor((now - Date.parse(k.hedef_tarih + 'T00:00:00+03:00')) / GUN);
  if (gecen < 1) return null;
  const by = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const ilk = (d.kritik_yol || []).map((no: number) => by.get(no)).find((a: any) => a && !BITTI(a.durum));
  const ikinci = ilk && k.en_erken_bitis ? ` ${adimAdi(ilk)[0].toLocaleUpperCase('tr')}${adimAdi(ilk).slice(1)} ${ilk.durum === 'engelli' ? 'takıldı' : 'bekleniyor'}; en erken ${gunAyUzun(k.en_erken_bitis)}.` : '';
  return `Hedef ${tarihDi(gunAyUzun(k.hedef_tarih))}; ${gecen} gün geçti.${ikinci}`;
}
export const gecenGun = (d: any, now: number) => (d.akis.hedef_tarih && !d.akis.kapandi_at ? Math.floor((now - Date.parse(d.akis.hedef_tarih + 'T00:00:00+03:00')) / GUN) : 0);

/** Haritada en çok 2 adım etiketi: engelli ve kritik yolun ilk açık adımı. */
function etiketler(d: any, M: Model, P: Record<number, [number, number]>, acik: (no: number) => boolean, odak: string | null) {
  const L: any[] = [];
  const uygun = (a: any) => P[a.no] && acik(a.no) && (!odak || a.sahip === odak);
  const eng = d.adimlar.find((a: any) => a.durum === 'engelli' && uygun(a));
  if (eng) L.push([eng.no, adimEtiketi(eng), P[eng.no][0] > 130 ? -44 : 44, 4, '#FFD6CC', '#FF8A78']);
  const by = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const kr = (d.kritik_yol || []).map((no: number) => by.get(no)).find((a: any) => a && !BITTI(a.durum) && a.no !== eng?.no && uygun(a));
  if (kr) L.push([kr.no, adimEtiketi(kr), 0, 26, '#FFE6B0', '#FFD27A']);
  void M;
  return L;
}

/** B7 · tarih kartı: harita %42 kararır; gezegenden sürgüdeki gününe kılavuz; şeritteki kopyalar halkalı; gezegenin üstünde kart. */
function tarihKarti(d: any, Y: any, Z: any, S: any, no: number): string {
  const a = d.adimlar.find((x: any) => x.no === no); if (!a) return '';
  const g = Y.G.gezegen[no], px = g.x, py = g.y;
  const ef = BITTI(a.durum) ? Date.parse(a.durum_at) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : g.t;
  let s = `<rect width="390" height="844" fill="#07051A" opacity=".42"/>`;
  const tx = Z.xOf(ef), ty = 512;
  s += `<path d="M${f(px)},${f(py + g.r + 4)} L${f(tx)},${ty - 8}" stroke="#FFD27A" stroke-width="1.3" stroke-dasharray="3 4" opacity=".9"/>`;
  s += `<circle cx="${f(tx)}" cy="${ty}" r="10" fill="url(#glowGold)"/><circle cx="${f(tx)}" cy="${ty}" r="5" fill="#FFD27A" stroke="#2A1D4F" stroke-width="1.2"/>`;
  s += pill(tx, ty + 26, gunAy(ef), { fs: 11.5, fw: 750, bg: '#FFD27A', bgo: 1, col: '#2A1D4F' });
  for (const k of S.kopyalar.filter((c: any) => c.no === no)) s += `<circle cx="${f(k.x)}" cy="${f(k.y)}" r="13" fill="none" stroke="#FFF3E8" stroke-width="1.6"/>`;
  s += `<circle cx="${f(px)}" cy="${f(py)}" r="40" fill="#FFF3E8" opacity=".08"/><circle cx="${f(px)}" cy="${f(py)}" r="30" fill="none" stroke="#FFF3E8" stroke-width="2" opacity=".45"/>`;
  s += planet(px, py, g.r, Y.stOf(no) === 'tahmin' ? 'lit' : Y.stOf(no), { cloudGap: 4 });
  const cxk = Math.min(Math.max(px, 124), 266), ust = py - 96 > 60, cyk = ust ? py - 96 : py + 96;
  const satirlar: [string, number, number, string][] = [[adimAdi(a), 14, 700, C.ink]];
  satirlar.push([BITTI(a.durum) ? `Bitti ${gunAyHafta(ef)} ${saat(ef)}` : `En erken ${gunAyHafta(ef)} ${saat(ef)}`, 12.5, 600, '#FFE6B0']);
  if (a.son_tarih) { const st = Date.parse(a.son_tarih + 'T23:59:00+03:00'), p = Math.floor((st - ef) / GUN); satirlar.push([`Son tarih ${gunAy(st)} · ${p >= 0 ? p + ' gün pay' : -p + ' gün geç'}`, 12, 500, C.ink3]); }
  if (a.gec_risk) satirlar.push(['Geç kalabilir', 12, 600, '#FFC2B8']);
  const h = 30 + satirlar.length * 19;
  s += `<rect x="${f(cxk - 112)}" y="${f(cyk - 34)}" width="224" height="${h}" rx="20" fill="#1A1238" fill-opacity=".96" stroke="#FFD27A" stroke-opacity=".6"/>`;
  s += ust ? `<path d="M${f(px - 8)},${f(cyk - 34 + h)} L${f(px)},${f(cyk - 24 + h)} L${f(px + 8)},${f(cyk - 34 + h)}Z" fill="#1A1238" stroke="#FFD27A" stroke-opacity=".6"/>` : `<path d="M${f(px - 8)},${f(cyk - 34)} L${f(px)},${f(cyk - 44)} L${f(px + 8)},${f(cyk - 34)}Z" fill="#1A1238" stroke="#FFD27A" stroke-opacity=".6"/>`;
  satirlar.forEach(([t, fs, fw, col], i) => { s += sans(cxk - 96, cyk - 10 + i * 19.5, t, { fs, fw, col }); });
  return s;
}

/** Ekran okuyucu: gezegen etiketi (§8.2). */
function gezegenEtiketi(a: any, kritik: boolean) {
  const tur = a.sahip_tip === 'agent' || /agent|Claude/i.test(a.sahip) ? 'agent' : a.sahip_tip === 'dis' ? 'dış katılımcı' : 'insan';
  const tarih = BITTI(a.durum) ? (a.durum_at ? `${gunAyUzun(a.durum_at)}` : '') : a.en_erken_bitis ? `En erken ${gunAyUzun(a.en_erken_bitis)}` : '';
  return [`${a.no}. adım, ${a.ad}. ${a.sahip} (${tur}). ${a.durum_etiket || a.durum}${a.engel ? ': ' + a.engel.replace(/[.\s]+$/, '') : ''}.`, tarih && tarih + '.', kritik ? 'Kritik yolda.' : '', a.karar_adimi ? 'Karar adımı.' : ''].filter(Boolean).join(' ');
}

export function Galaksi({ kod, sahip, secim }: { kod: string; sahip: string; secim?: number }) {
  const q = useAkis(kod);
  // tablet yatay ve masaüstü: solda harita, sağda şeritler + seçili adım kartı (§5 M1, T1)
  const boy = useBoyut();
  const GD = useMemo(() => genisDuzen(boy.w, boy.h), [boy.w, boy.h]);
  const [sel, setSel] = useState<number | null>(secim ?? null);
  const [gelis] = useState(haritaGelisi);
  const ben = useBen();
  const NOW = simdi();
  // ?an=2026-10-17T12:00 → sürgü o anda açılır (paylaşılan bağlantı, ekran testleri)
  const an0 = useMemo(() => { const v = arama().get('an'); const t = v ? Date.parse(v.length <= 16 ? v + ':00+03:00' : v) : NaN; return Number.isFinite(t) ? t : NOW; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [X, setX] = useState(an0);
  const [oynuyor, setOynuyor] = useState(false);
  const [odak, setOdak] = useState<string | null>(null);
  const [gonder, setGonder] = useState<string | null>(null);
  const [kayma, setKayma] = useState(0);
  // B7: basılı tut (450 ms) → tarih kartı; bırakınca 2 sn kalır
  const [tarihNo, setTarihNo] = useState<number | null>(null);
  const bas = useRef<{ zm: number; gizle: number; acildi: boolean }>({ zm: 0, gizle: 0, acildi: false });
  const basiliBasla = (no: number) => {
    clearTimeout(bas.current.zm); clearTimeout(bas.current.gizle); bas.current.acildi = false;
    bas.current.zm = window.setTimeout(() => { bas.current.acildi = true; setTarihNo(no); navigator.vibrate?.(10); }, 450);
  };
  const basiliBirak = () => {
    clearTimeout(bas.current.zm);
    if (bas.current.acildi) bas.current.gizle = window.setTimeout(() => setTarihNo(null), 2000);
  };
  const [birakildi, setBirakildi] = useState(an0);
  const d = q.data;
  const M = useMemo(() => (d ? akisModeli(d, { sahip, haric: dalHaric(d) }) : null), [d, sahip]);
  // kalabalık akış (> 6 kişi): ps .82, şerit satırı 27 (§4.14)
  const geo = useMemo(() => (GD ? GD.harita : { ...HARITA, ps: d && new Set(d.adimlar.map((a: any) => a.sahip)).size > 6 ? .82 : HARITA.ps }), [d, GD]);
  const SU = GD ? GD.surgu : SURGU, SR = GD ? GD.serit : SERIT;
  const selNo = GD && d ? sel ?? varsayilanSecim(d) : null;
  const secOlay = useAdimOlaylari(kod, selNo);

  // ilk çizim: geometri (etiket konumları için gezegen yerleri)
  const temel = useMemo(() => (M ? yolCiz(M, { ...geo, now: NOW, x: NOW }) : null), [M, NOW, geo]);
  const cizim = useMemo(() => {
    if (!M || !temel || !d) return null;
    // etiket: yalnız bugün ve ileride, x anında hâlâ açık olan adımlar (yanık/tahmin olanlar etiketsiz)
    const acik = (no: number) => !['lit', 'tahmin', 'ghost'].includes(temel.G.durumAn(no, X) || '');
    // tekrar grubu sürüyorsa: uydular ve aşama etiketi (D1)
    const A = tekrarAsamasi(d), sats = uydular(d);
    const soruVar = !odak && Math.abs(X - NOW) < 36e5 && !!soruCumlesi(d);
    let labels = soruVar ? [] : X >= NOW - 36e5 ? (A && !odak ? [[A.no, `${A.ad} · ${A.k}/${A.n}`, 0, 34, '#FFE6B0', '#FFD27A']] : etiketler(d, M, temel.P, acik, odak)) : [];
    if (GD) labels = labels.map((l: any[]) => [l[0], l[1], l[2] * GD.etiket.dx, l[3] * GD.etiket.dy, l[4], l[5]]);
    const gecti = gecenGun(d, NOW) > 0; // I2: hedef geçince şerit sıkışır (tasarım 11 px/gün)
    const uzun = (temel.G.hedef - temel.G.T0) / GUN > 30, satir = temel.G.uyeler.length > 6 ? 27 : uzun || temel.G.uyeler.length > 4 ? 38 : 42;
    const Y = yolCiz(M, { ...geo, now: NOW, x: X, focus: odak || undefined, labels: tarihNo != null && !GD ? [] : labels, sats, sel: selNo ?? undefined });
    const Z = zamanCubugu(SU.x, SU.y, SU.w, Y.G, X, { now: NOW, oynuyor, ...(GD ? { ps: GD.surgu.ps } : {}) });
    const S = GD
      ? seritler(M, Y, GD.serit, { x: X, now: NOW, pxGun: uzun ? GD.serit.pxGun * .3 : GD.serit.pxGun, satir: GD.serit.satir, lw: GD.serit.lw, ps: GD.serit.ps, tBas: Y.G.T0 - GUN * .3, herGun: !uzun, focus: odak || undefined, kayma, sel: selNo ?? undefined })
      : seritler(M, Y, SERIT, { x: X, now: NOW, pxGun: uzun ? 9 : gecti ? 11 : 30, satir, tBas: Y.G.T0 - GUN * .4, herGun: !uzun && !gecti, focus: odak || undefined, kayma });
    // açık sorular: ikizler, tarih bekleyen adım (E1, E2); yalnız bugün ve odaksız
    const SK = !odak && Math.abs(X - NOW) < 36e5 ? soruKatmani(d, M, Y, { ...geo, now: NOW }) : { svg: '', hedefler: [] };
    let ust = '';
    // I2: hedef geçti; kulenin üstünde mercan hap
    const gec = gecenGun(d, NOW), kule = Y.G.kule;
    if (gec > 0 && kule && !odak) ust += pill(kule.x, kule.y - 34, `${gec} gün geçti`, { fs: 11.5, fw: 750, bg: '#FF8A78', bgo: 1, col: '#2A1D4F' });
    if (tarihNo != null && Y.G.gezegen[tarihNo] && !GD) ust = tarihKarti(d, Y, Z, S, tarihNo);
    return { svg: Y.svg + SK.svg + Z.svg + S.svg + ust, Y, Z, S, SK };
  }, [M, temel, d, X, NOW, odak, oynuyor, kayma, tarihNo, geo, GD, selNo]);

  // oynat: 1 gün / sn (§4.10); sona gelince durur
  useEffect(() => {
    if (!oynuyor || !cizim) return;
    const t1 = cizim.Z.t1, azalt = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let son = performance.now(), id = 0;
    const kare = (t: number) => {
      const dt = t - son; son = t;
      setX((x) => { const y = Math.min(t1, x + (azalt ? 0 : dt / 1000 * GUN)); if (y >= t1) { setOynuyor(false); setBirakildi(t1); } return y; });
      id = requestAnimationFrame(kare);
    };
    const adim = azalt ? setInterval(() => setX((x) => { const y = Math.min(t1, x + GUN); if (y >= t1) { setOynuyor(false); setBirakildi(t1); } return y; }), 1000) : 0;
    if (!azalt) id = requestAnimationFrame(kare);
    return () => { cancelAnimationFrame(id); if (adim) clearInterval(adim); };
  }, [oynuyor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!oynuyor) setBirakildi(X); }, [oynuyor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isPending) return <HaritaYukleniyor />;
  if (q.isError || !d || !cizim || !M) return <HaritaHata hata={(q.error as Error)?.message} yeniden={() => void q.refetch()} />;

  if (d.akis.kapandi_at) return <KapaliGalaksi d={d} kod={kod} sahipMi={ben.data?.rol === 'sahip'} sahip={sahip} />;
  const { Y, Z, S, SK } = cizim;
  const ad = akisAdi(d.akis);
  const ham = odak && Math.abs(birakildi - NOW) < 36e5 ? [odakCumlesi(d, odak)] : Math.abs(birakildi - NOW) < 36e5 ? (soruCumlesi(d) ? [soruCumlesi(d)!] : tekrarCumlesi(d) ? [tekrarCumlesi(d)!] : haritaCumlesi(d)) : zamanCumlesi(d, M, Y.G, birakildi, NOW);
  const soruC = !odak && Math.abs(birakildi - NOW) < 36e5 ? soruCumlesi(d) : null;
  const gecC = !odak && !soruC && Math.abs(birakildi - NOW) < 36e5 ? gecikmeCumlesi(d, NOW) : null;
  const cumle = soruC ? doluSatir(soruC, 330, '17px Caladea', 5) : gecC ? doluSatir(gecC, 300, '17px Caladea', 5) : ham && ham.filter(Boolean).length ? ikiSatir(ham.filter(Boolean).join(' ')) : null;
  const surguEtiket = Math.abs(X - NOW) < 36e5 ? `Bugün, ${gunAyUzun(X)}` : `${gunAyHafta(X)}${X > NOW ? ', tahmin' : ''}`;

  // sürgü: sürükle / dokun; hapa dokunmak bugüne döner
  const surguTasi = (e: RPointerEvent<HTMLDivElement>) => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = Z.x0 - 22 + (e.clientX - r.left);
    let t = Z.tOf(Math.max(Z.x0, Math.min(Z.x1, px)));
    if (Math.abs(t - NOW) < GUN * .15) t = NOW; // bugüne oturma
    setX(t);
  };
  const surguTus = (e: KeyboardEvent) => {
    const k: Record<string, number> = { ArrowRight: 36e5, ArrowLeft: -36e5, PageUp: GUN, PageDown: -GUN };
    if (k[e.key]) { e.preventDefault(); const t = Math.max(Z.t0, Math.min(Z.t1, X + k[e.key])); setX(t); setBirakildi(t); }
    if (e.key === 'Home') { setX(Z.t0); setBirakildi(Z.t0); }
    if (e.key === 'End') { setX(Z.t1); setBirakildi(Z.t1); }
  };
  const kritik = new Set<number>(d.kritik_yol || []);
  const byNo = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const tekrarNo = new Set<number>((d.tekrar || []).flatMap((g: any) => (g.kalemler?.length ? g.adimlar : [])));
  const ac = (no: number) => (GD && !tekrarNo.has(no) ? setSel(no) : git(`/akis/${encodeURIComponent(kod)}/${tekrarNo.has(no) ? 'tekrar' : 'adim'}/${no}`));

  const kontroller = (
    <>
      {/* sarmal: gezegenler (dokun → adım) */}
      <div role="list" aria-label="Harita" className="harita-katman">
        {Object.values(Y.G.gezegen).map((g) => {
          const a = byNo.get(g.no); if (!a) return null;
          const r = Math.max(22, Y.radOf(g.no) + 6);
          return <button key={g.no} role="listitem" className="gezegen-hedef" style={{ left: g.x - r, top: g.y - r, width: r * 2, height: r * 2 }} aria-label={gezegenEtiketi(a, kritik.has(g.no))} onClick={() => { if (bas.current.acildi) { bas.current.acildi = false; return; } ac(g.no); }}
            onPointerDown={() => basiliBasla(g.no)} onPointerUp={basiliBirak} onPointerLeave={() => clearTimeout(bas.current.zm)}
            onContextMenu={(e) => { e.preventDefault(); setTarihNo(g.no); bas.current.gizle = window.setTimeout(() => setTarihNo(null), 2000); }} />;
        })}
        {SK.hedefler.map((h, i) => <button key={'soru' + i} role="listitem" className="gezegen-hedef" style={{ left: h.x - h.r, top: h.y - h.r, width: h.r * 2, height: h.r * 2 }} aria-label={h.etiket} onClick={() => git(`/akis/${encodeURIComponent(kod)}/soru/${encodeURIComponent(h.soru)}`)} />)}
      </div>

      {/* zaman sürgüsü */}
      <button className="surgu-oynat" style={{ left: SU.x, top: SU.y - 22 }} aria-label={oynuyor ? 'Durdur' : 'Oynat'} onClick={() => { if (!oynuyor && X >= Z.t1 - 36e5) setX(Z.t0); setOynuyor(!oynuyor); }} />
      <div className="surgu-ray" role="slider" tabIndex={0} aria-label="Zaman" aria-valuemin={Z.t0} aria-valuemax={Z.t1} aria-valuenow={Math.round(X)}
        aria-valuetext={`${surguEtiket}. ${gunAyUzun(Z.t0)} ile ${gunAyUzun(Y.G.hedef)} arası.`}
        style={{ left: Z.x0 - 22, top: SU.y - 22, width: Z.x1 - Z.x0 + 44 }}
        onKeyDown={surguTus}
        onPointerDown={(e) => { setOynuyor(false); e.currentTarget.setPointerCapture(e.pointerId); surguTasi(e); }}
        onPointerMove={(e) => { if (e.buttons) surguTasi(e); }}
        onPointerUp={() => setBirakildi(X)} />
      <button className="surgu-hap" style={{ left: Math.min(Math.max(Z.xOf(X), Z.x0 + 40), Z.x1 - 40) - 48, top: SU.y - 22 - 13 - 22 }} aria-label="Bugüne dön" onClick={() => { setOynuyor(false); setX(NOW); setBirakildi(NOW); }} />

      {/* şeritler: etiket → kişi odağı; yatay kaydırma */}
      <div className="serit-kaydir" style={{ left: S.X0 - 8, top: SR.y, width: S.XW + 8, height: SR.h }} aria-hidden
        onPointerDown={(e) => { const x0 = e.clientX, k0 = kayma; const m = (ev: PointerEvent) => setKayma(Math.max(0, Math.min(2000, k0 - (ev.clientX - x0)))); const u = () => { removeEventListener('pointermove', m); removeEventListener('pointerup', u); }; addEventListener('pointermove', m); addEventListener('pointerup', u); }} />
      <button className="serit-ok" style={{ left: SR.x + SR.w - 40, top: SR.y + SR.h / 2 - 28 }} aria-label="Sonraki günler" onClick={() => setKayma((k) => k + 120)} />
      <div role="list" aria-label="Şeritler">
        {S.us.map((u: any, i: number) => {
          const n = u.ziyaret.length, k = u.ziyaret.filter((no: number) => BITTI(byNo.get(no)?.durum)).length;
          return <button key={u.ad} role="listitem" className="serit-etiket" aria-pressed={odak === u.ad} style={{ left: SR.x + 4, top: S.yOf(i) - 21, width: S.lw + 4, height: 42 }}
            aria-label={`${u.ad} yolu: ${n} adım, ${k} tamam. Başlangıç ${gunAy(u.t0)}.`} onClick={() => { if (u.tip === 'dis') { setOdak(u.ad); setGonder(u.ad); } else setOdak(odak === u.ad ? null : u.ad); }} />;
        })}
      </div>
      {gonder && <><BaglantiGonder kod={kod} kisi={gonder} adimSayisi={d.adimlar.filter((a: any) => a.sahip === gonder).length} kapat={() => { setGonder(null); setOdak(null); }} /></>}
    </>
  );

  if (GD) {
    const U = GD.ust, a = selNo != null ? byNo.get(selNo) : null;
    const tam = a ? { ...a, ...(secOlay.data?.adim || {}) } : null;
    const cumleG = ham && ham.filter(Boolean).length ? (U.tekSatir ? [ham.filter(Boolean).join(' ')] : ikiSatir(ham.filter(Boolean).join(' '), Math.min(340, GD.PX - 64), `${U.cumleFs}px Caladea`)) : null;
    const cG = soruC ? [soruC] : gecC ? [gecC] : cumleG;
    return (
      <GenisSahne gok={{ tohum: 101, yildiz: 280, parilti: 10 }} w={GD.W} h={GD.H} etiket={ad} sinif={gelis ? 'harita-gelis' : ''}
        cizim={panelZemini(GD) + cizim.svg + (tam ? kartCizimi(GD.kart, tam, secOlay.data?.adim?.olaylar || null) : '')}>
        <button type="button" className="genis-geri" style={{ left: U.geriX - 22, top: U.geriY - 22 }} aria-label="Geri" onClick={() => (history.length > 1 ? history.back() : git('/'))} />
        <h1 className="genis-baslik" style={{ left: U.baslikX, top: U.baslikY - U.fs * 1.02, fontSize: U.fs, lineHeight: `${Math.round(U.fs * 1.25)}px` }}>{ad}</h1>
        {cG && <Metin y={U.cumleY} x={U.cumleX} fs={U.cumleFs} lh={Math.round(U.cumleFs * 1.3)} serif renk="ink2" style={{ whiteSpace: 'nowrap', right: 'auto' }} id="harita-cumle" as="p">{cG.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>}
        <h2 className="genis-bolum" style={{ left: GD.bolum.x, top: GD.bolum.y - 12 }}>ŞERİTLER</h2>
        {GD.bolum.alt && <Metin y={GD.bolum.alt.y} x={GD.bolum.x} fs={13} renk="ink3" className="tek-satir">Her satır bir kişinin yolu; soldan sağa zaman.</Metin>}
        {kontroller}
        {tam && <GenisKart K={GD.kart} d={d} a={tam} kod={kod} ben={sahip} />}
      </GenisSahne>
    );
  }

  return (
    <Sahne gok={{ tohum: 33, yildiz: 280 }} cizim={cizim.svg} etiket={ad} sinif={gelis ? 'harita-gelis' : ''}>
      <div style={{ opacity: tarihNo != null ? .58 : 1, transition: 'opacity var(--sure-kisa)' }}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={() => (history.length > 1 ? history.back() : git('/'))} /></Kutu>
      {cumle && <Metin y={110} fs={17} lh={22} serif renk="ink2" style={cumle.length > 1 ? { whiteSpace: 'nowrap' } : undefined} id="harita-cumle" as="p">{cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>}
      </div>

      {kontroller}
    </Sahne>
  );
}

/** Yükleniyor: merkez ışığı + tek soluk sarmal + boş sürgü rayı (§5 B3). */
export function HaritaYukleniyor() {
  const { cx, cy, R } = HARITA;
  let p = '';
  for (let i = 0; i <= 80; i++) { const th = i / 80 * Math.PI * 2.4, r = R * .1 + R * .85 * i / 80; p += (i ? 'L' : 'M') + (cx + Math.cos(th) * r).toFixed(1) + ',' + (cy + Math.sin(th) * r).toFixed(1); }
  const s = `<circle cx="${cx}" cy="${cy}" r="${R * .3}" fill="url(#bloom)" opacity=".8"/><g class="donen-sarmal" style="transform-origin:${cx}px ${cy}px"><path d="${p}" fill="none" stroke="#B9A6F2" stroke-width="1.4" opacity=".3"/></g>` +
    `<rect x="${SURGU.x + 56}" y="${SURGU.y - 4}" width="${SURGU.w - 68}" height="8" rx="4" fill="#120B2C" stroke="#8E80D6" stroke-opacity=".45"/>`;
  return (
    <Sahne gok={{ tohum: 33, yildiz: 280 }} cizim={s} etiket="Harita yükleniyor">
      <div className="iskelet-serit" style={{ top: 92, width: 300 }} /><div className="iskelet-serit" style={{ top: 114, width: 240 }} />
    </Sahne>
  );
}

function HaritaHata({ hata, yeniden }: { hata?: string; yeniden: () => void }) {
  return (
    <Sahne gok={{ tohum: 33, yildiz: 280 }} etiket="Harita">
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Akış" geri={() => git('/')} /></Kutu>
      <Kutu y={600} className="kart hata-karti" role="alert">
        <p>{hata || 'Akış şu an açılamadı.'}</p>
        <button className="dugme dugme-ikincil ton-mercan" onClick={yeniden}>Yeniden dene</button>
      </Kutu>
    </Sahne>
  );
}
