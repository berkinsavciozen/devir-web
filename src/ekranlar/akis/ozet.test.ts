import { describe, expect, it } from 'vitest';
import { akilliCumle, basliktaCipler, tuttugu } from './ozet';

const adim = (no: number, durum: string, o: any = {}) => ({ no, ad: `Adım ${no} işi`, sahip: 'Berkin', durum, bagimli: [], ...o });
const akis = (adimlar: any[], o: any = {}) => ({ akis: { pay_saat: 48, kapandi_at: null, ...o }, adimlar, kritik_yol: adimlar.map((a) => a.no) });

describe('akilliCumle', () => {
  it('takılan adımı ve tuttuğu adımları önce söyler', () => {
    const d = akis([adim(1, 'tamam'), adim(2, 'engelli', { kisa_ad: 'Post görseli' }), adim(3, 'sirada', { bagimli: [2] }), adim(4, 'sirada', { bagimli: [3] })]);
    expect(tuttugu(d, 2)).toBe(2);
    expect(akilliCumle(d)).toBe('Post görseli takıldı, 2 adımı tutuyor; 4 adımdan 1’i bitti, hedefe 2 gün pay.');
  });
  it('takılan yoksa karar, sonra kritik yol', () => {
    expect(akilliCumle(akis([adim(1, 'hazir', { karar_adimi: true }), adim(2, 'sirada')]))).toMatch(/^Karar bekleniyor: Adım 1 işi; /);
    expect(akilliCumle(akis([adim(1, 'hazir', { kisa_ad: 'Brif' }), adim(2, 'sirada')]))).toMatch(/^Kritik yol Brif/);
  });
  it('hepsi bittiyse yalnız ilerleme; hedef geçtiyse söyler', () => {
    expect(akilliCumle(akis([adim(1, 'tamam')], { pay_saat: null }))).toBe('Bütün adımlar bitti.');
    expect(akilliCumle(akis([adim(1, 'hazir', { kisa_ad: 'Brif' })], { pay_saat: -72 }))).toMatch(/hedef 3 gün geçiyor\.$/);
  });
  it('kapalı akışta cümle yok', () => { expect(akilliCumle(akis([adim(1, 'tamam')], { kapandi_at: '2026-10-01' }))).toBeNull(); });
});

describe('basliktaCipler', () => {
  const d = akis([adim(1, 'hazir'), adim(2, 'engelli', { sahip: 'Emre' }), adim(3, 'hazir', { karar_adimi: true, sahip: 'Emre' }), adim(4, 'tamam')]);
  it('önce kendi işi, sonra darboğazlar', () => {
    expect(basliktaCipler(d, 'Berkin', 'sahip').map((c) => c.tur)).toEqual(['sende', 'engel', 'karar', 'bitti']);
  });
  it('dış katılımcı darboğazları görmez', () => {
    expect(basliktaCipler(d, 'Berkin', 'dis').map((c) => c.tur)).toEqual(['sende', 'bitti']);
  });
  it('sınırı aşmaz', () => { expect(basliktaCipler(d, 'Berkin', 'sahip', 3)).toHaveLength(3); });
});
