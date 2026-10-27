import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Metin, Sahne } from '../../bilesen/Sahne';
import { useOlaylar } from '../../bilesen/Zil';
import { planet, ship } from '../../cizim/ortak.js';
import { gunAy, kisaAd, saat } from '../../cizim/yol.js';
import { doluSatir, yaziTipleriHazir } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { Segment } from '../akis/Adim';
import { durumGor, Liste, type Oge } from '../akis/Bilgi';
import { kucukGalaksi, useDetaylar } from '../evren/Evren';
import { SatirKart } from '../hesap/Hesap';
import { adimAdi, bSuzgecAdresi, gecmistenOlaylar, bSuzgecOku, gunlere, kisa, olayAciklamasi, olayFiili, olayTuru, suz, topla, TUR_AD, type BSuzgec, type OlayTuru, type Toplu } from './model';
import { GorevAdi, ustAdi } from '../../bilesen/Kirinti';

// Bildirimler (/bildirimler; el notu 18): görünen akışlardaki başkalarının hareketleri. "Senin için" (senin adımın ya da
// seni bekleyen) ve "Tüm etkinlik" sekmeleri, Kişi ve Akış süzgeçleri adreste; güne göre gruplar, aynı adımdaki art arda
// olaylar tek satır. Sayfa açılınca okundu işareti sunucuda ilerler (cihazlar arası aynı).
const GOK = { tohum: 77, yildiz: 230 };
const enc = encodeURIComponent;
const gemi = (ad: string, tip: string, x: number, y: number, k: number) => tip === 'dis'
  ? ship(x, y + 1, 0, 'dis', '', '#F2B8D8', k)
  : ship(x, y, -12, tip === 'agent' ? 'agent' : 'insan', (kisaAd(ad)[0] || '?').toLocaleUpperCase('tr'), tip === 'agent' ? '#B9A6F2' : '#9EE6CF', k, { flame: false });
const LISTE_Y = 236;
/** Tür seçiminde haritadaki işaret (lejantla aynı). */
const TUR_GEZEGEN: Partial<Record<OlayTuru, string>> = { bitti: 'lit', basladi: 'wait', engel: 'block', sira: 'wait', karar: 'wait', atlandi: 'ghost', cikti: 'lit' };

