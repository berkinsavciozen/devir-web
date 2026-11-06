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
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
/** W2 (K3): akış düzeyinde AI yapsın: akıştaki açık agent işleri (alt görevler hariç). */
export const acikAgentIsleri = (d: any): any[] => (d?.adimlar || []).filter((a: any) => a.sahip_tip === 'agent' && !BITTI(a.durum) && a.ust_adim == null);
/** Bölümün yüksekliği: AI yapsın satırı yalnız açık agent işi olan aktif akışta. */
export const yonetY = (d: any) => YONET_Y + (d?.akis?.durum === 'aktif' && acikAgentIsleri(d).length ? 66 : 0);
const aiIkon = `<g transform="translate(28,33)"><path d="M2,-12 L-6,2 L0,2 L-2,12 L7,-3 L1,-3Z" fill="none" stroke="#FFD27A" stroke-width="1.5" stroke-linejoin="round"/></g>`;
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
      {yonetY(d) > YONET_Y && <AkisAiSatiri d={d} kod={kod} y={y + 32 + 66} />}
    </>
  );
}

/** W2 (6 Kas, K3): akış düzeyinde AI yapsın anahtarı: akıştaki senin agent işlerinin hepsinde aç ya da kapat. */
function AkisAiSatiri({ d, kod, y }: { d: any; kod: string; y: number }) {
  const [acik, setAcik] = useState(false);
  const L = acikAgentIsleri(d), n = L.filter((a) => a.oto).length;
  const [sonuc, setSonuc] = useState<any>(null);
  const m = useMutation({
    mutationFn: (oto: boolean) => api.post<any>(`/akis/${enc(kod)}/ai`, { oto }),
    onSuccess: (r) => { setSonuc(r); void sorguIstemcisi.invalidateQueries(); },
  });
  useEffect(() => { if (acik) { setSonuc(null); m.reset(); } }, [acik]); // eslint-disable-line react-hooks/exhaustive-deps
  const alt = n === 0 ? `${L.length} agent işinde kapalı · hepsinde aç` : n === L.length ? `${L.length} agent işinin hepsinde açık` : `${L.length} agent işinin ${n} tanesinde açık`;
  return (
    <>
      <SatirKart y={y} h={58} ikon={aiIkon} ust="AI yapsın" alt={alt} etiket={`AI yapsın: ${alt}. Akışın bütün agent işlerinde aç ya da kapat.`} onClick={() => setAcik(true)} />
      <AltSayfa acik={acik} kapat={() => setAcik(false)} baslik="AI yapsın" yukseklik={420}>
        {acik && (
          <div className="onay-sayfa">
            <h2>Bu akışta AI yapsın</h2>
            <p className="onay-cumle">Açınca akıştaki agent işlerin zamanı gelince bağlı Claude rutinin tarafından yapılır; çıktı taslak olarak gelir, sen onaylarsın. Karar, dışarı gönderme ve ödeme adımları senin elinde kalır.</p>
            <Dugme className="statik" yukseklik={50} fs={15} mesgul={m.isPending && m.variables === true} disabled={m.isPending} onClick={() => m.mutate(true)}>Agent işlerinin hepsinde aç</Dugme>
            {n > 0 && <Dugme className="statik" style={{ marginTop: 10 }} tur="ikincil" ton="lila" yukseklik={48} fs={15} mesgul={m.isPending && m.variables === false} disabled={m.isPending} onClick={() => m.mutate(false)}>Hepsinde kapat</Dugme>}
            {sonuc && <p className="onay-cumle" role="status">{sonuc.not}{sonuc.atlanan?.length ? ` Açılmayan: ${sonuc.atlanan.slice(0, 4).map((x: any) => `${x.no}. adım (${x.neden})`).join(', ')}${sonuc.atlanan.length > 4 ? '…' : ''}.` : ''}</p>}
            {m.isError && <p className="canli-hata-satir" role="alert">{(m.error as Error).message}</p>}
          </div>
        )}
      </AltSayfa>
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
