import { describe, expect, it } from 'vitest';
import { uyeRenkleri, ajanSahipleri } from './yol.js';
import { acik, kisiRengi } from './hamle';
import { galaksiSayilari } from '../ekranlar/akis/Lejant';

// Plan 27 Eki, Epic 3: gezegen dili (P4)
const uye = (ad: string, tip = 'insan') => ({ ad, tip });

describe('kişi renkleri (W7, Kimin Hamlesi)', () => {
  it('renk yalnız kişiyi söyler: kayıtlı renk önce, yoksa addan sabit renk; aynı ad her yerde aynı renk', () => {
    const G: any = { uyeler: [uye('Berkin'), uye('Ayşe'), uye('Usta', 'dis')] };
    const r = uyeRenkleri(G, 'Berkin', {}, { Ayşe: '#123456' });
    expect(r.Ayşe).toBe('#123456');
    expect(r.Berkin).toBe(kisiRengi('Berkin'));
    expect(uyeRenkleri(G, 'Ayşe').Berkin).toBe(r.Berkin);
  });
  it('agent sahibinin açık tonunda; sahibi kayıtlı renk seçtiyse ondan', () => {
    const G: any = { uyeler: [uye('Berkin'), uye('Claude', 'agent')] };
    const r = uyeRenkleri(G, 'Berkin', ajanSahipleri([{ sahip: 'Claude', tip: 'agent', agentSahibi: 'Berkin' }]), { Berkin: '#E86FA0' });
    expect(r.Claude).toBe(acik('#E86FA0'));
  });
});

describe('gezegen ışığı (W7)', async () => {
  const { planet } = await import('./ortak.js');
  it('durum beş sabit renkte (13 Kas): bitti yeşil, sürüyor mavi, sırası geldi kehribar, engel kırmızı; sırası gelmemiş renksiz', () => {
    expect(planet(0, 0, 9, 'lit')).toMatch(/pGreen/);
    expect(planet(0, 0, 9, 'run')).toContain('#5AB8FF');
    expect(planet(0, 0, 9, 'wait')).toContain('#FFB547');
    expect(planet(0, 0, 9, 'block')).toContain('#FF5A5A');
    for (const k of ['dark', 'ertele', 'ghost']) expect(planet(0, 0, 9, k, { halka: '#7FC8F8' })).not.toMatch(/pGreen|#5AB8FF|#FFB547|#FF5A5A|#6EE39A/);
  });
  it('halka kişinin renginde; ortakta bölünür; bayrak ve AI rozeti çizilmez', () => {
    expect(planet(0, 0, 9, 'dark', { halka: '#7FC8F8' })).toContain('stroke="#7FC8F8"');
    expect((planet(0, 0, 9, 'dark', { halka: ['#7FC8F8', '#F2D16B'] }).match(/<path d="M[^"]*A/g) || []).length).toBe(2);
    const g = planet(0, 0, 9, 'wait', { karar: true, oto: 'bakilacak' });
    expect(g).not.toContain('#5FE3F0'); expect(g).not.toContain('#FFD27A');
  });
  it('sonuç rozeti: tik, belge, terazi', () => {
    expect(planet(0, 0, 9, 'lit', { sonuc: 'belge' })).toContain('H');
    expect(planet(0, 0, 9, 'lit', { sonuc: 'tik' })).not.toBe(planet(0, 0, 9, 'lit', { sonuc: 'terazi' }));
  });
});

describe('galaksi sayıları', () => {
  const A = [
    { no: 1, durum: 'suruyor' }, { no: 2, durum: 'hazir' }, { no: 3, durum: 'ertelendi' }, { no: 4, durum: 'atlandi' },
    { no: 5, durum: 'tamam', cikti_sayisi: 2 }, { no: 6, durum: 'sirada' }, { no: 7, durum: 'sirada', ust_adim: 6 },
  ];
  it('sürüyor ve sırası geldi ayrı; ertelendi atlandıdan ayrı; kritik yalnız açık ana adım', () => {
    const s = galaksiSayilari(A, { kritik_yol: [1, 5, 6, 7], akis: {} });
    expect(s).toMatchObject({ suruyor: 1, sira: 1, ertele: 1, atlandi: 1, cikti: 1, kritik: 2 });
    expect(s.darbogaz).toBeUndefined();
    expect(galaksiSayilari(A, { akis: { karar_ozeti: { darbogaz: { no: 6 } } } }).darbogaz).toBe(1);
  });
});

