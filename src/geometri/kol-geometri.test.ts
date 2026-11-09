import { describe, it, expect } from 'vitest';
import { kurKol } from './kol-geometri';
import type { GirdiAkis } from './galaksi-geometri';

const GUN = 864e5, T0 = Date.parse('2026-11-09T10:00:00+03:00');
const akis = (): GirdiAkis => ({
  t0: T0, hedef: T0 + 19 * GUN, kapandi: null, sahip: 'Berkin', kritik_yol: [1, 2, 3],
  adimlar: [
    { no: 1, sahip: 'Berkin', sahip_tip: 'insan', durum: 'tamam', t: T0 + GUN },
    { no: 2, sahip: "Berkin'in Claude'u", sahip_tip: 'agent', durum: 'suruyor', t: T0 + 2 * GUN, bagimli: [1] },
    { no: 3, sahip: 'Ece', sahip_tip: 'insan', durum: 'sirada', t: T0 + 5 * GUN, bagimli: [2] },
    { no: 4, sahip: 'Selin', sahip_tip: 'dis', durum: 'sirada', t: T0 + 6 * GUN, bagimli: [2] },
  ],
});

describe('kol haritası', () => {
  it('yarıçap yalnız tarihe bağlı: bugün değişince gezegenler yerinde kalır', () => {
    const a = kurKol(akis(), { R: 100, simdi: T0 + GUN }), b = kurKol(akis(), { R: 100, simdi: T0 + 4 * GUN });
    for (const no of [1, 2, 3, 4]) { expect(a.gezegen[no].x).toBeCloseTo(b.gezegen[no].x, 6); expect(a.gezegen[no].y).toBeCloseTo(b.gezegen[no].y, 6); }
  });
  it('hedef, hedef halkasında; agent ayrı kol açmaz', () => {
    const G = kurKol(akis(), { R: 100, simdi: T0 });
    expect(G.rT(G.hedef)).toBeCloseTo(G.RH, 6);
    expect(new Set(G.uyeler.map((u) => u.psi)).size).toBe(3);
    expect(G.uyeOf["Berkin'in Claude'u"].psi).toBe(G.uyeOf.Berkin.psi);
  });
  it('gemi bugün halkasında; iki kişiye açılan iş ortak, devir ipleri var', () => {
    const G = kurKol(akis(), { R: 100, simdi: T0 + 3 * GUN });
    const p = G.konumAn('Ece', T0 + 5 * GUN)!;
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(G.rT(T0 + 5 * GUN), 0);
    expect(G.gezegen[2].ortak).toBe(true);
    expect(G.ipler.filter((x) => x.no === 2).map((x) => x.uye).sort()).toEqual(['Ece', 'Selin']);
  });
});
