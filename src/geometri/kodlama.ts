/**
 * Görsel kodlama sözleşmesi (el notu madde 11; tasarim/KODLAMA.md).
 * Haritalardaki her görsel değişken bir veri alanından gelir. Bu tablo o eşlemenin tek kaynağıdır:
 * lejant, tanıtım ve başlık çipleri buradan üretilir; her satırın iddiası kodda karşılığını bulduğu PR'da sınanır.
 */
export type Yuzey = 'galaksi' | 'evren' | 'serit';

export interface Kodlama {
  /** kısa kimlik (test ve lejant anahtarı) */
  kod: string;
  /** veri alanı, kullanıcının diliyle */
  veri: string;
  /** yüzey başına görsel karşılık; yoksa o yüzeyde gösterilmez */
  galaksi?: string;
  evren?: string;
  serit?: string;
  /** sınanacak iddia */
  iddia: string;
  /** bu satır hangi PR'da kodda karşılığını buldu */
  durum: 'var' | 'E2' | 'E3';
}

export const KODLAMA: Kodlama[] = [
  { kod: 'zaman', veri: 'Zaman', galaksi: 'sarmal yay uzunluğu, süreyle orantılı', evren: 'halkada açı; başlangıçtan hedefe yay', serit: 'yatay eksen', iddia: 'her yol parçasında piksel uzunluğu / gün sabit (%1)', durum: 'var' },
  { kod: 'adim-sayisi', veri: 'Adım sayısı', galaksi: 'gezegen sayısı', evren: 'galaksi alanı (yarıçap √adım)', serit: 'satırdaki gezegen', iddia: 'adım sayısı iki katına çıkınca evren alanı iki katına çıkar', durum: 'E3' },
  { kod: 'tamamlanma', veri: 'Biten adım', galaksi: 'gezegen yanar', evren: 'aydınlanma = biten / toplam', serit: 'yanan gezegen', iddia: 'durumu tamam olan her adım "lit" çizilir', durum: 'var' },
  { kod: 'darbogaz', veri: 'Darboğaz ağırlığı', galaksi: 'gezegen boyu (tuttuğu adım, kritik yol, bekleme)', evren: 'bulut simgesi ve sayı', serit: 'bulut simgesi', iddia: 'darboğaz puanı artınca gezegen küçülmez (büyütmeden sonra da)', durum: 'var' },
  { kod: 'pay', veri: 'Hedefe kalan pay', galaksi: 'kuyruk uzunluğu', evren: 'yarıçap: pay azaldıkça halkaya yakın', serit: 'pay çipi', iddia: 'payı az olan galaksi halkaya daha yakın', durum: 'E3' },
  { kod: 'kisi', veri: 'Kişi', galaksi: 'gemi ve rota', evren: 'ortak kişiyle bağlı galaksiler arasında ip', serit: 'satır ve gemi', iddia: 'her üyenin bir rotası ve bir satırı var', durum: 'var' },
  { kod: 'alt-adim', veri: 'Alt adım, kalem', galaksi: 'ana gezegenin çevresinde uydu (2 kat)', serit: 'sahibinin satırında küçük nokta', iddia: 'uydu ana gezegenden küçük, kendi durumunun rengiyle', durum: 'E2' },
  { kod: 'karar', veri: 'Karar bekleyen adım', galaksi: 'bayrak', evren: 'bayrak', serit: 'bayrak', iddia: 'açık karar adımı bayraklı çizilir', durum: 'var' },
];

/** Bir yüzeyde gösterilen kodlamalar (lejant ve tanıtım için). */
export const yuzeyKodlamalari = (y: Yuzey) => KODLAMA.filter((k) => k[y]);
