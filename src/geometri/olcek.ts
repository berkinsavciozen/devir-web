/**
 * Öğe ölçeği (el notu madde 9, 10, 15; tasarim/KODLAMA.md §Ölçek).
 * Gezegen, gemi ve etiket boyları sabit sayı değil, tek bir işlevin çıktısıdır:
 *
 *   kat = taban(tür) × yoğunluk(N) × √k      (sınırlar: EN_AZ … EN_COK)
 *
 * - taban: ana öğe 3 (uydular gezegen boyunun yarısıyla sabit, UYDU.BOY).
 * - yoğunluk: ekrandaki öğe sayısı N, rahat sayı N0'ı geçince √(N0/N) ile küçülür.
 * - k: yakınlaşma. Sahne k ile büyürken öğeler √k ile büyür; yaklaşınca okunur, harita kadar şişmez.
 * Yazı ayrı sınırlanır: ekranda hiçbir harita yazısı EN_AZ_YAZI px'in altına inmez, YAZI_COK katını geçmez.
 */
export const OLCEK = {
  ANA: 3,
  N0: 10,
  EN_AZ: 1.2,
  EN_COK: 4.5,
  YAZI_COK: 1.45,
  EN_AZ_YAZI: 12,
  EN_AZ_HEDEF: 44,
} as const;

export type OgeTuru = 'ana';

/** Yoğunluk katsayısı: N ≤ N0 iken 1, sonra √(N0/N). */
export const yogunluk = (n: number, n0: number = OLCEK.N0) => Math.min(1, Math.sqrt(n0 / Math.max(1, n)));

/** Öğe katsayısı: tasarımdaki boy × bu sayı. Taban, ölçeğin 1 olduğu tasarım boyunu ifade eder; öğe türünün tabanına bölünür. */
export function ogeKat(_tur: OgeTuru, n: number, k = 1, taban = 1): number {
  const v = (OLCEK.ANA / taban) * yogunluk(n) * Math.sqrt(Math.max(1, k));
  return Math.min(OLCEK.EN_COK, Math.max(OLCEK.EN_AZ, v));
}

/** Yazı katsayısı: öğe katsayısını izler ama YAZI_COK'u geçmez; fs × kat en az EN_AZ_YAZI px olur. */
export function yaziKat(ogeKatsayisi: number, fs: number): number {
  const k = Math.min(OLCEK.YAZI_COK, Math.max(1, Math.sqrt(ogeKatsayisi)));
  return Math.max(k, OLCEK.EN_AZ_YAZI / fs);
}

/** Dokunma hedefi yarıçapı: görünen yarıçap + 6, en az 22 (44 px çap). */
export const hedefYaricap = (r: number) => Math.max(OLCEK.EN_AZ_HEDEF / 2, r + 6);

/**
 * Yarıçap büyütme: en küçük öğe tam kat büyür, büyükler √kat ile. Darboğaz sırası (büyük = daha çok tutuyor) korunur,
 * aralık sıkışır; böylece 3 kat büyüyen küçük gezegen okunur, büyük gezegen sarmalı kapatmaz.
 *   r' = kat · r0 + (r − r0) · √kat     (r0: en küçük tasarım yarıçapı)
 */
export const buyut = (r: number, kat: number, r0: number) => kat * r0 + Math.max(0, r - r0) * Math.sqrt(kat);

/**
 * Yoğunluğa göre kat (madde 9'un ikinci yarısı: çok öğede kendiliğinden küçülme).
 * Her gezegenin en yakın komşusuna uzaklığının ortancası d alınır; büyümüş ortanca gezegenin çapı d'nin `oran` katını
 * geçmeyecek en büyük kat seçilir (hedef katı aşmadan). Seyrek akışta 3 kat, sık akışta daha az büyür; zaten üst üste
 * duran yakın adımlar küme rozetine düşer.
 */
export function uygunKat(G: { x: number; y: number; r: number }[], hedef: number, r0: number, oran = .9): number {
  if (G.length < 2) return hedef;
  const orta = (L: number[]) => { const s = [...L].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const d = orta(G.map((a) => Math.min(...G.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y)))));
  const r = orta(G.map((g) => g.r));
  for (let k = hedef; k > OLCEK.EN_AZ; k -= .1) if (2 * buyut(r, k, r0) <= oran * d) return k;
  return OLCEK.EN_AZ;
}

/*
 * Harita sabitleri (plan 27 Eki, 3.37): her sabitin yanında dayandığı karar. Gezegen boyu ve darboğaz eşikleri
 * geometri/galaksi-geometri.ts'te (darbogaz, KORONA; karar 3.A), çizgi kalınlıkları cizim/yol.js'te (karar 3.E).
 */

/** Yakınlaşma kademeleri (karar 3.D): Z0 uzak · Z1 aktif iş ve engel/karar adları · Z2 bütün adlar, uydu sarmalı · Z3 alt görev ve kişi adları, tarihler */
export const KADEME = { Z1: 1.3, Z2: 1.6, Z3: 2.4 } as const;
export type Kademe = 0 | 1 | 2 | 3;
export const kademe = (zk: number): Kademe => (zk >= KADEME.Z3 ? 3 : zk >= KADEME.Z2 ? 2 : zk >= KADEME.Z1 ? 1 : 0);

/** Zaman ölçeği (D grubu, 3.4): odak genişliği τ gün (yakınlaşmayla sabit; bkz. zaman-olcegi.ts) */
export const ZAMAN = { TAU_UZAK: 7 } as const;

/** Uydu sistemi v2 (karar 3.B, 3.20): uydu gezegenin yarısı boyunda sabit; mini sarmalda aralık en az bir uydu çapı */
export const UYDU = { BOY: 0.5, ARALIK: 1.25, ILK_BOSLUK: 7 } as const;

/** Etiket önceliği (karar 3.D): engelli > karar > kritik yol > sürüyor > sırada > bitti */
export const ETIKET_ONCELIK = ['engelli', 'karar', 'kritik', 'suruyor', 'sirada', 'bitti'] as const;
