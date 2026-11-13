import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SAHTE } from '../api/ortam';
import { arama } from '../yonlendirme';
import { yorungeHarita } from '../geometri/kol-bayrak';

/**
 * W8 (6 Kas, B3): etkileşimli tanıtım turu. Sayfadaki gerçek öğe ışıkla çevrilir, yanında kısa kart: ne işe yarar ve
 * ne kazandırır. Hedefi sayfada olmayan adım atlanır (masaüstü ve telefon düzeni farklı). Her tur bu cihazda bir kez;
 * Ayarlar'dan yeniden açılabilir. Sahte kipte yalnız ?tur=<ad> ile açılır.
 */
export type TurAdi = 'urun' | 'kurma' | 'harita';
export interface TurAdimi { hedef?: string; baslik: string; metin: string }

const anahtar = (ad: TurAdi) => `devir:tur:${ad}`;
export function turGorulmeli(ad: TurAdi): boolean {
  if (SAHTE) return arama().get('tur') === ad;
  try { return !localStorage.getItem(anahtar(ad)); } catch { return false; }
}
export function turuSifirla() { try { for (const a of ['urun', 'kurma', 'harita'] as TurAdi[]) localStorage.removeItem(anahtar(a)); localStorage.removeItem('devir:tanitim'); } catch { /* yok */ } }

export const TURLAR: Record<TurAdi, TurAdimi[]> = {
  urun: [
    { baslik: 'Devir’e hoş geldin', metin: 'Devir, senin, ekibinin ve AI agent’larının aynı işi birlikte yürüttüğü ortak harita. Kim neyi ne zaman yapacak, tek bakışta. Kısa bir tur atalım.' },
    { hedef: '.alt-gezinme .sekme:nth-of-type(1), .yuzen-gezinme > :nth-child(1)', baslik: 'Evren', metin: 'Bütün işlerin tek ekranda. Her galaksi bir akış; bitmeye yaklaşan merkeze iner, takılan kırmızıyla görünür.' },
    { hedef: '.alt-gezinme .sekme:nth-of-type(2), .yuzen-gezinme > :nth-child(2)', baslik: 'Akışlar', metin: 'İşlerinin listesi. Birini seçince haritası açılır: görevler, sahipleri ve hedef tarihe kalan pay.' },
    { hedef: '.alt-gezinme .sekme:nth-of-type(3), .yuzen-gezinme > :nth-child(3)', baslik: 'Görevler', metin: 'Sende ve ekibinde bekleyen işler zaman şeridinde. Bugün neyi bitirmen gerektiğini buradan görürsün.' },
    { hedef: '.ust-arti, .panel-arti', baslik: 'Yeni iş', metin: 'İşi tek cümleyle anlat. Devir adımları, sahipleri ve sorulması gerekenleri çıkarır; kurmadan önce düzeltirsin.' },
    { hedef: '.ai-dugme', baslik: 'Devir AI', metin: 'Haritaya soru sor ya da güncelle: “Selin’de ne bekliyor?”, “Afişi yarına ertele”. Claude ya da ChatGPT’den de aynısını yapabilirsin.' },
    { hedef: 'button[aria-label^="Pano"]', baslik: 'Pano', metin: 'Senden beklenenler, riskte olanlar ve son değişiklikler tek yerde. Bir şey değişince burada görürsün.' },
    { hedef: 'button[aria-label="Ayarlar"]', baslik: 'Ayarlar', metin: 'Kişiler, agent’ların ve Claude/ChatGPT bağlantıları. Herkesin rengi de buradan seçilir.' },
  ],
  kurma: [
    { hedef: '.taslak-alan', baslik: 'Hedefi ve tarihi yaz', metin: 'Ör. “Aralık sonuna kadar 5 çiftçi daha kazandırmam lazım.” Ne, kim için ve ne zamana kadar: cümle ne kadar netse taslak o kadar iyi.' },
    { hedef: '.taslak-alan ~ button, button[type=submit]', baslik: 'Taslak çıkar', metin: 'Devir adımları, sahiplerini, varsayımlarını ve sorularını çıkarır. Yanlış ya da eksik adımı kurmadan önce düzeltirsin.' },
    { baslik: 'Claude ya da ChatGPT ile', metin: 'Bağlıysa aynı cümleyi sohbette yazabilirsin; Devir taslağı orada da açar, cevaplarını oradan verirsin. Karar ve ödeme adımlarında son söz her zaman sende.' },
    { baslik: 'Elle kurmak', metin: 'Taslağı kurduktan sonra adım ekleyebilir, adını, sahibini ve tarihini değiştirebilirsin. Bir işi agent’a vermek için görevde “AI yapsın”ı aç.' },
  ],
  harita: [
    { hedef: '.harita-gezinme', baslik: 'Akışın haritası', metin: 'Her gezegen bir görev, yol zamanın akışı: merkezden dışa doğru ilerler. Halkanın rengi görevin kimde olduğunu söyler.' },
    { hedef: '.harita-gezinme', baslik: 'Işık ve damla', metin: 'Bitenler beyaz yanar, süren yarı yanık, sırası gelen nabız atar. Gezegenin üstündeki damla hamlenin kimde olduğunu gösterir; seninki büyük ve zıplar. Dokun, görev açılır.' },
    { hedef: '[aria-label^="Kişiler"]', baslik: 'Kişiler', metin: 'Birinin yolunu öne çıkar: kimin neye takıldığını ve sırada ne beklediğini görürsün.' },
    { hedef: '[aria-label="Harita dili"]', baslik: 'Harita dili', metin: 'İşaretlerin anlamı ve bu haritada kaç tane olduğu. Bir satıra dokununca o gezegenler yanıp söner.' },
    { hedef: '.surgu-oynat', baslik: 'Zaman', metin: 'Sürgüyü ileri al, takvimin nasıl ilerleyeceğini gör; geri al, ne olduğunu izle. Oynat düğmesi baştan oynatır.' },
  ],
};

