import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi, alanSecimi, istek } from '../../api/istemci';
import { kimlik } from '../../api/kimlik';
import { oturumDegisti } from '../../api/sorgular';
import type { Ben, Davet, Rol } from '../../api/turler';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { Ikon } from '../../bilesen/Svg';
import { bilgiIkon, logoIsaret } from '../../cizim/ekran';
import { planet, ship, C } from '../../cizim/ortak.js';
import { git } from '../../yonlendirme';

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const gunAy = (iso: string) => { const d = new Date(Date.parse(iso) + 3 * 36e5); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };

const ROL: Record<Rol, { ad: string; alt: string; cumle: string }> = {
  dis: { ad: 'Dış katılımcı', alt: 'yalnız kendi adımlarını görür', cumle: 'Kendi adımlarını buradan yürüteceksin.' },
  ekip: { ad: 'Ekip', alt: 'bütün akışları görür', cumle: 'Ekibin bütün akışlarını görürsün.' },
  sahip: { ad: 'Sahip', alt: 'alanı ve ekibi yönetir', cumle: 'Çalışma alanını sen yöneteceksin.' },
};

/** Üst satır: logo + oturumdaki e-posta hapı (A4, A5). */
function UstSatir({ eposta }: { eposta?: string }) {
  return (
    <>
      <Kutu x={17} y={45} w={26} h={26} aria-hidden><Ikon svg={logoIsaret()} w={26} /></Kutu>
      <Metin y={63} x={52} fs={14} agirlik={700} style={{ right: 'auto' }}>Devir</Metin>
      {eposta && <span className="hap hap-eposta" style={{ top: 49, right: 24 }}>{eposta}</span>}
    </>
  );
}

const cikisYap = async () => { await kimlik.cikis(); alanSecimi.koy(null); oturumDegisti(); git('/', { yerine: true }); };

const A4_CIZIM =
  `<circle cx="195" cy="250" r="120" fill="url(#bloom)" opacity=".6"/>` +
  `<path d="M86,300 Q140,226 195,236 Q250,226 304,290" fill="none" stroke="#FFD27A" stroke-width="1.4" stroke-dasharray="2 6" opacity=".7"/>` +
  planet(195, 236, 34, 'lit', {}) + ship(96, 296, -38, 'insan', 'B', C.peach, 1.05, { flame: false }) + ship(296, 286, 0, 'dis', '', '#F2B8D8', 1.1);

/** A4 · Davet kabulü. POST /kayit {davet, kisi} → katildi → evren. */
export function DavetKabul({ ben }: { ben: Ben }) {
  const davetler = ben.bekleyen_davetler || [];
  const [secili, setSecili] = useState<Davet>(davetler[0]);
  const [ad, setAd] = useState(secili?.kisi || '');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const qc = useQueryClient();
  const d = secili;
  const rol = ROL[d.rol] || ROL.ekip;
  const coklu = davetler.length > 1;

  const katil = async (e: FormEvent) => {
    e.preventDefault();
    setMesgul(true); setHata(null);
    try {
      const r = await api.post<{ katildi: { alan_id: string } }>('/kayit', { davet: d.id, kisi: ad.trim() || undefined });
      alanSecimi.koy(r.katildi.alan_id);
      await qc.invalidateQueries();
      git('/', { yerine: true });
    } catch (er) {
      setHata(er instanceof ApiHatasi ? er.hata : 'Şu an bağlanılamadı. Yeniden dene.');
    } finally { setMesgul(false); }
  };

  const satir = (y: number, et: string, deger: string, alt?: string) => (
    <>
      <Metin y={y} x={40} fs={11.5} agirlik={700} renk="ink3" style={{ letterSpacing: '.5px', right: 'auto' }}>{et}</Metin>
      <Metin y={y} x={140} fs={14.5} agirlik={650} style={{ right: 40, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deger}</Metin>
      {alt && <Metin y={y + 18} x={140} fs={12} renk="ink3">{alt}</Metin>}
    </>
  );

  return (
    <Sahne gok={{ tohum: 19, yildiz: 280, parilti: 6, bulutsu: [[195, 260, 260, 'neb1']] }} cizim={A4_CIZIM} etiket="Davet" ortala>
      <UstSatir eposta={ben.eposta} />
      <Metin y={358} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">{d.davet_eden ? `${d.davet_eden} seni davet etti` : 'Davetin var'}</Metin>
      <Metin y={392} fs={17} lh={23} serif renk="ink2" hiza="orta">{rol.cumle}</Metin>
      {coklu ? (
        <Kutu y={412} role="radiogroup" aria-label="Davetler" className="davet-secenekleri">
          {davetler.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === d.id} className={`secenek ${x.id === d.id ? 'secili' : ''}`}
              onClick={() => { setSecili(x); setAd(x.kisi || ad); }}>
              <span className="secenek-daire" aria-hidden />
              <span className="secenek-metin"><b>{x.alan || 'Çalışma alanı'}</b><small>{(ROL[x.rol] || ROL.ekip).ad} · {x.davet_eden || ''} · {gunAy(x.tarih)}</small></span>
            </button>
          ))}
        </Kutu>
      ) : (
        <>
          <Kutu y={420} h={150} className="kart" style={{ boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--renk-vurgu-seftali) 30%, transparent)' }} />
          {satir(452, 'ALAN', d.alan || 'Çalışma alanı')}
          <Kutu x={40} y={469.5} h={1} className="ayirici" style={{ right: 40 }} />
          {satir(496, 'ROL', rol.ad, rol.alt)}
          <Kutu x={40} y={531.5} h={1} className="ayirici" style={{ right: 40 }} />
          {satir(556, 'DAVET', `${d.davet_eden || 'Devir'} · ${gunAy(d.tarih)}`)}
        </>
      )}
      <form onSubmit={katil}>
        <Metin y={602} x={22} fs={12} agirlik={600} renk="ink3" as="label" style={{ right: 'auto' }}><span id="ad-etiket">Adın</span></Metin>
        {hata && <Metin y={602} x={368} fs={12} agirlik={600} renk="mercan" hiza="sag" style={{ left: 'auto' }}><span role="alert">{hata}</span></Metin>}
        <Kutu y={610}><input className="alan" aria-labelledby="ad-etiket" autoComplete="name" value={ad} onChange={(e) => setAd(e.target.value)} style={{ fontSize: 15 }} /></Kutu>
        <Dugme type="submit" mesgul={mesgul} yukseklik={56} fs={17} style={{ top: 680 }}>Katıl</Dugme>
      </form>
      <Kutu y={739} h={44} as="button" className="metin-dugme" onClick={cikisYap}>Başka e-postayla gir</Kutu>
    </Sahne>
  );
}

