import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { alanSecimi } from './api/istemci';
import { sorguIstemcisi, useBen, useOzet } from './api/sorgular';
import type { Ben } from './api/turler';
import { Baslik } from './bilesen/Baslik';
import { Gok, Gren } from './bilesen/Gok';
import { Kutu, Metin, Sahne } from './bilesen/Sahne';
import { SvgTanimlar } from './bilesen/Svg';
import { Dugme } from './bilesen/Dugme';
import { planet } from './cizim/ortak.js';
import { Evren } from './ekranlar/evren/Evren';
import { Akislar } from './ekranlar/evren/Akislar';
import { Arsiv } from './ekranlar/evren/Arsiv';
import { ClaudeaBagla } from './ekranlar/evren/ClaudeaBagla';
import { DavetKabul, DavetYok } from './ekranlar/giris/Davet';
import { Giris } from './ekranlar/giris/Giris';
import { GirisDonus } from './ekranlar/giris/GirisDonus';
import { Iskelet } from './ekranlar/Iskelet';
import { Galaksi } from './ekranlar/akis/Galaksi';
import { Adim } from './ekranlar/akis/Adim';
import { Karar } from './ekranlar/akis/Karar';
import { Kalemler } from './ekranlar/akis/Kalemler';
import { Cevapla } from './ekranlar/akis/Cevapla';
import { AkisBilgi, KisiSayfasi } from './ekranlar/akis/Bilgi';
import { Baglanti } from './ekranlar/dis/Baglanti';
import { TaslakSorulari, YeniIs } from './ekranlar/yeni/Taslak';
import { HesapSayfasi } from './ekranlar/hesap/Hesap';
import { Bildirimler } from './ekranlar/bildirimler/Bildirimler';
import { Gorevler } from './ekranlar/gorevler/Gorevler';
import { Tanitim, tanitimGorulmeli } from './ekranlar/evren/Tanitim';
import { Ayarlar } from './ekranlar/hesap/Ayarlar';
import { Ekip } from './ekranlar/hesap/Ekip';
import { OrnekMenusu } from './bilesen/OrnekMenusu';
import { eslestir, git, useYol, arama } from './yonlendirme';

/** Henüz yapılmamış ekran (geliştirme sırasında). */
/** Bilinmeyen adres (404, CELISKILER 66): kullanıcı dilinde tek cümle ve evrene dönüş. */
function Bulunamadi() {
  const cizim = `<circle cx="195" cy="330" r="90" fill="url(#glowLilac)" opacity=".6"/>` + planet(195, 330, 26, 'ghost', { life: false }) + planet(262, 286, 7, 'dark', { life: false }) + planet(136, 372, 5, 'dark', { life: false });
  return (
    <Sahne gok={{ tohum: 17, yildiz: 200 }} cizim={cizim} etiket="Sayfa bulunamadı">
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Bu sayfa yok" geri={() => git('/')} /></Kutu>
      <Metin y={112} fs={17} lh={22} serif renk="ink2" as="p">Adres değişmiş ya da eksik yazılmış olabilir.</Metin>
      <Dugme style={{ top: 470 }} fs={16} onClick={() => git('/', { yerine: true })}>Evrene dön</Dugme>
    </Sahne>
  );
}

/** İlk açılışta bir kez üç kartlık tanıtım (evrenin üstünde). */
function IlkTanitim() {
  const [acik, setAcik] = useState(tanitimGorulmeli);
  return acik ? <Tanitim bitti={() => setAcik(false)} /> : null;
}

/** Yüklenirken gök hemen çizilir; beyaz boş ekran yok (§3.21). */
const Yukleniyor = () => <Gok tohum={21} yildiz={330} />;

