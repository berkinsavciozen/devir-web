import { describe, expect, it } from 'vitest';
import { akisUfku, hedefsiz } from './ufuk';
import { apidenAkis } from '../geometri/galaksi-geometri';
import nm8r from '../../tasarim/veri/nm8r.json';

describe('akış ufku (3 Kas, NM8R: hedef tarihsiz akış)', () => {
  it('hedef varsa hedef, yoksa en erken bitiş, o da yoksa adımlar ya da kuruluş + 30 gün', () => {
    expect(akisUfku({ hedef_tarih: '2026-12-27', en_erken_bitis: '2027-01-05' })).toBe('2026-12-27');
    expect(akisUfku({ hedef_tarih: null, en_erken_bitis: '2026-12-29' })).toBe('2026-12-29');
    expect(akisUfku({ hedef_tarih: null, olcu: { en_erken_bitis: '2027-05-26' } })).toBe('2027-05-26');
    expect(akisUfku({ hedef_tarih: null, olusturuldu: '2026-11-03T09:05:47Z' }, [{ durum: 'sirada', en_erken_bitis: '2027-02-01T15:00:00Z' }])).toBe('2027-02-01');
    expect(akisUfku({ hedef_tarih: null, olusturuldu: '2026-11-03T09:05:47Z' })).toBe('2026-12-03');
    expect(akisUfku({ hedef_tarih: null, kapandi_at: '2026-11-20T10:00:00Z' })).toBe('2026-11-20');
  });
  it('hedefsiz yalnız açık ve hedefi olmayan akış', () => {
    expect(hedefsiz({ hedef_tarih: null })).toBe(true);
    expect(hedefsiz({ hedef_tarih: '2026-12-27' })).toBe(false);
    expect(hedefsiz({ hedef_tarih: null, kapandi_at: '2026-11-20T10:00:00Z' })).toBe(false);
  });
  it('harita girdisi hedef tarih yokken NaN üretmez (159 adımlı NM8R yapısı)', () => {
    const adimlar = (nm8r as any).adimlar.map((r: any[]) => ({ no: r[0], sahip: r[3], sahip_tip: r[4], durum: r[2], bagimli: r[7], sure_tahmin_gun: r[6], en_erken_bitis: '2026-12-29T15:00:00Z', durum_at: '2026-11-03T09:05:47Z' }));
    const g = apidenAkis({ akis: { olusturuldu: '2026-11-03T09:05:47Z', hedef_tarih: null }, adimlar });
    expect(Number.isFinite(g.hedef)).toBe(true);
    expect(g.adimlar).toHaveLength(159);
  });
});
