import { describe, expect, it } from 'vitest';
import { senEki } from './GorevKart';

describe('senEki: "Sen" ile kurulan görev cümlesi 2. tekil kişiye çekilir', () => {
  it('gelecek zaman: -acak/-ecek yumuşamaz', () => {
    expect(senEki('Sen bütçe çerçevesini 2 Kas’a kadar netleştirecek')).toBe('Bütçe çerçevesini 2 Kas’a kadar netleştireceksin');
    expect(senEki('Sen afişi yazacak; engelde')).toBe('Afişi yazacaksın; engelde');
    expect(senEki('Sen sözleşmeyi kontrol edecek')).toBe('Sözleşmeyi kontrol edeceksin');
  });
  it('şimdiki ve geçmiş zaman', () => {
    expect(senEki('Sen raporu yazıyor')).toBe('Raporu yazıyorsun');
    expect(senEki('Sen raporu yazdı')).toBe('Raporu yazdın');
  });
});
