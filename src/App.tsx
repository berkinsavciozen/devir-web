import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { alanSecimi } from './api/istemci';
import { sorguIstemcisi, useBen, useOzet } from './api/sorgular';
import type { Ben } from './api/turler';
import { Baslik } from './bilesen/Baslik';
import { Gok, Gren, useBoyut } from './bilesen/Gok';
import { Kabuk, masaustu, type KabukSekme } from './bilesen/Kabuk';
import { Kutu, Metin, Sahne } from './bilesen/Sahne';
import { SvgTanimlar } from './bilesen/Svg';
import { Dugme } from './bilesen/Dugme';
import { planet } from './cizim/ortak.js';
import { Evren } from './ekranlar/evren/Evren';
import { Akislar } from './ekranlar/evren/Akislar';
import { Arsiv } from './ekranlar/evren/Arsiv';
import { ClaudeaBagla } from './ekranlar/evren/ClaudeaBagla';
import { DavetKabul, DavetYok, Katil } from './ekranlar/giris/Davet';
import { Giris } from './ekranlar/giris/Giris';
import { GirisDonus } from './ekranlar/giris/GirisDonus';
import { OauthOnay } from './ekranlar/giris/OauthOnay';
import { Iskelet } from './ekranlar/Iskelet';
import { Galaksi } from './ekranlar/akis/Galaksi';
import { Adim } from './ekranlar/akis/Adim';
import { Kalemler } from './ekranlar/akis/Kalemler';
import { Cevapla } from './ekranlar/akis/Cevapla';
import { AkisBilgi, KisiSayfasi } from './ekranlar/akis/Bilgi';
import { Baglanti } from './ekranlar/dis/Baglanti';
import { TaslakSorulari, YeniIs } from './ekranlar/yeni/Taslak';
import { Bildirimler } from './ekranlar/bildirimler/Bildirimler';
import { Gorevler, GorevlerSol } from './ekranlar/gorevler/Gorevler';
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
  const boy = useBoyut();
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
  // masaüstü kabuğu (N13): sayfa sağdaki panelde, solda evren; telefonda sayfanın kendisi
  const genis = masaustu(boy.w, boy.h);
  const panel = (sayfa: JSX.Element, konum: string, o: { aktif?: KabukSekme; serbest?: boolean; geri?: string } = {}) =>
    genis ? <Evren ben={b} panel={sayfa} konum={konum} aktif={o.aktif ?? null} serbest={o.serbest} geri={o.geri ? () => git(o.geri!) : undefined} /> : sayfa;
  if (yol === '/bagla') return panel(<ClaudeaBagla ben={b} />, 'Claude’a bağla', { geri: '/ayarlar' });
  if (yol === '/' || yol === '') return <><Evren ben={b} /><IlkTanitim /></>;
  if (yol === '/hesap') return <Yonlen yol="/ayarlar?bolum=ben" />;
  if (yol === '/ayarlar') return panel(<Ayarlar />, 'Ayarlar', { geri: '/' });
  if (yol === '/ayarlar/ekip') return panel(<Ekip />, 'Ayarlar › Ekip');
  const sr = eslestir('/akis/:kod/soru/:soru', yol);
  if (sr) return panel(<Cevapla key={sr.kod + sr.soru} kod={sr.kod} soru={sr.soru} ben={b.kisi || ''} />, 'Akış › Soru');
  const tk = eslestir('/akis/:kod/tekrar/:no', yol);
  if (tk) return panel(<Kalemler key={tk.kod + tk.no} kod={tk.kod} no={Number(tk.no)} ben={b.kisi || ''} />, 'Akış › Kalemler');
  const bl = eslestir('/akis/:kod/bilgi', yol);
  if (bl) return panel(<AkisBilgi key={bl.kod} kod={bl.kod} ben={b.kisi || ''} />, 'Akış › Bilgi');
  const oz = eslestir('/akis/:kod/onizleme/:id', yol);
  if (oz) return <Baglanti key={oz.id} token="" onizleme={{ id: oz.id, kod: oz.kod }} />;
  const ks = eslestir('/akis/:kod/kisi/:ad', yol);
  if (ks) return panel(<KisiSayfasi key={ks.kod + ks.ad} kod={ks.kod} ad={ks.ad} ben={b.kisi || ''} />, 'Akış › Kişi');
  const kr = eslestir('/akis/:kod/karar/:no', yol);
  // ayrı karar sayfası kalktı (W2): karar, görev detayının bir bölümü
  if (kr) return <Yonlen yol={`/akis/${encodeURIComponent(kr.kod)}/adim/${kr.no}${location.search}`} />;
  const ad = eslestir('/akis/:kod/adim/:no', yol);
  // eski ?tam=1 (ayrı tam sayfa) kalktı: aynı detay, adres sadeleşir
  // (yalnız sorgu değişir; yol aynı kaldığı için yönlendirme yerine adres yerinde sadeleşir)
  if (ad && arama().has('tam')) { const q = arama(); q.delete('tam'); history.replaceState(history.state, '', yol + (q.toString() ? '?' + q : '')); }
  // tablet yatay ve masaüstünde görev haritanın yanındaki panelde açılır (tek görev detayı)
  if (ad && genis) return <Galaksi key={ad.kod} kod={ad.kod} sahip={b.kisi || ''} secim={Number(ad.no)} />;
  // adımlar arası geçişte sayfa yerinde kalır (geçmiş kaydı büyümez); içerik numarayla yenilenir
  if (ad) return <Adim key={ad.kod} kod={ad.kod} no={Number(ad.no)} ben={b.kisi || ''} />;
  const ak = eslestir('/akis/:kod', yol);
  if (ak) return <Galaksi key={ak.kod} kod={ak.kod} sahip={b.kisi || ''} />;
  if (yol === '/akislar') return panel(<Akislar ben={b} />, 'Akışlar', { aktif: 'akislar', serbest: true });
  if (yol === '/gorevler') return genis ? <Kabuk sol={<GorevlerSol ben={b} />} aktif="gorevler" konum="Görevler" etiket="Görevler"><Gorevler ben={b} /></Kabuk> : <Gorevler ben={b} />;
  if (yol === '/bildirimler') return panel(<Bildirimler ben={b} />, 'Bildirimler', { geri: '/' });
  if (yol === '/bana') return <Yonlen yol={'/gorevler' + (arama().toString() ? '?' + arama().toString() : '')} />;
  if (yol === '/akislar/arsiv') return panel(<Arsiv ben={b} />, 'Akışlar › Arşiv', { aktif: 'akislar' });
  if (yol === '/yeni') return panel(<YeniIs />, 'Yeni iş');
  const ty = eslestir('/yeni/:kod', yol);
  if (ty) return panel(<TaslakSorulari key={ty.kod} kod={ty.kod} />, 'Yeni iş › Taslak');
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
  else if (yol === '/oauth/onay') ekran = <OauthOnay />;
  // referans bağlantısı (P7, karar 4.B): girişten önce kimin önerdiğini gösterir
  else if (eslestir('/katil/:kod', yol)) ekran = <Katil kod={eslestir('/katil/:kod', yol)!.kod} />;
  // dış bağlantı: belirteç # parçasında (/l#…, N-3); eski /l/<belirteç> biçimi de açılır
  else if (yol === '/l' && location.hash.length > 1) ekran = <Baglanti token={decodeURIComponent(location.hash.slice(1))} />;
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
