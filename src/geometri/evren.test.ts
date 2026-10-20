import { describe, expect, it } from 'vitest';
import { evrenTakvimi, evrenYerlesimi, GUN, payYaricap, type EAkis } from './evren';

const T = Date.parse('2026-10-14T12:00:00+03:00');
const akis = (kod: string, o: Partial<EAkis> = {}): EAkis => ({ kod, t0: T - 3 * GUN, hedef: T + 20 * GUN, payGun: 10, adim: 10, biten: 3, kisiler: ['Berkin'], ...o });
const O = (A: EAkis[]) => { const { CA, CB } = evrenTakvimi(A, T); return evrenYerlesimi(A, { cx: 195, cy: 470, R: 170, CA, CB }); };
const uz = (p: { x: number; y: number }) => Math.hypot(p.x - 195, p.y - 470);

describe('evren matematiği', () => {
  it('takvim en az üç ay ve bütün hedefleri kapsar', () => {
    const { CA, CB } = evrenTakvimi([akis('A', { hedef: T + 200 * GUN })], T);
    expect(CA).toBeLessThanOrEqual(T - 3 * GUN);
    expect(CB).toBeGreaterThan(T + 200 * GUN);
    const k = evrenTakvimi([akis('A')], T);
    expect((k.CB - k.CA) / GUN).toBeGreaterThanOrEqual(89);
  });
  it('payı azalan galaksi halkaya yaklaşır', () => {
    expect(payYaricap(2, 50, 140)).toBeGreaterThan(payYaricap(20, 50, 140));
    expect(payYaricap(-5, 50, 140)).toBe(140);
    const Y = O([akis('A', { payGun: 2, hedef: T + 10 * GUN }), akis('B', { payGun: 25, hedef: T + 60 * GUN })]);
    const a = Y.yer.find((y) => y.kod === 'A')!, b = Y.yer.find((y) => y.kod === 'B')!;
    expect(uz(a)).toBeGreaterThan(uz(b));
  });
  it('adım sayısı iki katına çıkınca alan iki katına çıkar', () => {
    const Y = O([akis('A', { adim: 8, hedef: T + 10 * GUN }), akis('B', { adim: 16, hedef: T + 50 * GUN })]);
    const a = Y.yer.find((y) => y.kod === 'A')!, b = Y.yer.find((y) => y.kod === 'B')!;
    expect((b.rr / a.rr) ** 2).toBeCloseTo(2, 2);
  });
  it('çakışma yalnız yarıçap yönünde çözülür; açı hedef tarihten gelir', () => {
    const A = Array.from({ length: 8 }, (_, i) => akis('K' + i, { hedef: T + (20 + i) * GUN, payGun: 10, adim: 12 }));
    const Y = O(A);
    const { CA, CB } = evrenTakvimi(A, T);
    for (const y of Y.yer) expect(y.a).toBeCloseTo(-90 + (A.find((x) => x.kod === y.kod)!.hedef - CA) / (CB - CA) * 360, 6);
    for (let i = 0; i < Y.yer.length; i++) for (let j = i + 1; j < Y.yer.length; j++) {
      const p = Y.yer[i], q = Y.yer[j];
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(p.rr + q.rr + 5.4);
    }
    for (const y of Y.yer) expect(uz(y) + y.rr).toBeLessThanOrEqual(170 - 14 + .01);
  });
  it('ortak kişisi olan galaksiler iplidir', () => {
    const Y = O([akis('A', { kisiler: ['Berkin', 'Emre'] }), akis('B', { kisiler: ['Emre', 'Claude'], hedef: T + 40 * GUN }), akis('C', { kisiler: ['Ayşe'], hedef: T + 60 * GUN })]);
    expect(Y.ipler).toEqual([{ a: 'A', b: 'B', n: 1 }]);
  });
});