/** Kişi Yörüngeleri haritasının turu (13 Kas, sentez): zaman göstergesi, pencere, hamle düğmesi, kişi şeridi. */
export const YORUNGE_TURU: TurAdimi[] = [
  { hedef: '.ky-svg .igne-tut', baslik: 'Zamanı göstergeden çek', metin: 'Sarı göstergeyi sağa çek: ileriye, sola çek: geriye gidersin. Bir kez dokun: bugüne döner. Harita o anda kimin nerede olduğunu gösterir.' },
  { hedef: '.ky-svg .k-arac .arac-g', baslik: 'Pencere durumu söyler', metin: 'Her kişinin penceresindeki simge ve ışığın rengi durumudur: kırmızı takıldı, kehribar sıra onda, mavi çalışıyor, gri bekliyor, yeşil bitti. Gövdenin rengi ve biçimi kim olduğunu söyler.' },
  { hedef: '.ky-svg .plaka.ben, .ky-svg .plaka', baslik: 'Yuvarlak düğme: yapılacak hamle', metin: 'Görev kartındaki ve bildirimdeki düğmenin aynısı; rengi hamleyi yapacak kişinin. Büyük ve çerçeveli olan senin.' },
  { hedef: '.ky-serit', baslik: 'Bir kişiye dokun, yalnız onu gör', metin: 'Alttaki şeritte herkes şu anki durumuyla durur; dokununca o kişi, agent’ı ve işleri öne çıkar. Oynat düğmesi takvimi baştan oynatır.' },
  { hedef: '[aria-label="Harita dili"]', baslik: 'Harita dili', metin: 'Bütün işaretlerin anlamı ve bu haritada kaç tane olduğu burada.' },
];
const turAdimlari = (ad: TurAdi): TurAdimi[] => (ad === 'harita' && yorungeHarita() ? YORUNGE_TURU : TURLAR[ad]);

type Kutu = { x: number; y: number; w: number; h: number } | null;
const bul = (s?: string): Element | null => {
  if (!s) return null;
  for (const e of Array.from(document.querySelectorAll(s))) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return e; }
  return null;
};

