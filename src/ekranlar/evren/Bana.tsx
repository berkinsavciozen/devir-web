import { useOzet, useBen } from '../../api/sorgular';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { Metin, Sahne } from '../../bilesen/Sahne';
import { sparkle } from '../../cizim/ortak.js';
import { gunAy } from '../../cizim/yol.js';
import { paySure } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { adimIkon, Liste, type Oge } from '../akis/Bilgi';
import { alanAdi } from '../hesap/Hesap';

// Bana düşenler (/bana): bütün akışlarda kişinin sırası gelmiş, engelli ve süren adımları; taslaklar ve davetler.
// Telefonda dördüncü sekme (denetim planı, CELISKILER 60). Tasarımdaki M2 "Senden beklenen" panelinin tam hali.
const GOK = { tohum: 63, yildiz: 220 };
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const enc = encodeURIComponent;
const taslakIkon = `<g transform="translate(28,29)"><circle r="12" fill="#B9A6F2" fill-opacity=".12" stroke="#D9CCFF" stroke-dasharray="1.5 3"/>${sparkle(0, 0, 5, '#FFF1D6', .95)}</g>`;
const zarfIkon = `<g transform="translate(28,29)"><rect x="-11" y="-8" width="22" height="16" rx="3" fill="#1A1238" stroke="#F2B8D8" stroke-width="1.3"/><path d="M-10,-7 L0,1 L10,-7" fill="none" stroke="#F2B8D8" stroke-width="1.3"/></g>`;

/** "Sende 3 iş sırada; biri engelli." */
export function banaCumlesi(benim: any[]): string {
  const sira = benim.filter((b) => b.durum === 'hazir').length, engel = benim.filter((b) => b.durum === 'engelli').length, suren = benim.filter((b) => b.durum === 'suruyor').length;
  if (!sira && !engel) return suren ? `Sırası gelen yeni iş yok; ${suren} işin sürüyor.` : 'Şu an senden beklenen iş yok.';
  const bas = sira ? `Sende ${sira} iş sırada` : `${engel} işin engelli`;
  return `${bas}${sira && engel ? `; ${engel === 1 ? 'biri' : engel} engelli` : ''}.`;
}

export function BanaDusenler({ ben }: { ben: Ben }) {
  const ozet = useOzet();
  const b = useBen().data as Ben | undefined;
  const benim: any[] = ozet.data?.benim || [];
  const taslaklar: any[] = ozet.data?.taslaklar || [];
  const davetler = b?.bekleyen_davetler || ben.bekleyen_davetler || [];
  const adimSatir = (a: any): Oge => {
    const t = a.son_tarih ? `son ${gunAy(tarihMs(a.son_tarih))}` : a.bekleme_saat ? `${paySure(a.bekleme_saat)} bekliyor` : '';
    return {
      tur: 'satir', key: a.akis + a.no, ikon: adimIkon(a), ust: a.ad,
      alt: [a.akis_baslik, a.durum === 'engelli' ? 'engelli' : a.karar_adimi ? 'karar' : null, t].filter(Boolean).join(' · '),
      etiket: `${a.ad}. ${a.akis_baslik}. ${a.durum === 'engelli' ? 'Engelli.' : a.durum === 'suruyor' ? 'Sürüyor.' : 'Sırası geldi.'}`,
      git: () => git(`/akis/${enc(a.akis)}/${a.karar_adimi ? 'karar' : 'adim'}/${a.no}`),
    };
  };
  const ogeler: Oge[] = [];
  const bolum = (baslik: string, L: Oge[]) => { if (L.length) ogeler.push({ tur: 'baslik', metin: baslik }, ...L); };
  // karar adımları önce; sonra son tarihe göre (sunucu sırası)
  bolum('SIRASI GELEN', benim.filter((a) => a.durum === 'hazir').sort((p, q) => Number(!!q.karar_adimi) - Number(!!p.karar_adimi)).map(adimSatir));
  bolum('ENGELLİ', benim.filter((a) => a.durum === 'engelli').map(adimSatir));
  bolum('SÜRÜYOR', benim.filter((a) => a.durum === 'suruyor').map(adimSatir));
  bolum('TASLAKLAR', taslaklar.map((t) => ({ tur: 'satir', key: 't' + t.kod, ikon: taslakIkon, ust: t.baslik || t.cumle, alt: `${t.soru_sayisi} soru · ${t.adim_sayisi} adım`, etiket: `Taslak: ${t.baslik || t.cumle}. ${t.soru_sayisi} soru bekliyor.`, git: () => git(`/yeni/${enc(t.kod)}`) } as Oge)));
  bolum('DAVETLER', davetler.map((d: any) => ({ tur: 'satir', key: 'd' + d.id, ikon: zarfIkon, ust: alanAdi(d.alan || '', d.davet_eden), alt: `${d.rol === 'dis' ? 'dış' : d.rol}${d.davet_eden ? ` · ${d.davet_eden} davet etti` : ''}`, git: () => git('/hesap') } as Oge)));
  if (!ogeler.length && ozet.data) ogeler.push({ tur: 'not', metin: 'Yeni bir iş açınca senin adımların burada toplanır.' });
  const L = Liste({ y0: 132, ogeler, etiket: 'Bana düşenler' });
  return (
    <Sahne gok={GOK} etiket="Bana düşenler" yukseklik={Math.max(844, L.y + 130)}>
      <Metin y={70} fs={26} serif agirlik={700} as="h1">Bana düşenler</Metin>
      {ozet.data && <Metin y={106} fs={17} lh={22} serif renk="ink2" as="p" className="tek-satir">{banaCumlesi(benim)}</Metin>}
      {L.dugum}
      <AltGezinme aktif="bana" yeni={() => git('/yeni')} />
    </Sahne>
  );
}
