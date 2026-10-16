import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { boyutYaz } from '../../api/dosya';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { DosyaGlif, CopIkon } from '../../bilesen/DosyaSatiri';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { akisModeli, gunAy, saat, yolCiz, zamanCubugu, GUN } from '../../cizim/yol.js';
import { f, pill } from '../../cizim/ortak.js';
import { akisAdi, genislik, ikiSatir, ozelEk, sayiIyelik } from '../../metin/turkce';
import { simdi } from '../../api/ortam';
import { git } from '../../yonlendirme';

const SURGU = { x: 16, y: 548, w: 358 };
const UYARI = '<g transform="scale(1.15)"><path d="M0,-11 L11,8 L-11,8Z" fill="none" stroke="#FF8A78" stroke-width="1.8" stroke-linejoin="round"/><rect x="-1" y="-4" width="2" height="7" rx="1" fill="#FF8A78"/><circle cy="5" r="1.2" fill="#FF8A78"/></g>';

/** I1 cümlesi: "13 adımın hepsi kapandı; hedeften 35 gün önce bitti." */
export function kapanisCumlesi(d: any): string {
  const n = d.adimlar.length, kap = Date.parse(d.akis.kapandi_at);
  const acik = d.adimlar.filter((a: any) => !['tamam', 'atlandi', 'ertelendi'].includes(a.durum)).length;
  const bas = acik ? `${n} adımdan ${sayiIyelik(n - acik)} kapandı` : `${n} adımın hepsi kapandı`;
  if (!d.akis.hedef_tarih) return `${bas}.`;
  const g = Math.round((Date.parse(d.akis.hedef_tarih + 'T23:59:00+03:00') - kap) / GUN);
  return `${bas}; ${g > 0 ? `hedeften ${g} gün önce bitti` : g < 0 ? `hedeften ${-g} gün sonra bitti` : 'hedef gününde bitti'}.`;
}

