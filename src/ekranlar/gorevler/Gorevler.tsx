import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useBen, useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { UstDugmeler } from '../../bilesen/Zil';
import { usePanelIcinde } from '../../bilesen/Kabuk';
import { useBoyut } from '../../bilesen/Gok';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Metin, Sahne } from '../../bilesen/Sahne';
import { planet, ship, sparkle } from '../../cizim/ortak.js';
import { belge, elmas, uyduSistemi } from '../../cizim/yol.js';
import { gunAy, kisaAd, otoRozet } from '../../cizim/yol.js';
import { adimAdi, akisAdi as akisAdiK, altGorevSayaci, doluSatir, paySure, sarSatir, yaziTipleriHazir } from '../../metin/turkce';
import { KararSeridi, oncelikliAkis, seritYuksekligi, sutunEni } from '../../bilesen/KararSeridi';
import { arama, git } from '../../yonlendirme';
import { durumGor, Liste, type Oge } from '../akis/Bilgi';
import { kucukGalaksi, useDetaylar } from '../evren/Evren';
import { DurumNotu } from '../../bilesen/VeriDurumu';
import { alanAdi, SatirKart } from '../hesap/Hesap';
import { bagIsareti, beklenenler, benCumlesi, bosKuyruk, kararKarti, soruKarti, DURUM_AD, gorevCumlesi, gorevHaritasi, gruplar, haftaCizgileri, ozettenGorevler, suzgecAdresi, suzgecOku, type Durum, type Suzgec } from './model';
import { GorevAdi, ustAdi } from '../../bilesen/Kirinti';
import { useMutation } from '@tanstack/react-query';
import { sorguIstemcisi } from '../../api/sorgular';
import { destekGemisi } from '../../cizim/ortak.js';
import { AgentDetay, agentCumlesi, agentIkonu, useAgentlar } from '../hesap/Agentlarim';

// Görevler (/gorevler, eski /bana; el notu 16): bağlı olduğun bütün akışlardaki işler. Kişi (varsayılan sen), Akış ve
// Durum (varsayılan bitmemiş) süzgeçleri adreste; üstte görev haritası, altta durum grupları, en altta bekleyenler.
const GOK = { tohum: 63, yildiz: 220 };
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const enc = encodeURIComponent;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const taslakIkon = `<g transform="translate(28,29)"><circle r="12" fill="#B9A6F2" fill-opacity=".12" stroke="#D9CCFF" stroke-dasharray="1.5 3"/>${sparkle(0, 0, 5, '#FFF1D6', .95)}</g>`;
const zarfIkon = `<g transform="translate(28,29)"><rect x="-11" y="-8" width="22" height="16" rx="3" fill="#08222E" stroke="#F2B8D8" stroke-width="1.3"/><path d="M-10,-7 L0,1 L10,-7" fill="none" stroke="#F2B8D8" stroke-width="1.3"/></g>`;
const soruIkon = `<g transform="translate(28,29)"><circle r="12" fill="#FFC9A3" fill-opacity=".14" stroke="#FFC9A3" stroke-width="1.3"/><text y="5" text-anchor="middle" font-family="Bricolage, serif" font-size="15" font-weight="700" fill="#FFF1E2">?</text></g>`;
const gemi = (ad: string, tip: string, x: number, y: number, k: number, ben: boolean, destek = false) => destek
  ? destekGemisi(x, y, 1, -.35, '#FFC9A3', k * 1.6)
  : tip === 'dis'
  ? ship(x, y + 1, 0, 'dis', '', '#F2B8D8', k)
  : ship(x, y, -12, tip === 'agent' ? 'agent' : 'insan', (kisaAd(ad)[0] || '?').toLocaleUpperCase('tr'), ben ? '#FFC9A3' : tip === 'agent' ? '#B9A6F2' : '#8EC5FF', k, { flame: false });
