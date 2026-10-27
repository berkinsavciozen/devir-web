import { describe, expect, it } from 'vitest';
import { ustAdi, ustGorev } from './Kirinti';

const A = [{ no: 1, ad: 'Lansman sayfasını yayına al' }, { no: 2, ad: 'Sayfa metnini yaz', ust_adim: 1 }, { no: 3, ust_adim: 9 }, { no: 9, sahip: 'yol-1' }];
describe('üst görev kırıntısı (1.5)', () => {
  it('alt görevin üstü; olayda adim_no ile', () => {
    expect(ustGorev(A[1], A)?.no).toBe(1);
    expect(ustGorev({ adim_no: 2 }, A)?.no).toBe(1);
    expect(ustAdi({ no: 2 }, A)).toBe('Lansman sayfasını yayına al');
  });
  it('üstü yok, adsız (başkasının) ya da veri yoksa kırıntı yok', () => {
    expect(ustAdi(A[0], A)).toBeNull();
    expect(ustAdi(A[2], A)).toBeNull();
    expect(ustAdi(A[1], undefined)).toBeNull();
  });
});
