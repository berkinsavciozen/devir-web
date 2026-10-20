import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useBen, useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { Zil } from '../../bilesen/Zil';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Metin, Sahne } from '../../bilesen/Sahne';
import { planet, ship, sparkle } from '../../cizim/ortak.js';
import { gunAy, kisaAd } from '../../cizim/yol.js';
import { doluSatir, paySure, yaziTipleriHazir } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { durumGor, Liste, type Oge } from '../akis/Bilgi';
import { kucukGalaksi, useDetaylar } from '../evren/Evren';
import { alanAdi, SatirKart } from '../hesap/Hesap';
import { bagIsareti, DURUM_AD, gorevCumlesi, gorevHaritasi, gruplar, ozettenGorevler, suzgecAdresi, suzgecOku, type Durum, type Suzgec } from './model';

// Görevler (/gorevler, eski /bana; el notu 16): bağlı olduğun bütün akışlardaki işler. Kişi (varsayılan sen), Akış ve
// Durum (varsayılan bitmemiş) süzgeçleri adreste; üstte görev haritası, altta durum grupları, en altta bekleyenler.
const GOK = { tohum: 63, yildiz: 220 };
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const enc = encodeURIComponent;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const taslakIkon = `<g transform="translate(28,29)"><circle r="12" fill="#B9A6F2" fill-opacity=".12" stroke="#D9CCFF" stroke-dasharray="1.5 3"/>${sparkle(0, 0, 5, '#FFF1D6', .95)}</g>`;
const zarfIkon = `<g transform="translate(28,29)"><rect x="-11" y="-8" width="22" height="16" rx="3" fill="#1A1238" stroke="#F2B8D8" stroke-width="1.3"/><path d="M-10,-7 L0,1 L10,-7" fill="none" stroke="#F2B8D8" stroke-width="1.3"/></g>`;
const gemi = (ad: string, tip: string, x: number, y: number, k: number, ben: boolean) => tip === 'dis'
  ? ship(x, y + 1, 0, 'dis', '', '#F2B8D8', k)
  : ship(x, y, -12, tip === 'agent' ? 'agent' : 'insan', (kisaAd(ad)[0] || '?').toLocaleUpperCase('tr'), ben ? '#FFC9A3' : tip === 'agent' ? '#B9A6F2' : '#9EE6CF', k, { flame: false });
const gezegen = (a: any, x: number, y: number, r: number) => planet(x, y, r, durumGor(a), { life: false, waitRings: 1, cloudGap: 1.5, karar: a.karar_adimi && !BITTI(a.durum) });

type Sec = 'kisi' | 'akis' | 'durum' | null;
const HARITA_Y = 214;

