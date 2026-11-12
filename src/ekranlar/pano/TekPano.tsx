// W6 (6 Kas, K8, B19, C29): tek Pano. Evren, Akışlar ve Görevler panoları ile Bildirimler tek sayfada, aynı görev
// bileşeniyle dört başlık: Senden beklenen · Riskte · Son değişiklikler · Yakında. Akışa girince o akışa süzülür
// (masaüstünde seçim yokken panelde, telefonda akış sayfasının altında). Zaman görünümü Görevler'in şerididir.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { DurumNotu } from '../../bilesen/VeriDurumu';
import { simdi } from '../../api/ortam';
import { GorevKart } from '../../bilesen/GorevKart';
import { UstDugmeler, useOlaylar } from '../../bilesen/Zil';
import { hamle, kisiRengi } from '../../cizim/hamle';
import { gunAy, kisaAd, saat } from '../../cizim/yol.js';
import { adimAdi, akisAdi as akisAdiMetni } from '../../metin/turkce';
import { arama, git, useSorgu } from '../../yonlendirme';
import { usePanelIcinde } from '../../bilesen/Kabuk';
import { useOzet } from '../../api/sorgular';
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
export function panoBolumleri(L: any[], olaylar: any[], o: { ben: string; now: number; yeniler?: Set<number>; adimBul: (akis: string, no: number) => any | null; en?: number; kisi?: string | null }): PanoBolum[] {
  const en = o.en ?? 8;
  // kişi süzgeci (12 Kas, Tek Pano): Senden beklenen süzgeçten bağımsız; diğer başlıklar yalnız o kişinin (ve agent'larının) işleri
  const kapsam = (a: any) => !o.kisi || a.sahip === o.kisi || a.agent_sahibi === o.kisi;
  const acik = L.filter((a) => !BITTI(a.durum));
  const goruldu = new Set<string>();
  const al = (l: any[]) => l.filter((a) => !goruldu.has(anahtar(a))).map((a) => { goruldu.add(anahtar(a)); return a; });
  const tarih = (a: any) => (a.son_tarih ? tarihMs(a.son_tarih) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : Infinity);
  const senden = al(acik.filter((a) => { const h = hamle(a); return h && h.kim === o.ben; }).sort((p, r) => tarih(p) - tarih(r)));
  const riskte = al(acik.filter(kapsam).filter((a) => a.durum === 'engelli' || takvimIhlali(a) || (a.son_tarih && tarihMs(a.son_tarih) < o.now)).sort((p, r) => tarih(p) - tarih(r)));
  const yakin = al(acik.filter(kapsam).filter((a) => tarih(a) - o.now < 7 * GUN).sort((p, r) => tarih(p) - tarih(r)));
  const degisim = topla(olaylar).filter((t) => t.e.adim_no != null && !t.sira).filter((t) => { if (!o.kisi) return true; const a = o.adimBul(t.e.akis, t.e.adim_no); return t.e.kim === o.kisi || (a ? kapsam(a) : false); }).slice(0, en).map((t) => {
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


/** Zaman görünümü (12 Kas, K1): açık görevler tek tarih sırasında; alt görev üst görevinin hemen altında. */
export interface ZamanGrup { baslik: string; satirlar: { a: any; alt: boolean; key: string }[] }
export function zamanSirasi(L: any[], now: number): ZamanGrup[] {
  const acik = L.filter((a) => !BITTI(a.durum));
  const t = (a: any) => (a.son_tarih ? tarihMs(a.son_tarih) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : Infinity);
  const sira = (x: any[]) => x.slice().sort((p, r) => t(p) - t(r) || String(p.akis).localeCompare(String(r.akis)) || p.no - r.no);
  const var_ = new Set(acik.map(anahtar));
  const ustler = sira(acik.filter((a) => a.ust_adim == null || !var_.has(`${a.akis}:${a.ust_adim}`)));
  const altlar = (u: any) => sira(acik.filter((a) => a.ust_adim != null && a.akis === u.akis && a.ust_adim === u.no));
  const bugun = new Date(now); bugun.setHours(0, 0, 0, 0);
  const grupAdi = (a: any) => { const x = t(a); if (!Number.isFinite(x)) return 'TARİHSİZ'; if (x < bugun.getTime()) return 'GECİKMİŞ'; if (x < bugun.getTime() + GUN) return 'BUGÜN'; return gunAy(x).toLocaleUpperCase('tr'); };
  const G: ZamanGrup[] = [];
  for (const u of ustler) {
    const b = grupAdi(u);
    let g = G[G.length - 1];
    if (!g || g.baslik !== b) { g = { baslik: b, satirlar: [] }; G.push(g); }
    g.satirlar.push({ a: u, alt: false, key: anahtar(u) });
    for (const c of altlar(u)) g.satirlar.push({ a: c, alt: true, key: anahtar(c) });
  }
  return G;
}

/** Kartın altındaki bağımlılık satırı (12 Kas): beklediği açık görevler (kişi renginde nokta) ve onu bekleyenler. */
export function bagBilgisi(a: any, d: any): { bekledigi: { ad: string; sahip: string; renk: string }[]; bekleyen: number; kritik: boolean } | null {
  if (!d?.adimlar || BITTI(a.durum)) return null;
  const by = new Map<number, any>((d.adimlar as any[]).map((x) => [x.no, x]));
  const bekledigi = ((a.bagimli || by.get(a.no)?.bagimli || []) as number[]).map((n) => by.get(n)).filter((x) => x && !BITTI(x.durum))
    .map((x) => ({ ad: adimAdi(x), sahip: x.sahip, renk: kisiRengi(x.sahip, { tip: x.sahip_tip, sahibi: x.agent_sahibi }) }));
  const bekleyen = ((a.bekleyenler || by.get(a.no)?.bekleyenler || []) as number[]).filter((n) => { const x = by.get(n); return x && !BITTI(x.durum); }).length;
  if (!bekledigi.length && !bekleyen) return null;
  return { bekledigi, bekleyen, kritik: (d.kritik_yol || []).includes(a.no) };
}
function BagSatiri({ b, ben }: { b: NonNullable<ReturnType<typeof bagBilgisi>>; ben: string }) {
  const ilk = b.bekledigi[0];
  return (
    <small className={`tek-pano-bag${b.kritik ? ' kritik' : ''}`}>
      {ilk && <span><i className="kisi-nokta" style={{ background: ilk.renk }} aria-hidden />{`← ${ilk.ad} bekleniyor (${ilk.sahip === ben ? 'sen' : kisaAd(ilk.sahip)})${b.bekledigi.length > 1 ? ` +${b.bekledigi.length - 1}` : ''}`}</span>}
      {b.bekleyen > 0 && <span>{`→ ${b.bekleyen} görev bunu bekliyor`}</span>}
    </small>
  );
}

/** Tek Pano içeriği; `akis` verilirse yalnız o akış. */
export interface TekPanoOz {
  ben: string; akis?: string | null; akisAdi?: string | null; kapat?: () => void;
  /** başlık (varsayılan "Pano"; akışta akışın adı) */
  baslik?: string;
  /** kişi süzgeci çipleri (Görevler): adresteki ?kisi= (ben | hepsi | ad), yoksa varsayılan */
  kisiSecimi?: { varsayilan: 'ben' | 'hepsi' };
  /** başlığın altında (özet cümle, karar şeridi) */
  ust?: ReactNode;
  /** başlıkların önünde ek bölüm (Görevler'de açık sorular) */
  once?: ReactNode;
  /** başlıkların sonunda (Evren'de Akışlar ve Katılımcılar; Görevler'de Agent'ların ve Bekleyenler) */
  alt?: ReactNode;
  /** açılışta olayları okundu say (Pano sayfası, Görevler); Evren'in altındaki pano saymaz, Pano düğmesindeki sayı kalır */
  okunduYaz?: boolean;
}
export function TekPano({ ben, akis, akisAdi, kapat, baslik, kisiSecimi, ust, once, alt, okunduYaz = true }: TekPanoOz) {
  const NOW = simdi();
  const [kisiQ, setKisiQ] = useSorgu('kisi');
  const kisiS = kisiSecimi ? (kisiQ || kisiSecimi.varsayilan) : 'hepsi';
  const kisi = kisiS === 'hepsi' ? null : kisiS === 'ben' ? ben : kisiS;
  const qs = new URLSearchParams({ kisi: 'hepsi', durum: 'acik', ...(akis ? { akis } : {}) });
  const G = useQuery({ queryKey: ['gorevler', qs.toString()], queryFn: () => api.get<any>(`/gorevler?${qs}`), retry: (n, e) => !(e instanceof ApiHatasi && e.durum === 404) && n < 2 });
  const Q = useOlaylar();
  const qc = useQueryClient();
  const O: any[] = useMemo(() => (Q.data?.olaylar || []).filter((e: any) => !akis || e.akis === akis), [Q.data, akis]);
  const L: any[] = G.data?.gorevler || [];
  // Zaman bütün açık görevleri (sıradakiler dahil) akışların detayından okur: kapsamdaki bütün etkin akışlar
  const OZ = useOzet(!akis);
  const kodlar = useMemo(() => akis ? [akis] : [...new Set<string>([...L.map((a) => a.akis), ...O.slice(0, 12).map((e) => e.akis), ...((OZ.data?.akislar || []) as any[]).map((k) => k.kod)])], [L, O, OZ.data, akis]);
  const detay = useDetaylar(kodlar);
  // açılışta okundu (Bildirimler'deki gibi); bu açılışın yenileri işaretli kalır
  const yeni = useRef<Set<number> | null>(null);
  if (Q.data && !yeni.current) yeni.current = new Set(O.filter((e) => !e.okundu).map((e) => e.id));
  const yazildi = useRef(0);
  useEffect(() => {
    const d = Q.data; if (!d || !O.length || akis || !okunduYaz) return;
    const son = Math.max(...O.map((e) => e.id));
    if (son <= d.son_okunan || yazildi.current >= son) return;
    yazildi.current = son;
    void api.post('/olaylar/okundu', { son_id: son }).then(() => qc.setQueryData(['olaylar'], (x: any) => (x ? { ...x, okunmamis: 0, son_okunan: son } : x))).catch(() => { yazildi.current = 0; });
  }, [Q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const adimBul = (k: string, no: number) => detay[k]?.adimlar?.find((x: any) => x.no === no) || null;
  // satırdaki kayıt: akışın detayındaki tam adım (mini harita, hamle), yoksa /gorevler satırı
  const tam = (a: any) => ({ ...a, ...(adimBul(a.akis, a.no) || {}), akis: a.akis });
  const B = panoBolumleri(L.map(tam), O, { ben, now: NOW, yeniler: yeni.current || undefined, adimBul, kisi });
  // süzgeçteki kişiler: açık işi olan ekip üyeleri (agent'lar sahiplerinin süzgecinde, dış katılımcılar Hepsi'de)
  const kisiler: string[] = useMemo(() => ((G.data?.kisiler || []) as any[]).filter((k) => k.tip === 'insan' && k.ad !== ben && k.acik > 0).map((k) => k.ad), [G.data, ben]);
  // akışın kısa adı sunucudan (P1-F); yoksa detaydaki akıştan
  const kisaAdlar = useMemo(() => new Map<string, string>(((G.data?.akislar || []) as any[]).filter((k) => k.kisa_ad).map((k) => [k.kod, k.kisa_ad])), [G.data]);
  const yukleniyor = G.isPending && !G.isError;
  // Liste / Zaman yerinde (12 Kas): sayfa değişmez, adrese yalnız gorunum=zaman yazılır; geri tuşu Liste'ye döner
  const [gorunum, setGorunum] = useSorgu('gorunum');
  const zaman = gorunum === 'zaman';
  const kart = (a: any, not?: string | null, yeniMi?: boolean, altMi?: boolean) => {
    const bag = bagBilgisi(a, detay[a.akis]);
    return <>
      {not && <small className="tek-pano-not">{yeniMi && <i className="okunmamis-nokta" aria-label="Yeni" />}{not}</small>}
      <GorevKart a={a} d={detay[a.akis]} ben={ben} now={NOW} akisAdi={akis ? null : kisaAdlar.get(a.akis) || a.akis_kisa_ad || (detay[a.akis]?.akis ? akisAdiMetni(detay[a.akis].akis) : null)}
        className={altMi ? 'alt-girinti' : ''} ac={() => git(`/akis/${enc(a.akis)}/adim/${a.no}`)} />
      {bag && <BagSatiri b={bag} ben={ben} />}
    </>;
  };
  return (
    <div className="tek-pano">
      <div className="tek-pano-ust">
        <h2>{baslik || (akis && akisAdi ? akisAdi : 'Pano')}</h2>
        <div className="tek-pano-gorunum" role="group" aria-label="Görünüm">
          <button type="button" aria-pressed={!zaman} onClick={() => zaman && setGorunum(null)}>Liste</button>
          <button type="button" aria-pressed={zaman} onClick={() => !zaman && setGorunum('zaman')}>Zaman</button>
        </div>
        {akis && kapat && <button type="button" className="filtre-cip tek-pano-suzgec" aria-pressed="true" aria-label="Akış süzgecini kaldır" onClick={kapat}>Yalnız bu akış ×</button>}
      </div>
      {ust}
      {kisiSecimi && <div className="tek-pano-kisiler" role="group" aria-label="Kimin işleri">
        {[['ben', 'Ben'], ['hepsi', 'Hepsi'], ...kisiler.map((k) => [k, kisaAd(k)])].map(([v, ad]) => (
          <button key={v} type="button" className="filtre-cip" aria-pressed={kisiS === v} onClick={() => setKisiQ(v === kisiSecimi.varsayilan ? null : v)}>
            {v !== 'hepsi' && <i className="kisi-nokta" style={{ background: kisiRengi(v === 'ben' ? ben : v) }} aria-hidden />}{ad}
          </button>))}
      </div>}
      {once}
      {/* M-M3: yüklenirken ve hatada boş başlıklar "iş yok" demez */}
      {yukleniyor || (G.isError && !G.data) ? <DurumNotu durum={G.isError ? 'hata' : 'yukleniyor'} ne={baslik || 'Pano'} y={0} x={0} className="akim" yeniden={() => void G.refetch()} /> : zaman ? (() => {
        const tum = kodlar.flatMap((k) => ((detay[k]?.adimlar || []) as any[]).map((x) => ({ ...x, akis: k })));
        const Z = zamanSirasi((tum.length ? tum : L.map(tam)).filter((a) => !kisi || a.sahip === kisi || a.agent_sahibi === kisi), NOW);
        return Z.length ? Z.map((g) => (
          <section key={g.baslik} className={`tek-pano-bolum z-${g.baslik === 'GECİKMİŞ' ? 'gec' : 'gun'}`} aria-label={g.baslik}>
            <h3 className="gd-bolum-baslik">{g.baslik}</h3>
            <ul className="gd-kartlar">{g.satirlar.map((x) => <li key={x.key} className={x.alt ? 'alt' : undefined}>{kart(x.a, null, false, x.alt)}</li>)}</ul>
          </section>
        )) : <p className="gd-satir">Açık görev yok.</p>;
      })() : B.map((b) => (
        <section key={b.id} className={`tek-pano-bolum b-${b.id}`} aria-label={b.baslik}>
          <h3 className="gd-bolum-baslik">{b.baslik}{b.satirlar.length ? ` · ${b.satirlar.length}` : ''}</h3>
          {b.satirlar.length ? <ul className="gd-kartlar">{b.satirlar.map((x) => (
            <li key={x.key} className={x.yeni ? 'yeni' : undefined}>{kart(x.a, x.not, x.yeni)}</li>))}</ul>
          : <p className="gd-satir">{b.bos}</p>}
        </section>
      ))}
      {alt}
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
