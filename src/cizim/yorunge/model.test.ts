import { describe, expect, it } from 'vitest';
import { durumAn, kur } from './index.js';

// Kişi Yörüngeleri modeli (13 Kas, sentez): API akış detayından kişi sırası, durum ve hamle
const SIMDI = '2026-11-21T08:00:00.000Z';
const adim = (no: number, sahip: string, durum: string, ek: any = {}) => ({ no, ad: 'İş ' + no, sahip, sahip_tip: 'insan', durum, bagimli: [], bekleyenler: [], durum_at: '2026-11-20T08:00:00.000Z', en_erken_bitis: '2026-11-23', ...ek });
const ham = (adimlar: any[]) => ({ simdi: SIMDI, akis: { kod: 'T1', baslik: 'Deneme', hedef_tarih: '2026-11-28', adimlar, sahipler: [], katilimcilar: [{ ad: 'Deniz' }], olaylar: [], kritik_yol: [] } });

describe('yörünge modeli', () => {
  const M = kur(ham([
    adim(1, 'Berkin', 'tamam'),
    adim(2, 'Mert', 'suruyor', { bagimli: [1] }),
    adim(3, 'Berkin', 'sirada', { bagimli: [2], karar_adimi: true }),
    adim(4, "Mert'in agent'ı", 'hazir', { sahip_tip: 'agent', agent_sahibi: 'Mert', oto: true, rutin_var: false }),
    adim(5, 'Deniz', 'engelli', { engel_kisa: 'belge eksik' }),
  ]), 'Mert');
  const D = durumAn(M, M.simdi);
  it('kişiler: agent sahibinin hemen ardında, dış katılımcı türüyle', () => {
    expect(M.kisiler.map((k: any) => k.ad)).toEqual(['Berkin', 'Mert', "Mert'in agent'ı", 'Deniz']);
    expect(M.kisi.Deniz.tip).toBe('dis'); expect(M.kisi["Mert'in agent'ı"].sahibi).toBe('Mert');
    for (const k of M.kisiler) expect(k.renk).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('kişi durumları: çalışıyor, bekliyor, rutin yok, takıldı', () => {
    expect(D.K.Mert.durum).toBe('calisiyor'); expect(D.K.Berkin.durum).toBe('bekliyor'); expect(D.K.Berkin.tutan).toBe(2);
    expect(D.K["Mert'in agent'ı"].durum).toBe('ai_rutinsiz'); expect(D.K.Deniz.durum).toBe('engel');
  });
  it('hamle yapacak kişiye düşer: rutini sahibi kurar, süren işi sahibi bitirir', () => {
    expect(D.H[2]).toMatchObject({ tur: 'bitir', kim: 'Mert' }); expect(D.H[4]).toMatchObject({ tur: 'kur', kim: 'Mert' });
    expect(D.H[5]).toMatchObject({ tur: 'engel', kim: 'Deniz' }); expect(D.H[3]).toBeUndefined();
    expect(D.K.Mert.hamleler.map((h: any) => h.tur)).toEqual(['bitir', 'kur']);
  });
  it('ileri tarihte süren iş bitmiş sayılır (tahmin), hamle doğmaz', () => {
    const D2 = durumAn(M, M.simdi + 5 * 864e5);
    expect(D2.S[2].g).toBe('tahmin'); expect(D2.H[2]).toBeUndefined();
  });
});
