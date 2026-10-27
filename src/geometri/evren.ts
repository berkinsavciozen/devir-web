/**
 * Evren matematiği (el notu 5; tasarim/KODLAMA.md): her galaksinin yeri ve boyu veriden gelir.
 * - Açı: hedef tarihin takvim halkasındaki açısı (zaman). Başlangıçtan hedefe yay, halkanın içinde çizilir.
 * - Yarıçap (merkeze uzaklık): kalan iş oranı (plan 27 Eki, karar 3.I). Merkez "bitti" noktasıdır: bitmeye yaklaşan akış
 *   merkeze iner. Gecikme uzaklıkla değil, galaksinin kırmızılaşan çerçevesiyle gösterilir (gec).
 * - Boy: alan adım sayısıyla orantılı (yarıçap ∝ √adım).
 * - Işık: biten / toplam adım.
 * - İp: ortak kişisi olan galaksiler arasında; kalınlık ortak kişi sayısıyla.
 * Çakışmalar yalnız yarıçap yönünde çözülür (açı = zaman bozulmaz); sığmazsa bütün boylar birlikte küçülür.
 */
export const GUN = 864e5;

export interface EAkis { kod: string; t0: number; hedef: number; payGun: number | null; adim: number; biten: number; kisiler: string[] }
export interface EYer { kod: string; x: number; y: number; rr: number; a: number; rho: number; rhoPay: number; isik: number; yay: [number, number]; gec: boolean }
export interface EIp { a: string; b: string; n: number }
export interface EYerlesim { yer: EYer[]; ipler: EIp[]; olcek: number; ic: number; dis: number }

/** Takvim penceresi: en erken başlangıcın ayından en geç hedefin sonraki ayına; en az 3 ay. */
export function evrenTakvimi(akislar: { t0: number; hedef: number }[], now: number): { CA: number; CB: number } {
  const ay = (ms: number, k = 0) => { const d = new Date(ms + 3 * 36e5); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) - 3 * 36e5; };
  const bas = Math.min(now, ...akislar.map((a) => a.t0)), son = Math.max(now, ...akislar.map((a) => a.hedef));
  const CA = ay(bas);
  return { CA, CB: Math.max(ay(son, 1), ay(CA, 3)) };
}

/**
 * Kalan iş oranı → merkeze uzaklık (karar 3.I): ρ = iç + (dış − iç) × (1 − biten / toplam).
 * Hiç başlamamış akış dış sınırda, bitmek üzere olan iç sınırda.
 */
export function kalanYaricap(biten: number, adim: number, ic: number, dis: number): number {
  const oran = adim > 0 ? Math.max(0, Math.min(1, biten / adim)) : 0;
  return ic + (dis - ic) * (1 - oran);
}

/** Pay (gün) → merkeze uzaklık (3.I öncesi kural; artık kullanılmıyor, eski çizimlerle kıyas için). 0 ve altı: dış sınır; P gün ve üstü: iç sınır; arası doğrusal (gün başına sabit px). */
export function payYaricap(payGun: number | null, ic: number, dis: number, P = 45): number {
  if (payGun == null) return (ic + dis) / 2;
  if (payGun <= 0) return dis;
  return dis - (dis - ic) * Math.min(1, payGun / P);
}

export function evrenYerlesimi(akislar: EAkis[], o: { cx: number; cy: number; R: number; CA: number; CB: number; enBuyuk?: number; enKucuk?: number; bosluk?: number; engeller?: { x: number; y: number; r: number }[] }): EYerlesim {
  const { cx, cy, R, CA, CB } = o, gap = o.bosluk ?? 6, EN_B = o.enBuyuk ?? 36, EN_K = o.enKucuk ?? 14;
  const ang = (ms: number) => -90 + (ms - CA) / (CB - CA) * 360;
  const ic = R * .25, dis = R - 30;
  const maxAdim = Math.max(1, ...akislar.map((a) => a.adim));
  const olcek0 = EN_B / Math.sqrt(maxAdim);
  let olcek = olcek0;
  const sirali = akislar.slice().sort((p, q) => p.hedef - q.hedef || p.kod.localeCompare(q.kod));
  let yer: EYer[] = [];
  for (let tur = 0; tur < 16; tur++) {
    yer = sirali.map((a) => {
      const rr = Math.max(EN_K * olcek / olcek0, olcek * Math.sqrt(Math.max(1, a.adim))), rhoPay = kalanYaricap(a.biten, a.adim, ic, dis);
      return { kod: a.kod, a: ang(a.hedef), rr, rho: Math.min(rhoPay, R - 14 - rr), rhoPay, x: 0, y: 0, isik: a.adim ? a.biten / a.adim : 0, yay: [ang(a.t0), ang(a.hedef)] as [number, number], gec: a.payGun != null && a.payGun < 0 };
    });
    const konum = (g: EYer) => { const r = g.a * Math.PI / 180; g.x = cx + Math.cos(r) * g.rho; g.y = cy + Math.sin(r) * g.rho; };
    yer.forEach(konum);
    // yarıçap yönünde itme: üst üste binen ikiliden dıştaki dışa, içteki içe; merkez göbeği (r 14) de engel
    let kalan = 0;
    for (let it = 0; it < 80; it++) {
      kalan = 0;
      for (let i = 0; i < yer.length; i++) for (let j = i + 1; j < yer.length; j++) {
        const p = yer[i], q = yer[j], d = Math.hypot(p.x - q.x, p.y - q.y), ust = p.rr + q.rr + gap - d;
        if (ust <= 0) continue;
        kalan = Math.max(kalan, ust);
        // içteki iç sınıra dayanmışsa payını dıştaki üstlenir (ve tersi)
        const [disi, ici] = p.rho >= q.rho ? [p, q] : [q, p];
        const icAlan = Math.max(0, ici.rho - (14 + gap + ici.rr)), disAlan = Math.max(0, R - 14 - disi.rr - disi.rho);
        const ice = Math.min(icAlan, ust * .55), disa = Math.min(disAlan, ust * 1.1 - ice);
        ici.rho -= ice + Math.max(0, Math.min(icAlan - ice, ust * 1.1 - ice - disa));
        disi.rho += disa;
        konum(disi); konum(ici);
      }
      // sabit engeller (taslak kozaları): galaksi yarıçap yönünde engelden uzaklaşır
      for (const g of yer) for (const e of o.engeller || []) {
        const ust = g.rr + e.r + gap - Math.hypot(g.x - e.x, g.y - e.y);
        if (ust <= 0) continue;
        kalan = Math.max(kalan, ust);
        const ice = g.rho < Math.hypot(e.x - cx, e.y - cy) && g.rho - ust >= 14 + gap + g.rr;
        g.rho = ice ? g.rho - ust : Math.min(R - 14 - g.rr, g.rho + ust);
        konum(g);
      }
      if (kalan <= .5) break;
    }
    if (kalan <= .5) break;
    olcek *= .9;
  }
  // ortak kişi ipleri
  const ipler: EIp[] = [];
  for (let i = 0; i < sirali.length; i++) for (let j = i + 1; j < sirali.length; j++) {
    const B = new Set(sirali[j].kisiler), n = sirali[i].kisiler.filter((k) => B.has(k)).length;
    if (n) ipler.push({ a: sirali[i].kod, b: sirali[j].kod, n });
  }
  return { yer, ipler, olcek, ic, dis };
}