export function Bildirimler({ ben }: { ben: Ben }) {
  const kisi = ben.kisi || '';
  const NOW = simdi();
  const [, setYazi] = useState(0);
  useEffect(() => { void yaziTipleriHazir().then(() => setYazi(1)); }, []);
  const S = bSuzgecOku(arama());
  const Q = useOlaylar();
  const qc = useQueryClient();
  const eski = Q.isError && Q.error instanceof ApiHatasi && Q.error.durum === 404;
  // eski sunucu: aktif akışların geçmişlerinden
  const ozet = useOzet(eski);
  const eskiKodlar: string[] = useMemo(() => (eski ? (ozet.data?.akislar || []).map((k: any) => k.kod) : []), [eski, ozet.data]);
  const yeniKodlar = useMemo(() => [...new Set<string>((Q.data?.olaylar || []).map((e: any) => e.akis))], [Q.data]);
  const detay = useDetaylar(eski ? eskiKodlar : yeniKodlar);
  const O: any[] = useMemo(() => (eski ? gecmistenOlaylar(detay, kisi) : Q.data?.olaylar || []), [eski, detay, kisi, Q.data]);
  const hata = Q.isError && !eski;
  const [sec, setSec] = useState<'kisi' | 'akis' | 'tur' | null>(null);
  const uygula = (y: Partial<BSuzgec>) => { setSec(null); git(bSuzgecAdresi({ ...S, ...y }), { yerine: true }); };

  // açılışta okundu: en yeni olaya kadar. Satırlar bu açılışta "yeni" olarak kalır; rozet hemen söner.
  const yazildi = useRef(0);
  useEffect(() => {
    const d = Q.data; if (!d || !O.length) return;
    const son = Math.max(...O.map((e) => e.id));
    if (son <= d.son_okunan || yazildi.current >= son) return;
    yazildi.current = son;
    void api.post('/olaylar/okundu', { son_id: son }).then(() => qc.setQueryData(['olaylar'], (x: any) => (x ? { ...x, okunmamis: 0, son_okunan: son } : x))).catch(() => { yazildi.current = 0; });
  }, [Q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  // bu açılışın okunmamışları (yazımdan sonra veri değişse de satırlar yeni kalır)
  const yeni = useRef<Set<number> | null>(null);
  if (Q.data && !yeni.current) yeni.current = new Set(O.filter((e) => !e.okundu).map((e) => e.id));

  const L = suz(O, S).map((e) => ({ ...e, okundu: !yeni.current?.has(e.id) }));
  const T = topla(L);
  const ilgiliYeni = O.filter((e) => e.ilgili && yeni.current?.has(e.id)).length, tumYeni = yeni.current?.size ?? 0;

  const satir = (t: Toplu): Oge => {
    const e = t.e, d = detay[e.akis], a = d?.adimlar?.find((x: any) => x.no === e.adim_no);
    const akis = e.akis_kisa_ad || e.akis_baslik;
    // toplu "sırası geldi": adımlar alt satırda, satır galaksiye gider
    const fiil = t.sira ? `${t.n} adımın sırası geldi` : olayFiili(e);
    const adim = t.sira ? null : adimAdi(e), ust = adim ? ustAdi(e, d?.adimlar) : null, acik = t.sira ? t.adimlar.join(', ') : olayAciklamasi(e);
    const sistem = e.kim_tip === 'sistem';
    const yol = e.adim_no == null || t.sira ? `/akis/${enc(e.akis)}` : `/akis/${enc(e.akis)}/adim/${e.adim_no}${e.tip === 'cikti' ? '?bolum=ciktilar' : '?sekme=gecmis'}`;
    return {
      tur: 'satir', key: t.ids.join('-'),
      ikon: `<circle cx="28" cy="29" r="24" fill="url(#bloom)" opacity=".18"/>${kucukGalaksi(d, kisi, 28, 29, 19, 2, NOW)}${a ? planet(43, 44, 6, durumGor(a), { life: false, waitRings: 1, cloudGap: 1.5 }) : ''}`,
      ust: <>{!t.okundu && <i className="okunmamis-nokta" aria-hidden />}{fiil}{adim ? <span className="soluk"> · <GorevAdi ad={adim} ust={ust} /></span> : null}</>,
      alt: [akis, acik, t.n > 1 && !t.sira ? `${t.n} hareket` : null, saat(Date.parse(e.zaman))].filter(Boolean).join(' · '),
      etiket: `${t.okundu ? '' : 'Yeni. '}${fiil}${adim ? `: ${ust ? `${ust} › ` : ''}${adim}` : ''}. ${akis}.${acik ? ` ${acik}.` : ''}${t.n > 1 && !t.sira ? ` ${t.n} hareket.` : ''} ${saat(Date.parse(e.zaman))}.`,
      sag: sistem ? undefined : <svg aria-hidden className="satir-gemi" width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: gemi(e.kim, e.kim_tip, 0, 0, .55) }} />,
      git: () => git(yol),
    };
  };
  const ogeler: Oge[] = [];
  for (const [gun, G] of gunlere(T, NOW, gunAy)) ogeler.push({ tur: 'baslik', metin: gun }, ...G.map(satir));
  if (hata) ogeler.push({ tur: 'not', metin: 'Bildirimler alınamadı; birazdan yeniden dene.' });
  if ((Q.data || (eski && ozet.data)) && !T.length) ogeler.push({ tur: 'not', metin: S.sekme === 'sen' && !S.kisi && !S.akis && !S.tur ? 'Senin adımlarında ya da seni bekleyenlerde yeni bir hareket yok.' : 'Bu süzgeçte hareket yok.' });
  if (Q.data?.devami) ogeler.push({ tur: 'not', metin: 'Son 100 hareket gösteriliyor.' });
  const Lst = Liste({ y0: LISTE_Y, ogeler, etiket: 'Bildirimler' });

  const cumleMetin = eski ? 'Akışlarının son hareketleri; okundu bilgisi sunucu 0.12.0 ile gelir.' : hata ? ''
    : !Q.data ? '' : tumYeni ? `${tumYeni} yeni hareket${ilgiliYeni ? `; ${ilgiliYeni === tumYeni ? 'hepsi' : ilgiliYeni} senin işlerinle ilgili` : ''}.` : 'Yeni hareket yok; hepsini gördün.';
  const cumle = doluSatir(cumleMetin, 340, '17px Caladea', 2);
  const kisiAd = S.kisi ? kisa(S.kisi) : 'Herkes';
  const akisAd = S.akis ? (O.find((e) => e.akis === S.akis)?.akis_kisa_ad || O.find((e) => e.akis === S.akis)?.akis_baslik || S.akis) : 'Hepsi';

  return (
    <>
      <Sahne gok={GOK} etiket="Bildirimler" yukseklik={Math.max(844, Lst.y + 130)}>
        <Metin y={70} fs={26} serif agirlik={700} as="h1">Bildirimler</Metin>
        <Metin y={106} fs={17} lh={22} serif renk="ink2" as="p" style={cumle.length > 1 ? { whiteSpace: 'nowrap' } : undefined}>{cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
        {<>
          <div style={{ position: 'absolute', left: 20, right: 20, top: 128 }}>
            <Segment secenekler={['Senin için', 'Tüm etkinlik']} aktif={S.sekme === 'tum' ? 1 : 0} sec={(i) => uygula({ sekme: i ? 'tum' : 'sen' })} />
          </div>
          <div className="pano-cipler gorev-suzgec" role="group" aria-label="Süzgeçler" style={{ top: 182 }}>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={!!S.kisi} onClick={() => setSec('kisi')}>Kişi: {kisiAd}</button>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={!!S.akis} onClick={() => setSec('akis')}>Akış: {akisAd}</button>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={!!S.tur} onClick={() => setSec('tur')}>Tür: {S.tur ? TUR_AD[S.tur] : 'Hepsi'}</button>
          </div>
        </>}
        {Lst.dugum}
        <AltGezinme aktif={null} yeni={() => git('/yeni')} />
      </Sahne>
      <AltSayfa acik={sec != null} kapat={() => setSec(null)} baslik={sec === 'kisi' ? 'Kişi' : sec === 'tur' ? 'Tür' : 'Akış'} yukseklik={300} duraklar={['orta', 'yuksek']}>
        {sec && <SecimListesi sec={sec} S={S} O={O} uygula={uygula} />}
      </AltSayfa>
    </>
  );
}

function SecimListesi({ sec, S, O, uygula }: { sec: 'kisi' | 'akis' | 'tur'; S: BSuzgec; O: any[]; uygula: (y: Partial<BSuzgec>) => void }) {
  const say = (f: (e: any) => string) => { const m = new Map<string, any>(); for (const e of O) { const k = f(e); m.set(k, { e, n: (m.get(k)?.n || 0) + 1 }); } return [...m].sort((a, b) => b[1].n - a[1].n); };
  const L = sec === 'tur'
    ? [{ key: '', ust: 'Bütün türler', alt: undefined as string | undefined, ikon: '', secili: !S.tur, sec: () => uygula({ tur: null }) },
      ...say((e) => olayTuru(e)).map(([k, { n }]) => ({ key: k, ust: TUR_AD[k as OlayTuru], alt: `${n} hareket`, ikon: `<g transform="translate(28,29)">${planet(0, 0, 8, TUR_GEZEGEN[k as OlayTuru] || 'dark', { life: false, waitRings: 1, cloudGap: 1.5, karar: k === 'karar' })}</g>`, secili: S.tur === k, sec: () => uygula({ tur: k as OlayTuru }) }))]
    : sec === 'kisi'
    ? [{ key: '', ust: 'Herkes', alt: undefined as string | undefined, ikon: `<g transform="translate(28,29)">${planet(0, 0, 8, 'wait', { life: false, waitRings: 1 })}</g>`, secili: !S.kisi, sec: () => uygula({ kisi: null }) },
      ...say((e) => e.kim).map(([k, { e, n }]) => ({ key: k, ust: kisa(k), alt: `${n} hareket`, ikon: e.kim_tip === 'sistem' ? '' : gemi(k, e.kim_tip, 28, 29, .8), secili: S.kisi === k, sec: () => uygula({ kisi: k }) }))]
    : [{ key: '', ust: 'Bütün akışlar', alt: undefined as string | undefined, ikon: '', secili: !S.akis, sec: () => uygula({ akis: null }) },
      ...say((e) => e.akis).map(([k, { e, n }]) => ({ key: k, ust: e.akis_kisa_ad || e.akis_baslik, alt: `${n} hareket`, ikon: '', secili: S.akis === k, sec: () => uygula({ akis: k }) }))];
  return (
    <div className="karar-panel secim-listesi" role="list" style={{ height: 84 + L.length * 64 }}>
      {L.map((o, i) => <div key={o.key || 'hepsi'} role="listitem" style={{ display: 'contents' }}><SatirKart y={64 + i * 64} ikon={o.ikon} ust={o.ust} alt={o.alt} sec={o.secili} onClick={o.sec} etiket={`${o.ust}${o.secili ? ', seçili' : ''}`} /></div>)}
    </div>
  );
}
