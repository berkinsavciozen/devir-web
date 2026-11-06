import { useMemo, useState } from 'react';
import { useBoyut } from '../../bilesen/Gok';
import { PANEL_EN } from '../../bilesen/Kabuk';
import { soruyaOdaklan, useTaslakDurumu } from './taslakDurum';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { planet, ship } from '../../cizim/ortak.js';
import { gunAy } from '../../cizim/yol.js';
import { sarSatir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { Liste, type Oge } from '../akis/Bilgi';
import { haftaCizgileri } from '../gorevler/model';
import { adimRozetleri } from './plan';
import { rolAdi, taslakCumlesi, taslakHaritasi, type TNokta, type TRol } from './taslakModel';

/**
 * W4 (4 Kas, B5): taslak haritası (/yeni/:kod/harita). Taslak eksik olsa bile kurulmadan haritada görülür: soluk,
 * kesik çizgili gezegenler, sahip rolü şeritleri, tahmini zaman, hedef çizgisi. Sahibi belli olmayan rol mercan kesik
 * şeritte "?" gemisiyle, cevabı beklenen soruya bağlı adım "?" rozetiyle, hedefi aşan adım mercan halkayla vurgulanır.
 */
const GOK = { tohum: 89, yildiz: 240 };
const MERCAN = '#FF9A8A', ALTIN = '#FFD27A';
const enc = encodeURIComponent;

const rolGemisi = (r: TRol, x: number, y: number, eksik: boolean) => eksik
  ? `<g transform="translate(${x},${y})"><circle r="11" fill="#08222E" stroke="${MERCAN}" stroke-dasharray="2 3" stroke-width="1.3"/><text y="4.5" text-anchor="middle" font-family="Bricolage" font-size="12" font-weight="700" fill="${MERCAN}">?</text></g>`
  : r.tip === 'dis' ? ship(x, y + 1, 0, 'dis', '', '#F2B8D8', .5)
    : ship(x, y, -12, r.tip === 'agent' ? 'agent' : 'insan', (rolAdi(r)[0] || '?').toLocaleUpperCase('tr'), r.tip === 'agent' ? '#B9A6F2' : '#FFC9A3', .5, { flame: false });

function taslakGezegeni(n: TNokta, r: number, sec: boolean) {
  // W3 (B8): cevabı beklenen soruya bağlı adım henüz yok: gövdesiz, yalnız kesik halka ve "?"
  let s = n.soru ? `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="#B9A6F2" fill-opacity=".05"/>` : `<g opacity=".85">${planet(n.x, n.y, r, 'dark', { life: false })}</g>`;
  s += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r + 3}" fill="none" stroke="${n.gec ? MERCAN : '#D9CCFF'}" stroke-width="${n.gec ? 1.6 : 1.1}" stroke-dasharray="2 3"/>`;
  if (n.soru) s += `<g transform="translate(${(n.x + r * .8).toFixed(1)},${(n.y - r * .8).toFixed(1)})"><circle r="6" fill="${ALTIN}" stroke="#2A1D4F" stroke-width=".8"/><text y="3.4" text-anchor="middle" font-family="Bricolage" font-size="9" font-weight="800" fill="#2A1D4F">?</text></g>`;
  if (sec) s += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r + 8}" fill="none" stroke="#FFF3E8" stroke-width="1.5" opacity=".7"/>`;
  return s;
}