const A5_CIZIM =
  `<circle cx="195" cy="270" r="110" fill="url(#glowLilac)" opacity=".75"/>` +
  `<ellipse cx="195" cy="270" rx="96" ry="38" fill="none" stroke="#8E80D6" stroke-width="1.4" stroke-dasharray="3 6" transform="rotate(-14 195 270)"/>` +
  planet(195, 270, 26, 'dark', { life: false }) + ship(108, 300, -20, 'dis', '', '#F2B8D8', .95);

const yerelAd = (e?: string) => { const x = (e || '').split('@')[0].split(/[._-]/)[0]; return x ? x[0].toLocaleUpperCase('tr') + x.slice(1) : ''; };

/** Referans bağlantısıyla gelinen kod (/katil/KOD): girişten sonra kayıtta kullanılır, alan açılınca silinir. */
const REFERANS = 'devir:referans';
export const referansSecimi = {
  al(): string | null { try { return localStorage.getItem(REFERANS); } catch { return null; } },
  koy(kod: string | null) { try { if (kod) localStorage.setItem(REFERANS, kod); else localStorage.removeItem(REFERANS); } catch { /* yok */ } },
};

/** Referans sayfası (/katil/KOD, karar 4.B): kimin önerdiği; devam edince giriş, sonra katılım isteği. */
export function Katil({ kod }: { kod: string }) {
  const q = useQuery({ queryKey: ['referans-bilgi', kod], queryFn: () => istek<any>('GET', `/api/v1/referans/${encodeURIComponent(kod)}`, undefined, { kimliksiz: true }), retry: false });
  const devam = () => { referansSecimi.koy(kod.toUpperCase()); git('/', { yerine: true }); };
  return (
    <Sahne gok={{ tohum: 23, yildiz: 220, parilti: 2 }} cizim={A4_CIZIM} etiket="Devir'e katıl" ortala>
      <UstSatir />
      {q.isError ? <>
        <Metin y={400} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">Bu bağlantı geçerli değil</Metin>
        <Metin y={436} fs={17} lh={23} serif renk="ink2" hiza="orta">Seni öneren kişiden bağlantıyı<br />yeniden göndermesini iste.</Metin>
        <Dugme style={{ top: 520 }} onClick={() => git('/', { yerine: true })}>Devir’e git</Dugme>
      </> : <>
        <Metin y={400} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">{q.data?.davet_eden ? `${q.data.davet_eden} seni Devir’e çağırdı` : 'Devir’e katıl'}</Metin>
        <Metin y={436} fs={17} lh={23} serif renk="ink2" hiza="orta">Ekibinle ve AI agent’larınla<br />aynı işi tek kayıtta yürüt.</Metin>
        <Kutu y={494} h={58} className="kart bilgi-karti">
          <Ikon svg={bilgiIkon()} w={18} />
          <span>{q.data?.acik_kayit ? 'E-postanla giriş yapınca kendi alanını açarsın.' : 'E-postanla giriş yap; onaylanınca kendi alanını açarsın.'}</span>
        </Kutu>
        <Dugme mesgul={q.isPending} style={{ top: 580 }} onClick={devam}>Devam et</Dugme>
      </>}
    </Sahne>
  );
}

