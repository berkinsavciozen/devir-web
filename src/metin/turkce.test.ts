import { expect, test } from 'vitest';
import { adimAdi, adimEtiketi, akisAdi, ek, ozelEk, tarihDi, tarihEk } from './turkce';

test('ekler: ünlü uyumu, sertleşme, iyelik, sayılar', () => {
  expect(ek('App Store onayı', 'den')).toBe('App Store onayından');
  expect(ek('Görsel', 'den')).toBe('Görselden');
  expect(ek('Adım 4', 'den')).toBe('Adım 4’ten');
  expect(ek('Adım 2', 'den')).toBe('Adım 2’den');
  expect(ek('Adım 6', 'e')).toBe('Adım 6’ya');
  expect(ek('Adım 30', 'in')).toBe('Adım 30’un');
  expect(ozelEk('Test Bank', 'de')).toBe('Test Bank’te');
  expect(tarihEk('12 Eki', 'de')).toBe('12 Eki’de');
  expect(tarihDi('1 Kasım')).toBe('1 Kasım’dı');
  expect(tarihDi('9 Eylül')).toBe('9 Eylül’dü');
  expect(tarihDi('3 Ağustos')).toBe('3 Ağustos’tu');
});

test('P1-F: ad kesilmez; kisa_ad yoksa tam ad', () => {
  const uzun = 'Üretici kendi markalı ilk partiyi üretip teslim eder (private label kararı evetse)';
  expect(adimAdi({ ad: uzun })).toBe('Üretici kendi markalı ilk partiyi üretip teslim eder');
  expect(adimAdi({ ad: uzun, kisa_ad: 'İlk partiyi teslim eder' })).toBe('İlk partiyi teslim eder');
  expect(akisAdi({ baslik: 'Belediye park aydınlatma ihalesi: teklif, sonuç ve sözleşme/itiraz' })).toBe('Belediye park aydınlatma ihalesi');
  expect(akisAdi({ baslik: 'Yaza Veda Partisi – Swissotel İstanbul (100 kişi + süit)' })).toBe('Yaza Veda Partisi');
  expect(adimEtiketi({ ad: '', kisa_ad: 'Geçici teminat mektubunu al' })).toBe('Teminat mektubunu');
  expect(adimEtiketi({ ad: '', kisa_ad: 'Geçici teminat iadesini al' })).toBe('Teminat iadesini');
  expect(adimEtiketi({ ad: '', kisa_ad: 'App Store onayını bekle' })).toBe('App Store');
  expect(adimEtiketi({ ad: '', kisa_ad: 'Post görseli' })).toBe('Görsel');
  expect(adimEtiketi({ ad: '', kisa_ad: 'Mevzuat kontrolü yap' })).toBe('Mevzuat kontrolü');
});