describe('P4b işaretleri', async () => {
  const { planet, ship, kapi, yildiz } = await import('./ortak.js');
  const { lejantGezegenleri } = await import('../ekranlar/akis/Lejant');
  it('atlandı üstü çizik; araçlar (13 Kas): ekip roket, agent antenli küp, dış kubbeli disk; gövde kişinin renginde', () => {
    expect(planet(0, 0, 8, 'ghost')).toMatch(/M-4\.59,4\.59 L4\.59,-4\.59/);
    const insan = ship(0, 0, 0, 'insan', 'A', '#8EC5FF'), agent = ship(0, 0, 0, 'agent', 'C', '#B9A6F2'), dis = ship(0, 0, 0, 'dis', '', '#F2B8D8');
    expect(new Set([insan, agent, dis]).size).toBe(3);
    expect(insan).toContain('fill="#8EC5FF"'); expect(agent).toContain('fill="#B9A6F2"'); expect(dis).toContain('fill="#F2B8D8"');
    expect(insan).toContain('>A</text>');
  });
  it('pencere durumu söyler: grup rengi ve simge; durum verilmezse baş harfi', () => {
    const s = (d: string) => ship(0, 0, 0, 'insan', 'A', '#8EC5FF', 1, { durum: d });
    expect(s('engel')).toContain('#FF5A5A'); expect(s('sira')).toContain('#FFB547'); expect(s('karar')).toContain('#FFB547');
    expect(s('calisiyor')).toContain('#5AB8FF'); expect(s('bekliyor')).toContain('#A9C3D6'); expect(s('bitti')).toContain('#6EE39A');
    expect(new Set(['engel', 'karar', 'sira', 'calisiyor', 'bekliyor', 'bitti'].map(s)).size).toBe(6);
    expect(ship(0, 0, 0, 'insan', 'A', '#8EC5FF')).not.toMatch(/#FF5A5A|#FFB547|#5AB8FF|#6EE39A/);
  });
  it('varış kapısı ve merkez yıldızı çizilir', () => {
    expect(kapi(0, 0, 1, false)).toContain('r="22"');
    expect(yildiz(0, 0)).toContain('<path');
  });
  it('lejant satırının gezegenleri yalnız çizilen ana görevler', () => {
    const d = { akis: { karar_ozeti: { darbogaz: { no: 2 } } }, adimlar: [
      { no: 1, durum: 'engelli' }, { no: 2, durum: 'sirada' }, { no: 3, durum: 'engelli', ust_adim: 1 }, { no: 4, durum: 'tamam' },
    ] };
    const G = { gezegen: { 1: { kritik: true, korona: 2 }, 2: { ortak: true }, 4: {} } } as any;
    const L = lejantGezegenleri(d, G);
    expect(L.engel).toEqual([1]);
    expect(L.darbogaz).toEqual([1, 2]);
    expect(L.kritik).toEqual([1]);
    expect(L.ortak).toEqual([2]);
  });
});

// 2 Kas: uydu halkası ve kalem sayıları sunucunun ilerleme kuralıyla (m6); canlı LBKQ'da bir gönderi atlandığı için
// bitmiş 2. adımın halkası 11/12'de kalıyordu
import { uyduSistemi, uydular } from './yol.js';
import { tekrarAsamasi } from '../ekranlar/akis/cumleler';
import { kalemDurumu } from '../ekranlar/evren/Akislar';
describe('uydu sayıları', () => {
  const ks = (...d: string[]) => d.map((durum, i) => ({ ad: 'K' + i, durum, kalem: true }));
  it('atlanan uydu toplamdan düşer; kalanı bitmişse k/n tam', () => {
    expect(uyduSistemi(0, 0, 10, ks('tamam', 'tamam', 'atlandi'))).toContain('>2/2<');
    expect(uyduSistemi(0, 0, 10, ks('tamam', 'suruyor', 'ertelendi'))).toContain('>1/2<');
  });
  it('hepsi atlandıysa sayı yazılmaz', () => {
    expect(uyduSistemi(0, 0, 10, ks('atlandi', 'atlandi'))).not.toMatch(/\d\/\d/);
  });
  it('tekrar aşaması etiketi halkayla aynı sayar', () => {
    const k = (ad: string, d4: string) => ({ ad, adimlar: [{ ust_no: 4, durum: d4 }] });
    const A = tekrarAsamasi({ adimlar: [{ no: 4, ad: 'Yayınla' }], tekrar: [{ adimlar: [4], kalemler: [k('a', 'tamam'), k('b', 'atlandi'), k('c', 'hazir')] }] })!;
    expect([A.k, A.n]).toEqual([1, 2]);
  });
  it('Akışlar kartındaki mini uydular adım durumundan (akış durumundan değil)', () => {
    expect(kalemDurumu({ durum: 'aktif', bitti: true, adimlar: [{ durum: 'tamam' }] })).toBe('tamam');
    expect(kalemDurumu({ durum: 'aktif', bitti: true, adimlar: [{ durum: 'atlandi' }] })).toBe('atlandi');
    expect(kalemDurumu({ durum: 'aktif', bitti: false, asama: { durum: 'engelli' } })).toBe('engelli');
    const s = uydular(0, 0, 3, [{ ad: 'a', durum: 'tamam' }, { ad: 'b', durum: 'atlandi' }]);
    expect(s).toContain('#FFD27A');
  });
});

// 2 Kas durum dili 2: uzak halkada en kötü açık durumun boncuğu; son bakıştan beri değişenler
import { anlik, degisenler, degisimCumlesi } from '../ekranlar/akis/degisim';
describe('durum dili 2', () => {
  it('uydu halkasında en kötü durum boncuğu', () => {
    const ks = (...d: string[]) => d.map((durum, i) => ({ ad: 'K' + i, durum }));
    expect(uyduSistemi(0, 0, 10, ks('tamam', 'suruyor', 'engelli'))).toContain('data-durum="engelli"');
    expect(uyduSistemi(0, 0, 10, ks('tamam', 'suruyor', 'hazir'))).toContain('data-durum="hazir"');
    expect(uyduSistemi(0, 0, 10, ks('tamam', 'sirada'))).not.toContain('uydu-boncuk');
  });
  it('değişen adımlar; alt görev üst gezegende', () => {
    const once = anlik([{ no: 1, durum: 'suruyor' }, { no: 2, durum: 'hazir' }, { no: 5, durum: 'suruyor' }]);
    const ds = degisenler(once, [{ no: 1, durum: 'tamam' }, { no: 2, durum: 'engelli' }, { no: 5, durum: 'tamam', ust_adim: 3 }, { no: 9, durum: 'tamam' }]);
    expect(ds.map((d) => d.gezegen)).toEqual([1, 2, 3]);
    expect(degisimCumlesi(ds)).toBe('Son bakıştan beri: 2 bitti, 1 takıldı');
    expect(degisenler(null, [{ no: 1, durum: 'tamam' }])).toEqual([]);
  });
});

import { akisIlerlemesi } from '../api/ilerleme';
describe('evren sayımı (karar 2 Kas)', () => {
  it('yalnız ana görevler sayılır; alt görevler üst görevin içinde kalır', () => {
    const d = { adimlar: [
      { no: 1, durum: 'tamam' }, { no: 2, durum: 'suruyor' }, { no: 3, durum: 'atlandi' },
      { no: 4, durum: 'tamam', ust_adim: 2 }, { no: 5, durum: 'hazir', ust_adim: 2 }, { no: 6, durum: 'tamam', ust_adim: 2 },
    ] };
    expect(akisIlerlemesi({}, d)).toEqual({ tamam: 1, toplam: 2, atlandi: 1, ertelendi: 0 });
  });
});

describe('kişi paleti durum renklerinden uzak (13 Kas, U4)', async () => {
  const { PALET, paletRengi, kisiRengi } = await import('./hamle');
  const { DURUM_RENK } = await import('./ortak.js');
  const lab = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4));
    const t = (v: number) => (v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    const X = t((.4124 * r + .3576 * g + .1805 * b) / .95047), Y = t(.2126 * r + .7152 * g + .0722 * b), Z = t((.0193 * r + .1192 * g + .9505 * b) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const fark = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
  it('her kişi tonu beş durum rengine en az 28 uzaklıkta; birbirine en az 20', () => {
    for (const p of PALET) for (const d of Object.values(DURUM_RENK) as string[]) expect(fark(p, d), `${p} ~ ${d}`).toBeGreaterThanOrEqual(28);
    for (const a of PALET) for (const b of PALET) if (a < b) expect(fark(a, b), `${a} ~ ${b}`).toBeGreaterThanOrEqual(20);
  });
  it('eski paletten kayıtlı renk yeni tona çevrilir; kayıtsız kişi palete düşer', () => {
    expect(paletRengi('#F2D16B')).toBe('#D8F26B'); expect(paletRengi('#B9A6F2')).toBe('#B9A6F2');
    expect(kisiRengi('Mert', { renkler: { Mert: '#F28C6B' } })).toBe('#A170FB');
    expect(PALET).toContain(kisiRengi('Selin'));
  });
});
