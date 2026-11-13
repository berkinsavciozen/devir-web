import { describe, expect, it } from 'vitest';
import { durumAn, kur } from '../../cizim/yorunge/index.js';
import { yorungeLejanti } from './Lejant';

// Kişi Yörüngeleri lejantı (U5): satırlar haritanın o anki durumundan; yalnız haritada olan işaretler, sayılarıyla
const adim = (no: number, sahip: string, durum: string, ek: any = {}) => ({ no, ad: 'İş ' + no, sahip, sahip_tip: 'insan', durum, bagimli: [], bekleyenler: [], durum_at: '2026-11-20T08:00:00.000Z', en_erken_bitis: '2026-11-23', ...ek });
const M = kur({ simdi: '2026-11-21T08:00:00.000Z', akis: { kod: 'T1', baslik: 'Deneme', hedef_tarih: '2026-11-28', sahipler: [], katilimcilar: [{ ad: 'Deniz' }], olaylar: [], kritik_yol: [2, 3], adimlar: [
  adim(1, 'Berkin', 'tamam'), adim(2, 'Mert', 'suruyor', { bagimli: [1] }), adim(3, 'Berkin', 'sirada', { bagimli: [2], karar_adimi: true }),
  adim(4, "Mert'in agent'ı", 'hazir', { sahip_tip: 'agent', agent_sahibi: 'Mert', oto: true, rutin_var: false }), adim(5, 'Deniz', 'engelli', { engel_kisa: 'belge eksik' }),
] } }, 'Mert');

describe('yörünge lejantı', () => {
  const D = durumAn(M, M.simdi), L = yorungeLejanti(M, D);
  const n = (v: string) => L.find((x) => x.v === v)?.n;
  it('kişi durumları herkesi bir kez sayar', () => {
    const kim = L.filter((x) => x.v.startsWith('kd:'));
    expect(kim.reduce((t, x) => t + x.n, 0)).toBe(M.kisiler.length);
    expect(n('kd:engel')).toBe(1);
  });
  it('iş durumları adımları bir kez sayar; olmayan işaretin satırı yok', () => {
    expect(L.filter((x) => x.v.startsWith('g:')).reduce((t, x) => t + x.n, 0)).toBe(M.adimlar.length);
    expect(n('g:block')).toBe(1); expect(n('g:lit')).toBe(1); expect(n('g:ghost')).toBeUndefined();
    expect(L.every((x) => x.n > 0 && x.svg.length > 0)).toBe(true);
  });
  it('hamle, kritik yol, karar ve rutin satırları', () => {
    expect(L.filter((x) => x.v.startsWith('h:')).reduce((t, x) => t + x.n, 0)).toBe(Object.keys(D.H).length);
    expect(n('kritik')).toBe(2); expect(n('karar')).toBe(1); expect(n('rutin')).toBe(1);
  });
});
