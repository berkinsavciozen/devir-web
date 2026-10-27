import { describe, expect, it } from 'vitest';
import { uyeRenkleri, tac, elmas, belge, TAKIM_RENGI } from './yol.js';
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
