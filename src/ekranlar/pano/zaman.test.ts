import { describe, expect, it } from 'vitest';
import { bagBilgisi, panoBolumleri, zamanSirasi } from './TekPano';

const NOW = Date.parse('2026-11-12T09:00:00+03:00');
const a = (no: number, o: any = {}) => ({ akis: 'X', no, ad: `İş ${no}`, sahip: 'Ece', durum: 'sirada', ...o });

describe('Tek Pano Zaman (12 Kas, K1)', () => {
  it('tek tarih sırası; gecikmiş ve bugün başlıkları; tarihsiz en sonda; bitenler yok', () => {
    const G = zamanSirasi([a(1, { son_tarih: '2026-11-20' }), a(2, { son_tarih: '2026-11-10' }), a(3), a(4, { son_tarih: '2026-11-12' }), a(5, { durum: 'tamam', son_tarih: '2026-11-01' })], NOW);
    expect(G.map((g) => g.baslik)).toEqual(['GECİKMİŞ', 'BUGÜN', '20 KAS', 'TARİHSİZ']);
    expect(G.flatMap((g) => g.satirlar.map((s) => s.a.no))).toEqual([2, 4, 1, 3]);
  });
  it('alt görev üst görevinin hemen altında, girintili', () => {
    const G = zamanSirasi([a(1, { son_tarih: '2026-11-20' }), a(2, { ust_adim: 1, son_tarih: '2026-11-13' }), a(3, { son_tarih: '2026-11-15' })], NOW);
    const S = G.flatMap((g) => g.satirlar);
    expect(S.map((s) => [s.a.no, s.alt])).toEqual([[3, false], [1, false], [2, true]]);
  });
});

describe('bağımlılık satırı', () => {
  const d = { kritik_yol: [2], adimlar: [a(1, { durum: 'hazir', sahip: 'Mert', bagimli: [], bekleyenler: [2] }), a(2, { bagimli: [1], bekleyenler: [3] }), a(3, { bagimli: [2], bekleyenler: [] })] };
  it('beklediği açık görev ve onu bekleyenler', () => {
    const b = bagBilgisi(d.adimlar[1], d)!;
    expect(b.bekledigi.map((x) => x.sahip)).toEqual(['Mert']);
    expect(b.bekleyen).toBe(1);
    expect(b.kritik).toBe(true);
  });
  it('bağı olmayan ya da biten görevde satır yok', () => {
    expect(bagBilgisi(a(9, { bagimli: [], bekleyenler: [] }), { adimlar: [a(9, { bagimli: [], bekleyenler: [] })] })).toBeNull();
    expect(bagBilgisi({ ...d.adimlar[1], durum: 'tamam' }, d)).toBeNull();
  });
});

describe('kişi süzgeci (P2)', () => {
  const L = [a(1, { durum: 'engelli', sahip: 'Ece' }), a(2, { durum: 'engelli', sahip: 'Mert' }), a(3, { durum: 'engelli', sahip: "Ece'nin agent'ı", sahip_tip: 'agent', agent_sahibi: 'Ece' }), a(4, { durum: 'hazir', sahip: 'Ben' })];
  const o = { ben: 'Ben', now: NOW, adimBul: () => null };
  it('riskte yalnız o kişinin ve agent’ının işleri; senden beklenen süzgeçten bağımsız', () => {
    const B = panoBolumleri(L, [], { ...o, kisi: 'Ece' });
    expect(B.find((b) => b.id === 'risk')!.satirlar.map((s) => s.a.no)).toEqual([1, 3]);
    expect(B.find((b) => b.id === 'senden')!.satirlar.map((s) => s.a.no)).toEqual([4]);
    expect(panoBolumleri(L, [], o).find((b) => b.id === 'risk')!.satirlar).toHaveLength(3);
  });
});
