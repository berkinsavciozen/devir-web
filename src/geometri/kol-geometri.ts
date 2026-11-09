/**
 * Kol haritası (9 Kas, harita denetimi H1–H5): kur() ile aynı Galaksi arayüzünü üretir, yalnız yerleşim değişir.
 * - Kol = kişi: her insan ve dış katılımcı merkezden dışa giden kendi kolunda; agent, sahibinin kolunun yanında (ay izi).
 * - Halka = tarih: yarıçap sabit ve doğrusal; merkez akışın başlangıcı, R·HEDEF_KAT hedef tarih, R aşım bandının sonu.
 *   Ölçek o anki süreye göre değişmez, harita her gün aynı kalır; bugün halkası dışa doğru büyür.
 * - Gemi bugün halkasında (konumAn(ad, simdi)); geçmiş yol içte, gelecek dışta.
 * - Başka kişiye geçen iş, devir ipi (ipler) olarak; birden çok kişiye açılan adım ortak (uyeler > 1).
 * Bayrakla açılır (kol-bayrak.ts); kapalıyken kur() / olcekliKur() aynen çalışır.
 *
 * Zaman spirali (9 Kas 15:00, Berkin: "spiral daha mantıklıydı, yol görünsün, alan dolsun, gezegenler küçülsün"):
 * bicim 'spiral' ile herkes tek bir spiral yolda, kendi şeridinde ilerler. Yol boyu = tarih (gün aralıkları her yerde
 * eşit; yay uzunluğuna göre), merkez başlangıç, spiralin sonu hedef + aşım. Kişi = şerit (spiral bandının içinde sabit
 * kaydırma), agent sahibinin şeridine yapışık. Aynı günün işleri yan yana şeritlerde durur; devir ipi şeritler arasında
 * kısa bir köprüdür. Harita alanı turlarla dolar, ölçek her gün aynıdır.
 */
import { SABIT, darbogaz, ayrikla, type Galaksi, type GirdiAkis, type GirdiAdim, type Gezegen, type Ip, type Konum, type Uye, type ZamanliNokta, type GorselDurum, type KurSecenek } from './galaksi-geometri';

const GUN = 864e5;
type Nokta = [number, number];
const BITTI = (d: string) => d === 'tamam' || d === 'atlandi' || d === 'ertelendi';

export const KOL = Object.freeze({
  R0_KAT: 0.18,     // merkez boşluğu (başlangıç yıldızı); ilk günler sıkışmasın
  HEDEF_KAT: 0.84,  // hedef halkası
  KIVRIM: 0.7,      // kolun merkezden dışa dönüşü (radyan): düz çizgi değil, hafif sarmal
  AY_KAT: 0.075,    // agent izinin sahibinin kolundan uzaklığı (R katı)
  ASIM_GUN: 8,      // hedeften sonra aşım bandı en az bu kadar gün
  ORNEK: 6,         // yol örnekleme aralığı (px)
});

export const SPIRAL = Object.freeze({
  R0_KAT: 0.12,     // merkez boşluğu
  TUR_GUN: 9,       // bir turun aşağı yukarı kaç gün olduğu (tur sayısı süreden)
  TUR_MIN: 1.4, TUR_MAX: 3.2,
  SERIT_KAT: 0.62,  // şeritlerin bant genişliğine oranı
  GEZEGEN_KAT: 0.62, // gezegenler eski haritadan küçük
  AY_SERIT: 0.42,   // agent'ın sahibinin şeridinden kayması (şerit aralığı katı)
});

/** sy: spiral dikeyde bu kadar uzar (telefonda boş kalan dikey alanı doldurur; 1 = daire) */
export interface KolSecenek extends KurSecenek { ajanSahibi?: Record<string, string>; bicim?: 'kol' | 'spiral'; sy?: number }
export interface SpiralBilgi { spiral: true; bant: number; seritAra: number; tBas: number; tBit: number; pT: (t: number, kay?: number) => { x: number; y: number; yon: number } }

