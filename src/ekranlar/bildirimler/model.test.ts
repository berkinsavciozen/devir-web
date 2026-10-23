import { describe, expect, it } from 'vitest';
import { gecmistenOlaylar, bSuzgecAdresi, bSuzgecOku, gunBasligi, olayAciklamasi, olayFiili, olayTuru, suz, topla } from './model';

const NOW = Date.parse('2026-10-14T10:00:00+03:00');
const gunAy = (ms: number) => new Date(ms).toISOString().slice(5, 10);
const e = (o: any) => ({ id: 1, akis: 'A', adim_no: 3, kim: 'Selin', kim_tip: 'insan', tip: 'guncelleme', zaman: '2026-10-14T05:00:00Z', okundu: false, ilgili: true, ...o });

describe('bildirimler', () => {
  it('fiil: kişi, durum ve sistem', () => {
    expect(olayFiili(e({ tip: 'durum', durum: 'tamam' }))).toBe('Selin bitirdi');
    expect(olayFiili(e({ kim: 'Emre (Test Bank)', tip: 'not' }))).toBe('Emre not düştü');
    expect(olayFiili(e({ kim: 'Devir', kim_tip: 'sistem', tip: 'durum', durum: 'hazir' }))).toBe('Sırası geldi');
    expect(olayFiili(e({ adim_no: null, tip: 'akis_kapandi', kim: 'Berkin' }))).toBe('Berkin akışı kapattı');
  });
  it('açıklama: önek atılır, çıktı adı kalır, sıradan durumda boş', () => {
    expect(olayAciklamasi(e({ ozet: 'ilerleme: Raporun ilk taslağı hazır; bulgular gidiyor.' }))).toBe('Raporun ilk taslağı hazır');
    expect(olayAciklamasi(e({ tip: 'cikti', ozet: 'Adım 15 · çıktı: Sızma testi özeti' }))).toBe('Sızma testi özeti');
    expect(olayAciklamasi(e({ tip: 'durum', durum: 'hazir', ozet: 'Adım 16 hazır; sıra şimdi: Berkin' }))).toBeNull();
  });
  it('aynı adımda aynı kişinin art arda olayları toplanır', () => {
    const T = topla([e({ id: 3 }), e({ id: 2, tip: 'cikti', okundu: true }), e({ id: 1, kim: 'Claude' }), e({ id: 0, kim: 'Claude', adim_no: 4 })]);
    expect(T.map((t) => t.n)).toEqual([2, 1, 1]);
    expect(T[0].ids).toEqual([3, 2]);
    expect(T[0].okundu).toBe(false);
    const H = (id: number, no: number) => e({ id, adim_no: no, adim_kisa_ad: 'A' + no, kim: 'Devir', kim_tip: 'sistem', tip: 'durum', durum: 'hazir' });
    const S = topla([H(5, 1), H(4, 2), H(3, 3), e({ id: 2 })]);
    expect(S.map((t) => t.n)).toEqual([3, 1]);
    expect(S[0].sira).toBe(true);
    expect(S[0].adimlar).toEqual(['A1', 'A2', 'A3']);
  });
  it('gün başlığı Türkiye saatiyle', () => {
    expect(gunBasligi('2026-10-13T22:30:00Z', NOW, gunAy)).toBe('BUGÜN');
    expect(gunBasligi('2026-10-13T08:00:00Z', NOW, gunAy)).toBe('DÜN');
    expect(gunBasligi('2026-10-11T08:00:00Z', NOW, gunAy)).toBe('10-11');
  });
  it('süzgeç adreste; Senin için yalnız ilgili', () => {
    const s = bSuzgecOku(new URLSearchParams('sekme=tum&kisi=Selin'));
    expect(bSuzgecAdresi(s)).toBe('/bildirimler?sekme=tum&kisi=Selin');
    expect(suz([e({}), e({ ilgili: false })], bSuzgecOku(new URLSearchParams()))).toHaveLength(1);
    expect(suz([e({}), e({ kim: 'Claude' })], s)).toHaveLength(1);
  });
  it('eski sunucu: akış geçmişlerinden olaylar, kendininki yok, ilgili hesaplanır', () => {
    const d = { A: { akis: { baslik: 'Hasat', kisa_ad: 'Hasat' }, adimlar: [{ no: 1, ad: 'Liste', sahip: 'Selin', bagimli: [] }, { no: 2, ad: 'Karar', sahip: 'Berkin', bagimli: [1] }],
      olaylar: [e({ id: 2, adim_no: 1, kim: 'Selin', zaman: '2026-10-14T06:00:00Z' }), e({ id: 1, adim_no: 2, kim: 'Berkin' }), e({ id: 3, tip: 'okuma', kim: 'Selin' })] } };
    const O = gecmistenOlaylar(d, 'Berkin');
    expect(O).toHaveLength(1);
    expect(O[0]).toMatchObject({ akis: 'A', adim_ad: 'Liste', ilgili: true, okundu: true });
  });
  it('tür (K9): durum haritadaki dille; tür süzgeci adreste', () => {
    expect(olayTuru(e({ tip: 'durum', durum: 'tamam' }))).toBe('bitti');
    expect(olayTuru(e({ tip: 'durum', durum: 'engelli' }))).toBe('engel');
    expect(olayTuru(e({ tip: 'durum', durum: 'hazir', kim_tip: 'sistem' }))).toBe('sira');
    expect(olayTuru(e({ tip: 'durum', durum: 'ertelendi' }))).toBe('atlandi');
    expect(olayTuru(e({ tip: 'karar' }))).toBe('karar');
    expect(olayTuru(e({ tip: 'guncelleme', ozet: 'Adım 15 · çıktı: Rapor' }))).toBe('cikti');
    expect(olayTuru(e({ adim_no: null, tip: 'akis_olustu' }))).toBe('akis');
    expect(olayTuru(e({ tip: 'not' }))).toBe('not');
    const s = bSuzgecOku(new URLSearchParams('sekme=tum&tur=engel'));
    expect(bSuzgecAdresi(s)).toBe('/bildirimler?sekme=tum&tur=engel');
    expect(bSuzgecOku(new URLSearchParams('tur=uydurma')).tur).toBeNull();
    expect(suz([e({ tip: 'durum', durum: 'engelli' }), e({})], s)).toHaveLength(1);
  });
});
