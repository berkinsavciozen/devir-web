import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { kimlik } from '../../api/kimlik';
import { oturumDegisti } from '../../api/sorgular';
import { Dugme } from '../../bilesen/Dugme';
import { Metin, Sahne } from '../../bilesen/Sahne';
import { zarf } from '../../cizim/ekran';
import { f, tower } from '../../cizim/ortak.js';
import { git, arama, TABAN } from '../../yonlendirme';
import { AnahtarSayfasi, EpostaAlani, epostaGecerli, Giris, sonEposta } from './Giris';

// A1c süsleri: dönen altın yay ayrı katmanda (1.2 sn'de bir tur)
const A1C_CIZIM =
  `<ellipse cx="195" cy="360" rx="200" ry="200" fill="url(#bloom)" opacity=".55"/>` +
  `<circle cx="195" cy="330" r="92" fill="none" stroke="#FFD27A" stroke-width="2" stroke-dasharray="10 8" opacity=".75"/>` +
  `<circle cx="195" cy="330" r="72" fill="none" stroke="#B9A6F2" stroke-width="1.4" stroke-dasharray="3 6" opacity=".8"/>` +
  `<g class="donen-yay"><path d="M195,238 A92,92 0 0 1 287,330" fill="none" stroke="#FFE6B0" stroke-width="4" stroke-linecap="round"/></g>` +
  tower(195, 372, 1.25, true);

// A1d süsleri: sönük zarf, kesik yörünge
function a1dCizim() {
  let s = `<rect width="390" height="844" fill="#07051A" opacity=".25"/>`;
  s += `<circle cx="195" cy="280" r="96" fill="url(#glowLilac)" opacity=".7"/>`;
  for (let i = 0; i < 6; i++) {
    const a0 = i * 60 + 8, a1 = a0 + 34, r = 78, p = (a: number) => [195 + Math.cos(a * Math.PI / 180) * r, 280 + Math.sin(a * Math.PI / 180) * r * .5];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    s += `<path d="M${f(x0)},${f(y0)} A${r},${r * .5} 0 0 1 ${f(x1)},${f(y1)}" fill="none" stroke="#8E80D6" stroke-width="1.6" stroke-dasharray="3 4" opacity="${i % 2 ? .4 : .8}"/>`;
  }
  s += zarf(195, 280, .8, '#3A3170') + `<path d="M171,262 L219,298" stroke="#FF8A78" stroke-width="2.4" stroke-linecap="round"/>`;
  return s;
}
const A1D_CIZIM = a1dCizim();

/** Adresten ?code= / ?error_code= (Supabase PKCE dönüşü; hata bazen # içinde gelir). */
function donusOku() {
  const q = arama(), h = new URLSearchParams(location.hash.slice(1));
  return { kod: q.get('code'), hata: q.get('error_code') || h.get('error_code') || q.get('error') || h.get('error') };
}

type Hal = { tur: 'aciliyor' } | { tur: 'gecersiz' } | { tur: 'ag' } | { tur: 'giris' };
const SINIR = 8000;

/** /giris dönüşü: A1c (açılıyor) → yönlendirme; A1d (geçersiz ya da ağ hatası). */
export function GirisDonus() {
  const [hal, setHal] = useState<Hal>(() => {
    const d = donusOku();
    return d.kod ? { tur: 'aciliyor' } : d.hata ? { tur: 'gecersiz' } : { tur: 'giris' };
  });
  const [eposta, setEposta] = useState(sonEposta.al);
  const kod = useRef(donusOku().kod);

  const ac = useCallback(async () => {
    if (!kod.current) { setHal({ tur: 'gecersiz' }); return; }
    setHal({ tur: 'aciliyor' });
    const sure = new Promise<never>((_, red) => setTimeout(() => red(new Error('sure')), SINIR));
    try {
      const r = await Promise.race([kimlik.kodDegistir(kod.current), sure]);
      if (r.eposta) sonEposta.koy(r.eposta);
      kod.current = null;
      oturumDegisti();
      git('/', { yerine: true });
    } catch (e) {
      const m = (e as Error).message || '';
      setHal(/sure|fetch|network|ağ/i.test(m) ? { tur: 'ag' } : { tur: 'gecersiz' });
    }
  }, []);

  useEffect(() => { if (hal.tur === 'aciliyor') void ac(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (hal.tur === 'giris') return <Giris />;
  if (hal.tur === 'aciliyor') {
    return (
      <Sahne gok={{ tohum: 7, yildiz: 300, parilti: 4 }} cizim={A1C_CIZIM} etiket="Giriş yapılıyor" ortala>
        <Metin y={482} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">Giriş yapılıyor</Metin>
        <Metin y={512} fs={14} agirlik={550} renk="ink3" hiza="orta">{eposta}</Metin>
        <div className="nokta-nabzi" style={{ top: 544 }} role="status" aria-label="Giriş yapılıyor"><i /><i /><i /></div>
      </Sahne>
    );
  }
  return <BaglantiGecersiz ag={hal.tur === 'ag'} eposta={eposta} setEposta={setEposta} yeniden={ac} />;
}

function BaglantiGecersiz({ ag, eposta, setEposta, yeniden }: { ag: boolean; eposta: string; setEposta: (v: string) => void; yeniden: () => void }) {
  const [hata, setHata] = useState<string | null>(null);
  const [anahtar, setAnahtar] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const gonder = async (e: FormEvent) => {
    e.preventDefault();
    if (ag) { yeniden(); return; }
    if (!epostaGecerli(eposta)) { setHata('E-posta adresi eksik görünüyor.'); return; }
    setMesgul(true);
    sonEposta.koy(eposta.trim().toLowerCase());
    await kimlik.girisBaglantisi(eposta.trim().toLowerCase());
    setMesgul(false);
    setGonderildi(true);
  };
  if (gonderildi) { history.replaceState(null, '', TABAN + '/'); return <Giris />; }
  return (
    <Sahne gok={{ tohum: 13, yildiz: 200, parilti: 2 }} cizim={A1D_CIZIM} etiket="Giriş bağlantısı" ortala>
      <Metin y={420} fs={27} lh={33} serif agirlik={700} hiza="orta" as="h1">{ag ? 'Şu an açılamadı' : 'Bağlantının süresi dolmuş'}</Metin>
      <Metin y={456} fs={17} lh={23} serif renk="ink2" hiza="orta">
        {ag ? <>Bağlantı kurulamadı;<br />biraz sonra yeniden dene.</> : <>Giriş bağlantısı bir kez ve 1 saat<br />içinde açılır; yenisini gönderelim.</>}
      </Metin>
      <form onSubmit={gonder} noValidate>
        <EpostaAlani y={540} deger={eposta} degis={(v) => { setEposta(v); setHata(null); }} hata={hata} />
        <Dugme type="submit" mesgul={mesgul} style={{ top: 608 }}>{ag ? 'Yeniden dene' : 'Yeni bağlantı gönder'}</Dugme>
      </form>
      <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={15} style={{ top: 676 }} onClick={() => setAnahtar(true)}>Anahtarla gir</Dugme>
      <AnahtarSayfasi acik={anahtar} kapat={() => { setAnahtar(false); git('/', { yerine: true }); }} />
    </Sahne>
  );
}