/** Referansla gelen, açık kayıt kapalıyken: adını yazar, katılım ister; istek onay listesine düşer. */
function KatilimIste({ ben, kod, yenile }: { ben: Ben; kod: string; yenile: () => void }) {
  const [ad, setAd] = useState(() => yerelAd(ben.eposta));
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const iste = async (e: FormEvent) => {
    e.preventDefault();
    if (!ad.trim()) { setHata('Adını yaz.'); return; }
    setMesgul(true); setHata(null);
    try {
      const r = await api.post<any>('/kayit', { referans: kod, kisi: ad.trim() });
      if (r.acildi) { referansSecimi.koy(null); alanSecimi.koy(r.acildi.alan_id); }
      yenile();
    } catch (er) {
      if (er instanceof ApiHatasi && er.durum === 404) referansSecimi.koy(null);
      setHata(er instanceof ApiHatasi ? er.hata : 'Şu an bağlanılamadı. Yeniden dene.');
    } finally { setMesgul(false); }
  };
  return (
    <Sahne gok={{ tohum: 23, yildiz: 220, parilti: 2 }} cizim={A5_CIZIM} etiket="Katılım iste" ortala>
      <UstSatir eposta={ben.eposta} />
      <Metin y={400} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">Katılım iste</Metin>
      <Metin y={436} fs={17} lh={23} serif renk="ink2" hiza="orta">Devir şimdilik onayla açılıyor;<br />onaylanınca e-posta gelir.</Metin>
      <form onSubmit={iste} noValidate>
        <Metin y={492} x={22} fs={12} agirlik={600} renk="ink3" as="label" style={{ right: 'auto' }}><span id="ad-etiket">Adın</span></Metin>
        {hata && <Metin y={492} x={368} fs={12} agirlik={600} renk="mercan" hiza="sag" style={{ left: 'auto' }}><span role="alert">{hata}</span></Metin>}
        <Kutu y={500}><input className="alan" aria-labelledby="ad-etiket" autoComplete="given-name" value={ad} onChange={(e) => setAd(e.target.value)} /></Kutu>
        <Dugme type="submit" mesgul={mesgul} style={{ top: 580 }}>Katılım iste</Dugme>
      </form>
      <Kutu y={646} h={44} as="button" className="metin-dugme" onClick={cikisYap}>Başka e-postayla gir</Kutu>
    </Sahne>
  );
}

/** İstek onay listesinde: onaylanınca giriş e-postası gelir. */
function OnayBekliyor({ ben, yenile, yenileniyor }: { ben: Ben; yenile: () => void; yenileniyor: boolean }) {
  return (
    <Sahne gok={{ tohum: 23, yildiz: 220, parilti: 2 }} cizim={A5_CIZIM} etiket="Onay bekleniyor" ortala>
      <UstSatir eposta={ben.eposta} />
      <Metin y={400} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">İsteğin alındı</Metin>
      <Metin y={436} fs={17} lh={23} serif renk="ink2" hiza="orta">{ben.bekleme?.tarih ? `${gunAy(ben.bekleme.tarih)} tarihli isteğin` : 'İsteğin'} onay bekliyor;<br />onaylanınca e-posta gelir.</Metin>
      <Kutu y={494} h={58} className="kart bilgi-karti">
        <Ikon svg={bilgiIkon()} w={18} />
        <span>Giriş bağlantısı bu adrese gelir: <span className="kirilmaz">{ben.eposta}</span></span>
      </Kutu>
      <Dugme mesgul={yenileniyor} style={{ top: 580 }} onClick={yenile}>Yeniden dene</Dugme>
      <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: 646 }} onClick={cikisYap}>Başka e-postayla gir</Dugme>
    </Sahne>
  );
}