export function Tur({ ad, bitti }: { ad: TurAdi; bitti: () => void }) {
  const [i, setI] = useState(0);
  const [kutu, setKutu] = useState<Kutu>(null);
  const [hazir, setHazir] = useState(false);
  const kart = useRef<HTMLDivElement>(null);
  // hedefi olmayan adım (bu düzende yok) atlanır; hedefsiz adım ortada
  const [adimlar, setAdimlar] = useState<TurAdimi[]>([]);
  useEffect(() => {
    const t = setTimeout(() => { setAdimlar(turAdimlari(ad).filter((a) => !a.hedef || bul(a.hedef))); setHazir(true); }, 600);
    return () => clearTimeout(t);
  }, [ad]);
  const a = adimlar[i];
  const olc = () => {
    const e = bul(a?.hedef);
    if (!e) { setKutu(null); return; }
    const r = e.getBoundingClientRect();
    setKutu({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
  };
  useLayoutEffect(() => { olc(); addEventListener('resize', olc); return () => removeEventListener('resize', olc); }, [a]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { kart.current?.focus(); }, [i, hazir]);
  const kapat = () => { try { localStorage.setItem(anahtar(ad), '1'); } catch { /* yok */ } bitti(); };
  const ileri = () => (i < adimlar.length - 1 ? setI(i + 1) : kapat());
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat();
      if (e.key === 'ArrowRight') ileri();
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    addEventListener('keydown', t); return () => removeEventListener('keydown', t);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!hazir || !a) return null;
  const W = innerWidth, H = innerHeight, KW = Math.min(340, W - 32);
  // kart hedefin altında, yer yoksa üstünde; hedefsizse ortada
  let kx = (W - KW) / 2, ky = H / 2 - 110, ok: 'ust' | 'alt' | null = null;
  if (kutu) {
    kx = Math.max(16, Math.min(W - KW - 16, kutu.x + kutu.w / 2 - KW / 2));
    if (kutu.y + kutu.h + 230 < H) { ky = kutu.y + kutu.h + 14; ok = 'ust'; } else { ky = Math.max(16, kutu.y - 14 - 210); ok = 'alt'; }
    if (kutu.h > H * .5) { ky = Math.min(H - 230, kutu.y + kutu.h * .55); ok = null; }
  }
  return (
    <div className="tur-kok">
      <div className={`tur-isik${kutu ? '' : ' tur-isik-yok'}`} style={kutu ? { left: kutu.x, top: kutu.y, width: kutu.w, height: kutu.h } : undefined} aria-hidden />
      <div ref={kart} className={`tur-kart${ok ? ' ok-' + ok : ''}`} style={{ left: kx, top: ky, width: KW, ['--ok-x' as string]: kutu ? `${Math.max(18, Math.min(KW - 18, kutu.x + kutu.w / 2 - kx))}px` : '50%' }}
        role="dialog" aria-modal="true" aria-labelledby="tur-baslik" aria-describedby="tur-metin" tabIndex={-1}>
        <small className="tur-sayi">{i + 1} / {adimlar.length}</small>
        <h2 id="tur-baslik">{a.baslik}</h2>
        <p id="tur-metin">{a.metin}</p>
        <div className="tur-dugmeler">
          <button type="button" className="tur-gec" onClick={kapat}>{i < adimlar.length - 1 ? 'Turu geç' : 'Kapat'}</button>
          {i > 0 && <button type="button" className="tur-geri" onClick={() => setI(i - 1)}>Geri</button>}
          <button type="button" className="tur-ileri" onClick={ileri}>{i < adimlar.length - 1 ? 'İleri' : 'Başla'}</button>
        </div>
      </div>
    </div>
  );
}

/** Sayfada bir kez açılan tur (görüldüyse hiç çizilmez). */
export function IlkTur({ ad, kosul = true }: { ad: TurAdi; kosul?: boolean }) {
  const [acik, setAcik] = useState(() => turGorulmeli(ad));
  return acik && kosul ? <Tur ad={ad} bitti={() => setAcik(false)} /> : null;
}
