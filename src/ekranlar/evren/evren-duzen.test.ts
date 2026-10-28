import { describe, expect, it } from 'vitest';
import { enRiskliSirasi, kisalt, SERBEST, serbestDizilim } from './Evren';
import { hapEni } from '../../cizim/ekran';

// Plan 28 Eki, B3: Akışlar ızgarası ekran koordinatında; galaksi en az 72 px, ad galaksiden dar; sığmazsa aşağı uzar
describe('serbest düzen', () => {
  const G = (n: number) => Array.from({ length: n }, (_, i) => ({ kod: 'K' + i, adim: 5 + i, ad: `Hasat postu kampanyası ${i}` }));
  const A = { kx: 40, ky: 164, kw: 920, kh: 640 }; // 1440 × 900
  for (const n of [1, 3, 6, 10, 16, 40]) it(`${n} akış: yanda alanın içinde, boşluk sabit, galaksi ≥ 72 px, ad galaksiden dar`, () => {
    const { yer: S, boy } = serbestDizilim(G(n), A);
    for (const g of S) {
      expect(g.x - g.r).toBeGreaterThanOrEqual(A.kx - 1e-6);
      expect(g.x + g.r).toBeLessThanOrEqual(A.kx + A.kw + 1e-6);
      expect(g.y - g.r).toBeGreaterThanOrEqual(A.ky - 1e-6);
      expect(2 * g.r).toBeGreaterThanOrEqual(72);
      expect(hapEni(g.ad!, 11.5)).toBeLessThan(2 * g.r);
    }
    if (n <= 16) expect(boy).toBeLessThanOrEqual(A.kh);
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const p = S[i], q = S[j];
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(p.r + q.r + SERBEST.BOSLUK - 1e-6);
    }
  });
  it('sütun sayısı √N çevresinde; akış azaldıkça galaksiler büyür; sığmayınca alan uzar', () => {
    const sutun = (n: number) => new Set(serbestDizilim(G(n), A).yer.map((g) => Math.round(g.x))).size;
    expect(sutun(16)).toBeGreaterThanOrEqual(4); expect(sutun(16)).toBeLessThanOrEqual(6);
    expect(serbestDizilim(G(3), A).yer[0].r).toBeGreaterThan(serbestDizilim(G(12), A).yer[0].r);
    expect(serbestDizilim(G(80), { ...A, kh: 456 }).boy).toBeGreaterThan(456);
  });
  it('kısaltma: sığan ad aynen, uzun ad "…" ile', () => {
    expect(kisalt('Ege', 80, 11.5)).toBe('Ege');
    const k = kisalt('Çok uzun bir akış adı burada', 80, 11.5);
    expect(k.endsWith('…')).toBe(true); expect(hapEni(k, 11.5)).toBeLessThanOrEqual(80);
  });
});

describe('akış süzgeci: en riskli sıra', () => {
  it('engelli, sonra karar bekleyen, sonra payı az olan', () => {
    const kartlar = [{ kod: 'A', pay_saat: 10 }, { kod: 'B', pay_saat: 500 }, { kod: 'C', pay_saat: 300 }, { kod: 'D', pay_saat: 1 }];
    const detay = { B: { adimlar: [{ durum: 'engelli' }] }, C: { adimlar: [{ karar_adimi: true, durum: 'hazir' }] } };
    expect(enRiskliSirasi(kartlar, detay, [])).toEqual(['B', 'C', 'D', 'A']);
  });
});
