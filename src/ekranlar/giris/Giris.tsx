import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiHatasi } from '../../api/istemci';
import { kimlik } from '../../api/kimlik';
import { oturumDegisti } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { Ikon } from '../../bilesen/Svg';
import { anahtarIkon, bilgiIkon, zarf } from '../../cizim/ekran';
import { planet, ship, sparkle, tower, C } from '../../cizim/ortak.js';

const SON_EPOSTA = 'devir:son-eposta';
export const sonEposta = {
  al: () => { try { return localStorage.getItem(SON_EPOSTA) || ''; } catch { return ''; } },
  koy: (e: string) => { try { localStorage.setItem(SON_EPOSTA, e); } catch { /* yok */ } },
};
export const epostaGecerli = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const BEKLEME = 60;

// A1 süsleri (son-ekranlar-1.js → A1)
const A1_CIZIM =
  `<ellipse cx="195" cy="300" rx="190" ry="170" fill="url(#bloom)" opacity=".55"/>` +
  planet(78, 200, 13, 'lit', { life: false }) + planet(318, 236, 10, 'dark', { life: false }) + planet(300, 150, 7, 'wait', { waitRings: 1 }) +
  ship(96, 330, -12, 'insan', 'B', C.peach, .9) + ship(296, 352, 8, 'agent', 'C', C.lilac, .85) +
  tower(195, 372, 1.45, true) +
  `<path d="M120,382 Q195,400 270,382" stroke="#FFC9A3" stroke-opacity=".35" fill="none"/>` +
  `<line x1="40" y1="700" x2="160" y2="700" stroke="#4B4380"/><line x1="230" y1="700" x2="350" y2="700" stroke="#4B4380"/>`;

// A1b süsleri (son-090.js → A1b)
const A1B_CIZIM =
  `<ellipse cx="195" cy="280" rx="190" ry="150" fill="url(#bloom)" opacity=".5"/>` +
  `<path d="M40,360 Q110,250 195,282" fill="none" stroke="#FFD27A" stroke-width="1.6" stroke-dasharray="2 6" opacity=".7"/>` +
  ship(52, 372, -40, 'insan', 'B', C.peach, .9, { flame: false }) +
  zarf(200, 276, 1.15) + sparkle(256, 232, 7, '#FFF1D6', 1) + sparkle(140, 222, 5, '#FFF1D6', 1) + sparkle(270, 320, 4, '#FFE7A8', 1);

/** E-posta alanı: etiket üstte (taban y − 8), alan 48 px. */
export function EpostaAlani({ y, deger, degis, hata, odak }: { y: number; deger: string; degis: (v: string) => void; hata?: string | null; odak?: boolean }) {
  return (
    <>
      <Metin y={y - 8} x={22} fs={12} agirlik={600} renk="ink3" as="label" style={{ right: 'auto' }}>
        <span id="eposta-etiket">E-posta</span>
      </Metin>
      <Kutu y={y}>
        <input
          className="alan" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          aria-labelledby="eposta-etiket" placeholder="E-posta adresin" value={deger} autoFocus={odak}
          aria-invalid={hata ? true : undefined} aria-describedby={hata ? 'eposta-hata' : undefined}
          onChange={(e) => degis(e.target.value)}
        />
      </Kutu>
      {hata && <Metin y={y - 8} x={368} fs={12} agirlik={600} renk="mercan" hiza="sag" id="eposta-hata" style={{ left: 'auto' }}><span role="alert">{hata}</span></Metin>}
    </>
  );
}

/** "Anahtarla gir": dv_… alınır, GET /ben ile doğrulanır. */
export function AnahtarSayfasi({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const [deger, setDeger] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const gir = async (e: FormEvent) => {
    e.preventDefault();
    const a = deger.trim();
    if (!/^dv_\S{6,}$/.test(a)) { setHata('Anahtar dv_ ile başlar.'); return; }
    setMesgul(true); setHata(null);
    kimlik.anahtarlaGir(a);
    try {
      await api.get('/ben');
      oturumDegisti();
      kapat();
    } catch (er) {
      kimlik.anahtarlaGir('');
      await kimlik.cikis();
      setHata(er instanceof ApiHatasi ? er.hata : 'Şu an bağlanılamadı. Yeniden dene.');
    } finally { setMesgul(false); }
  };
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="Anahtarla gir" yukseklik={420} kirli={!!deger}>
      <form className="sayfa-form" onSubmit={gir}>
        <h2 className="t-sayfa-basligi">Anahtarla gir</h2>
        <label className="alan-etiket" htmlFor="anahtar">Devir anahtarı</label>
        <input id="anahtar" className="alan alan-es" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="dv_…"
          value={deger} onChange={(e) => setDeger(e.target.value)} aria-invalid={hata ? true : undefined} aria-describedby={hata ? 'anahtar-hata' : undefined} />
        {hata && <p id="anahtar-hata" className="alan-hata" role="alert">{hata}</p>}
        <Dugme type="submit" mesgul={mesgul} style={{ marginTop: 20 }}>Gir</Dugme>
      </form>
    </AltSayfa>
  );
}

