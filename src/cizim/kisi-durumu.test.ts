import { describe, it, expect } from 'vitest';
import { kisiDurumu } from './kisi-durumu';

const GUN = 864e5, T0 = 0;
// 1 Berkin bitti → 2 agent (oto) → 3 Ece ve 4 Selin bekler; 5 Ece'nin sonraki işi
const byNo: Record<number, any> = {
  1: { no: 1, sahip: 'Berkin', durum: 'tamam', dep: [] },
  2: { no: 2, sahip: "Berkin'in Claude'u", tip: 'agent', durum: 'suruyor', dep: [1], oto: 'calisiyor' },
  3: { no: 3, sahip: 'Ece', durum: 'sirada', dep: [2] },
  4: { no: 4, sahip: 'Selin', durum: 'hazir', dep: [2], karar: true },
  5: { no: 5, sahip: 'Ece', durum: 'sirada', dep: [3] },
};
const t = (no: number) => no * GUN;
const gorsel = (ek: Record<number, string> = {}) => (no: number) => ek[no] ?? ({ 1: 'lit', 2: 'run', 3: 'dark', 4: 'wait', 5: 'dark' } as Record<number, string>)[no];

describe('kisiDurumu (12 Kas, harita durum denetimi)', () => {
  it('işi biten kişi: bitti, son gezegeninde', () => {
    expect(kisiDurumu([1], byNo, gorsel(), t, 2 * GUN, T0)).toMatchObject({ durum: 'bitti', no: 1 });
  });
  it("AI çalışıyor, onay bekliyor ve hata oto_durum'dan", () => {
    expect(kisiDurumu([2], byNo, gorsel(), t, 2 * GUN, T0).durum).toBe('ai_calisiyor');
    expect(kisiDurumu([2], { ...byNo, 2: { ...byNo[2], oto: 'bakilacak' } }, gorsel(), t, 2 * GUN, T0).durum).toBe('ai_onay');
    expect(kisiDurumu([2], { ...byNo, 2: { ...byNo[2], oto: 'hata' } }, gorsel({ 2: 'block' }), t, 2 * GUN, T0).durum).toBe('ai_hata');
    expect(kisiDurumu([2], { ...byNo, 2: { ...byNo[2], oto: 'bekliyor' } }, gorsel({ 2: 'wait' }), t, 2 * GUN, T0).durum).toBe('ai_sirada');
  });
  it('başkasının açık işini bekleyen: bekliyor, tutan iş ve sıradaki gezegen', () => {
    expect(kisiDurumu([3, 5], byNo, gorsel(), t, 2 * GUN, 3 * GUN)).toMatchObject({ durum: 'bekliyor', no: 3, tutan: 2 });
  });
  it('karar adımı hazırsa karar verecek; tarihi geçtiyse gecikme günü', () => {
    expect(kisiDurumu([4], byNo, gorsel(), t, 2 * GUN, T0)).toMatchObject({ durum: 'karar', no: 4, gecGun: 0 });
    expect(kisiDurumu([4], byNo, gorsel(), t, 7 * GUN, T0).gecGun).toBe(3);
  });
  it('engel her şeyin önünde', () => {
    expect(kisiDurumu([3, 4], byNo, gorsel({ 3: 'block' }), t, 2 * GUN, T0)).toMatchObject({ durum: 'engel', no: 3 });
  });
  it('tutan işi bitmişse ve başlamadıysa: gelecek', () => {
    expect(kisiDurumu([3], byNo, gorsel({ 2: 'lit' }), t, 2 * GUN, 3 * GUN)).toMatchObject({ durum: 'gelecek', tutan: null });
  });
});
