// W6 (6 Kas, K8, B19, C29): tek Pano. Evren, Akışlar ve Görevler panoları ile Bildirimler tek sayfada, aynı görev
// bileşeniyle dört başlık: Senden beklenen · Riskte · Son değişiklikler · Yakında. Akışa girince o akışa süzülür
// (masaüstünde seçim yokken panelde, telefonda akış sayfasının altında). Zaman görünümü Görevler'in şerididir.
import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { GorevKart } from '../../bilesen/GorevKart';
import { UstDugmeler, useOlaylar } from '../../bilesen/Zil';
import { hamle } from '../../cizim/hamle';
import { saat } from '../../cizim/yol.js';
import { akisAdi as akisAdiMetni } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { usePanelIcinde } from '../../bilesen/Kabuk';
import { Sahne } from '../../bilesen/Sahne';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { takvimIhlali } from '../akis/Adim';
import { olayAciklamasi, olayFiili, topla } from '../bildirimler/model';
import { useDetaylar } from '../evren/Evren';

const GUN = 864e5;
const enc = encodeURIComponent;
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const anahtar = (a: any) => `${a.akis}:${a.no}`;

export interface PanoBolum { id: 'senden' | 'risk' | 'degisim' | 'yakin'; baslik: string; bos: string; satirlar: { a: any; not?: string | null; yeni?: boolean; key: string }[] }

/** Görevleri dört başlığa ayırır (saf; test edilir). Bir görev yalnız ilk uyduğu başlıkta görünür (değişiklikler hariç). */
export function panoBolumleri(L: any[], olaylar: any[], o: { ben: string; now: number; yeniler?: Set<number>; adimBul: (akis: string, no: number) => any | null; en?: number }): PanoBolum[] {
  const en = o.en ?? 8;
  const acik = L.filter((a) => !BITTI(a.durum));
  const goruldu = new Set<string>();
  const al = (l: any[]) => l.filter((a) => !goruldu.has(anahtar(a))).map((a) => { goruldu.add(anahtar(a)); return a; });
  const tarih = (a: any) => (a.son_tarih ? tarihMs(a.son_tarih) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : Infinity);
  const senden = al(acik.filter((a) => { const h = hamle(a); return h && h.kim === o.ben; }).sort((p, r) => tarih(p) - tarih(r)));
  const riskte = al(acik.filter((a) => a.durum === 'engelli' || takvimIhlali(a) || (a.son_tarih && tarihMs(a.son_tarih) < o.now)).sort((p, r) => tarih(p) - tarih(r)));
  const yakin = al(acik.filter((a) => tarih(a) - o.now < 7 * GUN).sort((p, r) => tarih(p) - tarih(r)));
  const degisim = topla(olaylar).filter((t) => t.e.adim_no != null && !t.sira).slice(0, en).map((t) => {
    const a = o.adimBul(t.e.akis, t.e.adim_no) || { akis: t.e.akis, no: t.e.adim_no, ad: t.e.adim_ad || '', durum: 'hazir', sahip: t.e.kim };
    const acik2 = olayAciklamasi(t.e);
    return { a: { ...a, akis: t.e.akis }, key: t.ids.join('-'), yeni: t.ids.some((i) => o.yeniler?.has(i)), not: [olayFiili(t.e), acik2, t.n > 1 ? `${t.n} hareket` : null, saat(Date.parse(t.e.zaman))].filter(Boolean).join(' · ') };
  });
  const s = (l: any[]) => l.slice(0, en).map((a) => ({ a, key: anahtar(a) }));
  return [
    { id: 'senden', baslik: 'SENDEN BEKLENEN', bos: 'Şu an senden beklenen bir iş yok.', satirlar: s(senden) },
    { id: 'risk', baslik: 'RİSKTE', bos: 'Engelli ya da gecikmede iş yok.', satirlar: s(riskte).map((x) => ({ ...x, not: x.a.durum === 'engelli' && x.a.engel ? String(x.a.engel).split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '') : takvimIhlali(x.a) ? 'En erken bitiş son tarihi aşıyor' : null })) },
    { id: 'degisim', baslik: 'SON DEĞİŞİKLİKLER', bos: 'Yeni bir hareket yok.', satirlar: degisim },
    { id: 'yakin', baslik: 'YAKINDA', bos: 'Önümüzdeki 7 günde bitmesi gereken başka iş yok.', satirlar: s(yakin) },
  ];
}