/**
 * W6 (Berkin 4 Kas 11:39): haritadaki görev akış haritasındaki gibi çizilir: durum gövdesi (sürüyor mavi), karar bayrağı,
 * AI rozeti ya da onay flaması, alt görev uydu halkası, kritik yol elması, çıktı belgesi (lejanttaki işaretler).
 */
const gorevGezegeni = (a: any, x: number, y: number, r: number, DA?: any[]) => {
  const acik = !BITTI(a.durum);
  const k = !acik ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'suruyor' ? 'run' : a.durum === 'hazir' ? 'wait' : 'dark';
  let s = planet(x, y, r, k, { life: r > 10, waitRings: 1, cloudGap: 2, karar: a.karar_adimi && acik, oto: acik ? otoRozet(a) : null });
  const altlar = (DA || []).filter((d) => d.ust_adim === a.no);
  if (altlar.length) s += uyduSistemi(x, y, r, altlar, r / 12);
  const sc = Math.min(1.3, Math.max(.8, r / 9));
  if (a.kritik && acik) s += elmas(x - r * .85 - 2, y - r * .85 - 2, sc);
  if (((DA || []).find((d) => d.no === a.no)?.cikti_sayisi || 0) > 0) s += belge(x + r * .9 + 2, y + r * .8 + 2, sc);
  return s;
};
const gezegen = (a: any, x: number, y: number, r: number) => planet(x, y, r, durumGor(a), { life: false, waitRings: 1, cloudGap: 1.5, karar: a.karar_adimi && !BITTI(a.durum), oto: BITTI(a.durum) ? null : otoRozet(a) });

type Sec = 'kisi' | 'akis' | 'durum' | null;
const HARITA_Y = 214;

/** Görev listesi ve süzgeçleri (adresten); liste ve masaüstündeki büyük harita aynı veriyi okur. */
function useGorevVerisi(ben: Ben) {
  const kisi = ben.kisi || '';
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
  // W6: varsayılan görünüm "sen ve agent'ların": şeritler kişi başına (sen + agent'ların)
  const benKip = S.kisi === 'ben' && S.durum === 'acik' && !eski;
  return { kisi, S, G, ozet, b, eski, L, kodlar, detay, benKip };
}