/** A5 (açık kayıt ya da onaylanmış referans): davetsiz kişi kendi çalışma alanını açar. POST /kayit {alan_adi, kisi} → acildi → boş evren. */
function AlanAc({ ben }: { ben: Ben }) {
  const [ad, setAd] = useState(() => yerelAd(ben.eposta));
  const [alan, setAlan] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const qc = useQueryClient();
  const ac = async (e: FormEvent) => {
    e.preventDefault();
    const kisi = ad.trim(), alanAdi = alan.trim() || `${kisi || yerelAd(ben.eposta)} · çalışma alanı`;
    if (!kisi) { setHata('Adını yaz.'); return; }
    setMesgul(true); setHata(null);
    try {
      const ref = referansSecimi.al();
      const r = await api.post<{ acildi: { alan_id: string } }>('/kayit', { alan_adi: alanAdi, kisi, ...(ref ? { referans: ref } : {}) });
      referansSecimi.koy(null);
      alanSecimi.koy(r.acildi.alan_id);
      await qc.invalidateQueries();
      git('/', { yerine: true });
    } catch (er) {
      setHata(er instanceof ApiHatasi ? er.hata : 'Şu an bağlanılamadı. Yeniden dene.');
    } finally { setMesgul(false); }
  };
  return (
    <Sahne gok={{ tohum: 23, yildiz: 220, parilti: 2 }} cizim={A5_CIZIM} etiket="Çalışma alanını aç" ortala>
      <UstSatir eposta={ben.eposta} />
      <Metin y={400} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">Çalışma alanını aç</Metin>
      <Metin y={436} fs={17} lh={23} serif renk="ink2" hiza="orta">Adını ve alanın adını yaz;<br />ilk akışın burada başlar.</Metin>
      <form onSubmit={ac} noValidate>
        <Metin y={492} x={22} fs={12} agirlik={600} renk="ink3" as="label" style={{ right: 'auto' }}><span id="ad-etiket">Adın</span></Metin>
        {hata && <Metin y={492} x={368} fs={12} agirlik={600} renk="mercan" hiza="sag" style={{ left: 'auto' }}><span role="alert">{hata}</span></Metin>}
        <Kutu y={500}><input className="alan" aria-labelledby="ad-etiket" autoComplete="given-name" value={ad} onChange={(e) => setAd(e.target.value)} /></Kutu>
        <Metin y={572} x={22} fs={12} agirlik={600} renk="ink3" as="label" style={{ right: 'auto' }}><span id="alan-etiket">Çalışma alanı</span></Metin>
        <Kutu y={580}><input className="alan" aria-labelledby="alan-etiket" placeholder={`${ad.trim() || 'Adın'} · çalışma alanı`} value={alan} onChange={(e) => setAlan(e.target.value)} /></Kutu>
        <Dugme type="submit" mesgul={mesgul} style={{ top: 650 }}>Alanı aç</Dugme>
      </form>
      <Kutu y={716} h={44} as="button" className="metin-dugme" onClick={cikisYap}>Başka e-postayla gir</Kutu>
    </Sahne>
  );
}

/** A5 · Bekleyen davet yok. Kayıt açıksa kişi kendi alanını açar; kapalıysa davet ister. */
export function DavetYok({ ben, yenile, yenileniyor }: { ben: Ben; yenile: () => void; yenileniyor: boolean }) {
  // referansla gelen (karar 4.B): onaylanınca ya da açık kayıtta alanını açar; istek bekliyorsa onu söyler
  const ref = referansSecimi.al();
  if (ben.acik_kayit || ben.bekleme?.durum === 'onaylandi') return <AlanAc ben={ben} />;
  if (ben.bekleme?.durum === 'bekliyor') return <OnayBekliyor ben={ben} yenile={yenile} yenileniyor={yenileniyor} />;
  if (ref && !ben.bekleme) return <KatilimIste ben={ben} kod={ref} yenile={yenile} />;
  return (
    <Sahne gok={{ tohum: 23, yildiz: 220, parilti: 2 }} cizim={A5_CIZIM} etiket="Davet yok" ortala>
      <UstSatir eposta={ben.eposta} />
      <Metin y={400} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">Bekleyen davetin yok</Metin>
      <Metin y={436} fs={17} lh={23} serif renk="ink2" hiza="orta">Devir şimdilik davetle açılıyor;<br />ekibinden seni eklemesini iste.</Metin>
      <Kutu y={494} h={58} className="kart bilgi-karti">
        <Ikon svg={bilgiIkon()} w={18} />
        <span>Davet bu e-postaya gelmeli: <span className="kirilmaz">{ben.eposta}</span></span>
      </Kutu>
      <Dugme mesgul={yenileniyor} style={{ top: 580 }} onClick={yenile}>Yeniden dene</Dugme>
      <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: 646 }} onClick={cikisYap}>Başka e-postayla gir</Dugme>
    </Sahne>
  );
}
