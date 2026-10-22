import { describe, expect, it } from 'vitest';
import { pano } from './pano';

const adim = (no: number, o: any = {}) => ({ no, ad: `Adım ${no}`, sahip: 'Emre', durum: 'sirada', bagimli: [], ...o });
const kart = (kod: string) => ({ kod, ilerleme: { tamam: 0, toplam: 0 } });

describe('evren panosu', () => {
  const detay = {
    A: { adimlar: [adim(1, { durum: 'tamam' }), adim(2, { durum: 'engelli', sahip: 'Berkin' }), adim(3, { bagimli: [2] }), adim(4, { bagimli: [3] })] },
    B: { adimlar: [adim(1, { durum: 'tamam' }), adim(2, { durum: 'hazir', karar_adimi: true }), adim(3, { durum: 'suruyor', sahip: 'Berkin', gec_risk: true })] },
  };
  const P = pano([kart('A'), kart('B')], detay, 'Berkin');

  it('tutanak cümlesi bütün akışları sayar', () => {
    expect(P.cumle).toBe("2 aktif akışta toplam 7 adım: 2’si bitti, 1 adım takılı, 1 karar bekliyor, 2 iş senden bekleniyor.");
  });
  it('süzgeçler boş olanları atlar, ilk dolu varsayılandır', () => {
    expect(P.suzgecler.map((s) => s.tur)).toEqual(['sende', 'engel', 'karar', 'risk', 'sira']);
    expect(P.varsayilan).toBe('sende');
    expect(pano([kart('B')], { B: { adimlar: [adim(1, { durum: 'hazir' })] } }, 'Berkin').varsayilan).toBe('sira');
  });
  it('en çok tutan adım önce gelir', () => {
    expect(P.adimlar.sende.map((a) => `${a.kod}${a.no}`)).toEqual(['A2', 'B3']);
    expect(P.adimlar.sende[0].tuttugu).toBe(2);
  });
  it('detayı gelmemiş akış kart ilerlemesiyle sayılır', () => {
    expect(pano([{ kod: 'C', ilerleme: { tamam: 3, toplam: 3 } }], {}, 'Berkin').cumle).toBe('1 aktif akışta toplam 3 adım: hepsi bitti; işler yükleniyor.');
  });
  it('yüklenirken eksik akış sayılır ve cümle bunu söyler (M-M3)', () => {
    const Q = pano([kart('A'), kart('B'), { kod: 'C', ilerleme: { tamam: 1, toplam: 4 } }], detay, 'Berkin');
    expect(Q.eksik).toBe(1);
    expect(Q.cumle.endsWith('; 1 akışın işleri yükleniyor.')).toBe(true);
    expect(P.eksik).toBe(0);
  });
});
