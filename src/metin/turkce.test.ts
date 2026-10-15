import { expect, test } from 'vitest';
import { ek, ozelEk, tarihDi, tarihEk } from './turkce';

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