/** I1 · Kapanmış akış: yanık sarmal, kapanışa kadar sürgü, değerlendirme, dersler; sahibe akış menüsü (§5 I1). */
export function KapaliGalaksi({ d, kod, sahipMi, sahip }: { d: any; kod: string; sahipMi: boolean; sahip: string }) {
  const M = useMemo(() => akisModeli(d, { sahip }), [d, sahip]);
  const kap = Date.parse(d.akis.kapandi_at);
  const [X, setX] = useState(kap);
  const [oynuyor, setOynuyor] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sil, setSil] = useState(false);
  const [ders, setDers] = useState(false);
  const [silindi, setSilindi] = useState<number | null>(null);
  const ad = akisAdi(d.akis);
  const cizim = useMemo(() => {
    const Y = yolCiz(M, { cx: 195, cy: 330, R: 150, ps: .8, allLit: X >= kap, ships: false, kuleEtiket: false, x: X, now: Math.max(kap, simdi()) });
    let s = `<circle cx="195" cy="330" r="280" fill="url(#bloom)" opacity=".9"/>` + Y.svg;
    const k = Y.G.kule;
    if (k && X >= kap) s += `<circle cx="${f(k.x)}" cy="${f(k.y)}" r="16" fill="url(#glowGold)"/>` + pill(k.x - 10, k.y + 34, `Kapandı ${gunAy(kap)}`, { fs: 11, fw: 750, bg: '#FFC9A3', bgo: 1, col: '#2A1D4F' });
    const Z = zamanCubugu(SURGU.x, SURGU.y, SURGU.w, Y.G, X, { now: kap, oynuyor, etiket: X >= kap ? `Kapandı · ${gunAy(kap)} ${saat(kap)}` : `${gunAy(X)} ${saat(X)}` });
    return { svg: s + Z.svg, Z };
  }, [M, X, kap, oynuyor]);
  // oynat: kuruluştan kapanışa en az 4 sn (§7.3)
  useEffect(() => {
    if (!oynuyor) return;
    const { t0, t1 } = cizim.Z, sure = Math.max(4000, (t1 - t0) / GUN * 1000);
    let id = 0; const bas = performance.now();
    const kare = (t: number) => { const p = Math.min(1, (t - bas) / sure); setX(t0 + (t1 - t0) * p); if (p < 1) id = requestAnimationFrame(kare); else setOynuyor(false); };
    id = requestAnimationFrame(kare);
    return () => cancelAnimationFrame(id);
  }, [oynuyor]); // eslint-disable-line react-hooks/exhaustive-deps
  const K = d.kapanis;
  const deg = K?.degerlendirme ? K.degerlendirme.split(/(?<=[.!?])\s+/)[0] : null;
  const degSatir = deg ? sar(`“${deg.replace(/'/g, '’')}”`, 262, '16px Caladea').slice(0, 3) : [];
  const devir = K && K.devredilen ? `${K.devredilen} açık iş ${d.akis.varlik ? tarihEkAd(d.akis.varlik) : 'sonraki işlere'} devredildi · ${K.arac || K.kim}, ${gunAy(Date.parse(K.zaman))}` : K ? `${K.arac || K.kim}, ${gunAy(Date.parse(K.zaman))}` : '';
  const cumle = ikiSatir(kapanisCumlesi(d), 350, '17px Caladea');
  const Z = cizim.Z;
  return (
    <>
      <Sahne gok={{ tohum: 71, yildiz: 300, parilti: 8 }} cizim={cizim.svg + (K ? `<rect x="16" y="600" width="358" height="154" rx="22" fill="#120B2C" fill-opacity=".72" stroke="#FFD27A" stroke-opacity=".35"/>` : '')} etiket={ad}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={() => (history.length > 1 ? history.back() : git('/'))} /></Kutu>
        {sahipMi && <Kutu as="button" x={326} y={40} w={44} h={44} className="akis-menu" aria-label="Akış menüsü" onClick={() => setMenu(true)}><i /><i /><i /></Kutu>}
        <Metin y={110} fs={17} lh={22} serif renk="ink2" as="p" style={{ whiteSpace: 'nowrap' }}>{cumle.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
        <button className="surgu-oynat" style={{ left: SURGU.x, top: SURGU.y - 22 }} aria-label={oynuyor ? 'Durdur' : 'Baştan oynat'} onClick={() => { if (!oynuyor) setX(Z.t0); setOynuyor(!oynuyor); }} />
        <div className="surgu-ray" role="slider" tabIndex={0} aria-label="Zaman" aria-valuemin={Z.t0} aria-valuemax={Z.t1} aria-valuenow={Math.round(X)} aria-valuetext={`${gunAy(X)} ${saat(X)}`}
          style={{ left: Z.x0 - 22, top: SURGU.y - 22, width: Z.x1 - Z.x0 + 44 }}
          onPointerDown={(e) => { setOynuyor(false); e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); setX(Z.tOf(Math.max(Z.x0, Math.min(Z.x1, Z.x0 - 22 + e.clientX - r.left)))); }}
          onPointerMove={(e) => { if (!e.buttons) return; const r = e.currentTarget.getBoundingClientRect(); setX(Z.tOf(Math.max(Z.x0, Math.min(Z.x1, Z.x0 - 22 + e.clientX - r.left)))); }} />
        {K && <>
          <Metin y={628} x={34} fs={12} lh={16} agirlik={700} renk="ink3" style={{ letterSpacing: '.6px' }}>DEĞERLENDİRME</Metin>
          {deg && <Metin y={656} x={34} fs={16} lh={21} serif as="blockquote" style={{ whiteSpace: 'nowrap', margin: 0 }}>{degSatir.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>}
          <Metin y={736} x={34} fs={12} lh={16} agirlik={600} renk="ink3" className="tek-satir">{devir}</Metin>
        </>}
        <Dugme tur="ikincil" ton="altin" yukseklik={46} fs={14.5} style={{ top: K ? 770 : 620 }} onClick={() => setDers(true)}>Dersleri gör</Dugme>
        {silindi != null && <span className="hap silindi-hap" role="status" style={{ top: 92 }}>{silindi} dosya silindi.</span>}
      </Sahne>
      <AltSayfa acik={menu} kapat={() => setMenu(false)} baslik="Akış menüsü" yukseklik={620} duraklar={['orta']}>
        <AkisMenusu kod={kod} sil={() => { setMenu(false); setSil(true); }} />
      </AltSayfa>
      {sil && <DosyalariSil kod={kod} ad={ad} kapat={() => setSil(false)} bitti={(n) => { setSil(false); setSilindi(n); setTimeout(() => setSilindi(null), 3000); }} />}
      <AltSayfa acik={ders} kapat={() => setDers(false)} baslik="Dersler" yukseklik={300} duraklar={['orta', 'yuksek']}>
        {ders && <DersListesi varlik={d.akis.varlik} />}
      </AltSayfa>
    </>
  );
}

/** Açgözlü çok satır. */
function sar(metin: string, en: number, font: string): string[] {
  const L: string[] = [];
  for (const w of metin.split(' ')) { const s = L.length ? `${L[L.length - 1]} ${w}` : w; if (L.length && genislik(s, font) <= en) L[L.length - 1] = s; else L.push(w); }
  return L;
}
const mb = (b: number) => `${(b / 1e6).toFixed(1).replace('.', ',')} MB`;

const tarihEkAd = (s: string) => ozelEk(s, 'e');

