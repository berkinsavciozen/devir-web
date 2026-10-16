import { describe, expect, it } from 'vitest';
import { buyut, hedefYaricap, ogeKat, OLCEK, uygunKat, yaziKat, yogunluk } from './olcek';
import { KODLAMA } from './kodlama';

describe('öğe ölçeği (madde 9, 15)', () => {
  it('seyrek akışta ana öğe 3, alt adım 2 kat', () => {
    expect(ogeKat('ana', 6)).toBeCloseTo(3);
    expect(ogeKat('alt', 6)).toBeCloseTo(2);
  });
  it('öğe sayısı arttıkça kat azalır, sınırın altına inmez', () => {
    let son = Infinity;
    for (const n of [5, 10, 20, 40, 80, 400]) { const k = ogeKat('ana', n); expect(k).toBeLessThanOrEqual(son); expect(k).toBeGreaterThanOrEqual(OLCEK.EN_AZ); son = k; }
    expect(yogunluk(40)).toBeCloseTo(0.5);
  });
  it('yakınlaşınca öğe √k ile büyür, sahneden yavaş', () => {
    expect(ogeKat('alt', 6, 4) / ogeKat('alt', 6, 1)).toBeCloseTo(2);
    expect(ogeKat('ana', 6, 9)).toBeLessThanOrEqual(OLCEK.EN_COK);
  });
  it('büyütme darboğaz sırasını korur; en küçük tam kat büyür', () => {
    const r0 = 5, L = [5, 7, 9, 14, 18].map((r) => buyut(r, 3, r0));
    expect(L[0]).toBeCloseTo(15);
    for (let i = 1; i < L.length; i++) expect(L[i]).toBeGreaterThan(L[i - 1]);
    expect(L[4] / 18).toBeLessThan(3);
  });
  it('yazı en az 12 px, en çok 1,45 kat', () => {
    expect(11 * yaziKat(1, 11)).toBeGreaterThanOrEqual(OLCEK.EN_AZ_YAZI);
    expect(yaziKat(4.5, 14)).toBeLessThanOrEqual(OLCEK.YAZI_COK);
  });
  it('dokunma hedefi en az 44 px', () => {
    expect(hedefYaricap(3) * 2).toBeGreaterThanOrEqual(OLCEK.EN_AZ_HEDEF);
    expect(hedefYaricap(30)).toBe(36);
  });
  it('sık yerleşimde kat düşer, seyrekte hedefte kalır', () => {
    const sik = Array.from({ length: 12 }, (_, i) => ({ x: i * 12, y: 0, r: 5 }));
    const seyrek = Array.from({ length: 12 }, (_, i) => ({ x: i * 80, y: 0, r: 5 }));
    expect(uygunKat(sik, 3, 5)).toBeLessThan(uygunKat(seyrek, 3, 5));
    expect(uygunKat(seyrek, 3, 5)).toBeCloseTo(3);
  });
});

describe('kodlama sözleşmesi', () => {
  it('her satırın kimliği tek, en az bir yüzeyi ve bir iddiası var', () => {
    expect(new Set(KODLAMA.map((k) => k.kod)).size).toBe(KODLAMA.length);
    for (const k of KODLAMA) { expect(k.galaksi || k.evren || k.serit).toBeTruthy(); expect(k.iddia.length).toBeGreaterThan(10); }
  });
});
