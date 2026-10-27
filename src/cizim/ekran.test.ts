import { describe, expect, it } from 'vitest';
import { evrenOlcek, usturlap } from './ekran';
import { evrenTakvimi } from '../geometri/evren';

const T = (s: string) => Date.parse(s + 'T12:00:00+03:00');
const NOW = T('2026-10-27');
const akis = (kod: string, hedef: string) => ({ kod, ad: kod, hedef: T(hedef) });

describe('J1 ölçek düzeni takvimi (harita raporu, 2027 sarma hatası)', () => {
  it('pencere veriden: 2027 hedefi başa dolanmaz, açı sırası tarih sırasıdır', () => {
    const A = [akis('KAS', '2026-11-15'), akis('ARA', '2026-12-20'), akis('OCA', '2027-01-20')];
    const takvim = evrenTakvimi(A.map((a) => ({ t0: NOW - 20 * 864e5, hedef: a.hedef })), NOW);
    const O = evrenOlcek({ simdi: NOW, akislar: A, kucuk: () => '', takvim });
    const a = (kod: string) => O.yer.find((y: any) => y.kod === kod)!.a;
    for (const y of O.yer) { expect(y.a).toBeGreaterThanOrEqual(-90); expect(y.a).toBeLessThanOrEqual(270); }
    expect(a('KAS')).toBeLessThan(a('ARA'));
    expect(a('ARA')).toBeLessThan(a('OCA'));
  });
});

describe('usturlap (plan 27 Eki)', () => {
  const U = usturlap({ simdi: NOW, oran: .3, taslak: 0, akislar: [{ ...akis('A', '2026-11-10'), t0: T('2026-10-01'), adim: 8, biten: 2, payGun: 5, kisiler: ['Berkin'] }, { ...akis('B', '2026-11-20'), t0: T('2026-10-05'), adim: 6, biten: 1, payGun: 12, kisiler: ['Berkin'] }], kucuk: () => '' });
  it('3.27: ortak kişi ipi çizilmez', () => {
    expect(U.svg).not.toContain('stroke="#D9CCFF" stroke-width');
  });
  it('3.29: halka bandı ince (12 px)', () => {
    expect(U.svg).toContain('stroke="#120B2C" stroke-width="12"');
    expect(U.svg).not.toContain('stroke-width="22"');
  });
});