export function TaslakHaritasi({ kod }: { kod: string }) {
  const NOW = simdi();
  const q = useQuery({ queryKey: ['taslak', kod], queryFn: () => api.get<any>(`/taslak/${enc(kod)}`) });
  const t = q.data;
  const [sec, setSec] = useState<number | null>(null);
  const geri = () => (history.length > 1 ? history.back() : git('/akislar'));
  const baslikSatir = t ? sarSatir(String(t.baslik || t.cumle || '').replace(/'/g, '’'), 330, '700 21px Bricolage').slice(0, 3) : [];
  // cümle haritanın yerinden bağımsız (zaman ve sayılar); önce bir kez hesaplanır, harita onun altına iner
  const H0 = useMemo(() => (t ? taslakHaritasi(t, { now: NOW }) : null), [t, NOW]);
  const cumle = H0 && t ? sarSatir(taslakCumlesi(H0, (t.sorular || []).length, gunAy), 300, '15px Bricolage') : [];
  const HY = 122 + baslikSatir.length * 26 + 6 + cumle.length * 20 + 40;
  const H = useMemo(() => (t ? taslakHaritasi(t, { now: NOW, y0: HY + 8, x0: 132, x1: 356, satir: 62 }) : null), [t, NOW, HY]);

  const svg = useMemo(() => {
    if (!H) return '';
    let s = `<rect x="16" y="${HY - 4}" width="358" height="${H.h + 54}" rx="20" fill="#061A24" fill-opacity=".55" stroke="#D9CCFF" stroke-opacity=".18" stroke-dasharray="3 5"/>`;
    for (const t0 of haftaCizgileri(H.t0, H.t1)) {
      const x = H.x0 + (t0 - H.t0) / (H.t1 - H.t0) * (H.x1 - H.x0);
      s += `<line x1="${x.toFixed(1)}" y1="${HY + 4}" x2="${x.toFixed(1)}" y2="${HY + 8 + H.h}" stroke="#FFFFFF" stroke-opacity=".05"/>`;
    }
    for (const r of H.seritler) {
      s += `<line x1="${H.x0}" y1="${r.y}" x2="${H.x1}" y2="${r.y}" stroke="${r.eksik ? MERCAN : '#4B4380'}" stroke-opacity="${r.eksik ? .55 : 1}" stroke-width="1.2" stroke-dasharray="2 4"/>`;
    }
    const yer = new Map(H.noktalar.map((n) => [n.a.id, n]));
    for (const n of H.noktalar) for (const d of n.a.bagimli || []) {
      const p = yer.get(d);
      if (p) s += `<path d="M${p.x.toFixed(1)},${p.y.toFixed(1)} C${((p.x + n.x) / 2).toFixed(1)},${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}" fill="none" stroke="#B9A6F2" stroke-opacity=".3" stroke-width="1" stroke-dasharray="2 3"/>`;
    }
    s += `<line x1="${H.bugunX.toFixed(1)}" y1="${HY + 2}" x2="${H.bugunX.toFixed(1)}" y2="${HY + 10 + H.h}" stroke="#FFC9A3" stroke-width="1.5" stroke-linecap="round"/>`;
    if (H.hedefX != null) s += `<line x1="${H.hedefX.toFixed(1)}" y1="${HY + 2}" x2="${H.hedefX.toFixed(1)}" y2="${HY + 10 + H.h}" stroke="${ALTIN}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    for (const n of H.noktalar) s += taslakGezegeni(n, 7.5, sec === n.no);
    return s;
  }, [H, HY, sec]);

  if (!t || !H) return <Sahne gok={GOK} etiket="Taslak"><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Taslak" geri={geri} /></Kutu>{q.isError && <Metin y={300} fs={17} lh={22} serif renk="ink2" hiza="orta">{(q.error as Error).message}</Metin>}</Sahne>;

  // eksikler, sonra adımlar (taslak sırasıyla)
  const ogeler: Oge[] = [];
  const S: any[] = t.sorular || [];
  const eksik = S.length + H.eksikRol.length + (H.gecikme.length ? 1 : 0);
  const ikonX = (svg: string) => `<g transform="translate(28,29)">${svg}</g>`;
  if (eksik) {
    ogeler.push({ tur: 'baslik', metin: `KURMADAN ÖNCE · ${eksik}` });
    for (const s of S) {
      const bagli = H.noktalar.filter((n) => n.a.kosul?.soru === s.kod);
      ogeler.push({ tur: 'satir', key: 'q' + s.kod, ikon: ikonX(`<circle r="11" fill="${ALTIN}" fill-opacity=".18" stroke="${ALTIN}"/><text y="4.5" text-anchor="middle" font-family="Bricolage" font-size="12" font-weight="800" fill="${ALTIN}">?</text>`),
        ust: s.soru, alt: bagli.length ? `cevabına bağlı: ${bagli.map((n) => `${n.no}. adım`).join(', ')}` : 'soru', git: () => git(`/yeni/${enc(kod)}`) });
    }
    for (const r of H.eksikRol) ogeler.push({ tur: 'satir', key: 'r' + r.kod, ikon: rolGemisi(r, 28, 29, true), ust: `${r.ad}: kim yapacak belli değil`,
      alt: `${H.noktalar.filter((n) => n.a.sahip_rol === r.kod).length} adım · kurunca ${r.tip === 'dis' ? 'bağlantı gönderirsin' : 'kişiyi seçersin'}` });
    if (H.gecikme.length) ogeler.push({ tur: 'satir', key: 'gec', ikon: ikonX(`<circle r="11" fill="none" stroke="${MERCAN}" stroke-dasharray="2 3" stroke-width="1.6"/><path d="M0,-5 L0,1" stroke="${MERCAN}" stroke-width="2" stroke-linecap="round"/><circle cy="5" r="1.3" fill="${MERCAN}"/>`),
      ust: `${H.gecikme.length} adım hedefi aşıyor`, alt: `tahmini bitiş ${gunAy(H.bitis)}, hedef ${H.hedef ? gunAy(H.hedef) : '—'}` });
  }
  ogeler.push({ tur: 'baslik', metin: `ADIMLAR · ${H.noktalar.length}` });
  for (const n of H.noktalar) {
    const rol = H.seritler.find((r) => r.rol.kod === n.a.sahip_rol)!;
    ogeler.push({
      tur: 'satir', key: n.a.id, ikon: `<g transform="translate(-${(n.x - 28).toFixed(1)},-${(n.y - 29).toFixed(1)})">${taslakGezegeni(n, 9, false)}</g>`,
      ust: `${n.no}. ${n.a.ad}`, baslik: n.a.ad,
      // C14/C15: tarih başta (kesilmesin), sonra kim yürütür / inceleme / karar rozetleri, seçenekler
      alt: [gunAy(n.bit), ...adimRozetleri(n.a).map((r) => r.metin), rolAdi(rol.rol) + (rol.eksik ? ' (belli değil)' : ''), n.a.sure_tahmin_gun != null ? `${n.a.sure_tahmin_gun} gün` : null, n.soru ? 'soruya bağlı' : null, n.gec ? 'hedefi aşıyor' : null,
        n.a.karar_secenekleri?.length ? `seçenekler: ${n.a.karar_secenekleri.join(' / ')}` : null].filter(Boolean).join(' · '),
      sag: sec === n.no ? <span className="satir-not">seçili</span> : <span />,
    });
  }
  const listeY = HY + H.h + 66 + 60;
  const Lst = Liste({ y0: listeY, ogeler, etiket: 'Taslak' });

  return (
    <Sahne gok={GOK} cizim={svg} etiket="Taslak haritası" yukseklik={Math.max(844, Lst.y + 130)}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Taslak" geri={geri} /></Kutu>
      <Metin y={122} fs={21} lh={26} serif agirlik={700} as="h1">{baslikSatir.map((x, j) => <span key={j}>{j ? <br /> : null}{x}</span>)}</Metin>
      <Metin y={122 + baslikSatir.length * 26 + 6} fs={15} lh={20} renk="ink2" as="p" style={{ whiteSpace: 'nowrap' }}>{cumle.map((x, j) => <span key={j}>{j ? <br /> : null}{x}</span>)}</Metin>
      <h2 className="bolum-baslik" style={{ top: HY - 26 }}>TASLAK HARİTASI</h2>
      {H.seritler.map((r) => {
        // C15 (0.34.0): gemi ve ad aynı HTML satırında; panelde çizim ile metin kaysa da simge adın üstüne binmez
        const L = sarSatir(rolAdi(r.rol), 74, '650 10.5px Bricolage').slice(0, 2);
        return <Metin key={r.rol.kod} y={r.y + 4 - (L.length - 1) * 5.75} x={20} fs={10.5} lh={11.5} agirlik={650} renk={r.eksik ? 'mercan' : 'ink2'} style={{ right: 'auto', width: 108, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg aria-hidden width="26" height="26" viewBox="-13 -13 26 26" style={{ flex: 'none', overflow: 'visible', marginTop: (L.length - 1) * 5.75 - 8 }} dangerouslySetInnerHTML={{ __html: rolGemisi(r.rol, 0, 0, r.eksik) }} />
          <span>{L.map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}</span>
        </Metin>;
      })}
      <Metin y={HY + H.h + 26} x={Math.max(20, H.bugunX - 20)} fs={11} lh={14} agirlik={700} renk="altin" className="tek-satir" style={{ right: 'auto' }}>bugün</Metin>
      {H.hedefX != null && <Metin y={HY + H.h + 26} x={Math.min(332, H.hedefX - 16)} fs={11} lh={14} agirlik={700} renk="altin" className="tek-satir" style={{ right: 'auto' }}>hedef</Metin>}
      <div className="harita-katman gorev-harita">
        {H.noktalar.map((n) => <button key={n.a.id} type="button" className="gezegen-hedef" aria-label={`${n.no}. ${n.a.ad}`} aria-pressed={sec === n.no} style={{ left: n.x - 14, top: n.y - 14, width: 28, height: 28 }} onClick={() => setSec(sec === n.no ? null : n.no)} />)}
      </div>
      {sec != null && (() => { const n = H.noktalar[sec - 1]; return <Metin y={HY + H.h + 48} fs={13} lh={17} renk="ink" className="tek-satir" as="p" style={{ left: 20, right: 20 }}>{n.no}. {n.a.ad} · tahmini {gunAy(n.bit)}</Metin>; })()}
      <Dugme style={{ top: HY + H.h + 62 }} yukseklik={50} fs={16} onClick={() => git(`/yeni/${enc(kod)}`)}>{S.length ? 'Soruları cevapla, akışı kur' : 'Akışı kur'}</Dugme>
      {Lst.dugum}
    </Sahne>
  );
}

/**
 * W3 (B8): masaüstünde taslak sayfasının sol bölmesi. Evren yerine akışın taslak haritası, normal akış haritasının
 * düzeninde: sahip şeritleri, tahmini zaman, bugün ve hedef çizgisi. Taslağı taslak yapan eksikler boş çizilir:
 * cevapsız soruya bağlı adım gövdesiz kesik halka ve "?", sahibi belli olmayan rol kesik mercan şerit ve "?" gemisi.
 * Sağdaki panelde soru cevaplandıkça bağlı adımlar dolar; "?" e basınca paneldeki soru açılır.
 */
export function TaslakSol({ kod }: { kod: string }) {
  const NOW = simdi();
  const { w: W, h: Hh } = useBoyut();
  const SW = W - PANEL_EN;
  const q = useQuery({ queryKey: ['taslak', kod], queryFn: () => api.get<any>(`/taslak/${enc(kod)}`) });
  const t = q.data;
  const { cevap } = useTaslakDurumu(kod);
  const [sec, setSec] = useState<number | null>(null);
  const y0 = 196;
  const H = useMemo(() => {
    if (!t) return null;
    const n = Math.max(1, taslakHaritasi(t, { now: NOW }).seritler.length);
    const satir = Math.max(52, Math.min(96, (Hh - y0 - 190) / n));
    return taslakHaritasi(t, { now: NOW, x0: 260, x1: SW - 72, y0, satir, cevaplar: cevap });
  }, [t, NOW, SW, Hh, cevap]);
  const svg = useMemo(() => {
    if (!H) return '';
    let s = `<rect x="40" y="${y0 - 26}" width="${SW - 80}" height="${H.h + 64}" rx="26" fill="#061A24" fill-opacity=".5" stroke="#D9CCFF" stroke-opacity=".18" stroke-dasharray="3 5"/>`;
    for (const t0 of haftaCizgileri(H.t0, H.t1)) {
      const x = H.x0 + (t0 - H.t0) / (H.t1 - H.t0) * (H.x1 - H.x0);
      s += `<line x1="${x.toFixed(1)}" y1="${y0 - 8}" x2="${x.toFixed(1)}" y2="${y0 + H.h + 10}" stroke="#FFFFFF" stroke-opacity=".05"/>`;
    }
    for (const r of H.seritler) {
      s += `<line x1="${H.x0}" y1="${r.y}" x2="${H.x1}" y2="${r.y}" stroke="${r.eksik ? MERCAN : '#4B4380'}" stroke-opacity="${r.eksik ? .55 : 1}" stroke-width="1.3" stroke-dasharray="2 5"/>`;
      s += rolGemisi(r.rol, 92, r.y, r.eksik);
    }
    const yer = new Map(H.noktalar.map((n) => [n.a.id, n]));
    for (const n of H.noktalar) for (const d of n.a.bagimli || []) {
      const p = yer.get(d);
      if (p) s += `<path d="M${p.x.toFixed(1)},${p.y.toFixed(1)} C${((p.x + n.x) / 2).toFixed(1)},${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}" fill="none" stroke="#B9A6F2" stroke-opacity="${n.soru || p.soru ? .18 : .35}" stroke-width="1.1" stroke-dasharray="2 3"/>`;
    }
    s += `<line x1="${H.bugunX.toFixed(1)}" y1="${y0 - 8}" x2="${H.bugunX.toFixed(1)}" y2="${y0 + H.h + 12}" stroke="#FFC9A3" stroke-width="1.8" stroke-linecap="round"/>`;
    if (H.hedefX != null) s += `<line x1="${H.hedefX.toFixed(1)}" y1="${y0 - 8}" x2="${H.hedefX.toFixed(1)}" y2="${y0 + H.h + 12}" stroke="${ALTIN}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    for (const n of H.noktalar) s += taslakGezegeni(n, 10, sec === n.no);
    return s;
  }, [H, SW, sec]);
  if (!t || !H) return <div style={{ position: 'absolute', inset: 0 }}>{q.isError && <p className="gorev-sol-bos">{(q.error as Error).message}</p>}</div>;
  const S: any[] = t.sorular || [];
  const acik = S.filter((x) => cevap[x.kod] == null || cevap[x.kod] === '').length;
  const n = sec != null ? H.noktalar[sec - 1] : null;
  return (
    <div className="taslak-sol" style={{ position: 'absolute', inset: 0 }}>
      <svg aria-hidden width={SW} height={Hh} viewBox={`0 0 ${SW} ${Hh}`} style={{ position: 'absolute', left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="genis-bolum" style={{ left: 48, top: 40 }}>TASLAK HARİTASI</div>
      <h1 className="taslak-sol-baslik" style={{ left: 48, top: 62, width: SW - 96 }}>{String(t.baslik || t.cumle || '').replace(/'/g, '’')}</h1>
      <p className="taslak-sol-cumle" style={{ left: 48, top: 128, width: SW - 96 }}>{taslakCumlesi(H, acik, gunAy)}</p>
      {H.seritler.map((r) => (
        <span key={r.rol.kod} className={`gorev-sol-ad ${r.eksik ? 'eksik' : ''}`} style={{ left: 112, top: r.y - 17, width: 142, whiteSpace: 'normal', lineHeight: '17px' }} title={rolAdi(r.rol)}>
          {rolAdi(r.rol)}{r.eksik ? <small> · kim yapacak?</small> : null}
        </span>
      ))}
      <span className="gorev-sol-tarih bugun" style={{ left: H.bugunX - 30, top: y0 + H.h + 18 }}>bugün</span>
      {H.hedefX != null && <span className="gorev-sol-tarih hedef" style={{ left: H.hedefX - 30, top: y0 + H.h + 18 }}>hedef {H.hedef ? gunAy(H.hedef) : ''}</span>}
      <div className="harita-katman gorev-harita">
        {H.noktalar.map((p) => <button key={p.a.id} type="button" className="gezegen-hedef" aria-label={`${p.no}. ${p.a.ad}${p.soru ? ', soruya bağlı' : ''}`} aria-pressed={sec === p.no} style={{ left: p.x - 16, top: p.y - 16, width: 32, height: 32 }}
          onClick={() => { setSec(sec === p.no ? null : p.no); if (p.soru) soruyaOdaklan(kod, p.soru); }} />)}
      </div>
      <p className="taslak-sol-not" style={{ left: 48, top: y0 + H.h + 52, width: SW - 96 }}>
        {n ? <><b>{n.no}. {n.a.ad}</b> · {rolAdi(H.seritler[n.serit].rol)} · tahmini {gunAy(n.bit)}{n.soru ? ` · “${S.find((x) => x.kod === n.soru)?.soru || 'soru'}” cevabına bağlı` : ''}{n.gec ? ' · hedefi aşıyor' : ''}</>
          : <>Boş halkalı adımlar cevap bekleyen soruya bağlı; kesik mercan şeritte kimin yapacağı belli değil. Sağda cevapladıkça harita dolar.</>}
      </p>
    </div>
  );
}
