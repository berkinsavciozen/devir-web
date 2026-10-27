import { describe, expect, it } from 'vitest';
import { enRiskliSirasi, SERBEST, serbestDizilim } from './Evren';
import { hapEni } from '../../cizim/ekran';

// Plan 27 Eki, P6: serbest düzen ızgarası (3.31) ve akış süzgecinin ilk seçimi (karar 3.J)
describe('serbest düzen', () => {
  const G = (n: number) => Array.from({ length: n }, (_, i) => ({ kod: 'K' + i, adim: 5 + i, ad: `Akış ${i}` }));
  for (const n of [1, 3, 6, 10, 16]) it(`${n} akış: alanın içinde, boşluk sabit, adlar birbirine binmez`, () => {
    const S = serbestDizilim(G(n));
    for (const g of S) {
      expect(g.x - g.r).toBeGreaterThanOrEqual(SERBEST.kx - 1e-6);
      expect(g.x + g.r).toBeLessThanOrEqual(SERBEST.kx + SERBEST.kw + 1e-6);
      expect(g.y - g.r).toBeGreaterThanOrEqual(SERBEST.ky - 1e-6);
    }
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const p = S[i], q = S[j];
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(p.r + q.r + SERBEST.BOSLUK - 1e-6);
      if (Math.abs(p.y - q.y) < 1) expect(Math.abs(p.x - q.x)).toBeGreaterThanOrEqual(hapEni(`Akış ${i}`, 11.5));
    }
  });
  it('akış azaldıkça galaksiler büyür', () => {
    expect(serbestDizilim(G(3))[0].r).toBeGreaterThan(serbestDizilim(G(12))[0].r);
  });
});

describe('akış süzgeci: en riskli sıra', () => {
  it('engelli, sonra karar bekleyen, sonra payı az olan', () => {
    const kartlar = [{ kod: 'A', pay_saat: 10 }, { kod: 'B', pay_saat: 500 }, { kod: 'C', pay_saat: 300 }, { kod: 'D', pay_saat: 1 }];
    const detay = { B: { adimlar: [{ durum: 'engelli' }] }, C: { adimlar: [{ karar_adimi: true, durum: 'hazir' }] } };
    expect(enRiskliSirasi(kartlar, detay, [])).toEqual(['B', 'C', 'D', 'A']);
  });
});
