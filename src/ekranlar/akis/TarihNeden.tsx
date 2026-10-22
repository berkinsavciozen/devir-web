// "Bu tarih neden?" (P1-A2, MK-5): bitiş aralığının dayanağı. Veri GET /akis/:kod → bitis (yalnız ekip; dış kişiye gelmez).
import { AltSayfa } from '../../bilesen/AltSayfa';
import { aralikMetni, type KararOzeti } from '../../bilesen/KararSeridi';
import { gunAy, kisaAd } from '../../cizim/yol.js';

export interface BitisV {
  en_erken: string | null; aralik: [string, string] | null; guven: 'kesin' | 'tahmin' | 'eksik'; eksik_sure: number;
  varsayimlar: string[]; yuk_uyarilari: { kisi: string; adimlar: number[]; gecikme_gun: number }[];
  adimlar: { no: number; kaynak: 'kullanici' | 'tahmin' | 'gecmis' | 'eksik'; sure_gun: [number, number]; bitis: [string, string] }[];
  zincir: number[];
}

const KAYNAK: Record<BitisV['adimlar'][number]['kaynak'], string> = { kullanici: 'girilen süre', tahmin: 'tahmin', gecmis: 'benzer işlerin gerçek süresi', eksik: 'süre yok' };
const GUVEN: Record<BitisV['guven'], string> = {
  kesin: 'Süreler girildiği gibi; işler planda giderse bu tarih değişmez.',
  tahmin: 'Alt uç her iş tahmini kadar sürerse; üst uç aşağıdaki varsayımlarla.',
  eksik: 'Süresi girilmemiş adım var; kesin tarih verilemez.',
};
const gun = (x: number) => String(x).replace('.', ',');
const sure = ([a, b]: [number, number]) => (a === b ? `${gun(a)} gün` : `${gun(a)}–${gun(b)} gün`);
const tarih = (t: string) => gunAy(Date.parse(t + 'T12:00:00+03:00'));

export function hedefSatiri(oz: KararOzeti | null | undefined): string | null {
  const h = oz?.hedef;
  if (!h) return null;
  if (h.durum === 'pay') return `Hedef ${tarih(h.tarih)}: üst uca göre ${h.pay_gun} gün pay.`;
  if (h.durum === 'riskte') return `Hedef ${tarih(h.tarih)} aralığın içinde: işler uzarsa kaçabilir.`;
  return `Hedef ${tarih(h.tarih)}: en erken tarih bile geçiyor.`;
}

/** Panelin içeriği (alt sayfadan ayrı, test edilebilir). */
export function TarihNedenIcerik({ b, oz, adimlar, adimaGit }: { b: BitisV; oz?: KararOzeti | null; adimlar: any[]; adimaGit?: (no: number) => void }) {
  const by = new Map<number, any>(adimlar.map((a) => [a.no, a]));
  const ad = new Map(b.adimlar.map((x) => [x.no, x]));
  const zincir = b.zincir.filter((no) => ad.has(no));
  const yukKisi = new Set(b.yuk_uyarilari.map((y) => y.kisi));
  const hs = hedefSatiri(oz);
  return (
    <div className="tarih-neden">
      <h2>Bu tarih neden?</h2>
      {b.aralik ? <p className="tn-aralik">{b.aralik[0] === b.aralik[1] ? 'Bitiş' : 'En erken'} {aralikMetni(b.aralik)}</p> : <p className="tn-aralik">Tarih yok</p>}
      <p className="tn-not">{GUVEN[b.guven]}</p>
      {hs && <p className="tn-not">{hs}</p>}
      {b.varsayimlar.length > 0 && <>
        <h3>Varsayımlar</h3>
        <ul>{b.varsayimlar.map((v) => <li key={v} className={[...yukKisi].some((k) => v.startsWith(k + ' ')) ? 'tn-yuk' : undefined}>{v}</li>)}</ul>
      </>}
      {zincir.length > 0 && <>
        <h3>Üst ucu belirleyen adımlar</h3>
        <ol>{zincir.map((no) => {
          const x = ad.get(no)!, a = by.get(no);
          const alt = [a?.sahip ? kisaAd(a.sahip) : null, sure(x.sure_gun), KAYNAK[x.kaynak], `en geç ${tarih(x.bitis[1])}`].filter(Boolean).join(' · ');
          return <li key={no}><i>{no}</i><span>{a?.ad || `${no}. adım`}<small>{alt}</small></span></li>;
        })}</ol>
      </>}
      {oz?.hamle && <>
        <h3>Sıradaki hamle</h3>
        <ul><li>{adimaGit ? <button type="button" className="metin-baglanti" onClick={() => adimaGit(oz.hamle!.no)}>{oz.hamle.ad}</button> : oz.hamle.ad}<small>{kisaAd(oz.hamle.sahip)} · {oz.hamle.neden}</small></li></ul>
      </>}
    </div>
  );
}

export function TarihNeden({ acik, kapat, d, adimaGit }: { acik: boolean; kapat: () => void; d: any; adimaGit?: (no: number) => void }) {
  if (!d?.bitis) return null;
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="Bu tarih neden?" yukseklik={150} duraklar={[150]}>
      <TarihNedenIcerik b={d.bitis} oz={d.akis?.karar_ozeti} adimlar={d.adimlar || []} adimaGit={adimaGit && ((no) => { kapat(); adimaGit(no); })} />
    </AltSayfa>
  );
}
