/*
 * Fener Masalı · YOL GEOMETRİSİ v2 (saf TS, çizim yok, bağımlılık yok)
 * ---------------------------------------------------------------
 * tasarim/kaynak/galaksi-geometri.js'in birebir TypeScript taşıması. Mantık değiştirilmez;
 * eşdeğerlik testi (galaksi-geometri.test.ts) iki modülün çıktısını bütün örnek akışlarda karşılaştırır.
 *
 * Kurallar (SPESIFIKASYON.md §4):
 *  1. Galaksinin merkezi akışın t=0 anıdır (olusturuldu).
 *  2. Her üyenin (insan, agent, dış katılımcı) merkezden çıkan kendi yolu vardır. Yol, üyenin kendi t0 anında
 *     merkezden başlar; geç katılan aynı merkezden, zamanda daha ileriden çıkar.
 *     Ortak adım (bağımlılıkta devir alınan adım) birden çok yolun üstündeki TEK gezegendir; yollar orada kesişir.
 *  3. Bir yolda iki gezegen arasındaki yol uzunluğu, aradaki süreyle DOĞRU ORANTILIDIR (sabit hız).
 *  4. Gezegen yarıçapı darboğaz puanından gelir (bekleyen adım sayısı, kritik yol, engel süresi, gelen yol sayısı).
 *  5. Zaman sürgüsü: herhangi bir x anında gemi konumu, yanan gezegenler, x'e kadar çizilen yol (konumAn, kesit, durumAn).
 *  6. Evren görünümü aynı fonksiyonun düşük ayrıntılı çizimidir.
 *  7. Şeritler: her üyenin yolu yatay bir şeride açılır; x = zaman (yol uzunluğu ∝ zaman olduğu için açılım birebirdir).
 *
 * Zamanlar ms (UTC). Geometri içinde uzunluk birimi "gün"dür (hız c = 1); çıktı pikseldir (k piksel/gün).
 */

export type Durum = 'tamam' | 'atlandi' | 'ertelendi' | 'hazir' | 'suruyor' | 'engelli' | 'sirada' | string;
export type SahipTip = 'insan' | 'agent' | 'dis' | string;
export type GorselDurum = 'lit' | 'ghost' | 'ertele' | 'tahmin' | 'block' | 'run' | 'wait' | 'dark';

export interface GirdiAdim {
  no: number;
  sahip: string;
  sahip_tip?: SahipTip;
  durum: Durum;
  /** bitiş: durum_at ya da en_erken_bitis (ms) */
  t: number;
  bagimli?: number[];
  hazir_at?: number | null;
  basla_plan?: number | null;
  engel_at?: number | null;
  bekleme_saat?: number | null;
  tarih_bilinmiyor?: boolean;
}

export interface GirdiOlay {
  t: number;
  kim?: string;
  kim_tip?: string;
  arac?: string | null;
  tip?: string;
  adim_no?: number | null;
  durum?: string | null;
}

export interface GirdiAkis {
  t0: number;
  hedef: number;
  kapandi: number | null;
  sahip?: string;
  kritik_yol?: number[];
  adimlar: GirdiAdim[];
  olaylar?: GirdiOlay[];
}

export interface KurSecenek {
  cx?: number;
  cy?: number;
  R?: number;
  ps?: number;
  simdi?: number;
  sira?: string[];
  spin?: number;
  haric?: number[];
}

type Polar = { r: number; th: number };
type Nokta = [number, number];

export interface ZamanliNokta { x: number; y: number; t: number }
export interface Parca { ta: number; tb: number; L: number; hata: number; tur: 'dogal' | 'aktarma'; pts: ZamanliNokta[] }

export interface Uye {
  ad: string;
  i: number;
  tip: 'insan' | 'agent' | 'dis';
  psi: number;
  t0: number;
  hayalet: boolean;
  kendi: number[];
  ziyaret: number[];
  parcalar: Parca[];
  yol: ZamanliNokta[];
  tSon: number;
}

export interface Gezegen {
  no: number;
  x: number;
  y: number;
  t: number;
  r: number;
  puan: number;
  /** darboğaz tacı: 0 sönük, 1 ışıklı, 2 nabız (plan 27 Eki, 3.A) */
  korona: 0 | 1 | 2;
  W: number;
  uyeler: string[];
  ortak: boolean;
  kritik: boolean;
}

export interface Ip { no: number; uye: string; t: number }
export interface Kule { x: number; y: number; t: number; uye: string; gec?: boolean }
export interface Kuyruk { ta: number; tb: number; L: number; gercekGun: number; kirik: boolean; P: Nokta[]; hata: number; pts: ZamanliNokta[] }
export interface Konum { x: number; y: number; yon: number; demir?: boolean }

