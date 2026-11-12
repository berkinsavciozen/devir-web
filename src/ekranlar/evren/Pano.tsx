// Evren panosu (el notu 3–4; 12 Kas Tek Pano P2): haritanın altında, kaydırınca oturan bölüm.
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { BaglantiGonder } from '../akis/BaglantiGonder';
import { ship } from '../../cizim/ortak.js';
import { gunAy, kisaAd } from '../../cizim/yol.js';
import { kisiRengi } from '../../cizim/hamle';
import { adimAdi as adimEkranAdi, akisAdi } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { katilimcilar, type Katilimci, type Pano as PanoV } from './pano';
import { akisIlerlemesi, ilerlemeMetni } from '../../api/ilerleme';
import { vurgula } from '../../bilesen/vurgu';
import { kucukGalaksi } from './Evren';
import { aralikMetni, hedefEtiketi, KararSeridi, oncelikliAkis } from '../../bilesen/KararSeridi';
import { TekPano } from '../pano/TekPano';

const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

/** Bölüm sayıları: akış ve katılımcı satırları en çok bu kadar (ötesi "Bütün akışlar"ta). */
export const AKIS_EN = 5, KATILIMCI_EN = 6;
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

// katılımcının gemisi kendi renginde (12 Kas, Tek Pano: başkalarının işleri kendi renklerinde); agent sahibinin açık tonunda
const kisiIkonu = (k: Katilimci) => k.tip === 'dis' ? ship(0, 1, 0, 'dis', '', '#F2B8D8', .7) : ship(0, 0, -12, k.tip === 'agent' ? 'agent' : 'insan', (kisaAd(k.ad)[0] || '?').toLocaleUpperCase('tr'), kisiRengi(k.ad, { tip: k.tip, sahibi: k.sahibi }), .7, { flame: false });

/**
 * Evren panosu (12 Kas, Tek Pano P2): haritanın altında Tek Pano'nun kendisi; üstünde özet cümle ve karar şeridi,
 * altında akışlar ve katılımcılar (K2). Durum süzgeci haritanın çiplerinde kalır. Yükseklik ölçülür (`boy`), sahne
 * ona göre uzar.
 */
export const EvrenTekPano = forwardRef<HTMLDivElement, { P: PanoV; ben: string; kartlar: any[]; detay: Record<string, any>; style?: CSSProperties; boy?: (h: number) => void }>(
  function EvrenTekPano({ P, ben, kartlar, detay, style, boy }, ref) {
    const ic = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => ic.current!);
    useLayoutEffect(() => {
      const e = ic.current; if (!e || !boy) return;
      boy(e.offsetHeight);
      const g = new ResizeObserver(() => boy(e.offsetHeight));
      g.observe(e);
      return () => g.disconnect();
    }, [boy]);
    const ak = oncelikliAkis(kartlar);
    return (
      <div ref={ic} className="evren-tek-pano" style={style}>
        <TekPano ben={ben} okunduYaz={false} ust={<>
          {P.cumle && <p className="tek-pano-cumle">{P.cumle}</p>}
          {ak && <KararSeridi oz={ak.karar_ozeti} onek={akisAdi(ak)} ac={() => git(`/akis/${encodeURIComponent(ak.kod)}`)} className="akim" />}
        </>} alt={<PanoAkislari ben={ben} kartlar={kartlar} detay={detay} />} />
      </div>
    );
  });

