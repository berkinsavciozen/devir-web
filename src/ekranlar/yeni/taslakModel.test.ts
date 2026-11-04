import { describe, expect, it } from 'vitest';
import { taslakCumlesi, taslakHaritasi } from './taslakModel';

const NOW = Date.parse('2026-12-01T09:00:00+03:00');
const roller = [{ kod: 'b', ad: 'Berkin', tip: 'insan', kisi: 'Berkin' }, { kod: 'ag', ad: 'Hazırlık agent’ı', tip: 'agent', kisi: null }, { kod: 'm', ad: 'Mali müşavir', tip: 'dis', kisi: null }];
const adimlar = [
  { id: 'a', ad: 'Teyit', sahip_rol: 'b', sure_tahmin_gun: 1, bagimli: [], kosul: null },
  { id: 'b', ad: 'Paket', sahip_rol: 'ag', sure_tahmin_gun: 2, bagimli: ['a'], kosul: null },
  { id: 'c', ad: 'Belge modeli', sahip_rol: 'm', sure_tahmin_gun: 5, bagimli: [], kosul: { soru: 'vergisiz', deger: 'evet' } },
  { id: 'd', ad: 'Sözleşme', sahip_rol: 'b', sure_tahmin_gun: 30, bagimli: ['b', 'c'], kosul: null },
];
const t = { adimlar, roller, hedef_tarih: '2026-12-20', sorular: [{ kod: 'vergisiz' }] };

describe('W4 taslak haritası', () => {
  const H = taslakHaritasi(t, { now: NOW });
  it('en erken bitiş bağımlılıklarla', () => expect(Math.round((H.noktalar[3].bit - NOW) / 864e5)).toBe(35));
  it('eksik sahip: dış rol kişisiz; agent rolü eksik sayılmaz', () => expect(H.eksikRol.map((r) => r.kod)).toEqual(['m']));
  it('cevaplanmamış soruya bağlı adım', () => {
    expect(H.sorulu.map((n) => n.a.id)).toEqual(['c']);
    expect(taslakHaritasi(t, { now: NOW, cevaplar: { vergisiz: 'evet' } }).sorulu).toEqual([]);
  });
  it('hedefi aşan adım', () => expect(H.gecikme.map((n) => n.a.id)).toEqual(['d']));
  it('cümle', () => expect(taslakCumlesi(H, 1, () => 'x')).toBe('4 adım · 1 soru bekliyor · 1 rolün sahibi belli değil · tahmini bitiş hedeften 16 gün sonra.'));
});