export interface Galaksi {
  cx: number;
  cy: number;
  R: number;
  ps: number;
  k: number;
  b: number;
  T0: number;
  tSon: number;
  payGun: number;
  hedef: number;
  kapandi: number | null;
  simdi: number;
  uyeler: Uye[];
  uyeOf: Record<string, Uye>;
  gezegen: Record<number, Gezegen>;
  ipler: Ip[];
  kule: Kule | null;
  kuyruk: Kuyruk | null;
  gec: boolean;
  kuleUye: string;
  byNo: Record<number, GirdiAdim>;
  konumAn(ad: string, t: number, o?: { kuyruk?: boolean }): Konum | null;
  kesit(ad: string, ta: number, tb: number, o?: { kuyruk?: boolean }): Nokta[];
  durumAn(no: number, x: number): GorselDurum | null;
  kumeler(radOf?: (no: number) => number, nos?: number[]): number[][];
  seritX(t: number, x0: number, pxGun: number): number;
  haric: Set<number>;
}

const GUN = 864e5, TAU = Math.PI * 2;
export const SABIT = Object.freeze({
  PHI_SON: 8.0,      // t0'da çıkan üye akış sonunda sarmalda 8 radyan (≈1.3 tur) dönmüş olur
  ORNEK: 48,         // bir yol parçasındaki örnek nokta sayısı
  K_MAX: 3,          // aktarma yolunda en çok fazladan tam tur
  DEVIR_PAY: 3600e3, // girdi, alıcı başladıktan en az 1 saat sonra bittiyse yollar kesişir
  YAKIN: 0.8,        // küme: merkezler arası < (r1+r2)·0.8
  KUYRUK_MAX: 0.5,   // iş payı kuyruğu en çok (etkin süre × 0.5) uzunlukta çizilir; fazlası kırık işaretle kısaltılır
});
const polar = (x: number, y: number): Polar => ({ r: Math.hypot(x, y), th: Math.atan2(y, x) });
const kart = (p: Polar): Nokta => [Math.cos(p.th) * p.r, Math.sin(p.th) * p.r];
const BITTI = (d: Durum) => d === 'tamam' || d === 'atlandi' || d === 'ertelendi';
const modT = (a: number) => ((a % TAU) + TAU) % TAU;

// ---------- Arşimet sarmalı r = b·φ ; yay uzunluğu = b·S(φ), S(φ) = ½(φ√(1+φ²) + asinh φ) ----------
export const S = (phi: number) => 0.5 * (phi * Math.sqrt(1 + phi * phi) + Math.asinh(phi));
export function phiOfS(s: number) { // S(φ) = s → φ (Newton; S'(φ) = √(1+φ²))
  if (s <= 0) return 0;
  let p = Math.sqrt(2 * s);
  for (let i = 0; i < 40; i++) { const e = S(p) - s; p -= e / Math.sqrt(1 + p * p); if (Math.abs(e) < 1e-12) break; }
  return Math.max(0, p);
}

// ---------- kutupsal ara yol ----------
// q ∈ [0,1]:  r(q) = rA + (rB − rA)·q + β·sin(πq) ,  θ(q) = θA + Δθ·q
// β = 0 ve Δθ = (rB − rA)/b iken bu tam olarak Arşimet sarmalının parçasıdır (doğal yol).
export function araYol(A: Polar, B: Polar, dth: number, beta: number, n: number = SABIT.ORNEK): Nokta[] {
  const P: Nokta[] = [];
  for (let i = 0; i <= n; i++) {
    const q = i / n, r = A.r + (B.r - A.r) * q + beta * Math.sin(Math.PI * q), th = A.th + dth * q;
    P.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  return P;
}
const uzunluk = (P: Nokta[]) => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };

/** A'dan B'ye TAM L uzunluğunda yol (aktarma). Tek parametreli aile, p ∈ [−1, ∞):
 *   p < 0 : sarmal parça ile düz kiriş arasında karışım, λ = −p  (p = −1 → düz çizgi, uzunluk = kiriş)
 *   p ≥ 0 : sarmal parçanın ortası β = p·L kadar dışa şişer (uzunluk artar)
 *  Kiriş ≤ L olduğu sürece çözüm vardır. Tur sayısı k = 0..K_MAX denenir; |p| en küçük çözüm seçilir. */