export function Gorevler({ ben }: { ben: Ben }) {
  const kisi = ben.kisi || '';
  const NOW = simdi();
  const [, setYazi] = useState(0);
  useEffect(() => { void yaziTipleriHazir().then(() => setYazi(1)); }, []);
  const S = suzgecOku(arama());
  const kisiQ = S.kisi === 'ben' ? kisi : S.kisi;
  const qs = new URLSearchParams({ kisi: kisiQ || 'hepsi', durum: S.durum, ...(S.akis.length ? { akis: S.akis.join(',') } : {}) });
  const G = useQuery({ queryKey: ['gorevler', qs.toString()], queryFn: () => api.get<any>(`/gorevler?${qs}`), retry: (n, e) => !(e instanceof ApiHatasi && e.durum === 404) && n < 2 });
  const ozet = useOzet();
  const b = useBen().data as Ben | undefined;
  // sunucu 0.12.0 yüklenmeden: /ozet'teki kendi işlerin (süzgeçsiz)
  const eski = G.isError && G.error instanceof ApiHatasi && G.error.durum === 404;
  const L: any[] = useMemo(() => (eski ? ozettenGorevler(ozet.data?.benim || [], ozet.data?.akislar || [], kisi) : G.data?.gorevler || []), [eski, G.data, ozet.data, kisi]);
  const kodlar = useMemo(() => [...new Set(L.map((a) => a.akis))], [L]);
  const detay = useDetaylar(kodlar);
  const [sec, setSec] = useState<Sec>(null);
  const uygula = (y: Partial<Suzgec>) => { setSec(null); git(suzgecAdresi({ ...S, ...y }), { yerine: true }); };

  const kisiBasina = S.kisi === 'hepsi';
  const H = useMemo(() => gorevHaritasi(L, { kisiBasina, now: NOW, y0: HARITA_Y + 8 }), [L, kisiBasina, NOW]);
  const akisAdi = (a: any) => a.akis_kisa_ad || a.akis_baslik;

  // harita çizimi: şerit çizgileri, bugün, hafta işaretleri, görevler; bağımlılık bağı aynı haritadaki görevler arasında
  const svg = useMemo(() => {
    if (!L.length) return '';
    let s = `<rect x="16" y="${HARITA_Y - 4}" width="358" height="${H.h + 40}" rx="20" fill="#120B2C" fill-opacity=".55" stroke="#FFFFFF" stroke-opacity=".06"/>`;
    for (let t = Math.ceil(H.t0 / (7 * 864e5)) * 7 * 864e5; t <= H.t1; t += 7 * 864e5) {
      const x = H.x0 + (t - H.t0) / (H.t1 - H.t0) * (H.x1 - H.x0);
      s += `<line x1="${x.toFixed(1)}" y1="${HARITA_Y + 4}" x2="${x.toFixed(1)}" y2="${HARITA_Y + 8 + H.h}" stroke="#FFFFFF" stroke-opacity=".05"/>`;
    }
    for (const r of H.seritler) {
      s += `<line x1="${H.x0}" y1="${r.y}" x2="${H.x1}" y2="${r.y}" stroke="#4B4380" stroke-width="1.2" stroke-dasharray="2 4"/>`;
      if (r.tip === 'kisi') s += gemi(r.ad, r.sahipTip || 'insan', 32, r.y, .5, r.ad === kisi);
      else s += kucukGalaksi(detay[L.find((a) => akisAdi(a) === r.ad)?.akis], kisi, 32, r.y, 11, 1.4, NOW);
    }
    const yer = new Map(H.noktalar.map((n) => [n.a.akis + ':' + n.a.no, n]));
    for (const n of H.noktalar) for (const o of n.a.onceki || []) {
      const p = yer.get(n.a.akis + ':' + o.no);
      if (p) s += `<path d="M${p.x.toFixed(1)},${p.y.toFixed(1)} C${((p.x + n.x) / 2).toFixed(1)},${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}" fill="none" stroke="#B9A6F2" stroke-opacity=".35" stroke-width="1"/>`;
    }
    s += `<line x1="${H.bugunX.toFixed(1)}" y1="${HARITA_Y + 2}" x2="${H.bugunX.toFixed(1)}" y2="${HARITA_Y + 10 + H.h}" stroke="#FFC9A3" stroke-width="1.5" stroke-linecap="round"/>`;
    for (const n of H.noktalar) s += gezegen(n.a, n.x, n.y, 6.5);
    return s;
  }, [H, L, detay, kisi, NOW]); // eslint-disable-line react-hooks/exhaustive-deps

  // liste
  const satir = (a: any): Oge => {
    const isaret = bagIsareti(a, kisi);
    const t = BITTI(a.durum) ? (a.durum_at ? gunAy(Date.parse(a.durum_at)) : null) : a.son_tarih ? `son ${gunAy(tarihMs(a.son_tarih))}` : a.en_erken_bitis ? `en erken ${gunAy(Date.parse(a.en_erken_bitis))}` : a.bekleme_saat ? `${paySure(a.bekleme_saat)} bekliyor` : null;
    const kim = a.sahip === kisi ? null : kisaAd(a.sahip);
    return {
      tur: 'satir', key: a.akis + ':' + a.no,
      ikon: `<circle cx="28" cy="29" r="24" fill="url(#bloom)" opacity=".18"/>${kucukGalaksi(detay[a.akis], kisi, 28, 29, 19, 2, NOW)}${gezegen(a, 43, 44, 6)}`,
      ust: a.ad,
      alt: [akisAdi(a), kim, isaret, t].filter(Boolean).join(' · '),
      etiket: `${a.ad}. ${akisAdi(a)}. ${kim ? `Sahibi ${kim}. ` : ''}${a.durum === 'engelli' ? 'Engelli.' : a.durum === 'suruyor' ? 'Sürüyor.' : a.durum === 'hazir' ? 'Sırası geldi.' : BITTI(a.durum) ? 'Bitti.' : 'Sırada.'}${isaret ? ` ${isaret.replace(/^[←→] /, '')}.` : ''}`,
      sag: kim ? <svg aria-hidden className="satir-gemi" width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: gemi(a.sahip, a.sahip_tip, 0, 0, .55, false) }} /> : undefined,
      git: () => git(`/akis/${enc(a.akis)}/${a.karar_adimi && !BITTI(a.durum) ? 'karar' : 'adim'}/${a.no}`),
    };
  };
  const ogeler: Oge[] = [];
  for (const [ad, A] of gruplar(L)) ogeler.push({ tur: 'baslik', metin: `${ad} · ${A.length}` }, ...A.map(satir));
  if (G.isError && !eski) ogeler.push({ tur: 'not', metin: 'Görevler alınamadı; birazdan yeniden dene.' });
  if (!L.length && (G.data || eski)) ogeler.push({ tur: 'not', metin: S.kisi === 'ben' && S.durum === 'acik' ? 'Yeni bir iş açınca senin adımların burada toplanır.' : 'Bu süzgeçte iş yok.' });
  // bekleyenler: görev değil; yalnız kendi görünümünde
  const taslaklar: any[] = ozet.data?.taslaklar || [];
  const davetler = b?.bekleyen_davetler || ben.bekleyen_davetler || [];
  if (S.kisi === 'ben' && (taslaklar.length || davetler.length)) {
    ogeler.push({ tur: 'baslik', metin: 'BEKLEYENLER' });
    for (const t of taslaklar) ogeler.push({ tur: 'satir', key: 't' + t.kod, ikon: taslakIkon, ust: t.baslik || t.cumle, alt: `taslak · ${t.soru_sayisi} soru · ${t.adim_sayisi} adım`, etiket: `Taslak: ${t.baslik || t.cumle}. ${t.soru_sayisi} soru bekliyor.`, git: () => git(`/yeni/${enc(t.kod)}`) });
    for (const d of davetler) ogeler.push({ tur: 'satir', key: 'd' + d.id, ikon: zarfIkon, ust: alanAdi(d.alan || '', d.davet_eden), alt: `davet · ${d.rol === 'dis' ? 'dış' : d.rol}${d.davet_eden ? ` · ${d.davet_eden}` : ''}`, git: () => git('/hesap') });
  }
  const listeY = L.length ? HARITA_Y + H.h + 52 : 196;
  const Lst = Liste({ y0: listeY, ogeler, etiket: 'Görevler' });

  const cumle = G.data || eski ? doluSatir(gorevCumlesi(L, S.kisi, kisi, S.durum), 340, '17px Caladea', 2) : [''];
  const kisiAd = S.kisi === 'ben' ? 'Ben' : S.kisi === 'hepsi' ? 'Herkes' : kisaAd(S.kisi);
  const akisAd = S.akis.length ? (G.data?.akislar || []).filter((a: any) => S.akis.includes(a.kod)).map((a: any) => a.kisa_ad || a.baslik).join(', ') || S.akis.join(', ') : 'Hepsi';

  return (
    <>
      <Sahne gok={GOK} etiket="Görevler" cizim={svg} yukseklik={Math.max(844, Lst.y + 130)}>
        <Metin y={70} fs={26} serif agirlik={700} as="h1">Görevler</Metin>
        <Zil y={36} />
        <Metin y={106} fs={17} lh={22} serif renk="ink2" as="p" style={cumle.length > 1 ? { whiteSpace: 'nowrap' } : undefined}>{cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
        {!eski ? (
          <div className="pano-cipler gorev-suzgec" role="group" aria-label="Süzgeçler" style={{ top: cumle.length > 1 ? 146 : 128 }}>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={S.kisi !== 'ben'} onClick={() => setSec('kisi')}>Kişi: {kisiAd}</button>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={S.akis.length > 0} onClick={() => setSec('akis')}>Akış: {akisAd}</button>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={S.durum !== 'acik'} onClick={() => setSec('durum')}>Durum: {DURUM_AD[S.durum]}</button>
          </div>
        ) : <Metin y={150} fs={12.5} lh={16} renk="ink3">Sunucu 0.12.0 yüklenince bütün akışlardaki işler ve süzgeçler burada.</Metin>}
        {L.length > 0 && <>
          <h2 className="bolum-baslik" style={{ top: HARITA_Y - 26 }}>{kisiBasina ? 'GÖREV HARİTASI · KİŞİLER' : 'GÖREV HARİTASI · AKIŞLAR'}</h2>
          {H.seritler.map((r) => <Metin key={r.ad} y={r.y + 4} x={48} fs={11.5} lh={14} agirlik={650} renk="ink2" className="tek-satir" style={{ right: 'auto', width: 58, overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{r.tip === 'kisi' ? kisaAd(r.ad) : r.ad}</Metin>)}
          <Metin y={HARITA_Y + H.h + 26} x={Math.max(20, H.bugunX - 20)} fs={11} lh={14} agirlik={700} renk="altin" className="tek-satir" style={{ right: 'auto' }}>bugün</Metin>
          {/* harita listenin görsel özeti; her görev aşağıdaki listede de var, bu yüzden dokunma kısayolu ekran okuyucudan gizli */}
          <div aria-hidden="true" className="harita-katman gorev-harita">
            {H.noktalar.map((n) => <span key={n.a.akis + n.a.no} className="gezegen-hedef" title={`${n.a.ad} · ${akisAdi(n.a)}`} style={{ left: n.x - 14, top: n.y - 14, width: 28, height: 28 }}
              onClick={() => git(`/akis/${enc(n.a.akis)}/adim/${n.a.no}`)} />)}
          </div>
        </>}
        {Lst.dugum}
        <AltGezinme aktif="bana" yeni={() => git('/yeni')} />
      </Sahne>
      <AltSayfa acik={sec != null} kapat={() => setSec(null)} baslik={sec === 'kisi' ? 'Kişi' : sec === 'akis' ? 'Akış' : 'Durum'} yukseklik={300} duraklar={['orta', 'yuksek']}>
        {sec && <SecimListesi sec={sec} S={S} kisi={kisi} veri={G.data} uygula={uygula} />}
      </AltSayfa>
    </>
  );
}

function SecimListesi({ sec, S, kisi, veri, uygula }: { sec: Exclude<Sec, null>; S: Suzgec; kisi: string; veri: any; uygula: (y: Partial<Suzgec>) => void }) {
  let L: { key: string; ust: string; alt?: string; ikon: string; secili: boolean; sec: () => void }[] = [];
  if (sec === 'kisi') {
    L = [
      { key: 'ben', ust: 'Ben', alt: kisi, ikon: gemi(kisi, 'insan', 28, 29, .8, true), secili: S.kisi === 'ben', sec: () => uygula({ kisi: 'ben' }) },
      { key: 'hepsi', ust: 'Herkes', alt: 'şeritler kişi başına', ikon: `<g transform="translate(28,29)">${planet(0, 0, 8, 'wait', { life: false, waitRings: 1 })}</g>`, secili: S.kisi === 'hepsi', sec: () => uygula({ kisi: 'hepsi' }) },
      ...(veri?.kisiler || []).filter((k: any) => k.ad !== kisi).map((k: any) => ({ key: k.ad, ust: kisaAd(k.ad), alt: `${k.acik} açık iş`, ikon: gemi(k.ad, k.tip, 28, 29, .8, false), secili: S.kisi === k.ad, sec: () => uygula({ kisi: k.ad }) })),
    ];
  } else if (sec === 'akis') {
    L = [
      { key: 'hepsi', ust: 'Bütün akışlar', ikon: '', secili: !S.akis.length, sec: () => uygula({ akis: [] }) },
      ...(veri?.akislar || []).map((a: any) => ({ key: a.kod, ust: a.kisa_ad || a.baslik, alt: `${a.acik} açık iş`, ikon: '', secili: S.akis.length === 1 && S.akis[0] === a.kod, sec: () => uygula({ akis: [a.kod] }) })),
    ];
  } else {
    L = (['acik', 'bitti', 'hepsi'] as Durum[]).map((d) => ({ key: d, ust: DURUM_AD[d], ikon: '', secili: S.durum === d, sec: () => uygula({ durum: d }) }));
  }
  return (
    <div className="karar-panel secim-listesi" role="list" style={{ height: 84 + L.length * 64 }}>
      {L.map((o, i) => <div key={o.key} role="listitem" style={{ display: 'contents' }}><SatirKart y={64 + i * 64} ikon={o.ikon} ust={o.ust} alt={o.alt} sec={o.secili} onClick={o.sec} etiket={`${o.ust}${o.secili ? ', seçili' : ''}`} /></div>)}
    </div>
  );
}
