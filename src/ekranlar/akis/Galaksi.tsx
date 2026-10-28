import { hareketAz } from '../../ayar/hareket';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { Baslik } from '../../bilesen/Baslik';
import { DevirAiDugme, DevirAiPanel, devirAiKapat, useAiAcik } from '../ai/DevirAi';
import { GenisSahne, Kutu, Sahne } from '../../bilesen/Sahne';
import { useBoyut } from '../../bilesen/Gok';
import { PanelUst, YuzenGezinme } from '../../bilesen/Kabuk';
import { genisDuzen, panelZemini } from './Genis';
import { GorevDetay } from './GorevDetay';
import { akisModeli, gunAy, gunAyHafta, sans, saat, yolCiz, zamanCubugu, GUN, type Model } from '../../cizim/yol.js';
import { C, f, pill, planet } from '../../cizim/ortak.js';
import { adimAdi, adimEtiketi, akisAdi, gunAyUzun } from '../../metin/turkce';
import { git, arama } from '../../yonlendirme';
import { tekrarAsamasi, uydular } from './cumleler';
import { dalHaric, soruCumlesi, soruKatmani } from './soru';
import { BaglantiGonder } from './BaglantiGonder';
import { galaksiSayilari, lejantGezegenleri, Lejant, SoruIkon, type OdakAyar } from './Lejant';
import { BaglantiKopyala, akisKisileri, useAkisBolumu, type AkisSuzgec } from './Bilgi';
import { HaritaCipleri, KisiSuzgec, type HaritaCipi } from './HaritaSuzgec';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { KapaliGalaksi } from './Kapali';
import { useBen } from '../../api/sorgular';
import { haritaGelisi } from '../../cizim/yakinlas';
import { haritaCercevesi, useGezinme, type Bolge } from './gezinme';
import { bos, kisiAdlari, kuleKarti, yakinEtiketler, yelpaze, type Daire } from './katman';
import { hedefPayi, KararSeridi, seritYuksekligi } from '../../bilesen/KararSeridi';
import { TarihNeden } from './TarihNeden';
import { buyut, hedefYaricap, kademe, KADEME, ogeKat, OLCEK, uygunKat, yaziKat } from '../../geometri/olcek';

/** kuyruk yazısı (R17): "hedefe 24 gün pay" → "24 gün pay"; yalnız pay varken */
const payKisa = (d: any) => { const p = d ? hedefPayi(d.akis) : ''; return p.startsWith('hedefe ') ? p.slice(7) : ''; };