function aileNoktalari(A: Polar, B: Polar, dth: number, p: number): Nokta[] {
  const sp = araYol(A, B, dth, p > 0 ? p : 0);
  if (p >= 0) return sp;
  const lam = Math.min(1, -p), [ax, ay] = kart(A), [bx, by] = kart(B), n = sp.length - 1;
  return sp.map(([x, y], i): Nokta => [x * (1 - lam) + (ax + (bx - ax) * i / n) * lam, y * (1 - lam) + (ay + (by - ay) * i / n) * lam]);
}
export function aktarma(A: Polar, B: Polar, L: number): { P: Nokta[]; hata: number; p: number; k: number } {
  const [ax, ay] = kart(A), [bx, by] = kart(B), kir = Math.hypot(bx - ax, by - ay);
  if (L < 1e-9 || L <= kir) return { P: [[ax, ay], [bx, by]], hata: L < 1e-9 ? 0 : (kir - L) / L, p: -1, k: 0 };
  const base = modT(B.th - A.th);
  let en: { P: Nokta[]; hata: number; p: number; k: number } | null = null;
  for (let k = 0; k <= SABIT.K_MAX; k++) {
    const dth = base + TAU * k, f = (p: number) => uzunluk(aileNoktalari(A, B, dth, p * (p > 0 ? L : 1)));
    let lo = -1, hi = 1;
    while (f(hi) < L && hi < 1e4) hi *= 2;
    for (let i = 0; i < 64; i++) { const m = (lo + hi) / 2; if (f(m) < L) lo = m; else hi = m; }
    const p = (lo + hi) / 2, P = aileNoktalari(A, B, dth, p * (p > 0 ? L : 1)), h = Math.abs(uzunluk(P) - L) / L;
    if (!en || Math.abs(p) < Math.abs(en.p)) en = { P, hata: h, p, k };
  }
  return en!;
}

/** doğal ilerleme: A'dan geçen sarmal (faz ψ = θA − rA/b) üzerinde L kadar dışa */
export function dogal(A: Polar, L: number, b: number): Polar {
  const phi0 = A.r / b, psi = A.th - phi0, phi1 = phiOfS(S(phi0) + L / b);
  return { r: b * phi1, th: psi + phi1 };
}

// ---------- darboğaz puanı → taç (korona) ----------
/**
 * Plan 27 Eki, 3.A: gezegen boyu sabit; darboğaz gezegenin çevresindeki taçla söylenir.
 * puan = ln(1 + W) + 0.5·ln(1 + E)   (kritik yol artık puana girmez; altın elmasla ayrıca işaretli)
 *   W = geçişli bekleyen açık adım sayısı (adım bittiyse bütün geçişli bekleyenlerin yarısı: iz)
 *   E = engelli gün (bekleme_saat / 24; yalnız engelli adımda)
 * taç: puan < 0.7 → 0 (sönük), 0.7–1.6 → 1 (ışıklı), > 1.6 → 2 (nabız atan)
 * yarıçap = 7·ps; çok yol gelen gezegende yollar sığsın diye en çok 11·ps'e kadar (4 + 2.5·gelenYol); atlandı 6·ps
 */
export const KORONA = { ISIKLI: 0.7, NABIZ: 1.6 };
export function darbogaz(adim: Pick<GirdiAdim, 'durum' | 'bekleme_saat' | 'engel_at'>, W: number, _kritik: boolean, gelen: number, ps = 1, simdi = Date.now()) {
  if (adim.durum === 'atlandi') return { puan: 0, r: 6 * ps, korona: 0 as const };
  const Wx = BITTI(adim.durum) ? W * 0.5 : W;
  const E = adim.durum !== 'engelli' ? 0 : adim.bekleme_saat != null ? adim.bekleme_saat / 24 : adim.engel_at != null ? Math.max(0, simdi - adim.engel_at) / GUN : 0;
  const puan = Math.log(1 + Wx) + 0.5 * Math.log(1 + E);
  const korona = (BITTI(adim.durum) || puan < KORONA.ISIKLI ? 0 : puan <= KORONA.NABIZ ? 1 : 2) as 0 | 1 | 2;
  const r = Math.max(7, Math.min(11, 4 + 2.5 * gelen));
  return { puan, r: r * ps, korona };
}

type Aday = { u: Uye; L: number; A: Polar; N: Polar; sahip: boolean };
type HamParca = { ta: number; tb: number; L: number; P: Nokta[]; hata: number; tur: 'dogal' | 'aktarma' };

/**
 * Ana fonksiyon.
 * o: { cx, cy, R, ps, simdi, sira: [üye adları], spin (derece), haric: [no] (çizilmeyen: tarihi bilinmeyen, gizli dal) }
 */