/** Panonun altındaki akışlar ve katılımcılar (N4, N5; K2): akan satırlar. */
export function PanoAkislari({ ben, kartlar, detay }: { ben: string; kartlar: any[]; detay: Record<string, any> }) {
  const L = usePanoListeleri(kartlar, detay, ben);
  const AK = L.akislar.slice(0, AKIS_EN), KT = L.katilimcilar.slice(0, KATILIMCI_EN);
  const [paylas, setPaylas] = useState<any>(null);
  const ad = (kod: string) => { const k = kartlar.find((x) => x.kod === kod); return k ? akisAdi(k) : kod; };
  const now = Date.now();
  // akış satırının ikonu akışın küçük galaksisi (N8); detay gelmeden boş galaksi
  const miniHarita = useMemo(() => { const m: Record<string, string> = {}; for (const k of kartlar) if (detay[k.kod]) m[k.kod] = kucukGalaksi(detay[k.kod], ben, 0, 0, 16, 1.5, now); return m; }, [kartlar, detay, ben]); // eslint-disable-line react-hooks/exhaustive-deps
  const vurguOlay = (kod: string) => ({ onMouseEnter: () => vurgula(kod), onMouseLeave: () => vurgula(null), onFocus: () => vurgula(kod), onBlur: () => vurgula(null) });
  return (
    <div className="pano-akim">
      {AK.length > 0 && <section aria-label="Akışlar" className="tek-pano-bolum">
        <h3 className="gd-bolum-baslik">AKIŞLAR</h3>
        <div role="list" aria-label="Pano akışları">{AK.map((k) => {
          const oz = k.karar_ozeti;
          // hedef etiketi şeritle aynı hesaptan (üst uç); eski sunucuda alt uca göre pay
          const e = hedefEtiketi(oz) ?? (k.pay_saat == null ? null : k.pay_saat >= 0 ? `${Math.round(k.pay_saat / 24)} g pay` : `${Math.round(-k.pay_saat / 24)} g geç`);
          const alt = [ilerlemeMetni(akisIlerlemesi(k, detay[k.kod])), oz?.bitis?.aralik ? aralikMetni(oz.bitis.aralik) : null, !e && k.hedef_tarih ? `hedef ${gunAy(tarihMs(k.hedef_tarih))}` : null].filter(Boolean).join(' · ');
          return (
            <div role="listitem" key={k.kod}><button type="button" className="kart satir-kart pano-satir" title={k.baslik} aria-label={`${akisAdi(k)}: ${alt}${e ? `. ${e}` : ''}.`} onClick={() => git(`/akis/${encodeURIComponent(k.kod)}`)} {...vurguOlay(k.kod)}>
              <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: miniHarita[k.kod] || kucukGalaksi(null, ben, 0, 0, 16, 1.5, now) }} />
              <span className="satir-metin" style={{ left: 52, right: e ? 84 : 16 }}><b>{akisAdi(k)}</b><small>{alt}</small></span>
              {e && <span className="satir-not" style={{ color: oz?.hedef?.durum === 'geciyor' ? 'var(--renk-metin-mercan)' : 'var(--renk-metin-altin)' }}>{e}</span>}
            </button></div>
          );
        })}</div>
        <button type="button" className="metin-baglanti pano-akim-baglanti" onClick={() => git('/akislar')}>Bütün akışlar</button>
      </section>}
      {KT.length > 0 && <section aria-label="Katılımcılar" className="tek-pano-bolum">
        <h3 className="gd-bolum-baslik">KATILIMCILAR</h3>
        <div role="list" aria-label="Katılımcılar">{KT.map((k) => {
          const l = k.baglanti;
          const akisMetni = k.akislar.length > 1 ? `${ad(k.akislar[0])} +${k.akislar.length - 1}` : ad(k.akislar[0]);
          const ne = l ? (l.son_acilis ? `son açılış ${gunAy(Date.parse(l.son_acilis))}` : 'bağlantıyı açmadı') : k.siradaki ? `sırada ${adimEkranAdi(k.siradaki)}` : null;
          const tur = k.tip === 'agent' ? 'agent' : k.tip === 'dis' ? 'dış katılımcı' : null;
          const alt = [akisMetni, k.acik ? `${k.acik} açık` : 'açık işi yok', ne].filter(Boolean).join(' · ');
          const ac = () => (l ? setPaylas(l) : git(`/akis/${encodeURIComponent(k.kod)}/kisi/${encodeURIComponent(k.ad)}`));
          return (
            <div role="listitem" key={k.ad}><button type="button" className="kart satir-kart pano-satir" onClick={ac}
              aria-label={`${kisaAd(k.ad)}${tur ? ` (${tur})` : ''}: ${alt}.${l ? ' Paylaşımı aç.' : ''}`}>
              <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: kisiIkonu(k) }} />
              <span className="satir-metin" style={{ left: 52, right: 16 }}><b>{kisaAd(k.ad)}</b><small>{alt}</small></span>
            </button></div>
          );
        })}</div>
      </section>}
      {paylas && <BaglantiGonder kod={paylas.akis.kod} kisi={paylas.ad} kisiId={paylas.kisi_id} adimSayisi={paylas.adim_sayisi} kapat={() => setPaylas(null)} />}
    </div>
  );
}
