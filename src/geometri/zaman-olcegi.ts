/*
 * Bugünü büyüten zaman ölçeği (plan 27 Eki, Epic 3 D grubu; 3.4, 3.6, R17).
 *
 * Yol üzerindeki konum artık zamanla doğrusal değil: bugüne Δ gün uzaktaki an, yol üzerinde
 *   S(Δ) = τ · ln(1 + Δ/τ)
 * gün kadar uzakta durur (geçmiş ve gelecek simetrik). τ = 7 için 7 gün → 4,9; 30 gün → 11,4; 90 gün → 18,4.
 * kur() dokunulmaz: girdinin bütün anları bükülür, kur() bükülmüş zamanda "uzunluk ∝ zaman" kuralıyla çizer,
 * çıktının anları geri bükülür ve zaman alan işlevler (konumAn, kesit, durumAn) gerçek anla çağrılır.
 * Böylece "uzunluk ∝ zaman" bükülmüş zamanda tam kalır; geometri testi ve golden test kur() için değişmez.
 */
import { kur, type Galaksi, type GirdiAkis, type KurSecenek } from './galaksi-geometri';
import { ZAMAN } from './olcek';

const GUN = 864e5;

/** τ: odak genişliği (gün); 0 ya da küçükse doğrusal (bükme yok) */
export function zamanBukucu(simdi: number, tau: number) {
  if (!(tau > 0)) return { ileri: (t: number) => t, geri: (t: number) => t };
  const ileri = (t: number) => {
    const d = (t - simdi) / GUN;
    return simdi + Math.sign(d) * tau * Math.log1p(Math.abs(d) / tau) * GUN;
  };
  const geri = (t: number) => {
    const s = (t - simdi) / GUN;
    return simdi + Math.sign(s) * tau * Math.expm1(Math.abs(s) / tau) * GUN;
  };
  return { ileri, geri };
}

/**
 * τ yakınlaşmayla sabit (ZAMAN.TAU_UZAK). Plan 3.6 yakınlaştıkça τ'nun büyümesini öneriyordu; denendi, ama τ değişince
 * bütün geometri yeniden ölçeklenip parmağın altındaki nokta kayıyor. Yakınlaşma zaten bugünü büyüttüğü için sabit kaldı.
 */
export const TAU = ZAMAN.TAU_UZAK;

/** kur() + zaman ölçeği. tau 0 ise doğrudan kur(). */
export function olcekliKur(akis: GirdiAkis, o: KurSecenek & { tau?: number } = {}): Galaksi {
  const simdi = o.simdi ?? Date.now(), tau = o.tau ?? 0;
  if (!(tau > 0)) return kur(akis, o);
  const { ileri: w, geri: g } = zamanBukucu(simdi, tau);
  const wn = (t: number | null | undefined) => (t == null ? t : w(t));
  // engel süresi gerçek günle sayılsın (darboğaz tacı): bekleme_saat yoksa gerçek andan yazılır
  const A: GirdiAkis = {
    ...akis, t0: w(akis.t0), hedef: w(akis.hedef), kapandi: akis.kapandi == null ? null : w(akis.kapandi),
    adimlar: akis.adimlar.map((a) => ({
      ...a, t: w(a.t), hazir_at: wn(a.hazir_at), basla_plan: wn(a.basla_plan), engel_at: wn(a.engel_at),
      bekleme_saat: a.bekleme_saat ?? (a.durum === 'engelli' && a.engel_at != null ? Math.max(0, simdi - a.engel_at) / 36e5 : a.bekleme_saat),
    })),
    olaylar: akis.olaylar?.map((e) => ({ ...e, t: w(e.t) })),
  };
  const G = kur(A, { ...o, kuyrukMax: Infinity });
  // çıktı anları gerçeğe: kopyalarda (kur()'un iç işlevleri kendi nesnelerini bükülmüş zamanla kullanmaya devam eder).
  // Nokta dizilerinin (yol, pts) t alanı bükülmüş kalır; dışarıda yalnız x, y okunur.
  const uyeler = G.uyeler.map((u) => ({ ...u, t0: g(u.t0), tSon: g(u.tSon) }));
  const gezegen: Galaksi['gezegen'] = {}; for (const no in G.gezegen) gezegen[no] = { ...G.gezegen[no], t: g(G.gezegen[no].t) };
  const kuyruk = G.kuyruk && { ...G.kuyruk, ta: g(G.kuyruk.ta), tb: g(G.kuyruk.tb), gercekGun: (akis.hedef - g(G.kuyruk.ta)) / GUN, kirik: false };
  const tAktif = Math.max(akis.t0, ...akis.adimlar.filter((a) => !G.haric.has(a.no)).map((a) => a.t));
  const { konumAn, kesit, durumAn } = G;
  return {
    ...G, T0: g(G.T0), tSon: g(G.tSon), hedef: akis.hedef, kapandi: akis.kapandi,
    uyeler, uyeOf: Object.fromEntries(uyeler.map((u) => [u.ad, u])), gezegen, kuyruk,
    ipler: G.ipler.map((ip) => ({ ...ip, t: g(ip.t) })), kule: G.kule && { ...G.kule, t: g(G.kule.t) },
    payGun: akis.kapandi != null ? 0 : Math.max(0, (akis.hedef - tAktif) / GUN),
    byNo: Object.fromEntries(akis.adimlar.map((a) => [a.no, a])),
    konumAn: (ad, t, x) => konumAn(ad, w(t), x),
    kesit: (ad, ta, tb, x) => kesit(ad, w(ta), w(tb), x),
    durumAn: (no, x) => durumAn(no, w(x)),
  };
}