export function kur(akis: GirdiAkis, o: KurSecenek = {}): Galaksi {
  const cx = o.cx ?? 0, cy = o.cy ?? 0, R = o.R ?? 100, ps = o.ps ?? 1, simdi = o.simdi ?? Date.now();
  const haric = new Set<number>([...(o.haric || []), ...akis.adimlar.filter((a) => a.tarih_bilinmiyor).map((a) => a.no)]);
  const adimlar = akis.adimlar.filter((a) => !haric.has(a.no));
  const byNo: Record<number, GirdiAdim> = {}; for (const a of adimlar) byNo[a.no] = a;
  const T0 = akis.t0, bitti = !!akis.kapandi;
  // 1) üyeler: sıra = o.sira ya da [akış sahibi] + adımlarda ilk görünüş
  const adlar: string[] = []; for (const a of adimlar) if (!adlar.includes(a.sahip)) adlar.push(a.sahip);
  const tercih = o.sira || [akis.sahip as string];
  const sira = tercih.filter((x) => adlar.includes(x)).concat(adlar.filter((x) => !tercih.includes(x)));
  const n = sira.length;
  const aktor = (e: GirdiOlay) => (e.kim_tip === 'agent' ? e.arac : e.kim);
  const uyeler: Uye[] = sira.map((ad, i) => {
    const kendi = adimlar.filter((a) => a.sahip === ad);
    const tip = kendi.some((a) => a.sahip_tip === 'agent') || /agent|Claude/i.test(ad) ? 'agent' : kendi.every((a) => a.sahip_tip === 'dis') ? 'dis' : 'insan';
    // t0: akış sahibi = olusturuldu; değilse ilk sistem dışı olayı (aktör ya da kendi adımında); yoksa ilk adımının planlanan başlangıcı
    let t0: number | null = null;
    if (ad === akis.sahip) t0 = T0;
    else {
      const no = new Set(kendi.map((a) => a.no));
      for (const e of akis.olaylar || []) if (e.kim_tip !== 'sistem' && (aktor(e) === ad || no.has(e.adim_no as number))) t0 = t0 == null ? e.t : Math.min(t0, e.t);
      if (t0 == null) for (const a of kendi) { const p = a.hazir_at ?? a.basla_plan ?? a.t; t0 = t0 == null ? p : Math.min(t0, p); }
    }
    return { ad, i, tip, psi: (-90 + i * 360 / n + (o.spin || 0)) * Math.PI / 180, t0: Math.max(T0, t0 ?? T0), hayalet: kendi.every((a) => a.durum === 'atlandi'), kendi: kendi.map((a) => a.no), ziyaret: [], parcalar: [], yol: [], tSon: 0 } as Uye;
  });
  const uyeOf: Record<string, Uye> = {}; for (const u of uyeler) uyeOf[u.ad] = u;
  // 2) ziyaretler: kendi adımları + devir aldığı adımlar (beklediği, başka üyenin, atlanmamış, alıcı başladıktan ≥1 sa sonra biten)
  const ziyaret: Record<string, Set<number>> = {}; for (const u of uyeler) ziyaret[u.ad] = new Set(u.kendi);
  for (const a of adimlar) {
    if (a.durum === 'atlandi') continue;
    const u = uyeOf[a.sahip];
    for (const d of a.bagimli || []) {
      const dep = byNo[d]; if (!dep || dep.durum === 'atlandi' || dep.sahip === a.sahip) continue;
      if (dep.t > u.t0 + SABIT.DEVIR_PAY) ziyaret[a.sahip].add(d);
    }
  }
  for (const u of uyeler) {
    u.ziyaret = [...ziyaret[u.ad]].sort((x, y) => byNo[x].t - byNo[y].t || x - y);
    if (u.ziyaret.length) u.t0 = Math.min(u.t0, byNo[u.ziyaret[0]].t);
  }
  // 3) sarmal adımı b: t0'da çıkan üye akış sonunda PHI_SON radyan döner
  const tAktif = Math.max(T0, ...adimlar.map((a) => a.t)), aktifGun = (tAktif - T0) / GUN;
  const tSon = bitti ? (akis.kapandi as number) : Math.max(akis.hedef, tAktif);
  const payGun = bitti ? 0 : Math.max(0, (akis.hedef - tAktif) / GUN);
  const Dgun = Math.max(0.5, bitti ? ((akis.kapandi as number) - T0) / GUN : aktifGun + Math.min(payGun, SABIT.KUYRUK_MAX * Math.max(aktifGun, 1)));
  const b = Dgun / S(SABIT.PHI_SON);
  // 4) zaman sırasıyla yerleşim
  const durum: Record<string, { p: Polar; t: number; yol: HamParca[] }> = {}; for (const u of uyeler) durum[u.ad] = { p: { r: 0, th: u.psi }, t: u.t0, yol: [] };
  const gez: Record<number, { r: number; th: number; t: number; uyeler: string[] }> = {}, ipler: Ip[] = [];
  const bas = (u: Uye): Polar => (durum[u.ad].p.r < 1e-9 ? { r: 0, th: u.psi } : durum[u.ad].p);
  const ekle = (u: Uye, P: Polar, t: number, tur: 'dogal' | 'aktarma') => {
    const D = durum[u.ad], L = Math.max(0, (t - D.t) / GUN), A = bas(u);
    const seg = tur === 'dogal' ? { P: araYol(A, P, (P.r - A.r) / b, 0), hata: 0 } : aktarma(A, P, L);
    D.yol.push({ ta: D.t, tb: t, L, P: seg.P, hata: seg.hata || 0, tur });
    D.p = { r: P.r, th: P.th }; D.t = t;
  };
  const sirali = adimlar.slice().sort((x, y) => x.t - y.t || x.no - y.no);
  for (const a of sirali) {
    const kim = uyeler.filter((u) => ziyaret[u.ad].has(a.no));
    if (!kim.length) continue;
    let aday: Aday[] = kim.map((u) => { const L = Math.max(0, (a.t - durum[u.ad].t) / GUN), A = bas(u); return { u, L, A, N: dogal(A, L, b), sahip: u.ad === a.sahip }; });
    const ulasir = (c: Aday, P: Polar) => { const [ax, ay] = kart(c.A), [px_, py_] = kart(P); return Math.hypot(px_ - ax, py_ - ay) <= c.L * 0.995 + 1e-9; };
    let P!: Polar;
    for (let tur = 0; tur < 8; tur++) {
      if (aday.length === 1) { P = aday[0].N; break; }
      // ağırlıklı kutupsal ortalama, ağırlık 1/L: esnekliği az olan üye kendi doğal noktasına yakın kalır
      let sw = 0, sr = 0, sx = 0, sy = 0;
      for (const c of aday) { const w = 1 / Math.max(c.L, 1e-4); sw += w; sr += w * c.N.r; sx += w * Math.cos(c.N.th); sy += w * Math.sin(c.N.th); }
      P = { r: sr / sw, th: Math.atan2(sy, sx) };
      // ulaşılabilirlik: kirişi L'den uzun üye varsa P onun doğal noktasına doğru yarı yarıya çekilir
      for (let it = 0; it < 24; it++) {
        const kot = aday.find((c) => !ulasir(c, P)); if (!kot) break;
        const [px_, py_] = kart(P), [nx, ny] = kart(kot.N); P = polar((px_ + nx) / 2, (py_ + ny) / 2);
      }
      const kotu = aday.filter((c) => !ulasir(c, P) && !c.sahip);
      if (!kotu.length && aday.every((c) => ulasir(c, P))) break;
      // ulaşamayan devralan (sahip olmayan) bu gezegene uğramaz: bağ "devir ipi" olarak çizilir, yol uzunluğu bozulmaz
      const at = (kotu.length ? kotu : aday.filter((c) => !c.sahip)).sort((x, y) => x.L - y.L)[0];
      if (!at) { aday = aday.filter((c) => c.sahip); continue; }
      ipler.push({ no: a.no, uye: at.u.ad, t: a.t });
      aday = aday.filter((c) => c !== at);
    }
    for (const c of aday) ekle(c.u, P, a.t, aday.length === 1 ? 'dogal' : 'aktarma');
    kim.splice(0, kim.length, ...aday.map((c) => c.u));
    gez[a.no] = { r: P.r, th: P.th, t: a.t, uyeler: kim.map((u) => u.ad) };
  }
  // 5) kule: kritik yolun son adımının sahibinin yolunda, hedef anında. Pay varsa yol kuleye kadar uzar (kuyruk = iş payı).
  const kritik = new Set(akis.kritik_yol || []);
  const yerli = sirali.filter((a) => gez[a.no]);
  const sonK = [...kritik].filter((x) => gez[x]).sort((x, y) => gez[x].t - gez[y].t).pop() ?? (yerli.length ? yerli[yerli.length - 1].no : null);
  const kuleUye = sonK != null ? uyeOf[byNo[sonK].sahip] : uyeler[0];
  let kule: { r: number; th: number; t: number } | null = null, gec = false, kuyruk: Kuyruk | null = null;
  if (bitti && yerli.length) { const g = gez[yerli[yerli.length - 1].no]; kule = { r: g.r, th: g.th, t: akis.kapandi as number }; }
  else if (sonK != null) {
    const D = durum[kuleUye.ad];
    if (akis.hedef >= D.t) {
      // kuyruk = iş payı (hedefe kalan süre). Üyenin yürüdüğü yol değildir; çok uzunsa kırık işaretle kısaltılır.
      const gercek = (akis.hedef - D.t) / GUN, L = Math.min(gercek, SABIT.KUYRUK_MAX * Math.max(aktifGun, 1)), K = dogal(D.p, L, b);
      kuyruk = { ta: D.t, tb: akis.hedef, L, gercekGun: gercek, kirik: L < gercek - 1e-6, P: araYol(D.p, K, (K.r - D.p.r) / b, 0), hata: 0, pts: [] };
      kule = { r: K.r, th: K.th, t: akis.hedef };
    } else gec = true; // hedef geçti: kule, yolun hedef anındaki noktasına konur (aşağıda)
  }
  // 6) ölçek: bütün noktalar R içine (k = piksel/gün)
  let mx = 1e-9;
  const tum: { P: Nokta[] }[] = []; for (const u of uyeler) tum.push(...durum[u.ad].yol); if (kuyruk) tum.push(kuyruk);
  for (const s of tum) for (const p of s.P) mx = Math.max(mx, Math.hypot(p[0], p[1]));
  for (const no in gez) mx = Math.max(mx, gez[no].r);
  const k = R / mx;
  const px = (x: number, y: number): Nokta => [cx + x * k, cy + y * k];
  // 7) piksel yollar + zaman damgaları (sabit hız: t yay uzunluğuyla doğrusal)
  const zamanla = (s: { P: Nokta[]; ta: number; tb: number }): ZamanliNokta[] => { const Q = s.P.map(([x, y]) => px(x, y)), cum = [0]; for (let i = 1; i < Q.length; i++) cum.push(cum[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1])); const T = cum[cum.length - 1] || 1; return Q.map((q, i) => ({ x: q[0], y: q[1], t: s.ta + (s.tb - s.ta) * cum[i] / T })); };
  for (const u of uyeler) {
    u.parcalar = durum[u.ad].yol.map((s) => ({ ta: s.ta, tb: s.tb, L: s.L, hata: s.hata, tur: s.tur, pts: zamanla(s) }));
    u.yol = []; for (const s of u.parcalar) for (const p of s.pts) { const l = u.yol[u.yol.length - 1]; if (!l || p.t > l.t) u.yol.push(p); }
    if (!u.yol.length) u.yol.push({ x: cx, y: cy, t: u.t0 });
    u.tSon = durum[u.ad].t;
  }
  if (kuyruk) kuyruk.pts = zamanla(kuyruk);
  // gezegenler: piksel + darboğaz yarıçapı
  const bekleyen: Record<number, number[]> = {}; for (const a of adimlar) for (const d of a.bagimli || []) (bekleyen[d] ||= []).push(a.no);
  const gecisli = (no: number, acik: boolean) => { const g = new Set<number>(), st = [...(bekleyen[no] || [])]; while (st.length) { const x = st.pop() as number; if (g.has(x) || !byNo[x] || byNo[x].durum === 'atlandi') continue; if (acik && BITTI(byNo[x].durum)) continue; g.add(x); st.push(...(bekleyen[x] || [])); } return g.size; };
  const gezegen: Record<number, Gezegen> = {};
  for (const no in gez) {
    const g = gez[no], a = byNo[no], [x, y] = px(...kart(g));
    const W = gecisli(+no, !BITTI(a.durum)), dz = darbogaz(a, W, kritik.has(+no), g.uyeler.length, ps, simdi);
    gezegen[no] = { no: +no, x, y, t: g.t, r: dz.r, puan: dz.puan, korona: dz.korona, W, uyeler: g.uyeler, ortak: g.uyeler.length > 1, kritik: kritik.has(+no) };
  }
  const ipP = ipler.map((x) => ({ ...x }));
  let kuleP: Kule | null = kule ? (() => { const [x, y] = px(...kart(kule!)); return { x, y, t: kule!.t, uye: kuleUye.ad }; })() : null;

  // ---------- sorgular ----------
  const yolu = (ad: string, kq?: boolean) => { const u = uyeOf[ad]; return kq && kuyruk && ad === kuleUye.ad ? u.yol.concat(kuyruk.pts.slice(1)) : u.yol; };
  /** üyenin t anındaki konumu (gemi). t < t0 → null; t > yolun sonu → son nokta (demirli) */
  function konumAn(ad: string, t: number, o2: { kuyruk?: boolean } = {}): Konum | null {
    const u = uyeOf[ad]; if (!u || t < u.t0) return null;
    const Y = yolu(ad, o2.kuyruk);
    if (t >= Y[Y.length - 1].t) { const p = Y[Y.length - 1], q = Y[Math.max(0, Y.length - 2)]; return { x: p.x, y: p.y, yon: Math.atan2(p.y - q.y, p.x - q.x), demir: true }; }
    for (let i = 1; i < Y.length; i++) if (Y[i].t >= t) { const p = Y[i - 1], q = Y[i], f = (t - p.t) / ((q.t - p.t) || 1); return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, yon: Math.atan2(q.y - p.y, q.x - p.x), demir: false }; }
    return { x: Y[0].x, y: Y[0].y, yon: 0 };
  }
  /** üyenin yolunun [ta, tb] aralığı (piksel nokta dizisi) */
  function kesit(ad: string, ta: number, tb: number, o2: { kuyruk?: boolean } = {}): Nokta[] {
    const u = uyeOf[ad]; if (!u) return [];
    const Y = yolu(ad, o2.kuyruk), a = Math.max(ta, Y[0].t), z = Math.min(tb, Y[Y.length - 1].t);
    if (z <= a) return [];
    const out: Nokta[] = [], pa = konumAn(ad, a, o2)!, pz = konumAn(ad, z, o2)!;
    out.push([pa.x, pa.y]); for (const p of Y) if (p.t > a && p.t < z) out.push([p.x, p.y]); out.push([pz.x, pz.y]);
    return out;
  }
  /** adımın x anındaki durumu (sürgü): x ≤ simdi geçmiş olaylardan; x > simdi tahmin */
  function durumAn(no: number, x: number): GorselDurum | null {
    const a = byNo[no]; if (!a) return null;
    if (BITTI(a.durum) && a.t <= x) return a.durum === 'atlandi' ? 'ghost' : a.durum === 'ertelendi' ? 'ertele' : 'lit';
    if (x > simdi && !BITTI(a.durum) && a.t <= x) return 'tahmin';
    const xx = Math.min(x, simdi);
    if (a.durum === 'engelli' && a.engel_at != null && a.engel_at <= xx) return 'block';
    // sürüyor ile sırası geldi ayrı (R13): sürüyor yeşil halka, bekleyen kehribar
    if (a.hazir_at != null && a.hazir_at <= xx) return a.durum === 'suruyor' && x >= simdi - 36e5 ? 'run' : 'wait';
    if (x > simdi && ['hazir', 'suruyor'].includes(a.durum)) return a.durum === 'suruyor' ? 'run' : 'wait';
    return 'dark';
  }
  /** küme: ekranda üst üste düşen gezegenler */
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
  /** şerit: x = zaman (x0 = T0'ın x'i, pxGun piksel/gün) */
  const seritX = (t: number, x0: number, pxGun: number) => x0 + (t - T0) / GUN * pxGun;
  if (gec) { const p = konumAn(kuleUye.ad, akis.hedef)!; kuleP = { x: p.x, y: p.y, t: akis.hedef, uye: kuleUye.ad, gec: true }; }
  return { cx, cy, R, ps, k, b, T0, tSon, payGun, hedef: akis.hedef, kapandi: akis.kapandi, simdi, uyeler, uyeOf, gezegen, ipler: ipP, kule: kuleP, kuyruk, gec, kuleUye: kuleUye.ad, byNo, konumAn, kesit, durumAn, kumeler, seritX, haric };
}

