# Görsel kodlama sözleşmesi

Haritalardaki her görsel değişken bir veri alanından gelir; tablonun tek kaynağı `src/geometri/kodlama.ts` dosyasıdır. Lejanttaki "Ne neyi gösterir" bölümü oradan üretilir. Bir satır eklemek ya da değiştirmek bu dosyada ve kodda birlikte yapılır.

| Veri | Galaksi | Evren | Şeritler | Durum |
|---|---|---|---|---|
| Zaman | sarmal yay uzunluğu, süreyle orantılı | halkada açı | yatay eksen | var |
| Adım sayısı | gezegen sayısı | galaksi alanı (yarıçap √adım) | satırdaki gezegen | E3 |
| Biten adım | gezegen yanar | aydınlanma = biten / toplam | yanan gezegen | var |
| Darboğaz ağırlığı | gezegen boyu | bulut ve sayı | bulut | var |
| Hedefe kalan pay | kuyruk uzunluğu | yarıçap: pay azaldıkça halkaya yakın | pay çipi | E3 |
| Kişi | gemi ve rota | ortak kişili galaksiler arasında ip | satır ve gemi | var |
| Alt adım | ana gezegen çevresinde uydu | | sahibinin satırında nokta | E2 |
| Karar bekleyen adım | bayrak | bayrak | bayrak | var |

## Ölçek kuralları (`src/geometri/olcek.ts`)

- **Öğe katı** `kat = taban(tür) × yoğunluk(N) × √yakınlaştırma`. Ana gezegen tabanı 3, alt adım 2. Yoğunluk `min(1, √(10/N))`: 10 adımın üstünde öğeler kendiliğinden küçülür. Kat 1,2 ile 4,5 arasında tutulur.
- **Yarıçap büyütme** `buyut(r) = kat·r0 + (r − r0)·√kat`. En küçük gezegen tam kat büyür, darboğaz farkı korunur ama karekökle büyür; böylece büyük gezegen küçükleri yutmaz ve sıralama bozulmaz.
- **Sığma sınırı** `uygunKat`: komşu gezegenler arası medyan uzaklığa göre katı, büyütülmüş iki gezegen o uzaklığın 1,4 katını geçmeyecek kadar indirir. Kümeler büyütmeden önceki yarıçapla hesaplanır; büyük gezegenler hafifçe üst üste biner, kümeye dönüşmez.
- **Yazı** en çok 1,45 kat büyür ve 12 pikselin altına inmez. Yazının 3 kat büyümesi satırları taşırdığı için gezegen ve gemiden ayrı tutuldu.
- **Dokunma hedefi** en az 44 piksel (yarıçap 22).
- Geniş ekranda hedef kat √(telefon ölçeği / masaüstü ölçeği) ile iner; masaüstü harita zaten büyük çizilir.
