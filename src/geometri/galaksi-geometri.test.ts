import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as GG from './galaksi-geometri';
import { ornekAkislar, SIMDI } from './ornek';

const require = createRequire(import.meta.url);
// Tasarımın kaynak modülü: TS taşıması bununla birebir aynı sonucu vermeli.
const Ref = require('../../tasarim/kaynak/galaksi-geometri.cjs');
const veri = JSON.parse(readFileSync(new URL('../../tasarim/kaynak/veri.json', import.meta.url), 'utf8'));
const ham = JSON.parse(readFileSync(new URL('../../tasarim/veri/ornek-veri.json', import.meta.url), 'utf8'));
const akislar = ornekAkislar(veri, ham);
const MOBIL = { cx: 195, cy: 322, R: 156, ps: 0.78, simdi: SIMDI };

describe('galaksi geometrisi', () => {
  it('S ve phiOfS birbirinin tersi', () => {
    for (const s of [0.01, 1, 10, 33.3]) expect(GG.S(GG.phiOfS(s))).toBeCloseTo(s, 9);
  });

  for (const [kod, akis] of Object.entries(akislar)) {
    it(`${kod}: her yol parçasında uzunluk ∝ zaman (%1 altında)`, () => {
      expect(GG.test(akis, { simdi: SIMDI }).hata).toBeLessThan(0.01);
    });
    it(`${kod}: kaynak modülle birebir aynı`, () => {
      const a = GG.kur(akis, MOBIL), b = Ref.kur(akis, MOBIL);
      expect(a.k).toBeCloseTo(b.k, 9);
      expect(Object.keys(a.gezegen)).toEqual(Object.keys(b.gezegen));
      for (const no of Object.keys(b.gezegen)) {
        const p = a.gezegen[+no], q = b.gezegen[no];
        expect([p.x, p.y, p.r]).toEqual([q.x, q.y, q.r]);
        expect(p.uyeler).toEqual(q.uyeler);
      }
      expect(a.uyeler.map((u) => [u.ad, u.t0, u.yol.length])).toEqual(b.uyeler.map((u: any) => [u.ad, u.t0, u.yol.length]));
      expect(a.kule).toEqual(b.kule);
      expect(a.ipler).toEqual(b.ipler);
      for (const u of a.uyeler) for (const t of [a.T0, SIMDI, a.tSon]) expect(a.konumAn(u.ad, t)).toEqual(b.konumAn(u.ad, t));
      for (const no of Object.keys(b.gezegen)) expect(a.durumAn(+no, SIMDI)).toEqual(b.durumAn(+no, SIMDI));
      expect(a.kumeler()).toEqual(b.kumeler());
    });
  }

  it('bütün yollar merkezden çıkıyor', () => {
    for (const akis of Object.values(akislar)) {
      const G = GG.kur(akis, MOBIL);
      for (const u of G.uyeler) expect(Math.hypot(u.yol[0].x - G.cx, u.yol[0].y - G.cy)).toBeLessThan(1e-6);
    }
  });
});