/** API (GET /akis/:kod) yanıtının ilgili kısmı */
export interface ApiAkisDetay {
  akis: { olusturuldu: string; hedef_tarih: string; kapandi_at?: string | null; [k: string]: unknown };
  kritik_yol?: number[];
  adimlar: Array<{
    no: number; sahip: string; sahip_tip?: string; durum: string; bagimli?: number[];
    durum_at?: string | null; en_erken_bitis?: string | null; sure_tahmin_gun?: number | null;
    bekleme_saat?: number | null; capa_soru?: string | null; son_tarih?: string | null; [k: string]: unknown;
  }>;
  olaylar?: Array<{ zaman: string; kim?: string; kim_tip?: string; arac?: string | null; tip?: string; adim_no?: number | null; durum?: string | null; [k: string]: unknown }>;
  /** 0.10.0: her adımın ilk okunuşu (okuma olayları akışta yok; üyenin yola çıkışı için) */
  ilk_okumalar?: Array<{ zaman: string; kim?: string; kim_tip?: string; arac?: string | null; adim_no: number }>;
}

/** Planlanan başlangıç = bitiş − süre tahmini; biten adımda bitiş gerçek bitiştir (tasarım veridenAkis: ef − sure). */
const planBasi = (a: any): number | null => {
  const t = BITTI(a.durum) ? a.durum_at : a.en_erken_bitis;
  return t && a.sure_tahmin_gun ? Date.parse(t) - a.sure_tahmin_gun * GUN : null;
};

