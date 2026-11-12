import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { useBen, useOzet } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { UstDugmeler } from '../../bilesen/Zil';
import { usePanelIcinde } from '../../bilesen/Kabuk';
import { useBoyut } from '../../bilesen/Gok';
import { Sahne } from '../../bilesen/Sahne';
import { planet, ship, sparkle } from '../../cizim/ortak.js';
import { belge, elmas, uyduSistemi } from '../../cizim/yol.js';
import { gunAy, kisaAd, otoRozet } from '../../cizim/yol.js';
import { arama, git, useSorgu } from '../../yonlendirme';
import { durumGor } from '../akis/Bilgi';
import { kucukGalaksi, useDetaylar } from '../evren/Evren';
import { alanAdi } from '../hesap/Hesap';
import { soruKarti, gorevHaritasi, haftaCizgileri, ozettenGorevler, suzgecOku } from './model';
import { destekGemisi } from '../../cizim/ortak.js';
import { AgentDetay, agentCumlesi, agentIkonu, useAgentlar } from '../hesap/Agentlarim';
import { TekPano } from '../pano/TekPano';
import { KararSeridi, oncelikliAkis } from '../../bilesen/KararSeridi';
import { akisAdi as akisAdiK } from '../../metin/turkce';

// Görevler (/gorevler, eski /bana; el notu 16): bağlı olduğun bütün akışlardaki işler. Kişi (varsayılan sen), Akış ve
// Durum (varsayılan bitmemiş) süzgeçleri adreste; üstte görev haritası, altta durum grupları, en altta bekleyenler.
const GOK = { tohum: 63, yildiz: 220 };
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const enc = encodeURIComponent;
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

/**
 * Görevler (12 Kas, Tek Pano P2): Pano'nun kendisi, Kişi = Ben süzgeciyle. Üstte açık sorular (cevabı belli olmuş),
 * altta agent'ların ve bekleyenler (taslak, davet; yalnız Ben'de, K4). Masaüstünde sol bölmede görev haritası kalır.
 */
export function Gorevler({ ben }: { ben: Ben }) {
  const kisi = ben.kisi || '';
  const panelde = usePanelIcinde();
  const [kisiQ] = useSorgu('kisi');
  const benMi = !kisiQ || kisiQ === 'ben';
  const akis = arama().get('akis');
  // K6: cevabı belli olmuş ama yazılmamış açık sorular (sunucu 0.33.2+); kendi işlerinin sorgusunda gelir
  const qs = new URLSearchParams({ kisi: kisi || 'hepsi', durum: 'acik' });
  const G = useQuery({ queryKey: ['gorevler', qs.toString()], queryFn: () => api.get<any>(`/gorevler?${qs}`), enabled: benMi && !!kisi, retry: false });
  const SQ: any[] = benMi ? G.data?.sorular || [] : [];
  const AG = useAgentlar(benMi && ben.rol !== 'dis');
  const AA: any[] = benMi ? AG.data?.agentlar || [] : [];
  const [agentAc, setAgentAc] = useState<string | null>(null);
  const ozet = useOzet();
  const b = useBen().data as Ben | undefined;
  const taslaklar: any[] = benMi ? ozet.data?.taslaklar || [] : [];
  const davetler: any[] = benMi ? b?.bekleyen_davetler || ben.bekleyen_davetler || [] : [];
  const satir = (key: string, ikon: string, ust: ReactNode, alt: string, ac: () => void, etiket?: string) => (
    <div role="listitem" key={key}><button type="button" className="kart satir-kart pano-satir" onClick={ac} aria-label={etiket}>
      <svg aria-hidden width="52" height="60" viewBox="0 0 52 58" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ikon }} />
      <span className="satir-metin" style={{ left: 58, right: 16 }}><b>{ust}</b><small>{alt}</small></span>
    </button></div>
  );
  const once = SQ.length > 0 && (
    <section className="tek-pano-bolum b-sorular pano-akim" aria-label="Açık sorular">
      <h3 className="gd-bolum-baslik">AÇIK SORULAR · {SQ.length}</h3>
      <div role="list">{SQ.map((q) => satir(`s:${q.akis}:${q.kod}`, soruIkon, q.kisa || q.soru, `${soruKarti(q)} · ${q.akis_kisa_ad || q.akis_baslik}`,
        () => git(`/akis/${enc(q.akis)}/soru/${enc(q.kod)}`), `Açık soru: ${q.soru}. ${soruKarti(q)}. ${q.akis_kisa_ad || q.akis_baslik}.`))}</div>
    </section>
  );
  const alt = (AA.length > 0 || taslaklar.length > 0 || davetler.length > 0) && <div className="pano-akim">
    {AA.length > 0 && <section className="tek-pano-bolum" aria-label="Agent’ların">
      <h3 className="gd-bolum-baslik">AGENT’LARIN · {AA.length}</h3>
      <div role="list">{AA.map((g) => satir('ag:' + g.ad, agentIkonu(g, 28, 30, 1.15), g.ad, agentCumlesi(g, !!AG.data?.genel_rutin, true), () => setAgentAc(g.ad)))}</div>
    </section>}
    {(taslaklar.length > 0 || davetler.length > 0) && <section className="tek-pano-bolum" aria-label="Bekleyenler">
      <h3 className="gd-bolum-baslik">BEKLEYENLER</h3>
      <div role="list">
        {taslaklar.map((t) => satir('t' + t.kod, taslakIkon, t.baslik || t.cumle, `taslak · ${t.soru_sayisi} soru · ${t.adim_sayisi} adım`, () => git(`/yeni/${enc(t.kod)}/harita`), `Taslak: ${t.baslik || t.cumle}. ${t.soru_sayisi} soru bekliyor.`))}
        {davetler.map((d) => satir('d' + d.id, zarfIkon, alanAdi(d.alan || '', d.davet_eden), `davet · ${d.rol === 'dis' ? 'dış' : d.rol}${d.davet_eden ? ` · ${d.davet_eden}` : ''}`, () => git('/hesap')))}
      </div>
    </section>}
  </div>;
  // karar şeridi (P1-A2): dikkat isteyen akışın şeridi başlığın altında, Evren'deki panoyla aynı
  const ak = oncelikliAkis<any>(ozet.data?.akislar || []);
  const ust = ak && <KararSeridi oz={ak.karar_ozeti} onek={akisAdiK(ak)} ac={() => git(`/akis/${enc(ak.kod)}`)} className="akim" />;
  const icerik = <TekPano ben={kisi} baslik="Görevler" ust={ust} kisiSecimi={{ varsayilan: 'ben' }} akis={akis} kapat={() => git('/gorevler', { yerine: true })} once={once} alt={alt} />;
  const agentKutusu = agentAc && AG.data && (() => { const g = AA.find((x) => x.ad === agentAc); return g ? <AgentDetay a={g} veri={AG.data} kip="is" kapat={() => setAgentAc(null)} /> : null; })();
  if (panelde) return <><div className="tek-pano-panel">{icerik}</div>{agentKutusu}</>;
  return (
    <>
      <Sahne gok={GOK} etiket="Görevler">
        <UstDugmeler y={44} />
        <div className="tek-pano-sayfa">{icerik}</div>
        <AltGezinme aktif="bana" yeni={() => git('/yeni')} />
      </Sahne>
      {agentKutusu}
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
  useSorgu('kisi'); // Pano'daki kişi çipi adresi değiştirince harita da yeniden çizilir
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
