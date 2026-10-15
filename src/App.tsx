import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { alanSecimi } from './api/istemci';
import { sorguIstemcisi, useBen, useOzet } from './api/sorgular';
import type { Ben } from './api/turler';
import { Baslik } from './bilesen/Baslik';
import { Gok, Gren } from './bilesen/Gok';
import { Kutu, Metin, Sahne } from './bilesen/Sahne';
import { SvgTanimlar } from './bilesen/Svg';
import { Evren } from './ekranlar/evren/Evren';
import { Akislar } from './ekranlar/evren/Akislar';
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
import { Baglanti } from './ekranlar/dis/Baglanti';
import { eslestir, git, useYol } from './yonlendirme';

/** Henüz yapılmamış ekran (geliştirme sırasında). */
function Sirada({ baslik }: { baslik: string }) {
  return (
    <Sahne gok={{ tohum: 17, yildiz: 200 }} etiket={baslik}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={baslik} geri={() => git('/')} /></Kutu>
      <Metin y={112} fs={17} lh={22} serif renk="ink2">Bu ekran sıradaki adımda geliyor.</Metin>
    </Sahne>
  );
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
  if (yol === '/' || yol === '') return <Evren ben={b} />;
  const sr = eslestir('/akis/:kod/soru/:soru', yol);
  if (sr) return <Cevapla key={sr.kod + sr.soru} kod={sr.kod} soru={sr.soru} ben={b.kisi || ''} />;
  const tk = eslestir('/akis/:kod/tekrar/:no', yol);
  if (tk) return <Kalemler key={tk.kod + tk.no} kod={tk.kod} no={Number(tk.no)} ben={b.kisi || ''} />;
  const kr = eslestir('/akis/:kod/karar/:no', yol);
  if (kr) return <Karar key={kr.kod + kr.no} kod={kr.kod} no={Number(kr.no)} ben={b.kisi || ''} />;
  const ad = eslestir('/akis/:kod/adim/:no', yol);
  if (ad) return <Adim key={ad.kod + ad.no} kod={ad.kod} no={Number(ad.no)} ben={b.kisi || ''} />;
  const ak = eslestir('/akis/:kod', yol);
  if (ak) return <Galaksi key={ak.kod} kod={ak.kod} sahip={b.kisi || ''} />;
  if (yol === '/akislar') return <Akislar ben={b} />;
  if (yol === '/yeni') return <Sirada baslik="Yeni iş" />;
  return <Sirada baslik="Devir" />;
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
      </div>
    </QueryClientProvider>
  );
}