/** API → girdi. detay = GET /akis/:kod ; o.sahip = akış sahibinin adı */
export function apidenAkis(detay: ApiAkisDetay, o: { sahip?: string } = {}): GirdiAkis {
  const k = detay.akis, ms = (x: string | number | null | undefined): number | null => (x == null ? null : typeof x === 'number' ? x : Date.parse(x));
  const olaylar: GirdiOlay[] = (detay.olaylar || []).map((e) => ({ t: ms(e.zaman) as number, kim: e.kim, kim_tip: e.kim_tip, arac: e.arac, tip: e.tip, adim_no: e.adim_no, durum: e.durum }))
    .concat((detay.ilk_okumalar || []).map((e) => ({ t: ms(e.zaman) as number, kim: e.kim, kim_tip: e.kim_tip, arac: e.arac, tip: 'okuma', adim_no: e.adim_no, durum: null })));
  const ilk = (no: number, d: string) => { const e = olaylar.filter((x) => x.adim_no === no && x.tip === 'durum' && x.durum === d).sort((p, q) => p.t - q.t)[0]; return e ? e.t : null; };
  return {
    t0: ms(k.olusturuldu) as number, hedef: Date.parse(k.hedef_tarih + 'T23:59:00+03:00'), kapandi: ms(k.kapandi_at), sahip: o.sahip,
    kritik_yol: detay.kritik_yol || [],
    adimlar: detay.adimlar.map((a) => ({
      no: a.no, sahip: a.sahip, sahip_tip: a.sahip_tip, durum: a.durum, bagimli: a.bagimli || [],
      t: (BITTI(a.durum) ? ms(a.durum_at) : ms(a.en_erken_bitis)) as number,
      hazir_at: ilk(a.no, 'hazir'), basla_plan: planBasi(a),
      engel_at: a.durum === 'engelli' ? ms(a.durum_at) : null, bekleme_saat: a.bekleme_saat ?? null,
      tarih_bilinmiyor: !!a.capa_soru && !a.son_tarih && !BITTI(a.durum),
    })),
    olaylar,
  };
}

