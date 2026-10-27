import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as GG from './galaksi-geometri';
import { olcekliKur, TAU, zamanBukucu } from './zaman-olcegi';
import { ornekAkislar, SIMDI } from './ornek';

const veri = JSON.parse(readFileSync(new URL('../../tasarim/kaynak/veri.json', import.meta.url), 'utf8'));
const ham = JSON.parse(readFileSync(new URL('../../tasarim/veri/ornek-veri.json', import.meta.url), 'utf8'));
const akislar = ornekAkislar(veri, ham);
const GUN = 864e5, MOBIL = { cx: 195, cy: 322, R: 156, ps: 0.78, simdi: SIMDI };

describe('zaman ölçeği (plan 27 Eki, D)', () => {
  const { ileri, geri } = zamanBukucu(SIMDI, 7);
  it('plan tablosu: τ = 7 için 1 → 0,93; 7 → 4,9; 90 → 18,4 gün', () => {
    const S = (d: number) => (ileri(SIMDI + d * GUN) - SIMDI) / GUN;
    expect(S(1)).toBeCloseTo(0.93, 2);
    expect(S(7)).toBeCloseTo(4.85, 2);
    expect(S(90)).toBeCloseTo(18.4, 1);
    expect(S(-7)).toBeCloseTo(-4.85, 2);
  });
  it('ileri ve geri birbirinin tersi; sıra korunur', () => {
    for (const d of [-200, -3, -0.01, 0, 0.5, 40, 365]) expect(geri(ileri(SIMDI + d * GUN))).toBeCloseTo(SIMDI + d * GUN, -1);
    expect(ileri(SIMDI + 5 * GUN)).toBeLessThan(ileri(SIMDI + 6 * GUN));
  });
  it('τ sabit 7 gün (yakınlaşınca geometri kaymaz)', () => expect(TAU).toBe(7));

  for (const [kod, akis] of Object.entries(akislar)) {
    it(`${kod}: dışarıya gerçek anlar; gezegen sırası ve durumlar doğrusal ölçekle aynı`, () => {
      const a = GG.kur(akis, MOBIL), b = olcekliKur(akis, { ...MOBIL, tau: 7 });
      expect(Object.keys(b.gezegen)).toEqual(Object.keys(a.gezegen));
      for (const no of Object.keys(a.gezegen)) {
        expect(b.gezegen[+no].t).toBeCloseTo(a.gezegen[+no].t, -2);
        for (const x of [a.T0, SIMDI - GUN, SIMDI, SIMDI + 3 * GUN]) expect(b.durumAn(+no, x)).toBe(a.durumAn(+no, x));
      }
      expect(b.T0).toBeCloseTo(a.T0, -2);
      expect(b.hedef).toBe(akis.hedef);
      if (b.kuyruk) expect(b.kuyruk.kirik).toBe(false);
      // gemi bugün, gezegeninin yanında: konumAn gerçek anla çağrılır
      for (const u of b.uyeler) { const p = b.konumAn(u.ad, u.t0); expect(p && Math.hypot(p.x - b.cx, p.y - b.cy)).toBeLessThan(b.R * 1.6); }
    });
  }
});
