import { describe, expect, it } from 'vitest';
import { uyeRenkleri, ajanSahipleri, tac, elmas, belge, TAKIM_RENGI } from './yol.js';
import { galaksiSayilari } from '../ekranlar/akis/Lejant';

// Plan 27 Eki, Epic 3: gezegen dili (P4)
const YESIL = /#(9EE6CF|7BE0A8|5FD39A)/i;
const uye = (ad: string, tip = 'insan') => ({ ad, tip });

describe('kişi renkleri', () => {
  it('yeşil yok; 6 kişiye kadar herkes ayrı renk', () => {
    const G: any = { uyeler: [uye('Berkin'), uye('Claude', 'agent'), uye('Ayşe'), uye('Mehmet'), uye('Bot', 'agent'), uye('Usta', 'dis')] };
    const r = uyeRenkleri(G, 'Berkin');
    expect(Object.values(r).some((c) => YESIL.test(c))).toBe(false);
    expect(new Set(Object.values(r)).size).toBe(6);
  });
  it('6 kişiyi aşınca ötekiler takım rengine düşer, sahip ve Claude kendi renginde', () => {
    const G: any = { uyeler: ['Berkin', 'A', 'B', 'C', 'D', 'E', 'F'].map((a) => uye(a)).concat([uye('Claude', 'agent')]) };
    const r = uyeRenkleri(G, 'Berkin');
    expect(r.A).toBe(TAKIM_RENGI);
    expect(r.Berkin).not.toBe(TAKIM_RENGI);
    expect(r.Claude).toBe('#B9A6F2');
  });
  it('agent sahibinin renginde (agent_sahibi); sahibi olmayan Claude lila kalır', () => {
    const G: any = { uyeler: [uye('Berkin'), uye('Selin'), uye('Claude', 'agent'), uye('Selin’in Claude’u', 'agent'), uye('Bot', 'agent')] };
    const r = uyeRenkleri(G, 'Berkin', ajanSahipleri([{ sahip: 'Claude', tip: 'agent', agentSahibi: 'Berkin' }, { sahip: 'Selin’in Claude’u', tip: 'agent', agentSahibi: 'Selin' }]));
    expect(r.Claude).toBe(r.Berkin);
    expect(r['Selin’in Claude’u']).toBe(r.Selin);
    expect(r.Bot).not.toBe(r.Selin);
    expect(uyeRenkleri(G, 'Berkin').Claude).toBe('#B9A6F2');
  });
});

describe('işaretler', () => {
  it('taç: 0 boş, 1 ışıklı, 2 nabız', () => {
    expect(tac(0, 0, 8, 0)).toBe('');
    expect(tac(0, 0, 8, 1)).not.toContain('dongu-tac');
    expect(tac(0, 0, 8, 2)).toContain('dongu-tac');
  });
  it('elmas altın, belge çizilir', () => {
    expect(elmas(0, 0)).toContain('#FFD27A');
    expect(belge(0, 0)).toContain('<path');
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
  it('atlandı üstü çizik; UFO ve füze insandan ayrı biçim', () => {
    expect(planet(0, 0, 8, 'ghost')).toMatch(/M-6\.24,6\.24 L6\.24,-6\.24/);
    const insan = ship(0, 0, 0, 'insan', 'A', '#8EC5FF'), agent = ship(0, 0, 0, 'agent', 'C', '#B9A6F2'), dis = ship(0, 0, 0, 'dis', '', '#F2B8D8');
    expect(new Set([insan, agent, dis]).size).toBe(3);
    expect(agent).toContain('<rect'); expect(insan).not.toContain('<rect');
    expect(dis).toContain('<ellipse cx="0" cy="1"');
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