export function Gorevler({ ben }: { ben: Ben }) {
  const NOW = simdi();
  const [, setYazi] = useState(0);
  useEffect(() => { void yaziTipleriHazir().then(() => setYazi(1)); }, []);
  const { kisi, S, G, ozet, b, eski, L, kodlar, detay, benKip } = useGorevVerisi(ben);
  const AG = useAgentlar(benKip && ben.rol !== 'dis');
  const [agentAc, setAgentAc] = useState<string | null>(null);
  const B = useMemo(() => beklenenler(L, kisi), [L, kisi]);
  const onayla = useMutation({
    mutationFn: ({ a, govde }: { a: any; govde: Record<string, unknown> }) => api.post<any>(`/akis/${enc(a.akis)}/adim/${a.no}`, govde),
    onSuccess: (_r, { a }) => { for (const k of [['gorevler'], ['ozet'], ['akis', a.akis], ['agentlar-ai']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); },
  });
  // masaüstünde görev haritası sol bölmede büyük çizilir (GorevlerSol); panelde yalnız liste
  const panelde = usePanelIcinde();
  const [sec, setSec] = useState<Sec>(null);
  const uygula = (y: Partial<Suzgec>) => { setSec(null); git(suzgecAdresi({ ...S, ...y }), { yerine: true }); };

  // karar şeridi: listedeki işlerin akışlarından dikkat isteyeni (seçili tek akış varsa o); altındakiler şerit boyu kadar iner
  const ak = oncelikliAkis<any>((ozet.data?.akislar || []).filter((k: any) => kodlar.includes(k.kod)));
  const kayma = ak ? seritYuksekligi(ak.karar_ozeti, sutunEni(), { onek: akisAdiK(ak) }) + 10 : 0;
  // W6 (ben kipi): üstte senden beklenenler ve agent'ların, harita onların altında; listenin boyu satır sayısından
  const AA = benKip ? AG.data?.agentlar || [] : [];
  const ustListeY = 196 + kayma + (G.data && benKip && L.length ? 22 : 0);
  // P5: üstte karar kuyruğu (AI çıktısı + kararlar), altında sırası gelen işlerin
  const KK = [...B.onay, ...B.karar];
  // K6: cevabı belli olmuş ama yazılmamış açık sorular (sunucu 0.33.2+)
  const SQ: any[] = benKip ? G.data?.sorular || [] : [];
  const kuyrukBoyu = KK.length + SQ.length;
  const ustListeBoyu = benKip ? 32 + (kuyrukBoyu ? kuyrukBoyu * 66 : 36) + (B.is.length ? 32 + B.is.length * 66 : 0) + (AA.length ? 32 + AA.length * 66 : 0) : 0;
  const HY = benKip && !panelde ? ustListeY + ustListeBoyu + 52 : HARITA_Y + kayma;
  const kisiBasina = S.kisi === 'hepsi' || benKip;
  const H = useMemo(() => gorevHaritasi(L, { kisiBasina, now: NOW, y0: HY + 8, ...(benKip ? { satir: 64, yakin: 22, adim: 14 } : {}) }), [L, kisiBasina, NOW, HY, benKip]);
  const akisAdi = (a: any) => a.akis_kisa_ad || a.akis_baslik;

  // harita çizimi: şerit çizgileri, bugün, hafta işaretleri, görevler; bağımlılık bağı aynı haritadaki görevler arasında
  const svg = useMemo(() => {
    if (!L.length || panelde) return '';
    let s = `<rect x="16" y="${HY - 4}" width="358" height="${H.h + 54}" rx="20" fill="#061A24" fill-opacity=".55" stroke="#FFFFFF" stroke-opacity=".06"/>`;
    for (const t of haftaCizgileri(H.t0, H.t1)) {
      const x = H.x0 + (t - H.t0) / (H.t1 - H.t0) * (H.x1 - H.x0);
      s += `<line x1="${x.toFixed(1)}" y1="${HY + 4}" x2="${x.toFixed(1)}" y2="${HY + 8 + H.h}" stroke="#FFFFFF" stroke-opacity=".05"/>`;
    }
    for (const r of H.seritler) {
      s += `<line x1="${H.x0}" y1="${r.y}" x2="${H.x1}" y2="${r.y}" stroke="#4B4380" stroke-width="1.2" stroke-dasharray="2 4"/>`;
      if (r.tip === 'kisi') s += gemi(r.ad, r.sahipTip || 'insan', 32, r.y, .5, r.ad === kisi, benKip && r.sahipTip === 'agent');
      else s += kucukGalaksi(detay[L.find((a) => akisAdi(a) === r.ad)?.akis], kisi, 30, r.y, 9.5, 1.2, NOW);
    }
    const yer = new Map(H.noktalar.map((n) => [n.a.akis + ':' + n.a.no, n]));
    for (const n of H.noktalar) for (const o of n.a.onceki || []) {
      const p = yer.get(n.a.akis + ':' + o.no);
      if (p) s += `<path d="M${p.x.toFixed(1)},${p.y.toFixed(1)} C${((p.x + n.x) / 2).toFixed(1)},${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}" fill="none" stroke="#B9A6F2" stroke-opacity=".35" stroke-width="1"/>`;
    }
    s += `<line x1="${H.bugunX.toFixed(1)}" y1="${HY + 2}" x2="${H.bugunX.toFixed(1)}" y2="${HY + 10 + H.h}" stroke="#FFC9A3" stroke-width="1.5" stroke-linecap="round"/>`;
    for (const n of H.noktalar) s += benKip ? gorevGezegeni(n.a, n.x, n.y, 10, detay[n.a.akis]?.adimlar) : gezegen(n.a, n.x, n.y, 6.5);
    return s;
  }, [H, L, detay, kisi, NOW, HY, panelde]); // eslint-disable-line react-hooks/exhaustive-deps

  // liste
  const satir = (a: any): Oge => {
    const isaret = bagIsareti(a, kisi);
    const t = BITTI(a.durum) ? (a.durum_at ? gunAy(Date.parse(a.durum_at)) : null) : a.son_tarih ? `son ${gunAy(tarihMs(a.son_tarih))}` : a.en_erken_bitis ? `en erken ${gunAy(Date.parse(a.en_erken_bitis))}` : a.bekleme_saat ? `${paySure(a.bekleme_saat)} bekliyor` : null;
    const kim = a.sahip === kisi ? null : kisaAd(a.sahip);
    // 1.4, 1.5: alt görevde üst görevin adı; üst görevde alt görev ilerlemesi
    const DA: any[] | undefined = detay[a.akis]?.adimlar, ust = ustAdi(a, DA), altlar = (DA || []).filter((x) => x.ust_adim === a.no);
    const altMetin = altlar.length ? altGorevSayaci(altlar) : null;
    return {
      tur: 'satir', key: a.akis + ':' + a.no,
      ikon: `<circle cx="28" cy="29" r="24" fill="url(#bloom)" opacity=".18"/>${kucukGalaksi(detay[a.akis], kisi, 28, 29, 19, 2, NOW)}${gezegen(a, 43, 44, 6)}`,
      ust: <GorevAdi ad={adimAdi(a)} ust={ust} />, baslik: a.ad,
      alt: [akisAdi(a), kim, altMetin, isaret, t].filter(Boolean).join(' · '),
      etiket: `${ust ? `${ust} › ` : ''}${a.ad}. ${akisAdi(a)}.${altMetin ? ` ${altMetin}.` : ''} ${kim ? `Sahibi ${kim}. ` : ''}${a.durum === 'engelli' ? 'Engelli.' : a.durum === 'suruyor' ? 'Sürüyor.' : a.durum === 'hazir' ? 'Sırası geldi.' : BITTI(a.durum) ? 'Bitti.' : 'Sırada.'}${isaret ? ` ${isaret.replace(/^[←→] /, '')}.` : ''}`,
      sag: kim ? <svg aria-hidden className="satir-gemi" width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: gemi(a.sahip, a.sahip_tip, 0, 0, .55, false) }} /> : undefined,
      git: () => git(`/akis/${enc(a.akis)}/${a.karar_adimi && !BITTI(a.durum) ? 'karar' : 'adim'}/${a.no}`),
    };
  };
  const ogeler: Oge[] = [];
  // W6: üst liste (senden beklenenler, agent'ların); alttakinde beklenenler tekrar etmez
  const ustOgeler: Oge[] = [];
  if (benKip) {
    ustOgeler.push({ tur: 'baslik', metin: `KARARLARIN · ${kuyrukBoyu}` });
    for (const q of SQ) ustOgeler.push({ tur: 'satir', key: `s:${q.akis}:${q.kod}`, ikon: soruIkon, ust: q.kisa || q.soru, baslik: q.soru,
      alt: `${soruKarti(q)} · ${q.akis_kisa_ad || q.akis_baslik}`, etiket: `Açık soru: ${q.soru}. ${soruKarti(q)}. ${q.akis_kisa_ad || q.akis_baslik}.`,
      git: () => git(`/akis/${enc(q.akis)}/soru/${enc(q.kod)}`) });
    if (!kuyrukBoyu) ustOgeler.push({ tur: 'not', metin: bosKuyruk(AA.reduce((t: number, g: any) => t + (g.simdi?.length || 0), 0), AA.reduce((t: number, g: any) => t + (g.sirada || 0), 0)) });
    for (const a of KK) {
      const o = satir(a) as Extract<Oge, { tur: 'satir' }>, k = kararKarti(a);
      ustOgeler.push({ ...o, alt: `${k.alt} · ${akisAdi(a)}`,
        ...(k.hizli ? { sag: <button type="button" className="satir-eylem" disabled={onayla.isPending} onClick={(e) => { e.stopPropagation(); onayla.mutate({ a, govde: k.hizli!.govde }); }} aria-label={`${a.ad}: ${k.hizli.etiket}`}>{k.hizli.etiket}</button> } : {}) });
    }
    if (B.is.length) {
      ustOgeler.push({ tur: 'baslik', metin: `SIRASI GELEN İŞLERİN · ${B.is.length}` });
      for (const a of B.is) ustOgeler.push(satir(a));
    }
    if (AA.length) {
      ustOgeler.push({ tur: 'baslik', metin: `AGENT’LARIN · ${AA.length}` });
      for (const g of AA) ustOgeler.push({ tur: 'satir', key: 'ag:' + g.ad, ikon: agentIkonu(g, 28, 32, 1.15), ust: g.ad, alt: agentCumlesi(g, !!AG.data?.genel_rutin, true), git: () => setAgentAc(g.ad) });
    }
  }
  const ust = new Set(B.hepsi);
  for (const [ad, A] of gruplar(benKip ? L.filter((a) => !ust.has(a)) : L)) ogeler.push({ tur: 'baslik', metin: `${ad} · ${A.length}` }, ...A.map(satir));
  if (!L.length && (G.data || eski)) ogeler.push({ tur: 'not', metin: S.kisi === 'ben' && S.durum === 'acik' ? 'Yeni bir iş açınca senin adımların burada toplanır.' : 'Bu süzgeçte iş yok.' });
  // bekleyenler: görev değil; yalnız kendi görünümünde
  const taslaklar: any[] = ozet.data?.taslaklar || [];
  const davetler = b?.bekleyen_davetler || ben.bekleyen_davetler || [];
  if (S.kisi === 'ben' && (taslaklar.length || davetler.length)) {
    ogeler.push({ tur: 'baslik', metin: 'BEKLEYENLER' });
    for (const t of taslaklar) ogeler.push({ tur: 'satir', key: 't' + t.kod, ikon: taslakIkon, ust: t.baslik || t.cumle, alt: `taslak · ${t.soru_sayisi} soru · ${t.adim_sayisi} adım`, etiket: `Taslak: ${t.baslik || t.cumle}. ${t.soru_sayisi} soru bekliyor.`, git: () => git(`/yeni/${enc(t.kod)}/harita`) });
    for (const d of davetler) ogeler.push({ tur: 'satir', key: 'd' + d.id, ikon: zarfIkon, ust: alanAdi(d.alan || '', d.davet_eden), alt: `davet · ${d.rol === 'dis' ? 'dış' : d.rol}${d.davet_eden ? ` · ${d.davet_eden}` : ''}`, git: () => git('/hesap') });
  }
  const UstLst = Liste({ y0: ustListeY, ogeler: ustOgeler, etiket: 'Kararların, işlerin ve agent’ların' });
  const listeY = benKip ? (L.length && !panelde ? HY + H.h + 66 : ustListeY + ustListeBoyu + 16) : L.length && !panelde ? HY + H.h + 66 : (L.length ? HY : 196 + kayma);
  const Lst = Liste({ y0: listeY, ogeler, etiket: benKip ? 'Diğer işler' : 'Görevler' });

  const cumle = G.data || eski ? doluSatir(benKip ? benCumlesi(B, AG.data ? AA : null) : gorevCumlesi(L, S.kisi, kisi, S.durum), 340, '17px Bricolage', 3) : [''];
  const kisiAd = S.kisi === 'ben' ? (AA.length ? 'Ben + agent’larım' : 'Ben') : S.kisi === 'hepsi' ? 'Herkes' : kisaAd(S.kisi);
  const akisAd = S.akis.length ? (G.data?.akislar || []).filter((a: any) => S.akis.includes(a.kod)).map((a: any) => a.kisa_ad || a.baslik).join(', ') || S.akis.join(', ') : 'Hepsi';

  return (
    <>
      <Sahne gok={GOK} etiket="Görevler" cizim={svg} yukseklik={Math.max(844, Lst.y + 130)}>
        <Metin y={70} fs={26} serif agirlik={700} as="h1">Görevler</Metin>
        <UstDugmeler y={36} />
        <Metin y={106} fs={17} lh={22} serif renk="ink2" as="p" style={cumle.length > 1 ? { whiteSpace: 'nowrap' } : undefined}>{cumle.map((c, i) => <span key={i}>{i ? <>{' '}<br /></> : null}{c}</span>)}</Metin>
        {ak && <KararSeridi oz={ak.karar_ozeti} onek={akisAdiK(ak)} ac={() => git(`/akis/${enc(ak.kod)}`)} style={{ left: 20, right: 20, top: 98 + cumle.length * 22 }} />}
        {!eski ? (
          <div className="pano-cipler gorev-suzgec" role="group" aria-label="Süzgeçler" style={{ top: (cumle.length > 2 ? 168 : cumle.length > 1 ? 146 : 128) + kayma }}>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={S.kisi !== 'ben'} onClick={() => setSec('kisi')}>Kişi: {kisiAd}</button>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={S.akis.length > 0} onClick={() => setSec('akis')}>Akış: {akisAd}</button>
            <button type="button" className="filtre-cip" aria-haspopup="dialog" aria-pressed={S.durum !== 'acik'} onClick={() => setSec('durum')}>Durum: {DURUM_AD[S.durum]}</button>
          </div>
        ) : <Metin y={150} fs={12.5} lh={16} renk="ink3">Sunucu 0.12.0 yüklenince bütün akışlardaki işler ve süzgeçler burada.</Metin>}
        {L.length > 0 && !panelde && <>
          <h2 className="bolum-baslik" style={{ top: HY - 26 }}>{benKip ? 'HARİTA · SEN VE AGENT’LARIN' : kisiBasina ? 'GÖREV HARİTASI · KİŞİLER' : 'GÖREV HARİTASI · AKIŞLAR'}</h2>
          {H.seritler.map((r) => {
            // şerit adı kesilmez (P1-F): sütuna sığan en çok üç satır, şeridin ortasında
            const ad = r.tip === 'kisi' && r.sahipTip !== 'agent' ? kisaAd(r.ad) : r.ad, L = sarSatir(ad, 62, '650 10.5px Bricolage').slice(0, 3);
            return <Metin key={r.ad} y={r.y + 4 - (L.length - 1) * 5.75} x={48} fs={L.length > 1 ? 10.5 : 11.5} lh={11.5} agirlik={650} renk="ink2" style={{ right: 'auto', width: 62, pointerEvents: 'none' }}>{L.map((l, i) => <span key={i}>{i ? <>{' '}<br /></> : null}{l}</span>)}</Metin>;
          })}
          {/* eksen (K6): haftalık tarihler, birbirine ve "bugün"e binmeyenler; altında bugün */}
          {eksenTarihleri(H, 34).map(({ t, x }) => <Metin key={t} y={HY + H.h + 24} x={x - 22} fs={10} lh={12} agirlik={600} renk="ink3" className="tek-satir" style={{ right: 'auto', width: 44, textAlign: 'center', pointerEvents: 'none' }}>{gunAy(t)}</Metin>)}
          <Metin y={HY + H.h + 40} x={Math.max(20, H.bugunX - 20)} fs={11} lh={14} agirlik={700} renk="altin" className="tek-satir" style={{ right: 'auto' }}>bugün</Metin>
          {/* harita listenin görsel özeti; her görev aşağıdaki listede de var, bu yüzden dokunma kısayolu ekran okuyucudan gizli */}
          <div aria-hidden="true" className="harita-katman gorev-harita">
            {H.noktalar.map((n) => <span key={n.a.akis + n.a.no} className="gezegen-hedef" title={`${n.a.ad} · ${akisAdi(n.a)}`} style={{ left: n.x - 14, top: n.y - 14, width: 28, height: 28 }}
              onClick={() => git(`/akis/${enc(n.a.akis)}/adim/${n.a.no}`)} />)}
          </div>
        </>}
        {benKip && UstLst.dugum}
        {Lst.dugum}
        {/* M-M3: yüklenirken ve hatada boş liste "iş yok" sayılmaz */}
        {!eski && (G.isPending || G.isError) && <DurumNotu durum={G.isError ? 'hata' : 'yukleniyor'} ne="Görevler" y={listeY + 6} yeniden={() => void G.refetch()} />}
        <AltGezinme aktif="bana" yeni={() => git('/yeni')} />
      </Sahne>
      {agentAc && AG.data && (() => { const g = AA.find((x) => x.ad === agentAc); return g ? <AgentDetay a={g} veri={AG.data} kip="is" kapat={() => setAgentAc(null)} /> : null; })()}
      <AltSayfa acik={sec != null} kapat={() => setSec(null)} baslik={sec === 'kisi' ? 'Kişi' : sec === 'akis' ? 'Akış' : 'Durum'} yukseklik={300} duraklar={['orta', 'yuksek']}>
        {sec && <SecimListesi sec={sec} S={S} kisi={kisi} veri={G.data} uygula={uygula} />}
      </AltSayfa>
    </>
  );
}