export interface EvrenGirdi { hedef: number; kapandi?: number | null; yaricap?: number; [k: string]: unknown }
export interface EvrenYer<T extends EvrenGirdi = EvrenGirdi> { x: T; a: number; p: Nokta; rr: number; kapali?: boolean }

/** Evren yerleşimi: açı = hedef tarih; yarıçap bantları greedy; çakışma kalırsa küçült (en az 9 px); kapananlar dış halkada */
export function evrenYerlesim<T extends EvrenGirdi>(akislar: T[], o: { cx?: number; cy?: number; R?: number; cal0: number; cal1: number; bantlar?: number[] }): EvrenYer<T>[] {
  const cx = o.cx ?? 195, cy = o.cy ?? 470, R = o.R ?? 170, c0 = o.cal0, c1 = o.cal1;
  const bant = o.bantlar || [R - 42, R - 82, R - 120];
  const ang = (ms: number) => -90 + (ms - c0) / (c1 - c0) * 360;
  const pol = (a: number, r: number): Nokta => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r];
  const yer: EvrenYer<T>[] = [], acik = akislar.filter((x) => !x.kapandi).map((x) => ({ x, a: ang(x.hedef) })).sort((p, q) => p.a - q.a);
  for (const it of acik) {
    const rr = it.x.yaricap ?? 18; let en: { bb: number; p: Nokta; cak: number } | null = null;
    for (const bb of bant) { const p = pol(it.a, bb); const cak = yer.reduce((m, q) => Math.max(m, rr + q.rr + 6 - Math.hypot(p[0] - q.p[0], p[1] - q.p[1])), -1e9); if (!en || cak < en.cak) en = { bb, p, cak }; if (cak <= 0) break; }
    yer.push({ ...it, p: en!.p, rr: en!.cak > 0 ? Math.max(9, rr - en!.cak) : rr });
  }
  for (const x of akislar.filter((y) => y.kapandi)) yer.push({ x, a: ang(x.kapandi as number), p: pol(ang(x.kapandi as number), R + 26), rr: 10, kapali: true });
  return yer;
}

