import { describe, expect, it } from 'vitest';
import { aralikMetni as sunucuAralik, bitis, kararOzeti } from '../../sunucu/plan.ts';
import { aralikMetni, hedefEtiketi, hedefParcasi, kararParcalari, oncelikliAkis, seritTonu, type KararOzeti } from './KararSeridi';

// Sözleşme: parçalar sunucunun kurduğu cümleden çıkar; fixture sunucu kodunun kendisiyle üretilir.
const NOW = Date.parse('2026-10-22T09:00:00+03:00');
const gun = (n: number) => new Date(NOW + n * 864e5).toISOString().slice(0, 10);
const adim = (no: number, x: any = {}) => ({ id: no, no, ad: `Adım ${no}`, sahip: 'Berkin', sahip_tip: 'insan', durum: 'hazir', bagimli: [], sure_tahmin_gun: 1, created_at: new Date(NOW).toISOString(), durum_at: new Date(NOW).toISOString(), ...x });
const ozet = (s: any[], akis: any = {}, o: any = {}): KararOzeti => {
  const a = { created_at: new Date(NOW).toISOString(), kurallar: {}, baglam: {}, ...akis };
  return kararOzeti(a, s, bitis(a, s, [], NOW), NOW, o) as KararOzeti;
};
const S = [adim(1, { ad: 'Banka onayı', durum: 'engelli', sure_tahmin_gun: 2 }), adim(2, { ad: 'Sözleşme taslağı', bagimli: [1], durum: 'sirada', sure_tahmin_gun: 3 }), adim(3, { ad: 'Komisyon', sahip: 'Zeynep' })];

describe('kararParcalari', () => {
  it('sunucu cümlesini türlerine ayırır; darboğaz ve kritik yol adıma bağlanır', () => {
    const o = ozet(S, { hedef_tarih: gun(20) });
    const P = kararParcalari(o);
    expect(P.map((p) => p.tur)).toEqual(['darbogaz', 'kritik', 'tarih', 'hedef']);
    expect(P.map((p) => p.metin).join(' · ')).toBe(o.cumle);
    expect(P[0].no).toBe(1);
    expect(P[1].no).toBe(1);
  });
  it('kısa: adlar yok, aralık ve kısa hedef; süresi eksikse söyler', () => {
    const o = ozet([adim(1, { sure_tahmin_gun: 4 })], { hedef_tarih: gun(5) });
    expect(kararParcalari(o, true).map((p) => p.metin)).toEqual([aralikMetni(o.bitis.aralik!), 'hedef riskte']);
    const e = ozet([adim(1, { sure_tahmin_gun: null })], { hedef_tarih: gun(30) });
    expect(kararParcalari(e, true).map((p) => p.metin)).toContain('süre eksik');
    expect(seritTonu(ozet([adim(1, { sure_tahmin_gun: null })]))).toBe('eksik');
  });
  it('dış kişinin şeridinde başka adımın adı yok', () => {
    const o = ozet(S, { hedef_tarih: gun(20) }, { dis: true, kapsam: new Set([1]) });
    const P = kararParcalari(o);
    expect(P[0]).toEqual({ tur: 'dis', metin: 'Senin adımın kritik yolda' });
    expect(P.some((p) => /Banka|Sözleşme/.test(p.metin))).toBe(false);
  });
  it('kapalı akış ve boş özet', () => {
    expect(kararParcalari({ cumle: 'Kapandı · 12 Eki', darbogaz: null, kritik: { ilk_acik: null, zincir: [] }, bitis: { en_erken: '2026-10-12', aralik: ['2026-10-12', '2026-10-12'], guven: 'kesin' }, hedef: null, hamle: null }, true).map((p) => p.metin)).toEqual(['Kapandı', '12 Eki']);
    expect(kararParcalari(null)).toEqual([]);
  });
});

describe('hedef', () => {
  it('etiket üst uca göre; geçiyorsa alt uca göre gün (cümleyle aynı)', () => {
    expect(hedefEtiketi(ozet([adim(1, { sure_tahmin_gun: 2, sure_kaynak: 'kullanici' })], { hedef_tarih: gun(10) }))).toBe('8 g pay');
    expect(hedefEtiketi(ozet([adim(1, { sure_tahmin_gun: 4 })], { hedef_tarih: gun(5) }))).toBe('riskte');
    const g = ozet([adim(1, { sure_tahmin_gun: 4 })], { hedef_tarih: gun(2) });
    expect(g.cumle).toContain('hedef 2 gün geçiyor');
    expect(hedefEtiketi(g)).toBe('2 g geç');
  });
  it('dikkat isteyen akış ve liste parçası', () => {
    const k = (kod: string, o: KararOzeti, x: any = {}) => ({ kod, kisa_ad: kod, karar_ozeti: o, ...x });
    const pay = k('Ege', ozet([adim(1, { sure_tahmin_gun: 2, sure_kaynak: 'kullanici' })], { hedef_tarih: gun(10) }));
    const risk = k('İzmir', ozet([adim(1, { sure_tahmin_gun: 4 })], { hedef_tarih: gun(5) }));
    const kapali = k('Hasat', ozet([adim(1, { sure_tahmin_gun: 4 })], { hedef_tarih: gun(2) }), { kapandi_at: '2026-10-20' });
    expect(oncelikliAkis([pay, risk, kapali])?.kod).toBe('İzmir');
    expect(hedefParcasi([pay, risk])).toBe('İzmir’de hedef riskte');
    expect(hedefParcasi([pay])).toBe('en dar pay Ege’de: 8 gün');
    expect(hedefParcasi([{ kod: 'X', kisa_ad: 'Test Bank', pay_saat: 144 }])).toBe('en dar pay Test Bank’te: 6 gün');
  });
});

it('aralık metni sunucuyla aynı', () => {
  for (const ar of [['2026-10-28', '2026-10-31'], ['2026-10-30', '2026-11-02'], ['2026-10-28', '2026-10-28']] as [string, string][]) expect(aralikMetni(ar)).toBe(sunucuAralik(ar));
});
