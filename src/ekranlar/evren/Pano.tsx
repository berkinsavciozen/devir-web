// Evren panosu (el notu 3–4): haritanın altında, kaydırınca oturan bölüm. Tutanak cümlesi, durum süzgeçleri, bekleyen işler.
import { forwardRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { BaglantiGonder } from '../akis/BaglantiGonder';
import { Metin } from '../../bilesen/Sahne';
import { planet, ship } from '../../cizim/ortak.js';
import { gunAy } from '../../cizim/yol.js';
import { adimAdi as adimEkranAdi, akisAdi, doluSatir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { useOlaylar } from '../../bilesen/Zil';
import { saat } from '../../cizim/yol.js';
import { adimAdi, olayFiili, topla } from '../bildirimler/model';
import { katilimcilar, PANO_AD, type Katilimci, type Pano as PanoV, type PanoTur } from './pano';
import { akisIlerlemesi, ilerlemeMetni } from '../../api/ilerleme';
import { vurgula } from '../../bilesen/vurgu';
import { kisaAd } from '../../cizim/yol.js';
import { kucukGalaksi } from './Evren';
import { aralikMetni, hedefEtiketi, KararSeridi, oncelikliAkis, seritYuksekligi, sutunEni } from '../../bilesen/KararSeridi';
import { DurumNotu, type VeriDurumu } from '../../bilesen/VeriDurumu';

const SATIR = 60, ARA = 8, EN = 6;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

/** Bölüm sayıları: akış ve katılımcı satırları en çok bu kadar (ötesi "Bütün akışlar"ta). */
export const AKIS_EN = 5, KATILIMCI_EN = 6;
/**
 * Bölümün yerleşimi: cümle satırları, süzgeç, bekleyen işler, alt bağlantılar; sonra akışlar (N4), katılımcılar (N5)
 * ve son hareketler. Her bölüm başlık + satırlar; boş bölüm yer tutmaz.
 */
export function panoYerlesimi(P: PanoV, n: number, y0: number, hareket = 0, seritH = 0, katilimci = 0, akis = 0) {
  const cumle = doluSatir(P.cumle, 350, '17.5px Caladea', 4);
  // karar şeridi cümlenin altında (yüksekliği ölçülür; ölçülmeden önce tahmin)
  const cY = y0 + 66, kY = cY - 9 + cumle.length * 23, sY = cY + (cumle.length - 1) * 23 + 22 + (seritH ? seritH + 10 : 0), lY = sY + (P.suzgecler.length ? 56 : 0);
  const satir = Math.min(n, EN), aY = lY + (satir ? satir * (SATIR + ARA) : 40) + 8;
  let alt = aY + 44 - 24;
  const bolum = (k: number) => { if (!k) return 0; const y = alt + 48; alt = y + 30 + k * (SATIR + ARA) - ARA; return y; };
  const akY = bolum(Math.min(akis, AKIS_EN)), dY = bolum(Math.min(katilimci, KATILIMCI_EN));
  // son hareketler (el notu 4): başlık, en çok üç satır, Bildirimler bağlantısı
  const hY = hareket ? alt + 48 : 0, son = hareket ? hY + 30 + hareket * (SATIR + ARA) + 44 : alt + 24;
  return { cumle, cY, kY, sY, lY, aY, akY, dY, hY, son };
}

/** Dış katılımcıların bağlantıları (P1-C): açık olanlar, hiç açmayan önce, sonra en eski açılış. */
export function useDisBaglantilar(): any[] {
  const q = useQuery({ queryKey: ['katilimcilar-tum'], queryFn: () => api.get<any>('/katilimcilar'), staleTime: 60_000 });
  return useMemo(() => (q.data?.katilimcilar || [])
    .filter((k: any) => k.durum === 'acik' && k.acik_adim > 0)
    .sort((a: any, b: any) => (a.son_acilis ? Date.parse(a.son_acilis) : 0) - (b.son_acilis ? Date.parse(b.son_acilis) : 0)), [q.data]);
}

/** Panonun akış ve katılımcı satırları (N4, N5): evren sayfası yerleşim için aynı listeyi okur. */
export function usePanoListeleri(kartlar: any[], detay: Record<string, any>, ben: string) {
  const DB = useDisBaglantilar();
  return useMemo(() => {
    const akislar = kartlar.slice().sort((a, b) => (a.pay_saat ?? 1e9) - (b.pay_saat ?? 1e9));
    const K = katilimcilar(kartlar, detay, ben);
    // bağlantısı açık dış katılımcı, adımları detayda görünmese de listede (bağlantıyı açmayan önce)
    for (const l of DB) if (!K.some((k) => k.ad.toLocaleLowerCase('tr') === String(l.ad).toLocaleLowerCase('tr'))) K.push({ ad: l.ad, tip: 'dis', acik: l.acik_adim, sirasi: 0, akislar: [l.akis.kod], kod: l.akis.kod, siradaki: null });
    const bag = (k: Katilimci) => (k.tip === 'dis' ? DB.find((l) => String(l.ad).toLocaleLowerCase('tr') === k.ad.toLocaleLowerCase('tr')) : undefined);
    return { akislar, katilimcilar: K.map((k) => ({ ...k, baglanti: bag(k) as any })) };
  }, [kartlar, detay, ben, DB]);
}

const tarihMsKisa = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const kisiIkonu = (ad: string, tip: string) => tip === 'dis' ? ship(0, 1, 0, 'dis', '', '#F2B8D8', .7) : ship(0, 0, -12, tip === 'agent' ? 'agent' : 'insan', (kisaAd(ad)[0] || '?').toLocaleUpperCase('tr'), tip === 'agent' ? '#B9A6F2' : '#8EC5FF', .7, { flame: false });

export const EvrenPano = forwardRef<HTMLHeadingElement, { P: PanoV; y0: number; ben: string; kartlar: any[]; detay: Record<string, any>; goster: PanoTur | null; secili: PanoTur | null; sec: (t: PanoTur | null) => void; durum?: VeriDurumu; yeniden?: () => void }>(
  function EvrenPano({ P, y0, ben, kartlar, detay, goster, secili, sec, durum = 'hazir', yeniden }, ref) {
    const liste = goster ? P.adimlar[goster] : [];
    const H = sonHareketler(useOlaylar().data?.olaylar);
    const L = usePanoListeleri(kartlar, detay, ben);
    const AK = L.akislar.slice(0, AKIS_EN), KT = L.katilimcilar.slice(0, KATILIMCI_EN);
    const [paylas, setPaylas] = useState<any>(null);
    const ak = oncelikliAkis(kartlar);
    const Y = panoYerlesimi(P, liste.length, y0, H.length, ak ? seritYuksekligi(ak.karar_ozeti, sutunEni(), { onek: akisAdi(ak) }) : 0, KT.length, AK.length);
    const ad = (kod: string) => { const k = kartlar.find((x) => x.kod === kod); return k ? akisAdi(k) : kod; };
    const now = Date.now();
    // görev satırının ikonu görevin haritası (N8): akışın küçük galaksisi; detay gelmeden durum gezegeni
    const miniHarita = useMemo(() => { const m: Record<string, string> = {}; for (const k of kartlar) if (detay[k.kod]) m[k.kod] = kucukGalaksi(detay[k.kod], ben, 0, 0, 16, 1.5, now); return m; }, [kartlar, detay, ben]); // eslint-disable-line react-hooks/exhaustive-deps
    const benimN = P.adimlar.sende.length;
    const vurguOlay = (kod: string) => ({ onMouseEnter: () => vurgula(kod), onMouseLeave: () => vurgula(null), onFocus: () => vurgula(kod), onBlur: () => vurgula(null) });
    return (
      <>
        <h2 ref={ref} className="bolum-durak" style={{ top: y0 }}>Pano</h2>
        <Metin y={Y.cY} x={20} fs={17.5} lh={23} serif as="p" style={{ whiteSpace: Y.cumle.length > 1 ? 'nowrap' : undefined }}>
          {Y.cumle.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}
        </Metin>
        {ak && <KararSeridi oz={ak.karar_ozeti} onek={akisAdi(ak)} ac={() => git(`/akis/${encodeURIComponent(ak.kod)}`)} style={{ left: 20, right: 20, top: Y.kY }} />}
        {P.suzgecler.length > 0 && (
          <div className="pano-cipler" role="group" aria-label="Duruma göre süz; haritada da süzer" style={{ top: Y.sY }}>
            {P.suzgecler.map((s) => (
              <button key={s.tur} type="button" className={`filtre-cip pano-cip-${s.tur}`} aria-pressed={goster === s.tur} onClick={() => sec(secili === s.tur ? null : s.tur)}>
                {PANO_AD[s.tur]} {s.n}
              </button>
            ))}
          </div>
        )}
        {liste.length ? <div role="list" aria-label="Bekleyen işler">{liste.slice(0, EN).map((a, i) => {
          const y = Y.lY + i * (SATIR + ARA), son = a.son ? gunAy(tarihMs(a.son)) : null;
          const kim = a.sahip === ben ? 'Sende' : a.sahip.replace(/\s*\(.*\)$/, '');
          const alt = [ad(a.kod), kim, a.tuttugu ? `${a.tuttugu} adımı tutuyor` : null, son].filter(Boolean).join(' · ');
          const durumIkon = planet(0, 0, 4.5, a.durum === 'engelli' ? 'block' : 'wait', { waitRings: 0, life: false, karar: a.karar });
          const ikon = miniHarita[a.kod] ? `${miniHarita[a.kod]}<g transform="translate(11,11)"><circle r="6.5" fill="#120B2C"/>${durumIkon}</g>` : planet(0, 0, 9, a.durum === 'engelli' ? 'block' : 'wait', { waitRings: 1, life: false, karar: a.karar });
          return (
            <div role="listitem" key={a.kod + a.no} style={{ display: 'contents' }}><button type="button" className="kart satir-kart pano-satir" style={{ left: 20, right: 20, top: y, height: SATIR }} title={a.ad} onClick={() => git(`/akis/${encodeURIComponent(a.kod)}/adim/${a.no}`)} {...vurguOlay(a.kod)}>
              <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: ikon }} />
              <span className="satir-metin" style={{ left: 52, right: 16 }}><b>{adimEkranAdi(a)}</b><small>{alt}</small></span>
            </button></div>
          );
        })}</div> : durum === 'kismi' || durum === 'hata' || durum === 'yukleniyor'
          ? <DurumNotu durum={durum} y={Y.lY + 6} yeniden={yeniden} />
          : <Metin y={Y.lY + 22} x={20} fs={14} renk="ink3">Şu an bekleyen iş yok.</Metin>}
        <button type="button" className="metin-baglanti pano-baglanti" style={{ left: 20, top: Y.aY }} onClick={() => git('/gorevler')}>
          {benimN ? `Görevler (${benimN})` : 'Görevler'}
        </button>
        <button type="button" className="metin-baglanti pano-baglanti" style={{ right: 20, top: Y.aY }} onClick={() => git('/akislar')}>Bütün akışlar</button>
        {AK.length > 0 && <>
          <h3 className="bolum-baslik" style={{ top: Y.akY }}>AKIŞLAR</h3>
          <div role="list" aria-label="Pano akışları">{AK.map((k, i) => {
            const y = Y.akY + 30 + i * (SATIR + ARA), oz = k.karar_ozeti;
            // hedef etiketi şeritle aynı hesaptan (üst uç); eski sunucuda alt uca göre pay
            const e = hedefEtiketi(oz) ?? (k.pay_saat == null ? null : k.pay_saat >= 0 ? `${Math.round(k.pay_saat / 24)} g pay` : `${Math.round(-k.pay_saat / 24)} g geç`);
            const alt = [ilerlemeMetni(akisIlerlemesi(k, detay[k.kod])), oz?.bitis?.aralik ? aralikMetni(oz.bitis.aralik) : null, !e && k.hedef_tarih ? `hedef ${gunAy(tarihMsKisa(k.hedef_tarih))}` : null].filter(Boolean).join(' · ');
            return (
              <div role="listitem" key={k.kod} style={{ display: 'contents' }}><button type="button" className="kart satir-kart pano-satir" style={{ left: 20, right: 20, top: y, height: SATIR }} title={k.baslik} aria-label={`${akisAdi(k)}: ${alt}${e ? `. ${e}` : ''}.`} onClick={() => git(`/akis/${encodeURIComponent(k.kod)}`)} {...vurguOlay(k.kod)}>
                <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: miniHarita[k.kod] || kucukGalaksi(null, ben, 0, 0, 16, 1.5, now) }} />
                <span className="satir-metin" style={{ left: 52, right: e ? 84 : 16 }}><b>{akisAdi(k)}</b><small>{alt}</small></span>
                {e && <span className="satir-not" style={{ color: oz?.hedef?.durum === 'geciyor' ? 'var(--renk-metin-mercan)' : 'var(--renk-metin-altin)' }}>{e}</span>}
              </button></div>
            );
          })}</div>
        </>}
        {KT.length > 0 && <>
          <h3 className="bolum-baslik" style={{ top: Y.dY }}>KATILIMCILAR</h3>
          <div role="list" aria-label="Katılımcılar">{KT.map((k, i) => {
            const y = Y.dY + 30 + i * (SATIR + ARA), l = k.baglanti;
            const akisMetni = k.akislar.length > 1 ? `${ad(k.akislar[0])} +${k.akislar.length - 1}` : ad(k.akislar[0]);
            const ne = l ? (l.son_acilis ? `son açılış ${gunAy(Date.parse(l.son_acilis))}` : 'bağlantıyı açmadı') : k.siradaki ? `sırada ${adimEkranAdi(k.siradaki)}` : null;
            const tur = k.tip === 'agent' ? 'agent' : k.tip === 'dis' ? 'dış katılımcı' : null;
            const alt = [akisMetni, k.acik ? `${k.acik} açık` : 'açık işi yok', ne].filter(Boolean).join(' · ');
            const ac = () => (l ? setPaylas(l) : git(`/akis/${encodeURIComponent(k.kod)}/kisi/${encodeURIComponent(k.ad)}`));
            return (
              <div role="listitem" key={k.ad} style={{ display: 'contents' }}><button type="button" className="kart satir-kart pano-satir" style={{ left: 20, right: 20, top: y, height: SATIR }} onClick={ac}
                aria-label={`${kisaAd(k.ad)}${tur ? ` (${tur})` : ''}: ${alt}.${l ? ' Paylaşımı aç.' : ''}`}>
                <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: kisiIkonu(k.ad, k.tip) }} />
                <span className="satir-metin" style={{ left: 52, right: 16 }}><b>{kisaAd(k.ad)}</b><small>{alt}</small></span>
              </button></div>
            );
          })}</div>
        </>}
        {paylas && <BaglantiGonder kod={paylas.akis.kod} kisi={paylas.ad} kisiId={paylas.kisi_id} adimSayisi={paylas.adim_sayisi} kapat={() => setPaylas(null)} />}
        {H.length > 0 && <>
          <h3 className="bolum-baslik" style={{ top: Y.hY }}>SON HAREKETLER</h3>
          {H.map((t, i) => {
            const e = t.e, adim = adimAdi(e), y = Y.hY + 30 + i * (SATIR + ARA);
            const alt = [ad(e.akis), adim, saat(Date.parse(e.zaman))].filter(Boolean).join(' · ');
            return (
              <button key={t.ids.join('-')} type="button" className="kart satir-kart pano-satir" style={{ left: 20, right: 20, top: y, height: SATIR }}
                onClick={() => git(e.adim_no == null ? `/akis/${encodeURIComponent(e.akis)}` : `/akis/${encodeURIComponent(e.akis)}/adim/${e.adim_no}?sekme=gecmis`)}>
                <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: e.kim_tip === 'dis' ? ship(0, 1, 0, 'dis', '', '#F2B8D8', .7) : ship(0, 0, -12, e.kim_tip === 'agent' ? 'agent' : 'insan', (e.kim[0] || '?').toLocaleUpperCase('tr'), e.kim_tip === 'agent' ? '#B9A6F2' : '#8EC5FF', .7, { flame: false }) }} />
                <span className="satir-metin" style={{ left: 52, right: 16 }}><b>{olayFiili(e)}</b><small>{alt}</small></span>
              </button>
            );
          })}
          <button type="button" className="metin-baglanti pano-baglanti" style={{ left: 20, top: Y.hY + 30 + H.length * (SATIR + ARA) }} onClick={() => git('/bildirimler?sekme=tum')}>Bildirimler’de tümü</button>
        </>}
      </>
    );
  });

/** Panodaki son hareketler: kişilerin (sistem dışı) en yeni üç toplu olayı. */
export const sonHareketler = (O: any[] | undefined) => topla((O || []).filter((e) => e.kim_tip !== 'sistem')).slice(0, 3);
