import { describe, expect, it } from 'vitest';
import { BERKIN_ANAHTAR, sahteSunucu, TABAN } from './sahte';

const iste = async (s: Awaited<ReturnType<typeof sahteSunucu>>, yol: string, b: string, govde?: unknown) => {
  const r = await s.istek(new Request(TABAN + yol, { method: govde ? 'POST' : 'GET', headers: { authorization: `Bearer ${b}`, 'content-type': 'application/json' }, body: govde ? JSON.stringify(govde) : undefined }));
  return { st: r.status, j: await r.json() };
};

describe('sahte API (canlı sunucu kodu + örnek veri)', () => {
  it('Berkin oturumu: /ben ve /ozet', async () => {
    const s = await sahteSunucu('berkin', { webAdresi: 'http://yerel' });
    const ben = await iste(s, '/api/v1/ben', 'sahte:sahte-berkin:berkin@ornek.com');
    expect(ben.j.uyelikler).toHaveLength(1);
    expect(ben.j.kisi).toBe('Berkin');
    const oz = await iste(s, '/api/v1/ozet', 'sahte:sahte-berkin:berkin@ornek.com');
    expect(oz.st).toBe(200);
    expect(oz.j.akislar.length).toBeGreaterThan(3);
    const k = await iste(s, '/api/v1/ozet', BERKIN_ANAHTAR);
    expect(k.j.ozet).toBe(oz.j.ozet);
  });
  it('davetli: kayit_gerekli + bekleyen davet → katıl', async () => {
    const s = await sahteSunucu('davetli', { webAdresi: 'http://yerel' });
    const b = 'sahte:sahte-emre:emre@ornek.com';
    const ben = await iste(s, '/api/v1/ben', b);
    expect(ben.j.kayit_gerekli).toBe(true);
    expect(ben.j.bekleyen_davetler[0].davet_eden).toBe('Berkin');
    const k = await iste(s, '/api/v1/kayit', b, { davet: ben.j.bekleyen_davetler[0].id });
    expect(k.j.katildi.rol).toBe('dis');
  });
  it('davetsiz: yeni alan açamaz (kayıt kapalı)', async () => {
    const s = await sahteSunucu('davetsiz', { webAdresi: 'http://yerel', acikKayit: false });
    const r = await iste(s, '/api/v1/kayit', 'sahte:sahte-davetsiz:emre.k@ornek.com', { alan_adi: 'Ali' });
    expect(r.st).toBe(403);
    expect(r.j.hata).toMatch(/davetle/);
  });
  it('boş alan: /ozet boş', async () => {
    const s = await sahteSunucu('bos', { webAdresi: 'http://yerel' });
    const r = await iste(s, '/api/v1/ozet', 'sahte:sahte-berkin-yeni:berkin@ornek.com');
    expect(r.j.akislar).toHaveLength(0);
  });
  it('açık kayıt: davetsiz kişi kendi alanını açar', async () => {
    const s = await sahteSunucu('davetsiz', { webAdresi: 'http://yerel' });
    const b = 'sahte:sahte-davetsiz:emre.k@ornek.com';
    const ben = await iste(s, '/api/v1/ben', b);
    expect(ben.j.acik_kayit).toBe(true);
    const r = await iste(s, '/api/v1/kayit', b, { alan_adi: 'Emre · çalışma alanı', kisi: 'Emre' });
    expect(r.j.acildi.rol).toBe('sahip');
    const d = await s.istek(new Request('https://sahte.devir/functions/v1/devir-mcp/api/v1/durum'));
    expect((await d.json()).acik_kayit).toBe(true);
  });
});