export const useAkis = (kod: string) => useQuery({ queryKey: ['akis', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}`) });

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
/** Galaksi durum odakları (plan 27 Eki, 2.C) */
type GDurum = 'engelli' | 'karar' | 'sira' | 'sende';
const GDURUM: Record<GDurum, { ad: string; uyar: (a: any, ben: string) => boolean }> = {
  engelli: { ad: 'Engelli', uyar: (a) => a?.durum === 'engelli' },
  karar: { ad: 'Karar', uyar: (a) => !!a?.karar_adimi && !BITTI(a.durum) },
  sira: { ad: 'Sırası gelen', uyar: (a) => a?.durum === 'hazir' || a?.durum === 'suruyor' },
  sende: { ad: 'Sende', uyar: (a, ben) => a?.sahip === ben && !BITTI(a.durum) },
};
/** Harita düzeni (mobil, §5 B3; plan 27 Eki 2.2, 2.5: şeritler ve üst cümle kalktı, harita ilk ekranın ~%75'i) */
export const HARITA = { cx: 195, cy: 420, R: 164, ps: .8 };
/** Zaman sürgüsü: küçük (plan 27 Eki, 2.4) */
const SURGU = { x: 16, y: 766, w: 358, ps: .8 };
/** Haritanın üstü: başlığın altı (karar şeridi varsa onun da altı). */
const HARITA_UST = 92;
/** Telefonda haritanın altındaki bölümün üstü (sayfa kaydırılınca buraya oturur). */
const BOLUM_Y = 852;

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

/** B7 · tarih kartı: harita %42 kararır; gezegenden sürgüdeki gününe kılavuz; gezegenin üstünde kart. */
function tarihKarti(d: any, Y: any, Z: any, no: number, ty: number): string {
  const a = d.adimlar.find((x: any) => x.no === no); if (!a) return '';
  const g = Y.G.gezegen[no], px = g.x, py = g.y;
  const ef = BITTI(a.durum) ? Date.parse(a.durum_at) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : g.t;
  let s = `<rect width="390" height="844" fill="#07051A" opacity=".42"/>`;
  const tx = Z.xOf(ef);
  s += `<path d="M${f(px)},${f(py + g.r + 4)} L${f(tx)},${ty - 8}" stroke="#FFD27A" stroke-width="1.3" stroke-dasharray="3 4" opacity=".9"/>`;
  s += `<circle cx="${f(tx)}" cy="${ty}" r="10" fill="url(#glowGold)"/><circle cx="${f(tx)}" cy="${ty}" r="5" fill="#FFD27A" stroke="#2A1D4F" stroke-width="1.2"/>`;
  s += pill(tx, ty + 26, gunAy(ef), { fs: 11.5, fw: 750, bg: '#FFD27A', bgo: 1, col: '#2A1D4F' });
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

/** Masaüstünde üzerine gelince (K10): kısa ad, durum, sahip. */
function gezegenIpucu(a: any) {
  return `${a.no}. ${adimAdi(a)} · ${a.durum_etiket || a.durum} · ${String(a.sahip || '').replace(/\s*\(.*\)$/, '')}`;
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
  const [gelis] = useState(haritaGelisi);
  const ben = useBen();
  const ai = useAiAcik();
  const NOW = simdi();
  // ?an=2026-10-17T12:00 → sürgü o anda açılır (paylaşılan bağlantı, ekran testleri)
  const an0 = useMemo(() => { const v = arama().get('an'); const t = v ? Date.parse(v.length <= 16 ? v + ':00+03:00' : v) : NaN; return Number.isFinite(t) ? t : NOW; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [X, setX] = useState(an0);
  const [oynuyor, setOynuyor] = useState(false);
  // ?odak=Ad → kişi sayfasından "Haritada yolunu göster"
  const [odak, setOdak] = useState<string | null>(() => arama().get('odak'));
  // durum odağı (plan 27 Eki, 2.C): "?" sayfasından; uymayan gezegenler söner
  const [durumOdak, setDurumOdak] = useState<GDurum | null>(null);
  const [lejant, setLejant] = useState(false);
  // lejant satırı → o işaretli gezegenler kısa süre yanıp söner (plan 27 Eki, 3.G)
  const [parla, setParla] = useState<Set<number> | null>(null);
  useEffect(() => { if (!parla) return; const t = setTimeout(() => setParla(null), 2600); return () => clearTimeout(t); }, [parla]);
  const [kisiKutu, setKisiKutu] = useState(false);
  const [gonder, setGonder] = useState<string | null>(null);
  const [neden, setNeden] = useState(false);
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
  const d = q.data;
  // haritanın altındaki bölüm (madde 12): Adımlar · Kararlar · Çıktılar · Kişiler; telefonda aynı sayfada
  const B = useAkisBolumu({ d, kod, ben: sahip, y0: GD ? 12 : BOLUM_Y + 44, en: GD ? GD.kart.w : undefined });
  const bolumRef = useRef<HTMLHeadingElement>(null);
  // alt sayfa kapanırken geçmiş bir adım geri gider; kaydırma ondan sonra yapılır
  const bolumAc = (s?: AkisSuzgec) => { if (s) B.sec(s); if (GD) { if (secim != null) git(`/akis/${encodeURIComponent(kod)}`, { yerine: true }); return; } setTimeout(() => bolumRef.current?.scrollIntoView({ behavior: hareketAz() ? 'auto' : 'smooth', block: 'start' }), 60); };
  useEffect(() => { document.documentElement.classList.add('kaydir-otur'); return () => document.documentElement.classList.remove('kaydir-otur'); }, []);
  const M = useMemo(() => (d ? akisModeli(d, { sahip, haric: dalHaric(d) }) : null), [d, sahip]);
  const geo = useMemo(() => (GD ? GD.harita : HARITA), [GD]);
  const SU = GD ? GD.surgu : SURGU;
  // masaüstünde seçim adreste (/adim/:no); seçim yokken panelde adım listesi (N16)
  // alt görev seçiliyse haritada üst görevi (uydusunun gezegeni) seçili
  const selNo = GD && d ? (secim != null ? d.adimlar.find((a: any) => a.no === secim)?.ust_adim ?? secim : null) : null;
  // karar şeridi (P1-A2) başlığın altında tek kısa satır; bugünde ve kişi odağı yokken
  const seritH = !GD && d && !d.akis.kapandi_at ? seritYuksekligi(d.akis.karar_ozeti, 350, { neden: !!d.bitis }) : 0;
  // yakınlaşma, kaydırma (B3 "Pinch", §12): bölge sarmalın alanı; başlığın (ve karar şeridinin) altı, sürgünün üstü
  const [yelpazeNo, setYelpazeNo] = useState<number | null>(null);
  const [kuleAcik, setKuleAcik] = useState(false);
  const [kisiKarti, setKisiKarti] = useState<string | null>(null);
  const bolge = useMemo<Bolge>(() => { if (GD) { const y0 = GD.ust.cumleY + 44; return { x: 0, y: y0, w: GD.PX, h: GD.surgu.y - 34 - y0 }; } const y0 = HARITA_UST + (seritH ? seritH + 10 : 0); return { x: 0, y: y0, w: 390, h: SURGU.y - 56 - y0 }; }, [GD, seritH]);
  const gz = useGezinme(bolge, { hareket: () => { clearTimeout(bas.current.zm); setKuleAcik(false); } });
  const zk = gz.g.k, yak = gz.yaklasik;
  // seçilen gezegene yumuşak kayma (plan 28 Eki, B9, B4): tasarım konumu (yakınlaşmasız çizim) bölgenin ortasına; alt görevi
  // olan gezegende Z3'e (uydu sarmalı, adlar), diğerlerinde en az Z2'ye; zaten daha yakınsa yakınlık kalır
  const altli = useMemo(() => new Set<number>((d?.adimlar || []).filter((a: any) => a.ust_adim != null).map((a: any) => a.ust_adim)), [d]);
  const gezegeneKay = (no: number) => {
    const g = temelRef.current?.G.gezegen[no]; if (!g) return;
    const k = Math.min(4, Math.max(gz.g.k, altli.has(no) ? KADEME.Z3 + .1 : KADEME.Z2));
    gz.git({ k, tx: bolge.x + bolge.w / 2 - g.x * k, ty: bolge.y + bolge.h / 2 - g.y * k });
  };
  const temelRef = useRef<any>(null);
  const oncekiSecim = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (oncekiSecim.current !== undefined && selNo != null && selNo !== oncekiSecim.current) gezegeneKay(selNo);
    oncekiSecim.current = selNo;
  }, [selNo]); // eslint-disable-line react-hooks/exhaustive-deps
  const geoZ = useMemo(() => (yak ? { ...geo, cx: geo.cx * zk + gz.g.tx, cy: geo.cy * zk + gz.g.ty, R: geo.R * zk } : geo), [geo, yak, zk, gz.g.tx, gz.g.ty]);
  const sakin = useMemo<[number, number, number]>(() => [geo.cx, geo.cy, geo.R * 1.15], [geo]);

  // ilk çizim: geometri (etiket konumları için gezegen yerleri)
  const temel = useMemo(() => (M ? yolCiz(M, { ...geo, now: NOW, x: NOW }) : null), [M, NOW, geo]);
  temelRef.current = temel;
  const cizim = useMemo(() => {
    if (!M || !temel || !d) return null;
    // etiket: yalnız bugün ve ileride, x anında hâlâ açık olan adımlar (yanık/tahmin olanlar etiketsiz)
    const acik = (no: number) => !['lit', 'tahmin', 'ghost'].includes(temel.G.durumAn(no, X) || '');
    // tekrar grubu sürüyorsa: uydular ve aşama etiketi (D1)
    const A = tekrarAsamasi(d), sats = uydular(d);
    const soruVar = !odak && Math.abs(X - NOW) < 36e5 && !!soruCumlesi(d);
    let labels = soruVar ? [] : X >= NOW - 36e5 ? (A && !odak ? [[A.no, `${A.ad} · ${A.k}/${A.n}`, 0, 34, '#FFE6B0', '#FFD27A']] : etiketler(d, M, temel.P, acik, odak)) : [];
    if (GD) labels = labels.map((l: any[]) => [l[0], l[1], l[2] * GD.etiket.dx, l[3] * GD.etiket.dy, l[4], l[5]]);
    // öğe ölçeği (madde 9): ekrandaki adım sayısı ve yakınlaşmayla; en küçük gezegen 3 kat, büyükler √3 kat büyür
    const gz0 = Object.values(temel.G.gezegen) as { x: number; y: number; r: number }[], r0 = Math.max(Math.min(...gz0.map((g) => g.r)), 6.5 * geo.ps);
    // geniş düzende tasarım boyu zaten büyük (ps 1.35 ≈ telefonun 1,7 katı): hedef kat √(telefon ps / ps) ile iner
    const kat = Math.min(ogeKat('ana', gz0.length, zk) * Math.min(1, Math.sqrt(HARITA.ps / geo.ps)), uygunKat(gz0.map((g) => ({ x: g.x * zk, y: g.y * zk, r: g.r })), OLCEK.ANA * 2, r0, 1.4));
    const yk = yaziKat(kat, 11), gemiK = Math.min(kat, 1.9), rf = (r: number) => buyut(r, kat, r0);
    // küme: yalnız tasarım boyunda da üst üste binenler (büyüyen gezegenler birbirinin üstüne çizilir, rozete düşmez)
    const kumeRad = (no: number) => temel.radOf(no) * Math.min(kat, 1.4);
    const kad = kademe(zk);
    const Y = yolCiz(M, { ...geoZ, now: NOW, x: X, focus: odak || undefined, durumOdak: durumOdak && d ? (no: number) => GDURUM[durumOdak].uyar(d.adimlar.find((a: any) => a.no === no), sahip) : undefined, labels: (tarihNo != null && !GD) || kad >= 1 ? [] : labels, sats, satYakin: kad >= 2, satAdlar: kad >= 3, satHedef: kad >= 3, merkezTarih: kad >= 3, sel: selNo ?? undefined, parla: parla || undefined, payEtiket: payKisa(d), shipSc: .9, minR: 6.5, ikonAyri: zk >= 2, ok: gemiK, rf, kumeRad, yk });
    const Z = zamanCubugu(SU.x, SU.y, SU.w, Y.G, X, { now: NOW, oynuyor, ps: SU.ps });
    // açık sorular: ikizler, tarih bekleyen adım (E1, E2); yalnız bugün ve odaksız
    const SK = !odak && Math.abs(X - NOW) < 36e5 ? soruKatmani(d, M, Y, { ...geoZ, now: NOW }) : { svg: '', hedefler: [] };
    let ust = '';
    // I2: hedef geçti; kulenin üstünde mercan hap
    const gec = gecenGun(d, NOW), kule = Y.G.kule;
    if (gec > 0 && kule && !odak) ust += pill(kule.x, kule.y - 34, `${gec} gün geçti`, { fs: 11.5, fw: 750, bg: '#FF8A78', bgo: 1, col: '#2A1D4F' });
    if (tarihNo != null && Y.G.gezegen[tarihNo] && !GD && !yak) ust = tarihKarti(d, Y, Z, tarihNo, SU.y);
    // yakınlaşınca: adım etiketleri ve kişi adları ekranda (ölçekle büyümez); odaktaki kişinin adı her zaman
    const gemiD: Daire[] = [...(Y.gemiler || []).map((g: any) => ({ x: g.x, y: g.y, r: 14 })), ...(Y.uydular || []).map((u) => ({ x: u.x, y: u.y, r: u.r + 4 }))];
    // kademeler (3.D): Z1 engel, karar ve süren işin adı; Z2 bütün adlar; Z3 tarihler ve bütün kişi adları
    const YE = kad >= 1 ? yakinEtiketler(d, Y, bolge, zk, odak, gemiD, kad) : { svg: '', kutular: [] };
    let ek = YE.svg + kisiAdlari(d, Y, bolge, kad >= 3, kisiKarti && kisiKarti === odak ? kisiKarti : null, YE.kutular);
    if (kuleAcik && Y.G.kule) ek += kuleKarti(d, Y.G.kule, bolge);
    let svg = yak
      ? `${haritaCercevesi('harita-kirp', bolge)}${Y.svg + SK.svg + ust + ek}</g>` + Z.svg
      : Y.svg + SK.svg + Z.svg + ust + ek;
    // küme yelpazesi (§3.7): küme hâlâ varsa
    const kume = yelpazeNo != null ? (Y.clusters || []).find((c: number[]) => c.includes(yelpazeNo)) : null;
    const YP = kume ? yelpaze(d, Y, kume, bolge, GD ? GD.W : 390, GD ? GD.H : 844) : null;
    if (YP) svg += YP.svg;
    return { svg, Y, Z, SK, YP };
  }, [M, temel, d, X, NOW, odak, durumOdak, sahip, oynuyor, tarihNo, geo, geoZ, zk, yak, bolge, kuleAcik, kisiKarti, yelpazeNo, GD, selNo, parla]);
  // Esc: yelpaze ve kule kartı kapanır
  useEffect(() => {
    if (yelpazeNo == null && !kuleAcik) return;
    const t = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setYelpazeNo(null); setKuleAcik(false); } };
    addEventListener('keydown', t); return () => removeEventListener('keydown', t);
  }, [yelpazeNo, kuleAcik]);

  // oynat: 1 gün / sn (§4.10); sona gelince durur
  useEffect(() => {
    if (!oynuyor || !cizim) return;
    const t1 = cizim.Z.t1, azalt = hareketAz();
    let son = performance.now(), id = 0;
    const kare = (t: number) => {
      const dt = t - son; son = t;
      setX((x) => { const y = Math.min(t1, x + (azalt ? 0 : dt / 1000 * GUN)); if (y >= t1) { setOynuyor(false); } return y; });
      id = requestAnimationFrame(kare);
    };
    const adim = azalt ? setInterval(() => setX((x) => { const y = Math.min(t1, x + GUN); if (y >= t1) { setOynuyor(false); } return y; }), 1000) : 0;
    if (!azalt) id = requestAnimationFrame(kare);
    return () => { cancelAnimationFrame(id); if (adim) clearInterval(adim); };
  }, [oynuyor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isPending) return <HaritaYukleniyor />;
  if (q.isError || !d || !cizim || !M) return <HaritaHata hata={(q.error as Error)?.message} yeniden={() => void q.refetch()} />;

  if (d.akis.kapandi_at) return <KapaliGalaksi d={d} kod={kod} sahipMi={ben.data?.rol === 'sahip'} sahip={sahip} />;
  const { Y, Z, SK } = cizim;
  const ad = akisAdi(d.akis);
  // karar şeridi (P1-A2): başlığın altında; üst cümle ve sayı çipleri kalktı (plan 27 Eki, 2.3, 2.B)
  const serit = !!seritH;
  const surguEtiket = Math.abs(X - NOW) < 36e5 ? `Bugün, ${gunAyUzun(X)}` : `${gunAyHafta(X)}${X > NOW ? ', tahmin' : ''}`;

  // sürgü: sürükle / dokun; hapa dokunmak bugüne döner
  const surguTasi = (e: RPointerEvent<HTMLDivElement>) => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = Math.max(Z.x0 - 22, SU.x + 46) + (e.clientX - r.left);
    let t = Z.tOf(Math.max(Z.x0, Math.min(Z.x1, px)));
    if (Math.abs(t - NOW) < GUN * .15) t = NOW; // bugüne oturma
    setX(t);
  };
  const surguTus = (e: KeyboardEvent) => {
    const k: Record<string, number> = { ArrowRight: 36e5, ArrowLeft: -36e5, PageUp: GUN, PageDown: -GUN };
    if (k[e.key]) { e.preventDefault(); const t = Math.max(Z.t0, Math.min(Z.t1, X + k[e.key])); setX(t); }
    if (e.key === 'Home') setX(Z.t0);
    if (e.key === 'End') setX(Z.t1);
  };
  const kritik = new Set<number>(d.kritik_yol || []);
  const byNo = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const tekrarNo = new Set<number>((d.tekrar || []).flatMap((g: any) => (g.kalemler?.length ? g.adimlar : [])));
  const ac = (no: number) => (GD && !tekrarNo.has(no) ? git(`/akis/${encodeURIComponent(kod)}/adim/${no}`, { yerine: secim != null }) : git(`/akis/${encodeURIComponent(kod)}/${tekrarNo.has(no) ? 'tekrar' : 'adim'}/${no}`));
  const kisiSec = (ad: string) => { const u = Y.G.uyeler.find((x: any) => x.ad === ad); if (u?.tip === 'dis') { setOdak(ad); setGonder(ad); } else setOdak(odak === ad ? null : ad); };

  // dokunma hedefleri (ekran koordinatı): önce gezegen, küme, soru; sonra kule, bayrak, bulut, kişi. Çakışan sonraki hedef konmaz
  type Hedef = Daire & { key: string; etiket: string; olay: Record<string, any>; sinif?: string; basili?: boolean; ipucu?: string };
  const hedefler: Hedef[] = [];
  const gor = (x: number, y: number) => gz.icinde(x, y, 8);
  // küme rozeti (3.24a): harita kümeye yumuşakça yakınlaşır; en yakında hâlâ üst üsteyse yelpaze açılır
  const KUME_YAKIN = 3.9;
  const kumeyeDokun = (c: number[], g: { x: number; y: number }) => {
    if (yelpazeNo != null && c.includes(yelpazeNo)) { setYelpazeNo(null); return; }
    const d0 = gz.g;
    if (d0.k >= KUME_YAKIN) { setYelpazeNo(c[0]); return; }
    const k = Math.min(4, d0.k * 2.5), r = k / d0.k, mx = bolge.x + bolge.w / 2, my = bolge.y + bolge.h / 2;
    gz.git({ k, tx: g.x - (g.x - d0.tx) * r + (mx - g.x), ty: g.y - (g.y - d0.ty) * r + (my - g.y) });
  };
  const kumede = new Set<number>((Y.clusters || []).flat());
  for (const g of Object.values(Y.G.gezegen)) {
    const a = byNo.get(g.no); if (!a || kumede.has(g.no) || !gor(g.x, g.y)) continue;
    hedefler.push({ key: 'g' + g.no, x: g.x, y: g.y, r: hedefYaricap(Y.radOf(g.no)), etiket: gezegenEtiketi(a, kritik.has(g.no)), ipucu: gezegenIpucu(a), olay: {
      // alt görevi olan gezegen (B4): telefonda önce uydu sarmalına yakınlaşır, yakındayken görevi açar; masaüstünde seçer ve yakınlaşır
      onClick: () => { if (bas.current.acildi) { bas.current.acildi = false; return; } if (!GD && altli.has(g.no) && kademe(gz.g.k) < 3) { gezegeneKay(g.no); return; } ac(g.no); },
      onPointerDown: () => basiliBasla(g.no), onPointerUp: basiliBirak, onPointerLeave: () => clearTimeout(bas.current.zm),
      onContextMenu: (e: any) => { e.preventDefault(); setTarihNo(g.no); bas.current.gizle = window.setTimeout(() => setTarihNo(null), 2000); },
    } });
  }
  for (const c of (Y.clusters || []) as number[][]) {
    const g = Y.G.gezegen[c[0]]; if (!gor(g.x, g.y)) continue;
    const adlar = c.map((no) => byNo.get(no)).filter(Boolean).map((a: any) => adimAdi(a));
    hedefler.push({ key: 'k' + c[0], x: g.x, y: g.y, r: Math.max(22, Y.radOf(c[0]) + 12), etiket: `${c.length} adım bir arada: ${adlar.join(', ')}. ${gz.g.k >= KUME_YAKIN ? 'Açmak' : 'Yakınlaşmak'} için dokun.`, ipucu: `${c.length} adım: ${adlar.join(', ')}`, basili: yelpazeNo != null && c.includes(yelpazeNo), olay: { onClick: () => kumeyeDokun(c, g) } });
  }
  // uydular (B4): Z3'te dokunulur; alt görev seçilir, harita yerinde kalır
  for (const u of Y.uydular || []) {
    const a = byNo.get(u.no); if (!a) continue;
    const h: Hedef = { key: 'u' + u.no, x: u.x, y: u.y, r: 22, etiket: `${u.no}. alt görev (${u.ust}. görevin), ${a.ad}. ${a.durum_etiket || a.durum}.`, ipucu: `${adimAdi(a)} · ${a.durum_etiket || a.durum}`, basili: secim === u.no, olay: { onClick: () => ac(u.no) } };
    if (gor(h.x, h.y) && bos(h, hedefler)) hedefler.push(h);
  }
  SK.hedefler.forEach((h, i) => hedefler.push({ key: 'soru' + i, x: h.x, y: h.y, r: h.r, etiket: h.etiket, olay: { onClick: () => git(`/akis/${encodeURIComponent(kod)}/soru/${encodeURIComponent(h.soru)}`) } }));
  const koy = (h: Hedef) => { if (gor(h.x, h.y) && bos(h, hedefler)) hedefler.push(h); };
  const kule = Y.G.kule;
  if (kule && !d.akis.kapandi_at) for (const dy of [-8, -20, -32]) {
    const h: Hedef = { key: 'kule', x: kule.x, y: kule.y + dy, r: 22, etiket: `Hedef${d.akis.hedef_tarih ? ' ' + gunAyUzun(d.akis.hedef_tarih) : ''}. En erken bitiş, pay ve kritik yol.`, basili: kuleAcik, olay: { onClick: () => setKuleAcik(!kuleAcik) } };
    if (bos(h, hedefler)) { koy(h); break; }
  }
  // R18: bayrak ve bulut hedefi çakışırsa simgenin çevresinde boş yer aranır (tam boy, 44 px)
  for (const ik of (Y.ikonlar || []) as any[]) {
    const a = byNo.get(ik.no); if (!a) continue;
    const temel: Omit<Hedef, 'x' | 'y' | 'r'> = ik.tur === 'bayrak'
      ? { key: 'bayrak' + ik.no, etiket: `Karar: ${a.ad}.`, olay: { onClick: () => git(`/akis/${encodeURIComponent(kod)}/karar/${ik.no}`) } }
      : { key: 'bulut' + ik.no, etiket: `Engel: ${a.engel ? a.engel.replace(/[.\s]+$/, '') : a.ad}.`, olay: { onClick: () => ac(ik.no) } };
    const yer = [[0, 0], [0, -10], [10, -6], [-10, -6], [12, 6], [-12, 6], [0, -18], [18, -8], [-18, -8], [20, 8], [-20, 8]].map(([dx, dy]) => ({ x: ik.x + dx, y: ik.y + dy, r: 22 })).find((c) => gor(c.x, c.y) && bos(c, hedefler));
    if (yer) hedefler.push({ ...temel, ...yer } as Hedef);
  }
  for (const sh of (Y.gemiler || []) as any[]) {
    const n = d.adimlar.filter((a: any) => a.sahip === sh.ad && !BITTI(a.durum)).length;
    const tur = sh.tip === 'agent' ? 'agent' : sh.tip === 'dis' ? 'dış katılımcı' : 'insan';
    // gemi kalabalıkta kalırsa hedef küçülür ve gemi gövdesi içinde boş yere kayar (kişi her zaman seçilebilir)
    // önce tam boy (44 px) hedef gemi çevresinde aranır, sonra küçülür
    const yakin = [[0, 0], [0, 8], [8, 4], [-8, 4], [0, -8], [10, 10], [-10, 10]], uzak = [[0, 14], [14, 0], [-14, 0], [0, -14], [12, 12], [-12, 12], [12, -12], [-12, -12]];
    const yer = [...[...yakin, ...uzak].map(([dx, dy]) => ({ x: sh.x + dx, y: sh.y + dy, r: 22 })), ...[18, 15].flatMap((r) => yakin.map(([dx, dy]) => ({ x: sh.x + dx, y: sh.y + dy, r })))].find((c) => gor(c.x, c.y) && bos(c, hedefler));
    if (yer) hedefler.push({ key: 'kisi' + sh.ad, ...yer, etiket: `${sh.ad} (${tur}): ${n} açık adım. Yolunu öne çıkar.`, basili: odak === sh.ad && kisiKarti === sh.ad, olay: { onClick: () => { setKisiKarti(odak === sh.ad ? null : sh.ad); kisiSec(sh.ad); } } });
  }

  // lejant: sayılar ve satıra dokununca yanıp sönecek gezegenler (yalnız haritada çizilen ana görevler)
  const isaretli = lejantGezegenleri(d, temel?.G);
  const lejantSayilari = { ...galaksiSayilari(d.adimlar, d), ortak: isaretli.ortak.length, ip: temel?.G.ipler.length ?? 0, darbogaz: isaretli.darbogaz.length || undefined };
  const vurgula = (an: string) => { const n = (isaretli as Record<string, number[]>)[an]; if (n?.length) setParla(new Set(n)); };
  // kişi süzgeci ayrı kutuda (Kişiler ▾); lejant yalnız durum süzer (plan 28 Eki, B6)
  const odakAyar: OdakAyar = {
    kisiler: [], kisi: odak, kisiSec: (k) => { setKisiKarti(null); setOdak(k); },
    durumlar: (Object.keys(GDURUM) as GDurum[]).map((k) => ({ k, ad: GDURUM[k].ad, n: d.adimlar.filter((a: any) => GDURUM[k].uyar(a, sahip)).length })),
    durum: durumOdak, durumSec: (k) => setDurumOdak(k as GDurum | null),
  };
  const kontroller = (
    <>
      {/* sarmal: gezegenler (dokun → adım), küme (dokun → yelpaze), kule, bayrak, bulut, kişiler; iki parmak yakınlaşır, bir parmak kaydırır */}
      <div ref={gz.ref} className="harita-gezinme" style={{ left: bolge.x, top: bolge.y, width: bolge.w, height: bolge.h }} {...gz.olaylar}>
      <div role="list" aria-label="Harita" className="harita-katman" style={{ left: -bolge.x, top: -bolge.y }}>
        {hedefler.map((h) => <button key={h.key} role="listitem" className={`gezegen-hedef${h.sinif ? ' ' + h.sinif : ''}`} style={{ left: h.x - h.r, top: h.y - h.r, width: h.r * 2, height: h.r * 2 }} aria-label={h.etiket} data-ipucu={h.ipucu} aria-pressed={h.basili} {...h.olay} />)}
      </div>
      </div>
      {cizim.YP && <>
        <button className="yelpaze-perde" aria-label="Kümeyi kapat" onClick={() => setYelpazeNo(null)} />
        <div role="list" aria-label="Küme" className="harita-katman">
          {cizim.YP.uyeler.map((u) => { const a = byNo.get(u.no); return a && <button key={u.no} role="listitem" className="gezegen-hedef" style={{ left: u.x - 22, top: u.y - 22, width: 44, height: 44 }} aria-label={gezegenEtiketi(a, kritik.has(u.no))} onClick={() => { setYelpazeNo(null); ac(u.no); }} />; })}
          <button role="listitem" className="gezegen-hedef" style={{ left: cizim.YP.merkez[0] - 22, top: cizim.YP.merkez[1] - 22, width: 44, height: 44 }} aria-label="Kümeyi kapat" onClick={() => setYelpazeNo(null)} />
        </div>
      </>}
      {/* yakınlaşma düğmeleri: geniş düzende her zaman; telefonda yalnız yakınken "sığdır" (tekerlek ve iki parmak yeter) */}
      <div className="harita-yakin" style={{ left: bolge.x + bolge.w - (GD ? 64 : 58), top: bolge.y + 6 }}>
        {GD && <button type="button" aria-label="Yakınlaştır" disabled={zk >= 3.999} onClick={() => gz.yakinlas(1.5)}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,0 H5 M0,-5 V5" /></svg></button>}
        {GD && <button type="button" aria-label="Uzaklaştır" disabled={!yak} onClick={() => gz.yakinlas(1 / 1.5)}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,0 H5" /></svg></button>}
        {(GD || yak) && <button type="button" aria-label="Haritayı sığdır" disabled={!yak} onClick={gz.sigdir}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-6,-2 V-6 H-2 M2,-6 H6 V-2 M6,2 V6 H2 M-2,6 H-6 V2" /></svg></button>}
      </div>

      {/* zaman sürgüsü */}
      <button className="surgu-oynat" style={{ left: SU.x, top: SU.y - 22 }} aria-label={oynuyor ? 'Durdur' : 'Oynat'} onClick={() => { if (!oynuyor && X >= Z.t1 - 36e5) setX(Z.t0); setOynuyor(!oynuyor); }} />
      <div className="surgu-ray" role="slider" tabIndex={0} aria-label="Zaman" aria-valuemin={Z.t0} aria-valuemax={Z.t1} aria-valuenow={Math.round(X)}
        aria-valuetext={`${surguEtiket}. ${gunAyUzun(Z.t0)} ile ${gunAyUzun(Y.G.hedef)} arası.`}
        style={{ left: Math.max(Z.x0 - 22, SU.x + 46), top: SU.y - 22, width: Z.x1 + 22 - Math.max(Z.x0 - 22, SU.x + 46) }}
        onKeyDown={surguTus}
        onPointerDown={(e) => { setOynuyor(false); e.currentTarget.setPointerCapture(e.pointerId); surguTasi(e); }}
        onPointerMove={(e) => { if (e.buttons) surguTasi(e); }} />
      <button className="surgu-hap" style={{ left: Math.min(Math.max(Z.xOf(X), Z.x0 + 40), Z.x1 - 40) - 48, top: SU.y - 22 * SU.ps - 22 }} aria-label="Bugüne dön" onClick={() => { setOynuyor(false); setX(NOW); }} />

      {/* süzgeç satırı: Kişiler ▾, harita dili, seçili süzgeç çipleri (plan 28 Eki, B6, B10) */}
      <HaritaCipleri x={bolge.x + 12} y={bolge.y + 8} en={bolge.w - (GD ? 88 : 82)} secici={{ yazi: 'Kişiler', ikon: true, ac: () => setKisiKutu(true) }} lejantAc={() => setLejant(true)}
        cipler={[odak && { ad: odak.replace(/\s*\(.*\)$/, ''), etiket: 'Kişi', kaldir: () => { setOdak(null); setKisiKarti(null); } }, durumOdak && { ad: GDURUM[durumOdak].ad, etiket: 'Durum', kaldir: () => setDurumOdak(null) }].filter(Boolean) as HaritaCipi[]} />
      <KisiSuzgec acik={kisiKutu} kapat={() => setKisiKutu(false)} kisiler={akisKisileri(d)} secili={odak}
        uygula={(k) => { setKisiKarti(null); setOdak(k); }} kisiSayfasi={(ad) => git(`/akis/${encodeURIComponent(kod)}/kisi/${encodeURIComponent(ad)}`)} />
      {/* geçmişe ya da tahmine bakarken haritanın üstünde şerit ve "Bugüne dön" (plan 27 Eki, 3.25) */}
      {Math.abs(X - NOW) >= 36e5 && <div className="zaman-seridi" role="status" style={{ left: bolge.x + 16, top: bolge.y + 60 }}>
        <span>{X < NOW ? 'Geçmişe bakıyorsun' : 'Tahmine bakıyorsun'} · {gunAy(X)}</span>
        <button type="button" onClick={() => { setOynuyor(false); setX(NOW); }}>Bugüne dön</button>
      </div>}
      {gonder && <><BaglantiGonder kod={kod} kisi={gonder} kisiId={(d.sahipler || []).find((x: any) => x.ad === gonder)?.kisi_id} adimSayisi={d.adimlar.filter((a: any) => a.sahip === gonder).length} kapat={() => { setGonder(null); setOdak(null); }} /></>}
    </>
  );

  if (GD) {
    const U = GD.ust, a = secim != null ? byNo.get(secim) : null, au = a?.ust_adim != null ? byNo.get(a.ust_adim) : null;
    const panelKonum = a && secim != null ? `${ad} › ${au ? `${adimAdi(au)} › ` : ''}${adimAdi(a)}` : ad;
    return (
      <GenisSahne gok={{ tohum: 101, yildiz: 280, parilti: 10, sakin }} w={GD.W} h={GD.H} etiket={ad} sinif={gelis ? 'harita-gelis' : ''}
        cizim={panelZemini(GD) + cizim.svg}>
        <button type="button" className="genis-geri" style={{ left: U.geriX - 22, top: U.geriY - 22 }} aria-label="Geri" onClick={() => (history.length > 1 ? history.back() : git('/'))} />
        <h1 className="genis-baslik" style={{ left: U.baslikX, top: U.baslikY - U.fs * 1.02, fontSize: U.fs, lineHeight: `${Math.round(U.fs * 1.25)}px` }}>{ad}</h1>
        <BaglantiKopyala kod={kod} ikon style={{ position: 'absolute', left: GD.PX - 64, top: U.geriY - 22 }} />
      <Lejant acik={lejant} kapat={() => setLejant(false)} sayilar={lejantSayilari} akis={kod} odak={odakAyar} vurgula={vurgula} />
        <div className="galaksi-ust" style={{ left: U.cumleX, top: U.cumleY - 14, width: GD.PX - U.cumleX - 80 }}>
          <KararSeridi oz={d.akis.karar_ozeti} className="statik" adimaGit={ac} neden={d.bitis ? () => setNeden(true) : undefined} />
        </div>
        {/* panelin üstü (N9): seçili adımdan akışa geri, konum; zil, ayarlar, yeni iş */}
        <div style={{ position: 'absolute', left: GD.PX, top: 0, width: GD.W - GD.PX }}>
          <PanelUst geri={ai ? devirAiKapat : secim != null ? () => git(`/akis/${encodeURIComponent(kod)}`, { yerine: true }) : undefined} konum={ai ? 'Devir AI' : panelKonum} />
        </div>
        <YuzenGezinme aktif="akislar" solEn={GD.PX} />
        {kontroller}
        {/* seçili görev: telefondakiyle aynı detay, panelde kendi içinde kayar (W2, N18, N21); seçim yoksa adım listesi (N16) */}
        {ai ? <div className="gd-kaydir genis-gorev" style={{ left: GD.kart.x, top: GD.kart.y - 40, width: GD.kart.w, height: GD.H - GD.kart.y + 24 }}><DevirAiPanel /></div>
        : a ? <div className="gd-kaydir genis-gorev" style={{ left: GD.kart.x, top: GD.kart.y, width: GD.kart.w, height: GD.H - GD.kart.y - 16 }}>
          <GorevDetay key={a.no} kod={kod} no={a.no} ben={sahip} />
        </div> : <div className="gd-kaydir genis-liste" style={{ left: GD.kart.x - 20, top: GD.kart.y - 12, width: GD.kart.w + 40, height: GD.H - GD.kart.y }}>
          <div style={{ position: 'relative', height: B.y + 24 }}>{B.dugum}</div>
        </div>}
        <TarihNeden acik={neden} kapat={() => setNeden(false)} d={d} adimaGit={ac} />
      </GenisSahne>
    );
  }

  return (
    <Sahne gok={{ tohum: 33, yildiz: 280, sakin }} cizim={cizim.svg} etiket={ad} sinif={gelis ? 'harita-gelis' : ''} yukseklik={B.y + 40}>
      <span className="kaydir-durak" style={{ top: 0 }} aria-hidden />
      <div style={{ opacity: tarihNo != null ? .58 : 1, transition: 'opacity var(--sure-kisa)' }}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={() => (history.length > 1 ? history.back() : git('/'))} sagBos={48} /></Kutu>
      <Kutu x={326} y={40} w={44} h={44}><DevirAiDugme /></Kutu>
      </div>

      {kontroller}
      {serit && <div className="galaksi-ust" style={{ left: 20, right: 20, top: HARITA_UST }}>
        <KararSeridi oz={d.akis.karar_ozeti} className="statik" adimaGit={ac} neden={d.bitis ? () => setNeden(true) : undefined} />
      </div>}
      <button type="button" className="bolum-ipucu" style={{ top: 812 }} onClick={() => bolumAc()}>{B.ad} ve ayrıntılar</button>
      <h2 ref={bolumRef} className="bolum-durak" style={{ top: BOLUM_Y }}>{ad}</h2>
      {B.dugum}
      <Lejant acik={lejant} kapat={() => setLejant(false)} sayilar={lejantSayilari} akis={kod} odak={odakAyar} vurgula={vurgula} />
      <TarihNeden acik={neden} kapat={() => setNeden(false)} d={d} adimaGit={ac} />
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
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Akış açılamadı" geri={() => git('/akislar')} /></Kutu>
      <Kutu y={600} className="kart hata-karti" role="alert">
        <p>{hata || 'Akış şu an açılamadı.'}</p>
        {hata && /bulunamadı|açık değil/.test(hata)
          ? <button className="dugme dugme-ikincil ton-mercan" onClick={() => git('/akislar', { yerine: true })}>Akışlara dön</button>
          : <button className="dugme dugme-ikincil ton-mercan" onClick={yeniden}>Yeniden dene</button>}
      </Kutu>
    </Sahne>
  );
}