/** Haftalık eksen tarihleri: yalnız birbirine en az `en` px uzak olanlar (soldan, açgözlü). */
function eksenTarihleri(H: { t0: number; t1: number; x0: number; x1: number; bugunX: number }, en: number) {
  const out: { t: number; x: number }[] = [];
  for (const t of haftaCizgileri(H.t0, H.t1)) {
    const x = H.x0 + (t - H.t0) / (H.t1 - H.t0) * (H.x1 - H.x0);
    // bugün çizgisinin dibindeki tarih yazılmaz ("bugün" yazısı orada; K8)
    if (x - en / 2 < H.x0 - 4 || x + en / 2 > H.x1 + 14 || Math.abs(x - H.bugunX) < en * .6 || (out.length && x - out[out.length - 1].x < en + 6)) continue;
    out.push({ t, x });
  }
  return out;
}

/**
 * Masaüstü Görevler'in sol bölmesi (N14, açık soru 3): görev haritası büyük hali; şerit başına akış (ya da kişi),
 * yatayda zaman, haftalık tarih ekseni ve bugün çizgisi. Noktaya tıklayınca görev açılır.
 */
export function GorevlerSol({ ben }: { ben: Ben }) {
  const NOW = simdi();
  const { w: W, h: Hh } = useBoyut();
  const { kisi, S, L, detay, benKip } = useGorevVerisi(ben);
  const SW = W - 440, kisiBasina = S.kisi === 'hepsi' || benKip;
  const n = Math.max(1, Math.min(12, new Set(L.map((a) => (kisiBasina ? a.sahip : a.akis))).size));
  const satir = Math.max(46, Math.min(86, (Hh - 300) / n)), y0 = 150;
  const H = useMemo(() => gorevHaritasi(L, { kisiBasina, now: NOW, x0: 230, x1: SW - 70, y0, satir: benKip ? Math.max(satir, 110) : satir, en: 12, ...(benKip ? { yakin: 34, adim: 22 } : {}) }), [L, kisiBasina, NOW, SW, satir, benKip]);
  const akisAdi = (a: any) => a.akis_kisa_ad || a.akis_baslik;
  const svg = useMemo(() => {
    if (!L.length) return '';
    let s = `<rect x="40" y="${y0 - 24}" width="${SW - 80}" height="${H.h + 92}" rx="26" fill="#061A24" fill-opacity=".5" stroke="#FFFFFF" stroke-opacity=".06"/>`;
    for (const t of haftaCizgileri(H.t0, H.t1)) {
      const x = H.x0 + (t - H.t0) / (H.t1 - H.t0) * (H.x1 - H.x0);
      s += `<line x1="${x.toFixed(1)}" y1="${y0 - 6}" x2="${x.toFixed(1)}" y2="${y0 + H.h + 10}" stroke="#FFFFFF" stroke-opacity=".06"/>`;
    }
    for (const r of H.seritler) {
      s += `<line x1="${H.x0}" y1="${r.y}" x2="${H.x1}" y2="${r.y}" stroke="#4B4380" stroke-width="1.4" stroke-dasharray="2 5"/>`;
      if (r.tip === 'kisi') s += gemi(r.ad, r.sahipTip || 'insan', 84, r.y, .8, r.ad === kisi, benKip && r.sahipTip === 'agent');
      else s += kucukGalaksi(detay[L.find((a) => akisAdi(a) === r.ad)?.akis], kisi, 80, r.y, 15, 2, NOW);
    }
    const yer = new Map(H.noktalar.map((p) => [p.a.akis + ':' + p.a.no, p]));
    for (const p of H.noktalar) for (const o of p.a.onceki || []) {
      const q = yer.get(p.a.akis + ':' + o.no);
      if (q) s += `<path d="M${q.x.toFixed(1)},${q.y.toFixed(1)} C${((q.x + p.x) / 2).toFixed(1)},${q.y.toFixed(1)} ${((q.x + p.x) / 2).toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}" fill="none" stroke="#B9A6F2" stroke-opacity=".4" stroke-width="1.2"/>`;
    }
    s += `<line x1="${H.bugunX.toFixed(1)}" y1="${y0 - 8}" x2="${H.bugunX.toFixed(1)}" y2="${y0 + H.h + 14}" stroke="#FFC9A3" stroke-width="1.8" stroke-linecap="round"/>`;
    for (const p of H.noktalar) s += benKip ? gorevGezegeni(p.a, p.x, p.y, 15, detay[p.a.akis]?.adimlar) : gezegen(p.a, p.x, p.y, 10);
    return s;
  }, [H, L, detay, kisi, NOW, SW]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="gorev-sol" style={{ position: 'absolute', inset: 0 }}>
      <svg aria-hidden width={SW} height={Hh} viewBox={`0 0 ${SW} ${Hh}`} style={{ position: 'absolute', left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
      <h2 className="genis-bolum" style={{ left: 48, top: 92 }}>{benKip ? 'HARİTA · SEN VE AGENT’LARIN' : kisiBasina ? 'GÖREV HARİTASI · KİŞİLER' : 'GÖREV HARİTASI · AKIŞLAR'}</h2>
      {H.seritler.map((r) => (
        <span key={r.ad} className="gorev-sol-ad" style={{ left: 112, top: r.y - 10, width: 108, ...(r.sahipTip === 'agent' ? { whiteSpace: 'normal', top: r.y - 17, lineHeight: '17px' } : {}) }} title={r.ad}>{r.tip === 'kisi' && r.sahipTip !== 'agent' ? kisaAd(r.ad) : r.ad}</span>
      ))}
      {eksenTarihleri(H, 56).map(({ t, x }) => <span key={t} className="gorev-sol-tarih" style={{ left: x - 30, top: y0 + H.h + 22 }}>{gunAy(t)}</span>)}
      {L.length > 0 && <span className="gorev-sol-tarih bugun" style={{ left: H.bugunX - 30, top: y0 + H.h + 40 }}>bugün</span>}
      <div aria-hidden="true" className="harita-katman gorev-harita">
        {H.noktalar.map((p) => <span key={p.a.akis + p.a.no} className="gezegen-hedef" title={`${p.a.ad} · ${akisAdi(p.a)}`} style={{ left: p.x - 18, top: p.y - 18, width: 36, height: 36 }}
          onClick={() => git(`/akis/${enc(p.a.akis)}/adim/${p.a.no}`)} />)}
      </div>
      {!L.length && <p className="gorev-sol-bos">Bu süzgeçte görev yok.</p>}
    </div>
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
