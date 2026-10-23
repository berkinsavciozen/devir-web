import { describe, expect, it } from 'vitest';
import { katilimcilar, pano } from './pano';
import { ilerleme } from '../../api/ilerleme';

const adim = (no: number, o: any = {}) => ({ no, ad: `Adım ${no}`, sahip: 'Emre', durum: 'sirada', bagimli: [], ...o });
const kart = (kod: string) => ({ kod, ilerleme: { tamam: 0, toplam: 0 } });

describe('evren panosu', () => {
  const detay = {
    A: { adimlar: [adim(1, { durum: 'tamam' }), adim(2, { durum: 'engelli', sahip: 'Berkin' }), adim(3, { bagimli: [2] }), adim(4, { bagimli: [3] })] },
    B: { adimlar: [adim(1, { durum: 'tamam' }), adim(2, { durum: 'hazir', karar_adimi: true }), adim(3, { durum: 'suruyor', sahip: 'Berkin', gec_risk: true })] },
  };
  const P = pano([kart('A'), kart('B')], detay, 'Berkin');

  it('tutanak cümlesi bütün akışları sayar', () => {
    expect(P.cumle).toBe("2 aktif akışta toplam 7 adım: 2’si bitti, 1 adım takılı, 1 karar bekliyor, 2 görev senden bekleniyor.");
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
  it('katılımcılar (N5): sen hariç ekip, agent ve dış; sırası gelen önce; aynı ad tek satır', () => {
    const d = { A: { adimlar: [adim(1, { sahip: 'Berkin', durum: 'hazir' }), adim(2, { sahip: 'Selin', durum: 'hazir' }), adim(3, { sahip: 'Claude', sahip_tip: 'agent' }), adim(4, { sahip: 'Emre', sahip_tip: 'dis' }), adim(5, { sahip: 'Emre', sahip_tip: 'dis', durum: 'tamam' })] },
      B: { adimlar: [adim(1, { sahip: 'selin', durum: 'sirada' })] } };
    const K = katilimcilar([kart('A'), kart('B')], d, 'Berkin');
    expect(K.map((k) => k.ad)).toEqual(['Selin', 'Claude', 'Emre']);
    expect(K[0]).toMatchObject({ acik: 2, sirasi: 1, akislar: ['A', 'B'], siradaki: { kod: 'A', no: 2 } });
    expect(K.map((k) => k.tip)).toEqual(['insan', 'agent', 'dis']);
    expect(K[2].acik).toBe(1);
  });
  it('ilerleme sunucuyla aynı: atlanan ve ertelenen bitmiş sayılmaz, toplamdan düşer', () => {
    expect(ilerleme([{ durum: 'tamam' }, { durum: 'atlandi' }, { durum: 'ertelendi' }, { durum: 'sirada' }])).toEqual({ tamam: 1, toplam: 2, atlandi: 1, ertelendi: 1 });
  });
});
