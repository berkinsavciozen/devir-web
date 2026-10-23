import { describe, expect, it } from 'vitest';
import { bagIsareti, gorevCumlesi, gorevHaritasi, gruplar, suzgecAdresi, suzgecOku } from './model';

const NOW = Date.parse('2026-10-14T10:00:00+03:00');
const g = (o: any) => ({ akis: 'A', akis_baslik: 'Hasat', sahip: 'Berkin', sahip_tip: 'insan', durum: 'hazir', onceki: [], sonraki: [], ...o });

describe('görevler', () => {
  it('süzgeç adresten okunur ve varsayılanlar adrese yazılmaz', () => {
    const s = suzgecOku(new URLSearchParams('kisi=Selin&akis=A,B&durum=hepsi'));
    expect(s).toEqual({ kisi: 'Selin', akis: ['A', 'B'], durum: 'hepsi' });
    expect(suzgecAdresi(s)).toBe('/gorevler?kisi=Selin&akis=A%2CB&durum=hepsi');
    expect(suzgecAdresi(suzgecOku(new URLSearchParams()))).toBe('/gorevler');
  });
  it('cümle kişiye göre çekimlenir', () => {
    expect(gorevCumlesi([g({}), g({}), g({ durum: 'engelli' })], 'ben', 'Berkin', 'acik')).toBe('Sende 2 görev sırada; biri engelli.');
    expect(gorevCumlesi([g({ sahip: 'Selin' })], 'Selin', 'Berkin', 'acik')).toBe('Selin’de 1 görev sırada.');
    expect(gorevCumlesi([], 'ben', 'Berkin', 'acik')).toBe('Şu an senden beklenen görev yok.');
  });
  it('gruplar ekran sırasında, boşlar atlanır', () => {
    expect(gruplar([g({ durum: 'tamam' }), g({}), g({ durum: 'sirada' })]).map(([a]) => a)).toEqual(['SIRASI GELEN', 'SIRADA', 'BİTTİ']);
  });
  it('bağımlılık işareti: sıradaki iş kimi bekliyor, sırası gelen işi kim bekliyor', () => {
    expect(bagIsareti(g({ durum: 'sirada', onceki: [{ sahip: 'Claude' }] }), 'Berkin')).toBe('← Claude’u bekliyor');
    expect(bagIsareti(g({ sonraki: [{ sahip: 'Selin' }, { sahip: 'Emre' }] }), 'Berkin')).toBe('→ Selin seni bekliyor +1');
    expect(bagIsareti(g({ sahip: 'Selin', sonraki: [{ sahip: 'Berkin' }] }), 'Berkin')).toBe('→ sen bekliyorsun');
    expect(bagIsareti(g({ durum: 'tamam', sonraki: [{ sahip: 'Selin' }] }), 'Berkin')).toBeNull();
  });
  it('harita: tek kişide akış şeritleri, yakın görevler dikeyde ayrışır, bugün eksende', () => {
    const t = new Date(NOW + 3 * 864e5).toISOString();
    const G = [g({ en_erken_bitis: t }), g({ en_erken_bitis: t }), g({ akis: 'B', akis_baslik: 'Ege', en_erken_bitis: t })];
    const H = gorevHaritasi(G, { kisiBasina: false, now: NOW });
    expect(H.seritler.map((s) => s.ad)).toEqual(['Hasat', 'Ege']);
    const [p, q] = H.noktalar.filter((n) => n.serit === 0);
    expect(p.x).toBeCloseTo(q.x, 6);
    expect(Math.abs(p.y - q.y)).toBe(8);
    expect(H.bugunX).toBeGreaterThan(H.x0);
    expect(H.bugunX).toBeLessThan(p.x);
    expect(gorevHaritasi(G, { kisiBasina: true, now: NOW }).seritler).toHaveLength(1);
  });
});
