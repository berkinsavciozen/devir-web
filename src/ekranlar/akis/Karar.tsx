import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { bayrak, makbuz } from '../../cizim/ekran';
import { akisModeli, gunAy, saat, yolCiz } from '../../cizim/yol.js';
import { C, f, planet, shareRing, ship, sparkle } from '../../cizim/ortak.js';
import { adimAdi, akisAdi, doluSatir, ek, ozelEk } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { isPayi } from './Adim';
import { useAkis } from './Galaksi';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const kisi = (s: string) => s.replace(/\s*\(.*\)$/, '');
const tamamlaKucuk = (s: string) => s[0].toLocaleLowerCase('tr') + s.slice(1);

/** Kararın kısa adı (takımyıldız): `kisa` yoksa ilk cümleciğin en çok üç kelimesi. */
export function kararKisa(k: { karar: string; kisa?: string | null }): string {
  if (k.kisa) return k.kisa;
  const c = k.karar.split(/[;.:]/)[0].trim().split(/\s+/);
  return c.slice(0, 3).join(' ');
}

/** Karar adımı: sırası geldiyse C1 (seçenekler ve öneri), verildiyse C2 (yalnız okuma). */
export function Karar({ kod, no, ben }: { kod: string; no: number; ben: string }) {
  const akis = useAkis(kod);
  const q = useQuery({ queryKey: ['adim', kod, no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
  const d = akis.data, a = q.data?.adim;
  if (!d || !a) return <Sahne gok={{ tohum: 41, yildiz: 260 }} etiket="Karar" />;
  return a.durum === 'tamam' ? <KararVerildi d={d} a={a} kod={kod} /> : <KararBekleyen d={d} a={a} kod={kod} ben={ben} />;
}

const geri = (kod: string) => () => (history.length > 1 ? history.back() : git(`/akis/${encodeURIComponent(kod)}`));

/** C1 · Karar bekliyor (§5 C1). Seçenek yoksa serbest metin (§9-6 gelene kadar). */
function KararBekleyen({ d, a, kod, ben }: { d: any; a: any; kod: string; ben: string }) {
  const NOW = simdi(), K = a.karar || {}, sec: any[] = K.secenekler || [], oneri = K.oneri;
  const [secim, setSecim] = useState<string[]>(() => (oneri?.secim?.length ? oneri.secim : []));
  const [metin, setMetin] = useState('');
  const benim = a.sahip === ben;
  const cizim = useMemo(() => {
    const Y = yolCiz(akisModeli(d, { sahip: ben }), { cx: 195, cy: 208, R: 92, ps: .62, now: NOW, ships: false, labels: [], kuleEtiket: false });
    const p = Y.P[a.no];
    return Y.svg + (p ? `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="18" fill="none" stroke="#FFD27A" stroke-width="1.6"/>` + bayrak(p[0] + 14, p[1] - 16, .85) : '');
  }, [d, a.no, ben, NOW]);
  const ad = adimAdi(a), tur = K.tur || 'seçenek';
  const cumle = `${ad} ${benim ? 'sende' : ozelEk(kisi(a.sahip), 'de')}${oneri ? `; ${oneri.kim} ${oneri.secim.length} ${tur} önerdi.` : sec.length ? `; ${sec.length} ${tur} var.` : '.'}`;
  const ver = useMutation({
    mutationFn: () => {
      const icerik = sec.length ? `Kabul: ${secim.join(', ') || 'hiçbiri'}.${sec.filter((s) => !secim.includes(s.ad)).length ? ` Kabul edilmedi: ${sec.filter((s) => !secim.includes(s.ad)).map((s) => s.ad).join(', ')}.` : ''}` : metin.trim();
      return api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${a.no}`, { durum: 'tamam', ...(sec.length ? { karar_secimi: secim } : {}), cikti: { ad: 'Karar', ozet: icerik.slice(0, 200), icerik } });
    },
    onSuccess: () => { for (const k of [['akis', kod], ['adim', kod, a.no], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); },
  });
  const Y0 = 292 + 28, P = (y: number) => y - Y0;
  const satirY = (i: number) => P(292 + 146) + i * 56;
  const altY = sec.length ? satirY(sec.length) + 10 : P(292 + 146) + 120;
  let panel = '';
  if (oneri) {
    panel += `<rect x="20" y="${P(292 + 88)}" width="350" height="46" rx="16" fill="#B9A6F2" fill-opacity=".1" stroke="#B9A6F2" stroke-opacity=".5"/>`;
    panel += ship(44, P(292 + 111), -10, 'agent', (oneri.kim || 'C')[0], C.lilac, .66, { flame: false });
  }
  sec.forEach((s, i) => {
    const y = satirY(i), on = secim.includes(s.ad);
    panel += `<rect x="20" y="${y}" width="350" height="52" rx="16" fill="#FFFFFF" fill-opacity="${on ? .08 : .03}" stroke="${on ? '#FFD27A' : '#4B4380'}" stroke-opacity="${on ? .8 : 1}"/>`;
    panel += `<rect x="34" y="${y + 16}" width="20" height="20" rx="6" fill="${on ? '#FFD27A' : 'none'}" stroke="${on ? '#FFD27A' : '#9C8BE0'}" stroke-width="1.6"/>`;
    if (on) panel += `<path d="M39,${y + 26} L43,${y + 30} L50,${y + 21}" stroke="#2A1D4F" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    if (s.etiket && /fatura/i.test(s.etiket)) panel += makbuz(346, y + 26, !s.uyari);
  });
  return (
    <>
      <Sahne gok={{ tohum: 41, yildiz: 260 }} cizim={cizim} etiket={akisAdi(d.akis)}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={akisAdi(d.akis)} geri={geri(kod)} /></Kutu>
        <Metin y={108} fs={17} lh={22} serif renk="ink2">{cumle}</Metin>
      </Sahne>
      <AltSayfa acik kapat={geri(kod)} baslik={ad} yukseklik={292} duraklar={['orta', 'yuksek']} perdesiz>
        <form className="karar-panel" style={{ height: altY + 54 + 40 }} onSubmit={(e) => { e.preventDefault(); if (benim) ver.mutate(); }}>
          <svg className="karar-cizim" aria-hidden width="390" height={altY + 60} viewBox={`0 0 390 ${altY + 60}`} dangerouslySetInnerHTML={{ __html: panel }} />
          <Metin y={P(292 + 52)} fs={23} lh={28} serif agirlik={700} as="h2">{ad}</Metin>
          {(a.karar_kriteri || a.kriter) && <Metin y={P(292 + 74)} fs={12.5} lh={16} renk="ink3" className="tek-satir">Kriter: {a.karar_kriteri || a.kriter}</Metin>}
          {oneri && <>
            <Metin y={P(292 + 108)} x={66} fs={13} lh={17} agirlik={650} className="tek-satir">{oneri.kim}’un önerisi: {oneri.ozet || oneri.secim.join(', ')}</Metin>
            {oneri.gerekce && <Metin y={P(292 + 125)} x={66} fs={11.5} lh={15} renk="ink3" className="tek-satir">{oneri.gerekce}</Metin>}
          </>}
          {sec.length ? (
            <fieldset className="karar-secenekler" disabled={!benim}>
              <legend className="gorunmez">{ad}</legend>
              {sec.map((s, i) => {
                const y = satirY(i), on = secim.includes(s.ad);
                return (
                  <label key={s.ad} className="karar-satir" style={{ top: y }}>
                    <input type="checkbox" checked={on} onChange={() => setSecim(on ? secim.filter((x) => x !== s.ad) : [...secim, s.ad])} />
                    <b>{s.ad}</b>
                    {s.alt && <small>{s.alt}</small>}
                    {s.etiket && <em className={s.uyari ? 'uyari' : ''} style={/fatura/i.test(s.etiket) ? undefined : { right: 16 }}>{s.etiket}</em>}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <label className="karar-metin" style={{ top: P(292 + 146) }}>
              <span className="gorunmez">Kararın</span>
              <textarea value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Kararını yaz" rows={4} disabled={!benim} />
            </label>
          )}
          {benim && (
            <Dugme type="submit" style={{ top: altY }} mesgul={ver.isPending} disabled={!sec.length && !metin.trim()} ikonX={130 - 20 - 9} kayma={10}
              ikon={<svg aria-hidden width="18" height="20" viewBox="-9 -10 18 20"><rect x="-.8" y="-9" width="1.6" height="18" fill="var(--renk-metin-koyu-uzerine)" /><path d="M.8,-9 L9,-5.5 L.8,-2Z" fill="var(--renk-metin-koyu-uzerine)" /></svg>}>
              Kararı ver
            </Dugme>
          )}
          {ver.isError && <p className="canli-hata" role="alert" style={{ top: altY + 62 }}>{(ver.error as Error).message}</p>}
        </form>
      </AltSayfa>
    </>
  );
}

/** C2 · Karar verildi (yalnız okuma, §5 C2). */
function KararVerildi({ d, a, kod }: { d: any; a: any; kod: string }) {
  const NOW = simdi(), K = a.karar || {};
  const arka = useMemo(() => {
    let s = `<circle cx="195" cy="200" r="260" fill="url(#bloom)"/><circle cx="195" cy="200" r="120" fill="url(#bloom)" opacity=".8"/>`;
    s += yolCiz(akisModeli(d), { lod: 'kucuk', cx: 195, cy: 190, R: 128, now: NOW, pr: 6.5 }).svg;
    for (let i = 0; i < 9; i++) s += sparkle(60 + i * 37, 120 + (i * 53) % 150, 3 + (i % 3) * 2, '#FFF1D6', .9);
    return s;
  }, [d, NOW]);
  const ad = adimAdi(a);
  // kim, ne zaman
  const sonDurum = [...(a.olaylar || [])].reverse().find((e: any) => e.durum === 'tamam') || null;
  const kim = K.secim?.kim || sonDurum?.kim || a.sahip;
  const an = Date.parse(K.secim?.at || a.durum_at);
  // cümle ve sayılar
  const n = K.secenekler?.length || 0, k = K.secim?.secim?.length ?? 0, tur = K.tur || 'seçenek';
  const cumle = K.oneri && n ? `${K.oneri.kim} öneriyi hazırladı; ${kisi(kim)} ${k === n ? `${n} ${ozelEk(tur, 'in').replace('’', '')} tamamını` : `${n} ${ek(tur, 'den')} ${k}’sini`} kabul etti.`
    : n ? `${kisi(kim)} ${n} ${ek(tur, 'den')} ${k}’sini kabul etti.` : `${kisi(kim)} kararı verdi${a.ciktilar?.length ? `: ${tamamlaKucuk(a.ciktilar[a.ciktilar.length - 1].ozet || a.ciktilar[a.ciktilar.length - 1].ad)}` : '.'}`;
  let pay = isPayi(a.olaylar);
  for (const x of [K.oneri?.kim, kisi(kim)]) if (x && !pay.find((p) => p.ad === x)) pay = [...pay, { ad: x, n: 1, agent: /Claude|agent/i.test(x) }];
  // eşitlikte öneren önce (öneri → karar sırası)
  pay = [...pay].sort((p, q) => q.n - p.n || Number(q.ad === K.oneri?.kim) - Number(p.ad === K.oneri?.kim));
  const ilk2 = pay.slice(0, 2);
  const sayilar: [string, string, string][] = [
    [n ? `${k}/${n}` : '✓', n ? 'kabul' : 'verildi', '#FFD27A'],
    [ilk2.map((p) => p.n).join(' · '), ilk2.map((p) => kisi(p.ad)).join(' · '), '#B9A6F2'],
    [gunAy(an), 'karar', '#FFC9A3'],
  ];
  const kararlar: any[] = (a.kararlar || []).slice(0, 4);
  const Y0 = 300 + 28, P = (y: number) => y - Y0;
  const cy = P(300 + 386);
  const KS = [[52, -10], [148, 14], [252, -12], [340, 12]];
  let panel = `<circle cx="195" cy="${P(300 + 104)}" r="110" fill="url(#bloom)" opacity=".7"/>`;
  panel += planet(195, P(300 + 108), 38, 'lit', { karar: true, ring: false });
  if (pay.length) panel += shareRing(195, P(300 + 108), 58, pay, { w: 4, br: 10, bead: 2.4 });
  sayilar.forEach(([, , renk], i) => { panel += `<rect x="${20 + i * 119}" y="${P(300 + 272)}" width="112" height="54" rx="18" fill="#FFFFFF" fill-opacity=".06" stroke="${renk}" stroke-opacity=".6"/>`; });
  if (kararlar.length) {
    const ks = kararlar.map((_, i) => [KS[i][0], cy + KS[i][1]]);
    if (ks.length > 1) panel += `<path d="M${ks.map((p) => p[0] + ',' + p[1]).join(' L')}" fill="none" stroke="#FFD27A" stroke-width="1" stroke-dasharray="2 4" opacity=".7"/>`;
    for (const [x, y] of ks) panel += `<circle cx="${x}" cy="${y}" r="12" fill="url(#glowGold)"/>` + sparkle(x, y, 6, '#FFE7A8', 1);
  }
  panel += `<rect x="20" y="${P(300 + 446)}" width="350" height="44" rx="22" fill="#FFFFFF" fill-opacity=".04" stroke="#FFD27A" stroke-opacity=".35"/>`;
  panel += `<g transform="translate(46,${P(300 + 468)})"><circle r="8" fill="url(#pLit2)"/><path d="M-3.5,0 L-1,2.6 L3.6,-2.6" stroke="#2A1D4F" stroke-width="1.7" fill="none" stroke-linecap="round"/></g>`;
  const satir = doluSatir(cumle, 340, '17px Caladea', 3);
  return (
    <>
      <Sahne gok={{ tohum: 71, yildiz: 260 }} cizim={arka} etiket={akisAdi(d.akis)}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={akisAdi(d.akis)} geri={geri(kod)} /></Kutu>
      </Sahne>
      <AltSayfa acik kapat={geri(kod)} baslik={ad} yukseklik={300} duraklar={['orta', 'yuksek']} perdesiz>
        <div className="karar-panel" style={{ height: P(300 + 500) }}>
          <svg className="karar-cizim" aria-hidden width="390" height={P(300 + 500)} viewBox={`0 0 390 ${P(300 + 500)}`} style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: panel }} />
          <Metin y={P(300 + 210)} fs={25} lh={30} serif agirlik={700} hiza="orta" as="h2">{ad}</Metin>
          <Metin y={P(300 + 238)} fs={17} lh={22} serif renk="ink2" hiza="orta" style={{ whiteSpace: 'nowrap' }}>{satir.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
          {sayilar.map(([b, s], i) => <div key={i} className="sayi-kutusu" style={{ position: 'absolute', left: 20 + i * 119, top: P(300 + 272) }}><b>{b}</b><small>{s}</small></div>)}
          {kararlar.length > 0 && <>
            <Metin y={cy - 40} fs={11.5} lh={14} agirlik={600} renk="ink3" hiza="orta">{ozelEk(kararlar[0].varlik, 'in')} geçerli kararları</Metin>
            <ul className="karar-yildizlar" aria-label={`${ozelEk(kararlar[0].varlik, 'in')} geçerli kararları`}>
              {kararlar.map((x, i) => <li key={x.id} title={x.karar} style={{ left: KS[i][0] - 70, top: cy + KS[i][1] + 24 - 11.5 }}>{kararKisa(x)}<span className="gorunmez">: {x.karar}</span></li>)}
            </ul>
          </>}
          <Metin y={P(300 + 473)} x={64} fs={13.5} lh={17} agirlik={650}>Verildi · {gunAy(an)} {saat(an)} · {kisi(kim)}</Metin>
        </div>
      </AltSayfa>
    </>
  );
}
