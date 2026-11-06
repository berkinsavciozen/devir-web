import { describe, expect, it } from 'vitest';
import { gecmis, gelecek, gereklilik, gorevCumlesi, nesneFiil, simdiki } from './gorevCumlesi';

describe('W4 görev cümlesi (K6, C24)', () => {
  it('çekimler ses uyumuna uyar', () => {
    expect(gereklilik('netleştir')).toBe('netleştirmeli');
    expect(gereklilik('yaz')).toBe('yazmalı');
    expect(simdiki('netleştir')).toBe('netleştiriyor');
    expect(simdiki('hazırla')).toBe('hazırlıyor');
    expect(simdiki('et')).toBe('ediyor');
    expect(simdiki('gör')).toBe('görüyor');
    expect(gecmis('yaz')).toBe('yazdı');
    expect(gecmis('et')).toBe('etti');
    expect(gecmis('topla')).toBe('topladı');
    expect(gecmis('gönder')).toBe('gönderdi');
    expect(gelecek('yaz')).toBe('yazacak');
    expect(gelecek('et')).toBe('edecek');
    expect(gelecek('hazırla')).toBe('hazırlayacak');
  });
  it('adı nesne + fiile ayırır; fiilsiz adı ayırmaz', () => {
    expect(nesneFiil('Kapsamı netleştir')).toEqual({ nesne: 'Kapsamı', fiil: 'netleştir' });
    expect(nesneFiil('Sözleşmeyi kontrol et')).toEqual({ nesne: 'Sözleşmeyi', fiil: 'kontrol et' });
    expect(nesneFiil('App Store onayı')).toBeNull();
    expect(nesneFiil('Brif')).toBeNull();
    expect(nesneFiil('Post görseli')).toBeNull();
  });
  const gun = (x: string) => x;
  it('KİM + NE + NE ZAMAN + durum fiili', () => {
    expect(gorevCumlesi({ ad: 'Kapsamı netleştir', sahip: 'Berkin', durum: 'hazir', bitis: '16 Eki' }, { gun }).cumle).toBe('Berkin kapsamı 16 Eki’ye kadar netleştirmeli');
    expect(gorevCumlesi({ ad: 'Kapsamı netleştir', sahip: 'Berkin', durum: 'suruyor', bitis: '16 Eki' }, { gun }).cumle).toBe('Berkin kapsamı 16 Eki’ye kadar netleştiriyor');
    expect(gorevCumlesi({ ad: 'Kapsamı netleştir', sahip: 'Berkin', durum: 'tamam' }, { gun }).cumle).toBe('Berkin kapsamı netleştirdi');
    expect(gorevCumlesi({ ad: 'Afiş brifini yaz', sahip: 'Webinar metin agent’ı', sahip_tip: 'agent', agent_sahibi: 'Berkin', durum: 'hazir', oto: true, oto_durum: 'bekliyor' }, { gun }).cumle).toBe('Webinar metin agent’ı afiş brifini yazacak, Berkin onaylayacak');
    expect(gorevCumlesi({ ad: 'Afiş brifini yaz', sahip: 'Claude', sahip_tip: 'agent', agent_sahibi: 'Berkin', durum: 'suruyor', oto: true, oto_durum: 'bakilacak' }, { gun }).cumle).toBe('Claude afiş brifini yazdı, Berkin’in onayını bekliyor');
    expect(gorevCumlesi({ ad: 'App Store onayı', sahip: 'Berkin', durum: 'hazir', bitis: '16 Eki' }, { gun }).cumle).toBe('App Store onayı: Berkin, 16 Eki’ye kadar');
    expect(gorevCumlesi({ ad: 'Kapsamı netleştir', sahip: 'Berkin', durum: 'hazir', bitis: '16 Eki', gecikme_gun: 2 }, { gun }).cumle).toBe('Berkin kapsamı 16 Eki’ye kadar netleştirmeli; 2 gün gecikti');
  });
});