function sayac(sn: number) { return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`; }

/** Girişten sonra açılacak yol (OAuth onayı): e-posta bağlantısı başka tarayıcıda açılırsa adresteki ?sonra= taşır, aynı tarayıcıda bu da yeter. */
export const girisSonrasi = {
  koy(yol: string) { try { localStorage.setItem('devir:giris-sonrasi', yol); } catch { /* gizli pencere */ } },
  al(adres: string | null): string {
    let y = adres;
    try { y ||= localStorage.getItem('devir:giris-sonrasi'); localStorage.removeItem('devir:giris-sonrasi'); } catch { /* gizli pencere */ }
    // yalnız uygulama içi yol (açık yönlendirme olmasın)
    return y && y.startsWith('/') && !y.startsWith('//') ? y : '/';
  },
};

/** A1 · Giriş ve A1b · E-postanı kontrol et. sonra: girişten sonra açılacak uygulama içi yol */
export function Giris({ sonra }: { sonra?: string } = {}) {
  const [eposta, setEposta] = useState(sonEposta.al);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [gonderildi, setGonderildi] = useState<number | null>(null);
  const [anahtar, setAnahtar] = useState(false);
  const [kalan, setKalan] = useState(0);

  useEffect(() => {
    if (gonderildi == null) return;
    const t = () => setKalan(Math.max(0, BEKLEME - Math.floor((Date.now() - gonderildi) / 1000)));
    t();
    const i = window.setInterval(t, 1000);
    return () => clearInterval(i);
  }, [gonderildi]);

  const gonder = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!epostaGecerli(eposta)) { setHata('E-posta adresi eksik görünüyor.'); return; }
    setHata(null); setMesgul(true);
    const temiz = eposta.trim().toLowerCase();
    sonEposta.koy(temiz);
    if (sonra) girisSonrasi.koy(sonra);
    await kimlik.girisBaglantisi(temiz, sonra);
    setMesgul(false);
    setGonderildi(Date.now());
  };

  if (gonderildi != null) {
    return (
      <Sahne gok={{ tohum: 7, yildiz: 300, parilti: 6 }} cizim={A1B_CIZIM} etiket="E-postanı kontrol et" ortala>
        <Metin y={438} fs={30} lh={36} serif agirlik={700} hiza="orta" as="h1">E-postanı kontrol et</Metin>
        <Metin y={476} fs={17} lh={23} serif renk="ink2" hiza="orta" style={{ padding: '0 16px' }}>
          Giriş bağlantısını <span className="kirilmaz">{eposta.trim().toLowerCase()}</span><br />adresine gönderdik.
        </Metin>
        <Kutu y={532} h={58} className="kart bilgi-karti">
          <Ikon svg={bilgiIkon()} w={18} />
          <span>Bağlantıyı bu cihazda aç; 1 saat geçerli.</span>
        </Kutu>
        <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: 614 }} disabled={kalan > 0} onClick={() => gonder()}>
          {kalan > 0 ? `Yeniden gönder · ${sayac(kalan)}` : 'Yeniden gönder'}
        </Dugme>
        <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: 676 }} onClick={() => setGonderildi(null)}>Başka e-posta</Dugme>
      </Sahne>
    );
  }

  return (
    <Sahne gok={{ tohum: 7, yildiz: 320, parilti: 6 }} cizim={A1_CIZIM} etiket="Giriş" ortala>
      <Metin y={448} fs={36} lh={44} serif agirlik={700} hiza="orta" as="h1">Devir</Metin>
      <Metin y={480} fs={17} lh={23} serif renk="ink2" hiza="orta">İşler kimde, ne zaman biter; tek bakışta.</Metin>
      <form onSubmit={gonder} noValidate>
        <EpostaAlani y={548} deger={eposta} degis={(v) => { setEposta(v); if (hata) setHata(null); }} hata={hata} />
        <Dugme type="submit" mesgul={mesgul} style={{ top: 612 }}>Giriş bağlantısı gönder</Dugme>
      </form>
      <Metin y={704} fs={12} agirlik={600} renk="ink3" hiza="orta" as="div">ya da</Metin>
      <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={15} style={{ top: 722 }} ikon={<Ikon svg={anahtarIkon()} />} ikonX={98} onClick={() => setAnahtar(true)}>
        Anahtarla gir
      </Dugme>
      <Metin y={800} fs={12} renk="ink3" hiza="orta">Şifre yok; giriş bağlantısı e-postana gelir.</Metin>
      <AnahtarSayfasi acik={anahtar} kapat={() => setAnahtar(false)} />
    </Sahne>
  );
}
