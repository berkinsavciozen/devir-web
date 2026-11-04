import { describe, expect, it } from 'vitest';
import { agentCumlesi, baglantiOf, uygulamaOf, type Agent } from './Agentlarim';

const a = (o: Partial<Agent> = {}): Agent => ({ ad: 'Berkin’in Claude’u', rutinler: [], durum: 'bosta', simdi: [], sirada: 0, bakilacak: [], acik_is: 0, son_etkinlik: null, ...o });
const is = (ad: string) => ({ akis: 'RTD5', akis_ad: 'Hasat', no: 6, ad, durum: 'suruyor', oto_durum: 'bakilacak' });
const rutin = { id: 't1', ad: 'Berkin’in Claude’u', tur: 'api' as const, son_calisma: null, son_hata: null };

describe('W3 agent cümlesi', () => {
  it('onay bekleyen önce gelir', () => {
    expect(agentCumlesi(a({ bakilacak: [is('Post görseli')], rutinler: [rutin] }), false)).toBe('“Post görseli” çıktısı onayını bekliyor');
    expect(agentCumlesi(a({ bakilacak: [is('Post görseli')] }), false, true)).toBe('1 çıktı onayını bekliyor');
  });
  it('rutin hep başarısızsa söylenir', () => expect(agentCumlesi(a({ durum: 'hata', rutinler: [{ ...rutin, son_hata: '401' }] }), false)).toBe('Rutin son denemede çalışmadı'));
  it('çalışırken işi', () => expect(agentCumlesi(a({ durum: 'calisiyor', simdi: [is('Rapor')] }), false)).toBe('Şu an: Rapor'));
  it('rutin yoksa söylenir; genel rutin varsa ona düşer', () => {
    expect(agentCumlesi(a({ sirada: 2, acik_is: 2 }), false)).toBe('2 iş sırada; rutin bağlı değil');
    expect(agentCumlesi(a({ sirada: 2, acik_is: 2 }), true)).toBe('2 iş sırada · genel rutin');
  });
  it('boşta, rutin türüyle', () => expect(agentCumlesi(a({ rutinler: [rutin] }), false)).toBe('Boşta · anında rutin'));
});

describe('W3 bağlantı', () => {
  it('uygulama addan', () => { expect(uygulamaOf('Ayşe’nin ChatGPT’si')).toBe('ChatGPT'); expect(uygulamaOf('Kod agent’ı')).toBe('Claude'); });
  it('bağlantı eşleşir', () => expect(baglantiOf('Berkin’in Claude’u', [{ id: 'x', ad: 'Claude', alt: '' }])?.id).toBe('x'));
});
