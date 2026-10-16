import { describe, expect, it } from 'vitest';
import { kullaniciDili } from './istemci';

describe('kullaniciDili', () => {
  it('teknik cümleleri kullanıcı diline çevirir', () => {
    expect(kullaniciDili(400, "'XQ12' kodlu akış bulunamadı. devir_akislar ile akışları listele.")).toBe('Bu akış bulunamadı; kapanmış ya da başka bir alanda olabilir.');
    expect(kullaniciDili(400, "'RTD5' akışı senin kapsamında değil.")).toMatch(/sana açık değil/);
    expect(kullaniciDili(404, 'Böyle bir uç yok.')).toBe('Bu işlem şu an yapılamıyor.');
    expect(kullaniciDili(500, null)).toMatch(/ters gitti/);
  });
  it('araç adını atar, bilinen cümleyi korur', () => {
    expect(kullaniciDili(400, 'Adım tamam değil. devir_adim_guncelle ile güncelle.')).toBe('Adım tamam değil.');
    expect(kullaniciDili(400, 'Geçerli bir e-posta adresi yaz.')).toBe('Geçerli bir e-posta adresi yaz.');
  });
});
