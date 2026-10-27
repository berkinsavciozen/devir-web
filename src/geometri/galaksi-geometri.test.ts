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
    // plan 27 Eki (3.A): gezegen boyu sabit (darboğaz taçla), sürüyor ve ertelendi ayrı durum; geri kalanı kaynakla birebir
    it(`${kod}: kaynak modülle birebir aynı (boy ve yeni durumlar dışında)`, () => {
      const a = GG.kur(akis, MOBIL), b = Ref.kur(akis, MOBIL);
      expect(a.k).toBeCloseTo(b.k, 9);
      expect(Object.keys(a.gezegen)).toEqual(Object.keys(b.gezegen));
      for (const no of Object.keys(b.gezegen)) {
        const p = a.gezegen[+no], q = b.gezegen[no];
        expect([p.x, p.y]).toEqual([q.x, q.y]);
        expect(p.r).toBeGreaterThanOrEqual(6 * MOBIL.ps - 1e-9);
        expect(p.r).toBeLessThanOrEqual(11 * MOBIL.ps + 1e-9);
        expect(p.uyeler).toEqual(q.uyeler);
      }
      expect(a.uyeler.map((u) => [u.ad, u.t0, u.yol.length])).toEqual(b.uyeler.map((u: any) => [u.ad, u.t0, u.yol.length]));
      expect(a.kule).toEqual(b.kule);
      expect(a.ipler).toEqual(b.ipler);
      for (const u of a.uyeler) for (const t of [a.T0, SIMDI, a.tSon]) expect(a.konumAn(u.ad, t)).toEqual(b.konumAn(u.ad, t));
      const eski = (d: string | null) => (d === 'run' ? 'wait' : d === 'ertele' ? 'lit' : d);
      for (const no of Object.keys(b.gezegen)) expect(eski(a.durumAn(+no, SIMDI))).toEqual(b.durumAn(+no, SIMDI));
      expect(a.kumeler((no) => b.gezegen[no].r)).toEqual(b.kumeler());
    });
  }

  it('darboğaz tacı: puan = ln(1+W) + 0.5·ln(1+E); eşikler 0.7 ve 1.6; kritik yol puana girmez', () => {
    const a = (durum: string, bekleme_saat?: number) => ({ durum, bekleme_saat, engel_at: null } as any);
    expect(GG.darbogaz(a('hazir'), 0, true, 1).korona).toBe(0);
    expect(GG.darbogaz(a('hazir'), 1, false, 1).korona).toBe(0); // ln2 = 0.69
    expect(GG.darbogaz(a('hazir'), 2, false, 1).korona).toBe(1); // ln3 = 1.10
    expect(GG.darbogaz(a('hazir'), 5, false, 1).korona).toBe(2); // ln6 = 1.79
    expect(GG.darbogaz(a('engelli', 24 * 20), 1, false, 1).korona).toBe(2); // 0.69 + 0.5·ln21
    expect(GG.darbogaz(a('tamam'), 9, false, 1).korona).toBe(0);
    expect(GG.darbogaz(a('hazir'), 0, true, 1, .78).r).toBeCloseTo(7 * .78);
  });

  it('bütün yollar merkezden çıkıyor', () => {
    for (const akis of Object.values(akislar)) {
      const G = GG.kur(akis, MOBIL);
      for (const u of G.uyeler) expect(Math.hypot(u.yol[0].x - G.cx, u.yol[0].y - G.cy)).toBeLessThan(1e-6);
    }
  });
});
