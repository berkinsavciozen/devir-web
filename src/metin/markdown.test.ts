import { describe, expect, it } from 'vitest';
import { ayristir, hucreler } from './markdown';

describe('markdown okuyucu (12 Kas çıktı önizlemesi)', () => {
  it('GFM tabloyu başlık, hizalama ve satırlarla ayırır', () => {
    const b = ayristir('## Özellikler\n\n| Özellik | Rotalar | Durum |\n|---|:---:|--:|\n| Giriş | /auth, `a|b` | Var |\n| Fiyat \\| plan | /pricing |\n\nSonra paragraf.');
    expect(b.map((x) => x.tur)).toEqual(['baslik', 'tablo', 'paragraf']);
    const t = b[1] as any;
    expect(t.baslik).toEqual(['Özellik', 'Rotalar', 'Durum']);
    expect(t.hiza).toEqual([null, 'orta', 'sag']);
    expect(t.satirlar).toEqual([['Giriş', '/auth, `a|b`', 'Var'], ['Fiyat | plan', '/pricing', '']]);
  });
  it('paragrafın hemen ardından gelen tabloyu da tanır', () => {
    const b = ayristir('**Proje:** x\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(b.map((x) => x.tur)).toEqual(['paragraf', 'tablo']);
  });
  it('iç içe liste, görev maddesi, alıntı, kod bloğu ve çizgi', () => {
    const b = ayristir('- bir\n  - iç\n- [x] bitti\n\n1. ilk\n2. ikinci\n\n> not\n\n```ts\nconst a = 1;\n```\n\n---');
    expect(b.map((x) => x.tur)).toEqual(['liste', 'liste', 'alinti', 'kod', 'cizgi']);
    const l = b[0] as any;
    expect(l.ogeler[0].alt[0].tur).toBe('liste');
    expect(l.ogeler[1].tik).toBe(true);
    expect((b[3] as any).metin).toBe('const a = 1;');
  });
  it('başlığın hemen altındaki tablo (12 Kas Budgi çıktısı): kalın, kod ve tırnak hücrede kalır', () => {
    const b = ayristir('# Envanter\n\n**Proje:** [Lovable](https://lovable.dev/p) · yayında\n\n## Özellikler\n| Özellik | Rotalar | Durum |\n|---|---|---|\n| PDF | /scan | **Riskli**: `process-document` |\n| Landing | /welcome | Var ("Tornado?") — belirsiz |\n\n## Riskler\n- bir');
    expect(b.map((x) => x.tur)).toEqual(['baslik', 'paragraf', 'baslik', 'tablo', 'baslik', 'liste']);
    expect((b[3] as any).satirlar.length).toBe(2);
    expect((b[3] as any).satirlar[0][2]).toBe('**Riskli**: `process-document`');
  });
  it('hücre bölücü baştaki/sondaki dikey çizgiyi atar', () => {
    expect(hucreler('| a | b |')).toEqual(['a', 'b']);
    expect(hucreler('a | b')).toEqual(['a', 'b']);
  });
});