export function kurKol(akis: GirdiAkis, o: KolSecenek = {}): Galaksi & { kol?: true; rT: (t: number) => number; RH: number; RS: number } & Partial<SpiralBilgi> {
  const cx = o.cx ?? 0, cy = o.cy ?? 0, R = o.R ?? 100, ps = o.ps ?? 1, simdi = o.simdi ?? Date.now();
  const haric = new Set<number>([...(o.haric || []), ...akis.adimlar.filter((a) => a.tarih_bilinmiyor).map((a) => a.no)]);
  const adimlar = akis.adimlar.filter((a) => !haric.has(a.no));
  const byNo: Record<number, GirdiAdim> = {}; for (const a of adimlar) byNo[a.no] = a;
  const T0 = akis.t0, bitti = !!akis.kapandi;
  const tAktif = Math.max(T0, ...adimlar.map((a) => a.t));
  const hedef = Math.max(akis.hedef, T0 + GUN);
  const tSon = bitti ? (akis.kapandi as number) : Math.max(hedef, tAktif);
  const payGun = bitti ? 0 : Math.max(0, (akis.hedef - tAktif) / GUN);
  // ölçek: başlangıç → hedef doğrusal; hedeften sonrası aşım bandında (en az ASIM_GUN, gerekirse sıkışır)
  const r0 = R * KOL.R0_KAT, RH = R * KOL.HEDEF_KAT, RS = R;
  const tAsim = Math.max(hedef + KOL.ASIM_GUN * GUN, tSon, simdi);
  const rT = (t: number) => t <= hedef ? r0 + (Math.max(t, T0) - T0) / (hedef - T0) * (RH - r0) : RH + (Math.min(t, tAsim) - hedef) / (tAsim - hedef) * (RS - RH);
  const k = (RH - r0) / ((hedef - T0) / GUN);

  // 1) kollar: insanlar ve dış katılımcılar; agent, sahibinin kolunu paylaşır
  const adlar: string[] = []; for (const a of adimlar) if (!adlar.includes(a.sahip)) adlar.push(a.sahip);
  const tercih = o.sira || [akis.sahip as string];
  const sira = tercih.filter((x) => adlar.includes(x)).concat(adlar.filter((x) => !tercih.includes(x)));
  const tipOf = (ad: string): Uye['tip'] => { const ks = adimlar.filter((a) => a.sahip === ad); return ks.some((a) => a.sahip_tip === 'agent') ? 'agent' : ks.length && ks.every((a) => a.sahip_tip === 'dis') ? 'dis' : 'insan'; };
  const sahibi = (ad: string) => { const s = o.ajanSahibi?.[ad] || ad.split(/[’']/)[0]; return s !== ad && sira.includes(s) && tipOf(s) !== 'agent' ? s : null; };
  const kollar = sira.filter((ad) => tipOf(ad) !== 'agent' || !sahibi(ad));
  const n = kollar.length;
  const psiOf: Record<string, number> = {}; kollar.forEach((ad, i) => (psiOf[ad] = (-90 + i * 360 / n + (o.spin || 0)) * Math.PI / 180));
  const kolOf = (ad: string) => (kollar.includes(ad) ? ad : (sahibi(ad) as string));
  const yanOf = (ad: string) => (kollar.includes(ad) ? 0 : R * KOL.AY_KAT);
  const noktaKol = (ad: string, r: number): { x: number; y: number; yon: number } => {
    const psi = psiOf[kolOf(ad)], a = psi + KOL.KIVRIM * (r / RS), yan = yanOf(ad);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    const dx = Math.cos(a) - r * KOL.KIVRIM / RS * Math.sin(a), dy = Math.sin(a) + r * KOL.KIVRIM / RS * Math.cos(a), m = Math.hypot(dx, dy);
    return { x: cx + x - dy / m * yan, y: cy + y + dx / m * yan, yon: Math.atan2(dy, dx) };
  };
  // ---- zaman spirali: r(θ) = s0 + b·θ; yay uzunluğu ≈ s0·θ + b·θ²/2, tarih yay boyunca doğrusal ----
  const SP = o.bicim === 'spiral';
  const tBit = Math.max(hedef + KOL.ASIM_GUN * GUN, tSon, simdi);
  const gunler = (tBit - T0) / GUN;
  const tur = Math.max(SPIRAL.TUR_MIN, Math.min(SPIRAL.TUR_MAX, gunler / SPIRAL.TUR_GUN));
  const TH = tur * 2 * Math.PI, s0 = R * SPIRAL.R0_KAT;
  const bS = (R - s0) / (TH + Math.PI);          // son turun dışında yarım bant pay
  const bant = bS * 2 * Math.PI;
  const yayTop = s0 * TH + bS * TH * TH / 2;
  const nS = kollar.length;
  const seritAra = nS > 1 ? Math.min(bant * SPIRAL.SERIT_KAT / (nS - 1), bant * 0.24) : 0;
  const seritOf = (ad: string) => { const i = kollar.indexOf(kolOf(ad)); return (i - (nS - 1) / 2) * seritAra + (kollar.includes(ad) ? 0 : seritAra * SPIRAL.AY_SERIT * (i === nS - 1 && nS > 1 ? -1 : 1)); };
  const th0 = -Math.PI / 2 + (o.spin || 0) * Math.PI / 180, sy = SP ? Math.max(1, Math.min(1.5, o.sy ?? 1)) : 1;
  const pT = (t: number, kay = 0) => {
    const f = Math.max(0, Math.min(1, (t - T0) / (tBit - T0))), yy = f * yayTop;
    const th = (-s0 + Math.sqrt(s0 * s0 + 2 * bS * yy)) / bS, r = s0 + bS * th, a = th0 + th;
    const tx = bS * Math.cos(a) - r * Math.sin(a), ty = bS * Math.sin(a) + r * Math.cos(a), m = Math.hypot(tx, ty);
    // dış normal (ty, -tx)/m: şerit kayması merkezden dışa
    return { x: cx + Math.cos(a) * r + ty / m * kay, y: cy + (Math.sin(a) * r - tx / m * kay) * sy, yon: Math.atan2(ty * sy, tx) };
  };
  const nokta = (ad: string, t: number) => (SP ? pT(t, seritOf(ad)) : noktaKol(ad, rT(t)));
  // yol örnekleme adımı (ms): yaklaşık ORNEK px
  const dtOrnek = SP ? KOL.ORNEK * Math.max(ps, .5) / (yayTop / (tBit - T0)) : KOL.ORNEK * Math.max(ps, .5) / ((RH - r0) / (hedef - T0));
  const uyeler: Uye[] = sira.map((ad, i) => {
    const kendi = adimlar.filter((a) => a.sahip === ad);
    const bas = Math.min(...kendi.map((a) => a.hazir_at ?? a.basla_plan ?? a.t));
    const t0 = ad === akis.sahip ? T0 : Math.max(T0, Number.isFinite(bas) ? bas : T0);
    const son = bitti ? (akis.kapandi as number) : Math.max(...kendi.map((a) => a.t), t0);
    // yol: kolun t0 → son aralığı, yarıçapa göre zaman damgalı (yol = tarih)
    const yol: ZamanliNokta[] = [];
    const sonT = Math.max(son, t0 + 36e5);
    for (let t = t0; t < sonT; t += dtOrnek) { const p = nokta(ad, t); yol.push({ x: p.x, y: p.y, t }); }
    const p = nokta(ad, sonT); yol.push({ x: p.x, y: p.y, t: Math.max(sonT, (yol[yol.length - 1]?.t ?? t0) + 1) });
    return { ad, i, tip: tipOf(ad), psi: psiOf[kolOf(ad)], t0, hayalet: kendi.every((a) => a.durum === 'atlandi'), kendi: kendi.map((a) => a.no), ziyaret: kendi.map((a) => a.no), parcalar: [{ ta: t0, tb: son, L: (son - t0) / GUN, hata: 0, tur: 'dogal', pts: yol }], yol, tSon: son } as Uye;
  });
  const uyeOf: Record<string, Uye> = {}; for (const u of uyeler) uyeOf[u.ad] = u;

  // 2) gezegenler: sahibinin kolunda, bitiş tarihinin halkasında
  const kritik = new Set(akis.kritik_yol || []);
  const bekleyen: Record<number, number[]> = {}; for (const a of adimlar) for (const d of a.bagimli || []) (bekleyen[d] ||= []).push(a.no);
  const gecisli = (no: number, acik: boolean) => { const g = new Set<number>(), st = [...(bekleyen[no] || [])]; while (st.length) { const x = st.pop() as number; if (g.has(x) || !byNo[x] || byNo[x].durum === 'atlandi') continue; if (acik && BITTI(byNo[x].durum)) continue; g.add(x); st.push(...(bekleyen[x] || [])); } return g.size; };
  const gezegen: Record<number, Gezegen> = {}, ipler: Ip[] = [];
  for (const a of adimlar) {
    const p = nokta(a.sahip, a.t);
    // ortak iş: işi bekleyenler en az iki başka kola dağılıyorsa halka o kişilerin renkleriyle bölünür
    const acilan = [...new Set((bekleyen[a.no] || []).map((x) => byNo[x]?.sahip).filter((s) => s && kolOf(s) !== kolOf(a.sahip)).map((s) => kolOf(s as string)))];
    const uy = acilan.length >= 2 ? [a.sahip, ...acilan] : [a.sahip];
    const W = gecisli(a.no, !BITTI(a.durum)), dz = darbogaz(a, W, kritik.has(a.no), 1, ps, simdi);
    gezegen[a.no] = { no: a.no, x: p.x, y: p.y, t: a.t, r: SP ? dz.r * SPIRAL.GEZEGEN_KAT : dz.r, puan: dz.puan, korona: dz.korona, W, uyeler: uy, ortak: uy.length > 1, kritik: kritik.has(a.no) };
    // devir ipi: bu işi bekleyen başka koldaki kişiye doğru kısa ok
    for (const x of bekleyen[a.no] || []) { const b = byNo[x]; if (!b || b.durum === 'atlandi' || kolOf(b.sahip) === kolOf(a.sahip)) continue; if (!ipler.some((q) => q.no === a.no && kolOf(q.uye) === kolOf(b.sahip))) ipler.push({ no: a.no, uye: b.sahip, t: a.t }); }
  }

  // 3) hedef kapısı: kritik yolun son adımının kolunda, hedef halkasında; pay, o koldan hedefe kuyruk
  const sonK = [...kritik].filter((x) => gezegen[x]).sort((x, y) => gezegen[x].t - gezegen[y].t).pop() ?? adimlar.slice().sort((x, y) => x.t - y.t).pop()?.no;
  const kuleUye = sonK != null ? byNo[sonK].sahip : sira[0];
  const gec = !bitti && tAktif > akis.hedef + 6 * 36e5;
  const kp = SP ? pT(bitti ? (akis.kapandi as number) : akis.hedef) : nokta(kuleUye, bitti ? (akis.kapandi as number) : akis.hedef);
  const kule = { x: kp.x, y: kp.y, t: bitti ? (akis.kapandi as number) : akis.hedef, uye: kuleUye, gec };
  let kuyruk: Galaksi['kuyruk'] = null;
  if (!bitti && sonK != null && akis.hedef > gezegen[sonK].t) {
    const pts: ZamanliNokta[] = [];
    for (let t = gezegen[sonK].t; t < akis.hedef; t += dtOrnek) { const p = nokta(kuleUye, t); pts.push({ x: p.x, y: p.y, t }); }
    const ph = nokta(kuleUye, akis.hedef); pts.push({ x: ph.x, y: ph.y, t: akis.hedef });
    const gercek = (akis.hedef - gezegen[sonK].t) / GUN;
    kuyruk = { ta: gezegen[sonK].t, tb: akis.hedef, L: gercek, gercekGun: gercek, kirik: false, P: pts.map((p) => [p.x, p.y] as Nokta), hata: 0, pts };
  }

  // ---------- sorgular (kur() ile aynı anlam) ----------
  const yolu = (ad: string, kq?: boolean) => { const u = uyeOf[ad]; return kq && kuyruk && ad === kuleUye ? u.yol.concat(kuyruk.pts.slice(1)) : u.yol; };
  function konumAn(ad: string, t: number, o2: { kuyruk?: boolean } = {}): Konum | null {
    const u = uyeOf[ad]; if (!u || t < u.t0) return null;
    const Y = yolu(ad, o2.kuyruk);
    if (t >= Y[Y.length - 1].t) { const p = Y[Y.length - 1], q = Y[Math.max(0, Y.length - 2)]; return { x: p.x, y: p.y, yon: Math.atan2(p.y - q.y, p.x - q.x), demir: true }; }
    for (let i = 1; i < Y.length; i++) if (Y[i].t >= t) { const p = Y[i - 1], q = Y[i], f = (t - p.t) / ((q.t - p.t) || 1); return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, yon: Math.atan2(q.y - p.y, q.x - p.x), demir: false }; }
    return { x: Y[0].x, y: Y[0].y, yon: 0 };
  }
  function kesit(ad: string, ta: number, tb: number, o2: { kuyruk?: boolean } = {}): Nokta[] {
    const u = uyeOf[ad]; if (!u) return [];
    const Y = yolu(ad, o2.kuyruk), a = Math.max(ta, Y[0].t, u.t0), z = Math.min(tb, Y[Y.length - 1].t);
    if (z <= a) return [];
    const out: Nokta[] = [], pa = konumAn(ad, a, o2)!, pz = konumAn(ad, z, o2)!;
    out.push([pa.x, pa.y]); for (const p of Y) if (p.t > a && p.t < z) out.push([p.x, p.y]); out.push([pz.x, pz.y]);
    return out;
  }
  function durumAn(no: number, x: number): GorselDurum | null {
    const a = byNo[no]; if (!a) return null;
    if (BITTI(a.durum) && a.t <= x) return a.durum === 'atlandi' ? 'ghost' : a.durum === 'ertelendi' ? 'ertele' : 'lit';
    if (x > simdi && !BITTI(a.durum) && a.t <= x) return 'tahmin';
    const xx = Math.min(x, simdi);
    if (a.durum === 'engelli' && a.engel_at != null && a.engel_at <= xx) return 'block';
    if (a.hazir_at != null && a.hazir_at <= xx) return a.durum === 'suruyor' && x >= simdi - 36e5 ? 'run' : 'wait';
    if (x >= simdi - 36e5 && ['hazir', 'suruyor'].includes(a.durum)) return a.durum === 'suruyor' ? 'run' : 'wait';
    return 'dark';
  }
  function kumeler(radOf: (no: number) => number = (no) => gezegen[no].r, nos: number[] = Object.keys(gezegen).map(Number)): number[][] {
    const par: Record<number, number> = {}; nos.forEach((x) => (par[x] = x));
    const fnd = (x: number): number => (par[x] === x ? x : (par[x] = fnd(par[x])));
    for (let i = 0; i < nos.length; i++) for (let j = i + 1; j < nos.length; j++) {
      const A = gezegen[nos[i]], B = gezegen[nos[j]];
      if (Math.hypot(A.x - B.x, A.y - B.y) < (radOf(nos[i]) + radOf(nos[j])) * SABIT.YAKIN) par[fnd(nos[i])] = fnd(nos[j]);
    }
    const g: Record<number, number[]> = {}; for (const x of nos) (g[fnd(x)] ||= []).push(x);
    return Object.values(g).filter((x) => x.length > 1);
  }
  const seritX = (t: number, x0: number, pxGun: number) => x0 + (t - T0) / GUN * pxGun;
  // aynı ana düşen gezegenler kol yönünde aralanır (kur() ile aynı kural)
  ayrikla(gezegen, R / (o.R0 ?? R), (no) => { const p = nokta(byNo[no].sahip, gezegen[no].t); return [Math.cos(p.yon), Math.sin(p.yon)]; });
  const ek = SP ? { spiral: true as const, bant, seritAra, tBas: T0, tBit, pT } : { kol: true as const };
  return { ...ek, rT, RH, RS, cx, cy, R, ps, k, b: 0, T0, tSon, payGun, hedef: akis.hedef, kapandi: akis.kapandi, simdi, uyeler, uyeOf, gezegen, ipler, kule, kuyruk, gec, kuleUye, byNo, konumAn, kesit, durumAn, kumeler, seritX, haric };
}
