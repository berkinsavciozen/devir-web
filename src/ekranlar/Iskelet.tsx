import { useState } from 'react';
import { AltGezinme } from '../bilesen/AltGezinme';
import { AltSayfa, sayfayiKapat } from '../bilesen/AltSayfa';
import { AkilliCumle, Baslik } from '../bilesen/Baslik';
import { Dugme } from '../bilesen/Dugme';
import { Cizim } from '../bilesen/Svg';
import { ship } from '../cizim/ortak.js';

/** Geliştirme vitrini (/_iskelet): gök, başlık, cümle, düğmeler, alt sayfa ve alt gezinme bir arada. */
export function Iskelet() {
  const [sayfa, setSayfa] = useState<null | 'orta' | 'yuksek'>(null);
  return (
    <main className="ekran">
      <Baslik baslik="İskelet" geri={() => history.back()} />
      <AkilliCumle>İşler kimde, ne zaman biter; tek bakışta.</AkilliCumle>
      <div style={{ display: 'grid', gap: 16, padding: '28px 20px' }}>
        <svg width="60" height="40" viewBox="0 0 60 40" aria-hidden><Cizim html={ship(30, 20, -20, 'insan', 'B', '#FFC9A3', 1.2, { flame: false })} /></svg>
        <Dugme onClick={() => setSayfa('orta')}>Alt sayfayı aç</Dugme>
        <Dugme tur="ikincil" ton="altin" onClick={() => setSayfa('yuksek')}>Yüksek sayfa</Dugme>
        <Dugme tur="ikincil" ton="mercan">Engel bildir</Dugme>
        <Dugme tur="tehlike">Sil</Dugme>
        <Dugme mesgul>Kaydet</Dugme>
        <Dugme disabled>Akışı kur</Dugme>
      </div>
      <AltGezinme aktif="evren" git={() => {}} yeni={() => setSayfa('orta')} />
      <AltSayfa acik={!!sayfa} kapat={() => setSayfa(null)} yukseklik={sayfa ?? 'orta'} duraklar={['orta', 'yuksek']} baslik="Örnek">
        <div style={{ padding: '8px 20px', display: 'grid', gap: 16 }}>
          <h2 className="t-sayfa-basligi" style={{ margin: 0 }}>Örnek sayfa</h2>
          <p className="t-akilli-cumle" style={{ margin: 0 }}>Tutamaçtan sürükle, aşağı fırlat ya da arkaya dokun.</p>
          <Dugme tur="ikincil" onClick={sayfayiKapat}>Vazgeç</Dugme>
        </div>
      </AltSayfa>
    </main>
  );
}
