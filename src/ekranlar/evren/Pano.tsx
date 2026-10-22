// Evren panosu (el notu 3–4): haritanın altında, kaydırınca oturan bölüm. Tutanak cümlesi, durum süzgeçleri, bekleyen işler.
import { forwardRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { BaglantiGonder } from '../akis/BaglantiGonder';
import { Metin } from '../../bilesen/Sahne';
import { planet, ship } from '../../cizim/ortak.js';
import { gunAy } from '../../cizim/yol.js';
import { akisAdi, doluSatir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { useOlaylar } from '../../bilesen/Zil';
import { saat } from '../../cizim/yol.js';
import { adimAdi, olayFiili, topla } from '../bildirimler/model';
import { PANO_AD, type Pano as PanoV, type PanoTur } from './pano';
import { KararSeridi, oncelikliAkis, seritYuksekligi, sutunEni } from '../../bilesen/KararSeridi';
import { DurumNotu, type VeriDurumu } from '../../bilesen/VeriDurumu';

const SATIR = 60, ARA = 8, EN = 6;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

/** Bölümün yerleşimi: cümle satırları, süzgeç, satırlar ve alt bağlantılar. */
export function panoYerlesimi(P: PanoV, n: number, y0: number, hareket = 0, seritH = 0, dis = 0) {
  const cumle = doluSatir(P.cumle, 350, '17.5px Caladea', 4);
  // karar şeridi cümlenin altında (yüksekliği ölçülür; ölçülmeden önce tahmin)
  const cY = y0 + 66, kY = cY - 9 + cumle.length * 23, sY = cY + (cumle.length - 1) * 23 + 22 + (seritH ? seritH + 10 : 0), lY = sY + (P.suzgecler.length ? 56 : 0);
  const satir = Math.min(n, EN), aY = lY + (satir ? satir * (SATIR + ARA) : 40) + 8;
  // bekleyen dış katılımcılar (P1-C): başlık ve en çok üç satır
  const dY = aY + 72, dSon = dis ? dY + 30 + dis * (SATIR + ARA) - ARA : aY;
  // son hareketler (el notu 4): başlık, en çok üç satır, Bildirimler bağlantısı
  const hY = dis ? dSon + 52 : aY + 72, hSon = hareket ? hY + 30 + hareket * (SATIR + ARA) + 44 : dis ? dSon + 24 : aY + 44;
  return { cumle, cY, kY, sY, lY, aY, dY, hY, son: hSon };
}

/** Bağlantı alıp işi bekleyen dış katılımcılar (P1-C): hiç açmayan önce, sonra en eski açılış; en çok üç. */
export function useDisBekleyen(): any[] {
  const q = useQuery({ queryKey: ['katilimcilar-tum'], queryFn: () => api.get<any>('/katilimcilar'), staleTime: 60_000 });
  return useMemo(() => (q.data?.katilimcilar || [])
    .filter((k: any) => k.durum === 'acik' && k.acik_adim > 0)
    .sort((a: any, b: any) => (a.son_acilis ? Date.parse(a.son_acilis) : 0) - (b.son_acilis ? Date.parse(b.son_acilis) : 0))
    .slice(0, 3), [q.data]);
}

export const EvrenPano = forwardRef<HTMLHeadingElement, { P: PanoV; y0: number; ben: string; kartlar: any[]; goster: PanoTur | null; secili: PanoTur | null; sec: (t: PanoTur | null) => void; durum?: VeriDurumu; yeniden?: () => void }>(
  function EvrenPano({ P, y0, ben, kartlar, goster, secili, sec, durum = 'hazir', yeniden }, ref) {
    const liste = goster ? P.adimlar[goster] : [];
    const H = sonHareketler(useOlaylar().data?.olaylar);
    const DK = useDisBekleyen();
    const [paylas, setPaylas] = useState<any>(null);
    const ak = oncelikliAkis(kartlar);
    const Y = panoYerlesimi(P, liste.length, y0, H.length, ak ? seritYuksekligi(ak.karar_ozeti, sutunEni(), { onek: akisAdi(ak) }) : 0, DK.length);
    const ad = (kod: string) => { const k = kartlar.find((x) => x.kod === kod); return k ? akisAdi(k) : kod; };
    const benimN = P.adimlar.sende.length;
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
        {liste.length ? liste.slice(0, EN).map((a, i) => {
          const y = Y.lY + i * (SATIR + ARA), son = a.son ? gunAy(tarihMs(a.son)) : null;
          const kim = a.sahip === ben ? 'Sende' : a.sahip.replace(/\s*\(.*\)$/, '');
          const alt = [ad(a.kod), kim, a.tuttugu ? `${a.tuttugu} adımı tutuyor` : null, son].filter(Boolean).join(' · ');
          const ikon = planet(0, 0, 9, a.durum === 'engelli' ? 'block' : 'wait', { waitRings: 1, life: false, karar: a.karar });
          return (
            <button key={a.kod + a.no} type="button" className="kart satir-kart pano-satir" style={{ left: 20, right: 20, top: y, height: SATIR }} onClick={() => git(`/akis/${encodeURIComponent(a.kod)}/adim/${a.no}`)}>
              <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: ikon }} />
              <span className="satir-metin" style={{ left: 52, right: 16 }}><b>{a.ad}</b><small>{alt}</small></span>
            </button>
          );
        }) : durum === 'kismi' || durum === 'hata' || durum === 'yukleniyor'
          ? <DurumNotu durum={durum} y={Y.lY + 6} yeniden={yeniden} />
          : <Metin y={Y.lY + 22} x={20} fs={14} renk="ink3">Şu an bekleyen iş yok.</Metin>}
        <button type="button" className="metin-baglanti pano-baglanti" style={{ left: 20, top: Y.aY }} onClick={() => git('/gorevler')}>
          {benimN ? `Görevler (${benimN})` : 'Görevler'}
        </button>
        <button type="button" className="metin-baglanti pano-baglanti" style={{ right: 20, top: Y.aY }} onClick={() => git('/akislar')}>Bütün akışlar</button>
        {DK.length > 0 && <>
          <h3 className="bolum-baslik" style={{ top: Y.dY }}>DIŞ KATILIMCILAR</h3>
          {DK.map((k, i) => {
            const y = Y.dY + 30 + i * (SATIR + ARA);
            const alt = [ad(k.akis.kod), `${k.acik_adim} açık adım`, k.son_acilis ? `son açılış ${gunAy(Date.parse(k.son_acilis))}` : 'bağlantıyı açmadı'].join(' · ');
            return (
              <button key={k.id} type="button" className="kart satir-kart pano-satir" style={{ left: 20, right: 20, top: y, height: SATIR }} onClick={() => setPaylas(k)} aria-label={`${k.ad}: ${alt}. Paylaşımı aç.`}>
                <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: ship(0, 1, 0, 'dis', '', '#F2B8D8', .7) }} />
                <span className="satir-metin" style={{ left: 52, right: 16 }}><b>{k.ad.replace(/\s*\(.*\)$/, '')}</b><small>{alt}</small></span>
              </button>
            );
          })}
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
                <svg aria-hidden className="pano-ikon" width="36" height="36" viewBox="-18 -18 36 36" dangerouslySetInnerHTML={{ __html: e.kim_tip === 'dis' ? ship(0, 1, 0, 'dis', '', '#F2B8D8', .7) : ship(0, 0, -12, e.kim_tip === 'agent' ? 'agent' : 'insan', (e.kim[0] || '?').toLocaleUpperCase('tr'), e.kim_tip === 'agent' ? '#B9A6F2' : '#9EE6CF', .7, { flame: false }) }} />
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