function Uygulama({ yol }: { yol: string }) {
  const ben = useBen();
  useEffect(() => {
    const d = () => void sorguIstemcisi.invalidateQueries({ queryKey: ['ben'] });
    window.addEventListener('devir:giris-gerekli', d);
    return () => window.removeEventListener('devir:giris-gerekli', d);
  }, []);
  // birden çok alanda: son seçilen yoksa sunucunun seçtiği alan hatırlanır
  useEffect(() => { const id = ben.data?.calisma_alani?.id; if (id && !alanSecimi.al()) alanSecimi.koy(id); }, [ben.data]);

  if (ben.isPending) return <Yukleniyor />;
  if (ben.isError && !ben.data) return <Giris />;
  const b = ben.data;
  if (!b) return <Giris />;
  if (b.kayit_gerekli) return b.bekleyen_davetler?.length ? <DavetKabul ben={b} /> : <DavetYok ben={b} yenile={() => void ben.refetch()} yenileniyor={ben.isFetching} />;
  if (yol === '/bagla') return <ClaudeaBagla ben={b} />;
  if (yol === '/' || yol === '') return <><Evren ben={b} /><IlkTanitim /></>;
  if (yol === '/hesap') return <><Evren ben={b} /><HesapSayfasi kapat={() => git('/', { yerine: true })} /></>;
  if (yol === '/ayarlar') return <Ayarlar />;
  if (yol === '/ayarlar/ekip') return <Ekip />;
  const sr = eslestir('/akis/:kod/soru/:soru', yol);
  if (sr) return <Cevapla key={sr.kod + sr.soru} kod={sr.kod} soru={sr.soru} ben={b.kisi || ''} />;
  const tk = eslestir('/akis/:kod/tekrar/:no', yol);
  if (tk) return <Kalemler key={tk.kod + tk.no} kod={tk.kod} no={Number(tk.no)} ben={b.kisi || ''} />;
  const bl = eslestir('/akis/:kod/bilgi', yol);
  if (bl) return <AkisBilgi key={bl.kod} kod={bl.kod} ben={b.kisi || ''} />;
  const ks = eslestir('/akis/:kod/kisi/:ad', yol);
  if (ks) return <KisiSayfasi key={ks.kod + ks.ad} kod={ks.kod} ad={ks.ad} ben={b.kisi || ''} />;
  const kr = eslestir('/akis/:kod/karar/:no', yol);
  if (kr) return <Karar key={kr.kod + kr.no} kod={kr.kod} no={Number(kr.no)} ben={b.kisi || ''} />;
  const ad = eslestir('/akis/:kod/adim/:no', yol);
  // tablet yatay ve masaüstünde adım haritanın yanındaki panelde açılır; ?tam=1 tam ayrıntı (geçmiş, çıktılar)
  if (ad && innerWidth >= 1024 && innerHeight >= 600 && !arama().has('tam')) return <Galaksi key={ad.kod} kod={ad.kod} sahip={b.kisi || ''} secim={Number(ad.no)} />;
  // adımlar arası geçişte sayfa yerinde kalır (geçmiş kaydı büyümez); içerik numarayla yenilenir
  if (ad) return <Adim key={ad.kod} kod={ad.kod} no={Number(ad.no)} ben={b.kisi || ''} />;
  const ak = eslestir('/akis/:kod', yol);
  if (ak) return <Galaksi key={ak.kod} kod={ak.kod} sahip={b.kisi || ''} />;
  if (yol === '/akislar') return <Akislar ben={b} />;
  if (yol === '/gorevler') return <Gorevler ben={b} />;
  if (yol === '/bildirimler') return <Bildirimler ben={b} />;
  if (yol === '/bana') return <Yonlen yol={'/gorevler' + (arama().toString() ? '?' + arama().toString() : '')} />;
  if (yol === '/akislar/arsiv') return <Arsiv ben={b} />;
  if (yol === '/yeni') return <YeniIs />;
  const ty = eslestir('/yeni/:kod', yol);
  if (ty) return <TaslakSorulari key={ty.kod} kod={ty.kod} />;
  return <Bulunamadi />;
}

/** Eski adres → yeni adres (geçmiş kaydı büyümez). */
function Yonlen({ yol }: { yol: string }) {
  useEffect(() => git(yol, { yerine: true }), [yol]);
  return null;
}

export function App() {
  const yol = useYol();
  let ekran;
  if (yol === '/_iskelet') ekran = <><Gok tohum={21} yildiz={330} /><Iskelet /></>;
  else if (yol === '/giris') ekran = <GirisDonus />;
  else if (eslestir('/l/:token', yol)) ekran = <Baglanti token={eslestir('/l/:token', yol)!.token} />;
  else ekran = <Uygulama yol={yol} />;
  return (
    <QueryClientProvider client={sorguIstemcisi}>
      <div className="uygulama">
        <SvgTanimlar />
        {ekran}
        <Gren />
        {import.meta.env.VITE_HASH === '1' && <OrnekMenusu />}
      </div>
    </QueryClientProvider>
  );
}