/** Tek Pano içeriği; `akis` verilirse yalnız o akış. */
export function TekPano({ ben, akis, akisAdi, kapat }: { ben: string; akis?: string | null; akisAdi?: string | null; kapat?: () => void }) {
  const NOW = simdi();
  const qs = new URLSearchParams({ kisi: 'hepsi', durum: 'acik', ...(akis ? { akis } : {}) });
  const G = useQuery({ queryKey: ['gorevler', qs.toString()], queryFn: () => api.get<any>(`/gorevler?${qs}`), retry: (n, e) => !(e instanceof ApiHatasi && e.durum === 404) && n < 2 });
  const Q = useOlaylar();
  const qc = useQueryClient();
  const O: any[] = useMemo(() => (Q.data?.olaylar || []).filter((e: any) => !akis || e.akis === akis), [Q.data, akis]);
  const L: any[] = G.data?.gorevler || [];
  const kodlar = useMemo(() => [...new Set<string>([...L.map((a) => a.akis), ...O.slice(0, 12).map((e) => e.akis)])], [L, O]);
  const detay = useDetaylar(kodlar);
  // açılışta okundu (Bildirimler'deki gibi); bu açılışın yenileri işaretli kalır
  const yeni = useRef<Set<number> | null>(null);
  if (Q.data && !yeni.current) yeni.current = new Set(O.filter((e) => !e.okundu).map((e) => e.id));
  const yazildi = useRef(0);
  useEffect(() => {
    const d = Q.data; if (!d || !O.length || akis) return;
    const son = Math.max(...O.map((e) => e.id));
    if (son <= d.son_okunan || yazildi.current >= son) return;
    yazildi.current = son;
    void api.post('/olaylar/okundu', { son_id: son }).then(() => qc.setQueryData(['olaylar'], (x: any) => (x ? { ...x, okunmamis: 0, son_okunan: son } : x))).catch(() => { yazildi.current = 0; });
  }, [Q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const adimBul = (k: string, no: number) => detay[k]?.adimlar?.find((x: any) => x.no === no) || null;
  // satırdaki kayıt: akışın detayındaki tam adım (mini harita, hamle), yoksa /gorevler satırı
  const tam = (a: any) => ({ ...a, ...(adimBul(a.akis, a.no) || {}), akis: a.akis });
  const B = panoBolumleri(L.map(tam), O, { ben, now: NOW, yeniler: yeni.current || undefined, adimBul });
  const yukleniyor = G.isPending && !G.isError;
  return (
    <div className="tek-pano">
      <div className="tek-pano-ust">
        <h2>{akis ? akisAdi || 'Akış' : 'Pano'}</h2>
        <div className="tek-pano-gorunum" role="group" aria-label="Görünüm">
          <button type="button" aria-pressed="true">Liste</button>
          <button type="button" aria-pressed="false" onClick={() => git(akis ? `/gorevler?akis=${enc(akis)}&kisi=hepsi` : '/gorevler')}>Zaman</button>
        </div>
        {akis && kapat && <button type="button" className="filtre-cip tek-pano-suzgec" aria-pressed="true" aria-label="Akış süzgecini kaldır" onClick={kapat}>Yalnız bu akış ×</button>}
      </div>
      {yukleniyor ? <div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div> : B.map((b) => (
        <section key={b.id} className={`tek-pano-bolum b-${b.id}`} aria-label={b.baslik}>
          <h3 className="gd-bolum-baslik">{b.baslik}{b.satirlar.length ? ` · ${b.satirlar.length}` : ''}</h3>
          {b.satirlar.length ? <ul className="gd-kartlar">{b.satirlar.map((x) => (
            <li key={x.key} className={x.yeni ? 'yeni' : undefined}>
              {x.not && <small className="tek-pano-not">{x.yeni && <i className="okunmamis-nokta" aria-label="Yeni" />}{x.not}</small>}
              <GorevKart a={x.a} d={detay[x.a.akis]} ben={ben} now={NOW} akisAdi={akis ? null : detay[x.a.akis]?.akis ? akisAdiMetni(detay[x.a.akis].akis) : x.a.akis_kisa_ad || null}
                ac={() => git(`/akis/${enc(x.a.akis)}/adim/${x.a.no}`)} />
            </li>))}</ul>
          : <p className="gd-satir">{b.bos}</p>}
        </section>
      ))}
    </div>
  );
}

/** /pano: telefonda kendi sayfası (gök, üst düğmeler, alt gezinme); masaüstünde kabuğun panelinde. */
export function PanoSayfasi({ ben }: { ben: string }) {
  const panelde = usePanelIcinde();
  const akis = arama().get('akis');
  const icerik = <TekPano ben={ben} akis={akis} kapat={() => git('/pano', { yerine: true })} />;
  if (panelde) return <div className="tek-pano-panel">{icerik}</div>;
  return (
    <Sahne gok={{ tohum: 77, yildiz: 230 }} etiket="Pano">
      <UstDugmeler y={44} aktif="pano" />
      <div className="tek-pano-sayfa">{icerik}</div>
      <AltGezinme aktif={null} />
    </Sahne>
  );
}