/** test: her yol parçasının piksel uzunluğu / (k · Δt_gün) */
export function test(akis: GirdiAkis, o: KurSecenek = {}) {
  const G = kur(akis, Object.assign({ R: 200 }, o));
  let en = 0, say = 0;
  for (const u of G.uyeler) for (const s of u.parcalar) {
    if (s.L < 0.02) continue; // 30 dakikanın altı: tek nokta sayılır
    let Lpx = 0; for (let i = 1; i < s.pts.length; i++) Lpx += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
    en = Math.max(en, Math.abs(Lpx - s.L * G.k) / (s.L * G.k)); say++;
  }
  return { parca: say, hata: en, G };
}

/** Geliştirme modunda: üretimdeki her yol parçasının uzunluk hatasını konsola yazar (spesifikasyon §11). */
export function uzunlukDenetle(G: Galaksi, etiket = ''): number {
  let en = 0;
  for (const u of G.uyeler) for (const s of u.parcalar) {
    if (s.L < 0.02) continue;
    let Lpx = 0; for (let i = 1; i < s.pts.length; i++) Lpx += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
    en = Math.max(en, Math.abs(Lpx - s.L * G.k) / (s.L * G.k));
  }
  if (en >= 0.01) console.warn(`[galaksi] ${etiket} yol uzunluğu hatası %${(en * 100).toFixed(3)} (sınır %1)`);
  return en;
}
