import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { sorguIstemcisi, useOzet } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { f, galaxy, pill, ship, sparkle, tower } from '../../cizim/ortak.js';
import { sarSatir } from '../../metin/turkce';
import { git } from '../../yonlendirme';

const CX = 195, CY = 318;
/** Yörüngedeki rozet açıları (tasarım H1; 7'den fazlası sürer). */
const ACI = [-170, -125, -85, -45, -5, 35, 145, 110, 70, -210];
const GOK = { tohum: 89, yildiz: 280, parilti: 4 };

type Soru = { kod: string; soru: string; tip: string; secenekler?: { deger: string; etiket: string }[] | null; varsayilan?: unknown };
type Varsayim = { metin: string; boyut: string | null; soru?: Soru; cevap?: string };

/** Varsayım rozeti: boyutuna göre biçim (karar bayrak, kısıt kilit, sonuç kule, dış gemi, öteki yıldız). */
function rozet(b: string | null, x: number, y: number): string {
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="#150E33" stroke="#FFD27A" stroke-opacity=".6"/>`;
  if (b === 'karar') s += `<g transform="translate(${f(x - 2)},${f(y + 6)})"><rect x="-.6" y="-12" width="1.2" height="12" fill="#FFF1E0"/><path d="M.6,-12 L7,-9.6 L.6,-7.2Z" fill="#FFD27A"/></g>`;
  else if (b === 'kisit' || b === 'kapi') s += `<g transform="translate(${f(x)},${f(y)})"><rect x="-5" y="-2" width="10" height="8" rx="2" fill="#FFD27A"/><path d="M-3,-2 L-3,-4 A3,3 0 0 1 3,-4 L3,-2" fill="none" stroke="#FFD27A" stroke-width="1.5"/></g>`;
  else if (b === 'sonuc') s += tower(x, y + 7, .14, true);
  else if (b === 'dis') s += ship(x, y + 2, 0, 'dis', '', '#FFC9A3', .45);
  else s += sparkle(x, y, 6, '#FFE7A8', 1);
  return s;
}
const rozetYeri = (i: number) => { const a = ACI[i % ACI.length] * Math.PI / 180; return [CX + Math.cos(a) * 150, CY + Math.sin(a) * 100]; };

/** Doğmamış galaksi: 13 tohum, kesik koza; yükleniyorken nabız atar. */
function koza(n: number, rozetler: (string | null)[], nabiz: boolean): string {
  let s = `<g class="${nabiz ? 'koza-nabiz' : ''}"><ellipse cx="${CX}" cy="${CY}" rx="150" ry="110" fill="url(#glowLilac)" opacity=".7"/>`;
  s += `<ellipse cx="${CX}" cy="${CY}" rx="96" ry="68" fill="#B9A6F2" fill-opacity=".07" stroke="#D9CCFF" stroke-width="1.2" stroke-dasharray="2 5" transform="rotate(-12 ${CX} ${CY})"/>`;
  s += galaxy(CX, CY, Array.from({ length: n }, () => ({ state: 'dark' })), { scale: 1.25, seed: 13, rot: -12, pr: 4 });
  s += sparkle(CX, CY, 10, '#FFF1D6', 1) + '</g>';
  rozetler.slice(0, ACI.length).forEach((b, i) => { const [x, y] = rozetYeri(i); s += rozet(b, x, y); });
  if (rozetler.length) s += pill(CX, CY + 118, `${rozetler.length} varsayım`, { fs: 12, fw: 650, stroke: '#FFD27A', col: '#FFE6B0' });
  return s;
}

/** /yeni · Cümleyi yaz, taslak çıkar; yarım kalan taslaklara dön. */
export function YeniIs() {
  const [cumle, setCumle] = useState('');
  const ozet = useOzet();
  const tasla = useMutation({
    mutationFn: () => api.post<any>('/tasla', { cumle: cumle.trim() }),
    onSuccess: (r) => { void sorguIstemcisi.invalidateQueries({ queryKey: ['ozet'] }); if (r.taslak?.kod) { sorguIstemcisi.setQueryData(['taslak', r.taslak.kod], r.taslak); git(`/yeni/${r.taslak.kod}`); } },
  });
  const yarim: any[] = (ozet.data?.taslaklar || []).slice(0, 3);
  const bekliyor = tasla.isPending;
  const satirlar = sarSatir(`“${cumle.trim()}”`, 320, 'italic 18.5px Caladea');
  return (
    <Sahne gok={GOK} cizim={bekliyor ? koza(13, [], true) : ''} etiket="Yeni iş">
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Yeni iş" geri={() => (history.length > 1 ? history.back() : git('/'))} /></Kutu>
      {bekliyor ? <>
        <Metin y={122} x={24} fs={18.5} lh={24} serif className="taslak-cumle">{satirlar.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
        <Metin y={500} fs={17} lh={22} serif renk="ink2" hiza="orta" as="p" style={{ left: 20, right: 20 }}>Adımlar ve sorular çıkarılıyor.</Metin>
      </> : <form onSubmit={(e) => { e.preventDefault(); if (cumle.trim().length > 5) tasla.mutate(); }}>
        <Metin y={112} fs={17} lh={22} serif renk="ink2">Ne yapman lazım? Tek cümle yeter.</Metin>
        <label className="dis-alan" style={{ top: 132 }}>
          <span className="gorunmez">İş cümlesi</span>
          <textarea className="alan taslak-alan" rows={4} value={cumle} onChange={(e) => setCumle(e.target.value)} placeholder="Ör. Aralık sonuna kadar 5 çiftçi daha kazandırmam lazım." />
        </label>
        <Dugme type="submit" style={{ top: 268 }} disabled={cumle.trim().length < 6} fs={16}>Taslak çıkar</Dugme>
        {tasla.isError && <p className="canli-hata" role="alert" style={{ top: 330 }}>{(tasla.error as Error).message}</p>}
        {yarim.length > 0 && <>
          <Metin y={396} fs={12} lh={16} agirlik={700} renk="ink3" style={{ letterSpacing: '.6px' }}>YARIM KALAN TASLAKLAR</Metin>
          <ul className="taslak-liste" style={{ top: 410 }}>
            {yarim.map((t) => <li key={t.kod}><button type="button" onClick={() => git(`/yeni/${t.kod}`)}><b>{t.varlik || t.baslik || t.kod}</b><small>{t.soru_sayisi} soru · {t.adim_sayisi} adım</small></button></li>)}
          </ul>
        </>}
      </form>}
    </Sahne>
  );
}

/** H1 · Taslak soruları: cümle, koza + varsayım rozetleri, soru kartı, "Akışı kur" (§5 H1). */
export function TaslakSorulari({ kod }: { kod: string }) {
  const q = useQuery({ queryKey: ['taslak', kod], queryFn: () => api.get<any>(`/taslak/${encodeURIComponent(kod)}`) });
  const t = q.data;
  const [cevap, setCevap] = useState<Record<string, string>>({});
  const [ek, setEk] = useState<Soru[]>([]);
  const [sira, setSira] = useState(0);
  const [acik, setAcik] = useState<number | null>(null);
  const [metin, setMetin] = useState('');
  const V: Varsayim[] = useMemo(() => !t ? [] : [
    ...(t.varsayim_metinleri || []).map((v: any) => ({ metin: v.metin, boyut: v.boyut })),
    ...(t.varsayimlar || []).filter((v: any) => !ek.some((e) => e.kod === v.kod)).map((v: any) => ({ metin: v.soru, boyut: v.boyut || 'girdi', cevap: v.secenekler?.find((o: any) => String(o.deger) === String(v.cevap))?.etiket || v.cevap, soru: { kod: v.kod, soru: v.soru, tip: v.tip || 'secim', secenekler: v.secenekler } })),
  ], [t, ek]);
  const S: Soru[] = useMemo(() => [...(t?.sorular || []), ...ek], [t, ek]);
  const [vazgec, setVazgec] = useState(false);
  const [ayni, setAyni] = useState<AyniVarlik | null>(null);
  const tazele = () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['ozet'] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['akislar'] }); };
  const kur = useMutation({
    mutationFn: (onay?: boolean) => api.post<any>(`/taslak/${encodeURIComponent(kod)}/kur`, { cevaplar: cevap, ...(onay ? { ayni_varlik_onay: true } : {}) }),
    onSuccess: (r) => { setAyni(null); tazele(); git(r.akis?.kod ? `/akis/${encodeURIComponent(r.akis.kod)}` : '/'); },
    onError: (e) => setAyni(ayniVarlik(e)),
  });
  const cizim = useMemo(() => (t ? koza(Math.max(1, (t.adimlar || []).length), V.map((v) => v.boyut), false) : koza(13, [], true)), [t, V]);
  const geri = () => (history.length > 1 ? history.back() : git('/'));
  if (!t) return <Sahne gok={GOK} cizim={cizim} etiket="Yeni iş"><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Yeni iş" geri={geri} /></Kutu>{q.isError && <Metin y={500} fs={17} lh={22} serif renk="ink2" hiza="orta">{(q.error as Error).message}</Metin>}</Sahne>;
  if (t.durum !== 'acik') return <Sahne gok={GOK} cizim={cizim} etiket="Yeni iş"><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Yeni iş" geri={geri} /></Kutu><Metin y={500} fs={17} lh={22} serif renk="ink2" hiza="orta" as="p">{t.durum === 'iptal' ? 'Bu taslaktan vazgeçildi.' : 'Bu taslaktan akış kuruldu.'}</Metin></Sahne>;
  const satirlar = sarSatir(`“${String(t.cumle).trim().replace(/'/g, '’')}”`, 320, 'italic 18.5px Caladea').slice(0, t.motor?.yedek ? 3 : 4); // yedek motor etiketi rozetlere binmesin
  const hepsi = S.every((s) => cevap[s.kod] != null && cevap[s.kod] !== '');
  const i = Math.min(sira, Math.max(0, S.length - 1)), s = S[i];
  const sec = s?.secenekler?.length ? s.secenekler : null;
  const kartH = sec ? 140 + sec.length * 60 + 2 : 262, qy = 738 - kartH;
  const yaz = (k: string, v: string) => {
    const yeni = { ...cevap, [k]: v }; setCevap(yeni);
    const sonraki = S.findIndex((x, j) => j > i && (yeni[x.kod] == null || yeni[x.kod] === ''));
    const bos = sonraki >= 0 ? sonraki : S.findIndex((x) => yeni[x.kod] == null || yeni[x.kod] === '');
    if (bos >= 0) setTimeout(() => { setSira(bos); setMetin(''); }, 220);
  };
  const soruSatir = s ? sarSatir(s.soru.replace(/'/g, '’'), 300, '19.5px Caladea').slice(0, 3) : [];
  const vA = acik != null ? V[acik] : null;
  return (
    <>
      <Sahne gok={GOK} cizim={cizim + (s ? `<rect x="16" y="${qy}" width="358" height="${kartH}" rx="28" fill="url(#sheet)" stroke="#FFC9A3" stroke-opacity=".35"/>` : '')} etiket="Yeni iş">
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Yeni iş" geri={geri} sag={<button type="button" className="satir-eylem mercan baslik-eylem" onClick={() => setVazgec(true)}>Vazgeç</button>} /></Kutu>
        <Metin y={122} x={24} fs={18.5} lh={24} serif className="taslak-cumle" as="blockquote" style={{ margin: 0 }}>{satirlar.map((x, j) => <span key={j}>{j ? <br /> : null}{x}</span>)}</Metin>
        {V.slice(0, ACI.length).map((v, j) => { const [x, y] = rozetYeri(j); return <button key={j} type="button" className="varsayim-rozet" style={{ left: x - 22, top: y - 22 }} aria-label={`Varsayım: ${v.metin}`} onClick={() => setAcik(j)} />; })}
        {t.motor?.yedek && <Metin y={122 + satirlar.length * 24 + 8} x={24} fs={11.5} lh={20} as="p"><span className="hap hap-yedek" title={`Taslak yedek motorla (${t.motor.ad}) üretildi; birincil motor yanıt vermedi. Birincil dönünce aynı cümleyle yeniden taslak çıkarılabilir.`}>Yedek motor</span></Metin>}
        {S.length > 0 && s && <section aria-label="Taslak soruları">
          <div className="taslak-noktalar" style={{ top: qy + 26 - 11 }} role="tablist">
            {S.map((x, j) => <button key={x.kod} type="button" role="tab" aria-selected={j === i} aria-label={`${j + 1}. soru${cevap[x.kod] != null ? ', cevaplandı' : ''}`} className={`${j === i ? 'secili' : ''} ${cevap[x.kod] != null ? 'dolu' : ''}`} onClick={() => setSira(j)}><i /></button>)}
          </div>
          <Metin y={qy + 66} fs={19.5} lh={25} serif hiza="orta" as="h2" style={{ whiteSpace: 'nowrap' }}>{soruSatir.map((x, j) => <span key={j}>{j ? <br /> : null}{x}</span>)}</Metin>
          {sec ? sec.map((o, j) => (
            <Dugme key={o.deger} type="button" tur="ikincil" ton={j ? 'lila' : 'altin'} yukseklik={50} fs={15} aria-pressed={cevap[s.kod] === String(o.deger)} className={`taslak-secenek ${cevap[s.kod] === String(o.deger) ? 'secili' : ''}`} style={{ top: qy + 112 + j * 60, left: 36, right: 36 }} onClick={() => yaz(s.kod, String(o.deger))}>{o.etiket}</Dugme>
          )) : <form onSubmit={(e) => { e.preventDefault(); if (metin.trim()) yaz(s.kod, metin.trim()); }}>
            <input className="alan taslak-girdi" style={{ top: qy + 112 }} type={s.tip === 'tarih' ? 'date' : s.tip === 'sayi' ? 'number' : 'text'} value={metin || (cevap[s.kod] ?? '')} onChange={(e) => setMetin(e.target.value)} aria-label={s.soru} />
            <Dugme type="submit" tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: qy + 172, left: 36, right: 36 }} disabled={!metin.trim()}>Tamam</Dugme>
          </form>}
        </section>}
        <Dugme style={{ top: 756 }} yukseklik={50} fs={16} disabled={!hepsi} mesgul={kur.isPending} onClick={() => kur.mutate(false)}>Akışı kur</Dugme>
        {kur.isError && !ayniVarlik(kur.error) && <p className="canli-hata" role="alert" style={{ top: 812 }}>{(kur.error as Error).message}</p>}
      </Sahne>
      <AltSayfa acik={vA != null} kapat={() => setAcik(null)} baslik="Varsayım" yukseklik={520} duraklar={['orta']}>
        {vA && <div className="karar-panel" style={{ height: 300 }}>
          <Metin y={24} fs={12} lh={16} agirlik={700} renk="ink3" style={{ letterSpacing: '.6px' }}>VARSAYIM</Metin>
          <Metin y={56} fs={18} lh={24} serif as="p">{vA.soru ? <>{vA.metin} <b className="varsayim-cevap">{vA.cevap}</b></> : vA.metin}</Metin>
          {vA.soru ? <Dugme tur="ikincil" ton="mercan" fs={15} style={{ top: 168 }} onClick={() => { setEk([...ek, vA.soru!]); setSira(S.length); setAcik(null); }}>Bu yanlış, sor</Dugme>
            : <Dugme tur="ikincil" ton="lila" fs={15} style={{ top: 168 }} onClick={() => setAcik(null)}>Tamam</Dugme>}
        </div>}
      </AltSayfa>
      {vazgec && <TaslakVazgec kod={kod} kapat={() => setVazgec(false)} bitti={() => { tazele(); git('/'); }} />}
      {ayni && <AyniVarlikOnay a={ayni} kapat={() => setAyni(null)} mesgul={kur.isPending} kur={() => kur.mutate(true)} />}
    </>
  );
}

/** Sunucunun "aynı varlık için son 24 saatte kurulmuş aktif akış" 409'u (P1-B, J2LU): var olan akışlar. */
interface AyniVarlik { varlik: string; akislar: { kod: string; baslik: string }[] }
export function ayniVarlik(e: unknown): AyniVarlik | null {
  if (!(e instanceof ApiHatasi) || e.durum !== 409) return null;
  const m = /^(.*) için son 24 saatte kurulmuş aktif akış var: (.*?)\. Aynı iş olabilir/s.exec(e.message);
  if (!m) return null;
  const akislar = m[2].split('; ').map((x) => { const [kod, ...b] = x.split(' · '); return { kod: kod.trim(), baslik: b.join(' · ').trim() }; }).filter((x) => x.kod);
  return { varlik: m[1], akislar };
}

function AyniVarlikOnay({ a, kapat, kur, mesgul }: { a: AyniVarlik; kapat: () => void; kur: () => void; mesgul: boolean }) {
  const y0 = 470, P = (y: number) => y - (y0 + 28), ilk = a.akislar[0];
  return (
    <AltSayfa acik kapat={kapat} baslik="Aynı iş olabilir" yukseklik={y0} duraklar={['orta']}>
      <div className="karar-panel" style={{ height: 350 }}>
        <Metin y={P(y0 + 58)} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">Aynı iş olabilir</Metin>
        <Metin y={P(y0 + 96)} fs={17} lh={22} serif renk="ink2" as="p" style={{ right: 24 }}>{a.varlik} için son 24 saatte kurulmuş akış var: {a.akislar.map((x, j) => <span key={x.kod}>{j ? '; ' : ''}<b>{x.kod}</b> {x.baslik}</span>)}.</Metin>
        {ilk && <Dugme tur="ikincil" ton="lila" fs={15} yukseklik={48} style={{ top: P(y0 + 178) }} onClick={() => { kapat(); git(`/akis/${encodeURIComponent(ilk.kod)}`); }}>Var olan akışa git</Dugme>}
        <Dugme tur="ikincil" ton="altin" fs={15} yukseklik={48} style={{ top: P(y0 + 238) }} mesgul={mesgul} onClick={kur}>Ayrı iş, yine de kur</Dugme>
      </div>
    </AltSayfa>
  );
}

function TaslakVazgec({ kod, kapat, bitti }: { kod: string; kapat: () => void; bitti: () => void }) {
  const m = useMutation({ mutationFn: () => api.post<any>(`/taslak/${encodeURIComponent(kod)}/iptal`, {}), onSuccess: () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['taslak', kod] }); bitti(); } });
  const y0 = 560, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik="Taslaktan vazgeçilsin mi?" yukseklik={y0} duraklar={['orta']} guclu>
      <div className="karar-panel" style={{ height: 260 }}>
        <Metin y={P(y0 + 58)} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">Taslaktan vazgeçilsin mi?</Metin>
        <Metin y={P(y0 + 96)} fs={17} lh={22} serif renk="ink2">Akış kurulmaz; taslak listeden düşer.</Metin>
        <Dugme tur="tehlike" style={{ top: P(y0 + 122) }} mesgul={m.isPending} onClick={() => m.mutate()}>Taslaktan vazgeç</Dugme>
        <Dugme tur="ikincil" ton="lila" fs={15} yukseklik={48} style={{ top: P(y0 + 188) }} onClick={kapat}>Kalsın</Dugme>
        {m.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 242) }}>{(m.error as Error).message}</p>}
      </div>
    </AltSayfa>
  );
}
