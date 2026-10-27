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
  { kod: 'zaman', veri: 'Zaman', galaksi: 'sarmal yay uzunluğu; bugüne yakın günler geniş, uzaktakiler sıkışık (hafta çentikleri)', evren: 'halkada açı = hedef tarih; yörünge başlangıçtan hedefe', serit: 'yatay eksen', iddia: 'her yol parçasında piksel uzunluğu / gün sabit (%1)', durum: 'var' },
  { kod: 'adim-sayisi', veri: 'Adım sayısı', galaksi: 'gezegen sayısı', evren: 'galaksi alanı (yarıçap √adım)', serit: 'satırdaki gezegen', iddia: 'adım sayısı iki katına çıkınca evren alanı iki katına çıkar (evren.test.ts)', durum: 'var' },
  { kod: 'tamamlanma', veri: 'Biten adım', galaksi: 'gezegen yanar', evren: 'hale ışığı ve ilerleme yayı = biten / toplam; merkeze uzaklık = kalan iş (merkez = bitti)', serit: 'yanan gezegen', iddia: 'durumu tamam olan her adım "lit" çizilir; kalan işi az olan galaksi merkeze daha yakın (evren.test.ts)', durum: 'var' },
  { kod: 'darbogaz', veri: 'Darboğaz ağırlığı', galaksi: 'gezegen tacı (bekleyen iş ve engel süresi)', evren: 'cümledeki engel: köşeli çerçeve ve bulut', serit: 'bulut simgesi', iddia: 'darboğaz puanı artınca gezegen küçülmez (büyütmeden sonra da)', durum: 'var' },
  { kod: 'pay', veri: 'Hedefe kalan pay', galaksi: 'kuyruk uzunluğu', evren: 'hedefi geçen galaksinin çerçevesi kırmızı', serit: 'pay çipi', iddia: 'payı eksiye düşen galaksi kırmızı çerçeveli (evren.test.ts)', durum: 'var' },
  { kod: 'kisi', veri: 'Kişi', galaksi: 'gemi ve rota', evren: 'ortak kişisi olan galaksiler arasında ip', serit: 'satır ve gemi', iddia: 'her üyenin bir rotası ve bir satırı var', durum: 'var' },
  { kod: 'alt-adim', veri: 'Alt adım, kalem', galaksi: 'uzakta Satürn halkası ve k/n, yakında zaman sırasıyla mini sarmal', serit: 'sahibinin satırında küçük nokta', iddia: 'uydu ana gezegenden küçük, kendi durumunun rengiyle', durum: 'E2' },
  { kod: 'karar', veri: 'Karar bekleyen adım', galaksi: 'bayrak', evren: 'bayrak', serit: 'bayrak', iddia: 'açık karar adımı bayraklı çizilir', durum: 'var' },
];

/** Bir yüzeyde gösterilen kodlamalar (lejant ve tanıtım için). */
export const yuzeyKodlamalari = (y: Yuzey) => KODLAMA.filter((k) => k[y]);