function AkisMenusu({ kod, sil }: { kod: string; sil: () => void }) {
  const q = useQuery({ queryKey: ['dosyalar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/dosyalar`) });
  const n = q.data?.dosyalar?.length ?? 0;
  return (
    <div className="akis-menu-liste">
      <h2 className="gorunmez">Akış menüsü</h2>
      <div className="akis-menu-satir"><b>Dosyalar</b><small>{q.isPending ? '…' : n ? `${n} dosya · ${boyutYaz(q.data.toplam_boyut)}` : 'Dosya yok'}</small></div>
      {n > 0 && <Dugme className="statik" tur="ikincil" ton="mercan" fs={15} ikon={<CopIkon />} onClick={sil}>Bütün dosyaları sil</Dugme>}
    </div>
  );
}

/** I3 · Akışın bütün dosyaları: güçlü onay (ad yazılınca etkin). */
export function DosyalariSil({ kod, ad, kapat, bitti }: { kod: string; ad: string; kapat: () => void; bitti: (n: number) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['dosyalar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/dosyalar`) });
  const [yazi, setYazi] = useState('');
  const L: any[] = q.data?.dosyalar || [];
  const sil = useMutation({
    mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/dosyalari-sil`, {}),
    onSuccess: (r) => { for (const k of [['dosyalar', kod], ['akis', kod]]) void qc.invalidateQueries({ queryKey: k }); bitti(r.silinen ?? L.length); },
  });
  const y0 = 262, P = (y: number) => y - (y0 + 28);
  const eslesti = yazi.trim().toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr');
  return (
    <AltSayfa acik kapat={kapat} baslik="Bütün dosyalar silinsin mi?" yukseklik={y0} duraklar={['orta', 'yuksek']} guclu>
      <form className="karar-panel" style={{ height: 560 }} onSubmit={(e) => { e.preventDefault(); if (eslesti) sil.mutate(); }}>
        <svg aria-hidden width="30" height="30" viewBox="-15 -15 30 30" style={{ position: 'absolute', left: 21, top: P(y0 + 50) - 15, overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: UYARI }} />
        <Metin y={P(y0 + 58)} x={62} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">Bütün dosyalar silinsin mi?</Metin>
        <Metin y={P(y0 + 80)} x={62} fs={13} lh={16} agirlik={600} renk="ink3">{ad} · {L.length} dosya · {boyutYaz(q.data?.toplam_boyut || 0)}</Metin>
        <Metin y={P(y0 + 118)} fs={17} lh={23} serif renk="ink2">Dosyalar geri gelmez; çıktı kayıtları<br />ve geçmiş kalır.</Metin>
        <ul className="sil-liste" style={{ top: P(y0 + 152) }}>
          {L.slice(0, 3).map((x) => <li key={x.id}><span className="sil-glif"><DosyaGlif ad={x.ad} tur={x.tur} /></span><b>{x.ad}</b><small>{mb(x.boyut)}</small></li>)}
          {L.length > 3 && <li className="sil-fazla">+{L.length - 3} dosya</li>}
        </ul>
        <label className="dis-alan" style={{ top: P(y0 + 324) - 21 }}><span className="alan-etiket">Onaylamak için {ad} yaz</span><input className={`alan ${yazi ? 'odakli' : ''}`} value={yazi} onChange={(e) => setYazi(e.target.value)} autoComplete="off" /></label>
        <Dugme type="submit" tur="tehlike" style={{ top: P(y0 + 392) }} disabled={!eslesti} mesgul={sil.isPending} ikonX={110 - 20} kayma={10} ikon={<CopIkon />}>Bütün dosyaları sil</Dugme>
        <Dugme type="button" tur="ikincil" ton="lila" fs={15} style={{ top: P(y0 + 458) }} onClick={kapat}>Vazgeç</Dugme>
        {sil.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 516) }}>{(sil.error as Error).message}</p>}
      </form>
    </AltSayfa>
  );
}

function DersListesi({ varlik }: { varlik?: string | null }) {
  const q = useQuery({ queryKey: ['dersler'], queryFn: () => api.get<any>('/dersler') });
  const L: any[] = (q.data?.dersler || []).filter((x: any) => !varlik || !x.varlik || x.varlik === varlik).slice(0, 8);
  return (
    <section className="ders-liste">
      <h2 className="ders-baslik">Dersler</h2>
      {q.isPending ? <div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div>
        : L.length ? <ul>{L.map((x) => <li key={x.kod}><p>{x.metin}</p><small>{x.durum === 'kesin' ? 'Kesin' : 'Aday'} · {x.kanit_sayi} işte görüldü</small></li>)}</ul>
        : <p className="ders-bos">Bu işten henüz ders çıkmadı.</p>}
    </section>
  );
}
