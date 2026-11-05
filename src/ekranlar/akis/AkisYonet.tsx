import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { akisAdi } from '../../metin/turkce';
import { SatirKart } from '../hesap/Hesap';

// 0.31.0 (5 Kas, Berkin): akışın adı ve arşivi tek yerden. Arşiv silmez ve kapatmaz; akış listelerden kalkar,
// "Arşivden çıkar" önceki durumuna döndürür.
const enc = encodeURIComponent;
export const YONET_Y = 32 + 66 + 12;
const ikon = (arsiv: boolean) => `<g transform="translate(28,33)" fill="none" stroke="#D9CCFF" stroke-width="1.5" stroke-linejoin="round" opacity="${arsiv ? 1 : .85}"><rect x="-11" y="-10" width="22" height="6" rx="1.5"/><path d="M-9,-4 V9 H9 V-4"/><path d="M-3.5,1 H3.5" stroke-linecap="round"/></g>`;

export function AkisYonetSatiri({ d, kod, y }: { d: any; kod: string; y: number }) {
  const [acik, setAcik] = useState(false);
  const arsiv = d.akis?.durum === 'arsiv';
  return (
    <>
      <h3 className="bolum-baslik" style={{ top: y + 6 }}>AKIŞ</h3>
      <SatirKart y={y + 32} h={58} ikon={ikon(arsiv)} ust={arsiv ? 'Bu akış arşivde' : 'Adı ve arşiv'} alt={arsiv ? 'Arşivden çıkar · adını değiştir' : 'Adını değiştir · arşive at'}
        etiket={arsiv ? 'Bu akış arşivde. Arşivden çıkar ya da adını değiştir.' : 'Akışın adını değiştir ya da arşive at.'} onClick={() => setAcik(true)} />
      <AkisYonetSayfasi acik={acik} kapat={() => setAcik(false)} d={d} kod={kod} />
    </>
  );
}

function AkisYonetSayfasi({ acik, kapat, d, kod }: { acik: boolean; kapat: () => void; d: any; kod: string }) {
  const arsiv = d.akis?.durum === 'arsiv', ad0 = d.akis?.baslik || akisAdi(d.akis);
  const [ad, setAd] = useState(ad0);
  useEffect(() => { if (acik) setAd(ad0); }, [acik]); // eslint-disable-line react-hooks/exhaustive-deps
  const tazele = () => { void sorguIstemcisi.invalidateQueries(); };
  const adla = useMutation({ mutationFn: () => api.post<any>(`/akis/${enc(kod)}/ad`, { ad: ad.trim() }), onSuccess: () => { tazele(); kapat(); } });
  const arsivle = useMutation({ mutationFn: () => api.post<any>(`/akis/${enc(kod)}/arsiv`, { geri_al: arsiv }), onSuccess: () => { tazele(); kapat(); } });
  const yeni = ad.replace(/\s+/g, ' ').trim(), degisti = !!yeni && yeni !== ad0;
  const hata = (adla.error || arsivle.error) as Error | null;
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="Akışı düzenle" yukseklik={arsiv ? 400 : 380} kirli={degisti}>
      {acik && (
        <div className="onay-sayfa">
          <h2>Akışı düzenle</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (degisti) adla.mutate(); }}>
            <label><span className="alan-etiket">Akışın adı</span>
              <input className="alan" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={120} aria-describedby="akis-ad-not" autoFocus />
            </label>
            <p id="akis-ad-not" className="alan-not">{yeni.length > 40 ? 'Listelerde ilk 40 karakterden kısaltılmış hâli görünür.' : 'Listelerde, evrende ve haritada bu ad görünür.'}</p>
            <Dugme className="statik" style={{ marginTop: 14 }} type="submit" disabled={!degisti} mesgul={adla.isPending}>Adı kaydet</Dugme>
          </form>
          <p className="onay-cumle">{arsiv
            ? 'Arşivden çıkınca akış önceki yerine döner: listelerde, evrende ve AI işlerinde yeniden görünür.'
            : 'Arşive atınca akış listelerden, evrenden ve AI işlerinden kalkar. Hiçbir şey silinmez; Arşiv sayfasından açıp geri alabilirsin.'}</p>
          <Dugme className="statik" tur="ikincil" ton={arsiv ? 'altin' : 'lila'} yukseklik={48} fs={15} mesgul={arsivle.isPending} onClick={() => arsivle.mutate()}>{arsiv ? 'Arşivden çıkar' : 'Arşive at'}</Dugme>
          {hata && <p className="canli-hata-satir" role="alert">{hata.message}</p>}
        </div>
      )}
    </AltSayfa>
  );
}
