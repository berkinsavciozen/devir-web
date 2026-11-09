import { describe, expect, it } from 'vitest';
import { aiArdilCumlesi, ciktiCumlesi, eylemAdi, eylemPlani, hatirlatmaNotu, otoDurumCumlesi, sonHatirlatma } from './eylemler';

const ben = 'Berkin';
const L = { claude: 'https://claude.ai/new?q=x' };
const p = (a: any, o: { acikAlt?: number; tetikYok?: boolean; akisSahibi?: boolean; alt?: boolean; claudeYok?: boolean; hatirlatildi?: boolean } = {}) => eylemPlani({ a: { linkler: L, ...a }, ben, acikAlt: o.acikAlt ?? 0, tetikYok: o.tetikYok ?? false, akisSahibi: o.akisSahibi, alt: o.alt, claudeYok: o.claudeYok, hatirlatildi: o.hatirlatildi });
const insan = { sahip: ben, sahip_tip: 'insan', ad: 'Rakip listesini çıkar' };
const agent = { sahip: 'Berkin’in Claude’u', sahip_tip: 'agent', agent_sahibi: ben, ad: 'Rakip tablosunu hazırla' };

describe('W1 düğme matrisi', () => {
  it('1 · senin işin, sırada: yalnız Claude (hazırlık)', () => expect(p({ ...insan, durum: 'sirada' })).toEqual({ ana: null, ikincil: 'claude', menu: [] }));
  it('2 · çıktı beklenmiyor: Bitti, Claude’da başla, ⋯ Başladım, Engel bildir', () => expect(p({ ...insan, durum: 'hazir', cikti_bekleniyor: false })).toEqual({ ana: 'bitti', ikincil: 'claude_basla', menu: ['basladim', 'engel_bildir'] }));
  it('2b · karar 1: Claude bağlantısı yoksa ikincil Başladım; sürüyorken Başladım yok', () => {
    expect(eylemPlani({ a: { ...insan, durum: 'hazir', cikti_bekleniyor: false }, ben, acikAlt: 0, tetikYok: false })).toEqual({ ana: 'bitti', ikincil: 'basladim', menu: ['engel_bildir'] });
    expect(p({ ...insan, durum: 'suruyor', cikti_bekleniyor: false })).toEqual({ ana: 'bitti', ikincil: 'claude', menu: ['engel_bildir'] });
  });
  it('3 · çıktı bekleniyor, yok: Çıktı ekle; Çıktısız bitir ⋯ içinde', () => expect(p({ ...insan, durum: 'suruyor', beklenen_cikti: 'Rapor PDF’i' })).toEqual({ ana: 'cikti_ekle', ikincil: 'claude', menu: ['ciktisiz_bitir', 'engel_bildir'] }));
  it('4 · çıktı var: Bitti, Çıktı ekle, ⋯ Claude ve Engel', () => expect(p({ ...insan, durum: 'hazir', beklenen_cikti: 'x', ciktilar: [{ id: 1 }] })).toEqual({ ana: 'bitti', ikincil: 'cikti_ekle', menu: ['claude_basla', 'basladim', 'engel_bildir'] }));
  it('5 · engelli: Engeli kaldır', () => expect(p({ ...insan, durum: 'engelli' })).toEqual({ ana: 'engel_kaldir', ikincil: 'claude', menu: [] }));
  it('6 · karar 2: senin kararın, hazır: Karar ver; Claude’la düşün', () => expect(p({ ...insan, karar_adimi: true, durum: 'hazir' })).toEqual({ ana: 'karar_ver', ikincil: 'claude_dusun', menu: ['engel_bildir'] }));
  it('7 · senin kararın, sırada: düğme yok', () => expect(p({ ...insan, karar_adimi: true, durum: 'sirada' })).toEqual({ ana: null, ikincil: null, menu: [] }));
  it('8 · agent işi, AI kapalı: AI yapsın; rutin yoksa kur', () => {
    expect(p({ ...agent, durum: 'hazir', oto: false })).toEqual({ ana: 'oto_ac', ikincil: 'claude', menu: ['kendim_bitir'] });
    expect(p({ ...agent, durum: 'hazir', oto: false }, { tetikYok: true }).ana).toBe('oto_kur');
  });
  it('9 · agent işi, AI açık, bekliyor: Claude, ⋯ kapat', () => expect(p({ ...agent, durum: 'sirada', oto: true, oto_bekledigi: 'öncüller' })).toEqual({ ana: null, ikincil: 'claude', menu: ['oto_kapat'] }));
  it('10 · AI çalışıyor: oturumu aç', () => expect(p({ ...agent, durum: 'suruyor', oto: true, oto_durum: 'tetiklendi', oto_oturum: 'https://claude.ai/code/s1' })).toEqual({ ana: 'oturum', ikincil: null, menu: ['oto_kapat'] }));
  it('11 · AI yaptı, onay bekliyor: Onayla, yorumla geri gönder; menüde reddet', () => expect(p({ ...agent, durum: 'suruyor', oto: true, oto_durum: 'bakilacak' })).toEqual({ ana: 'onayla', ikincil: 'geri_gonder', menu: ['reddet', 'duzelt', 'kendim_yapacagim'] }));
  it('11b · 4 inceleme turundan sonra: Onayla, Claude’la düzelt', () => expect(p({ ...agent, durum: 'suruyor', oto: true, oto_durum: 'bakilacak', inceleme_gecmisi: [1, 2, 3, 4] })).toEqual({ ana: 'onayla', ikincil: 'duzelt', menu: ['kendim_yapacagim'] }));
  it('12 · AI yapamadı: Yeniden dene', () => expect(p({ ...agent, durum: 'engelli', oto: true, oto_durum: 'hata' })).toEqual({ ana: 'yeniden_dene', ikincil: 'claude', menu: ['oto_kapat'] }));
  it('13 · açık alt görevli üst görev: düğme yok', () => expect(p({ ...insan, durum: 'suruyor' }, { acikAlt: 3 })).toEqual({ ana: null, ikincil: null, menu: [] }));
  it('14b · karar 3: başkasının engelinde Hatırlat; akış sahibi sırası geleni de hatırlatır; bugün hatırlattıysan yok', () => {
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'engelli' })).toEqual({ ana: null, ikincil: 'hatirlat', menu: [] });
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'hazir' }, { akisSahibi: true })).toEqual({ ana: null, ikincil: null, menu: ['hatirlat'] });
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'engelli' }, { hatirlatildi: true })).toEqual({ ana: null, ikincil: null, menu: [] });
    // AI'ın sırası: hatırlatılacak kimse yok
    expect(p({ ...agent, agent_sahibi: 'Ayşe', durum: 'hazir', oto: true }, { akisSahibi: true })).toEqual({ ana: null, ikincil: null, menu: [] });
  });
  it('15b · karar 4: dış katılımcının engelini ekip kaldırır', () => expect(p({ sahip: 'Usta Ali', sahip_tip: 'dis', durum: 'engelli' })).toEqual({ ana: 'baglanti', ikincil: 'engel_kaldir', menu: ['onizle'] }));
  it('alt görev · karar 5: yalnız sahibi ve akış sahibi; başkasına düğme yok', () => {
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'hazir', cikti_bekleniyor: false }, { alt: true })).toEqual({ ana: null, ikincil: null, menu: [] });
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'hazir', cikti_bekleniyor: false }, { alt: true, akisSahibi: true }).ana).toBe('bitti');
    // ana görevde akış sahibi sahip yerine geçmez
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'hazir', cikti_bekleniyor: false }, { akisSahibi: true }).ana).toBe(null);
  });
  it('alt görev · karar 6–7: agent’ın alt görevinde AI yapsın; biten yeniden açılır; engelli Engeli kaldır', () => {
    expect(p({ ...agent, durum: 'hazir', oto: false }, { alt: true }).ana).toBe('oto_ac');
    expect(p({ ...insan, durum: 'tamam' }, { alt: true }).menu).toEqual(['yeniden_ac']);
    expect(p({ ...insan, durum: 'engelli' }, { alt: true }).ana).toBe('engel_kaldir');
  });
  it('AI yapsın yalnız Claude: başka uygulama bağlı ve rutin yoksa kur ⋯ içinde, ana sohbet', () => {
    expect(p({ ...agent, durum: 'hazir', oto: false }, { tetikYok: true, claudeYok: true })).toEqual({ ana: 'claude', ikincil: 'kendim_bitir', menu: ['oto_kur'] });
    expect(eylemAdi('oto_kur', { ad: 'ChatGPT', da: 'ChatGPT’de', la: 'ChatGPT’yle' })).toBe('AI yapsın’ı kur (Claude gerekir)');
    expect(eylemAdi('claude', { ad: 'ChatGPT', da: 'ChatGPT’de', la: 'ChatGPT’yle' })).toBe('ChatGPT’de aç');
    expect(eylemAdi('claude_dusun', { ad: 'Gemini', da: 'Gemini’de', la: 'Gemini’yle' })).toBe('Gemini’yle düşün');
  });
  it('14 · ekipten başkasının işi (ve başkasının agent’ı): düğme yok', () => {
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'hazir' })).toEqual({ ana: null, ikincil: null, menu: [] });
    expect(p({ ...agent, agent_sahibi: 'Ayşe', durum: 'hazir' })).toEqual({ ana: null, ikincil: null, menu: [] });
  });
  it('15 · dış katılımcının işi: bağlantı gönder, ⋯ Önizle', () => expect(p({ sahip: 'Usta Ali', sahip_tip: 'dis', durum: 'hazir' })).toEqual({ ana: 'baglanti', ikincil: null, menu: ['onizle'] }));
  it('16 · bitmiş görev: sahibine ⋯ Yeniden aç', () => {
    for (const d of ['tamam', 'atlandi', 'ertelendi']) expect(p({ ...insan, durum: d })).toEqual({ ana: null, ikincil: null, menu: ['yeniden_ac'] });
    expect(p({ ...insan, sahip: 'Ayşe', durum: 'tamam' }).menu).toEqual([]);
  });
  it('dışarıya gönderen agent işi AI yapsın olmaz; kişi kendisi bitirir', () => expect(p({ ...agent, ad: 'Teklifi müşteriye gönder', durum: 'hazir' }).ana).toBe('bitti'));
  it('"Gönderi" gönderme sayılmaz', () => expect(p({ ...agent, ad: 'Gönderi 3’ü hazırla', durum: 'hazir' }).ana).toBe('oto_ac'));
  it('Claude bağlantısı yoksa Claude düğmesi yok', () => expect(eylemPlani({ a: { ...insan, durum: 'sirada' }, ben, acikAlt: 0, tetikYok: false })).toEqual({ ana: null, ikincil: null, menu: [] }));
});

describe('W1 cümleler', () => {
  const o = { ben, tetikYok: false, zaman: () => '08:25', ek: (t: string) => `${t}’te`, kisa: () => 'Claude' };
  it('onay bekleyen AI işi', () => expect(otoDurumCumlesi({ ...agent, durum: 'suruyor', oto: true, oto_durum: 'bakilacak', ciktilar: [{ ad: 'Rakip tablosu', tarih: '2026-11-04T05:25:00Z' }] }, o)).toBe('Claude 08:25’te “Rakip tablosu” çıktısını yazdı. Bakıp onayla.'));
  it('geri gönderilmiş, yorumlu incelenen AI işi', () => expect(otoDurumCumlesi({ ...agent, durum: 'suruyor', oto: true, oto_durum: 'bakilacak', inceleme: 'yorumlu_inceleme', inceleme_gecmisi: [{}], ciktilar: [{ ad: 'Rakip tablosu v2', tarih: '2026-11-04T05:25:00Z' }] }, o)).toBe('Claude 08:25’te “Rakip tablosu v2” çıktısının 2. sürümünü yazdı. İncele; onayla ya da yorumla geri gönder.'));
  it('soru bekleyen AI işi', () => {
    const by = new Map<number, any>([[3, { no: 3, sahip: ben }]]);
    expect(otoDurumCumlesi({ ...agent, durum: 'hazir', oto: true, oto_bekledigi: 'açık soru', capa_soru: 'butce' }, { ...o, by, sorular: [{ kod: 'butce', kisa: 'Bütçe', adim_no: 3 }] }))
      .toBe('Bütçe sorusu cevaplanınca Claude başlar. Cevabı 3. görevde verirsin.');
  });
  it('öncül bekleyen AI işi', () => expect(otoDurumCumlesi({ ...agent, durum: 'sirada', oto: true, oto_bekledigi: 'öncüller', bekledigi: [{ no: 2, durum: 'hazir' }] }, o)).toBe('2. görev bitince Claude başlar.'));
  it('çıktı bekleniyor', () => expect(ciktiCumlesi({ ...insan, durum: 'hazir', beklenen_cikti: 'Rapor PDF’i' }, ben)).toBe('Rapor PDF’i bekleniyor. Ekleyince bitirebilirsin.'));
});

describe('9 Kas · Hatırlat ve AI ardılı', () => {
  it('hatırlatma notu ve 20 saat', () => {
    expect(hatirlatmaNotu({ durum: 'engelli', engel: 'Logo dosyası gelmedi. Tasarımcıya yazdım.' })).toBe('Hatırlatma: “Logo dosyası gelmedi” engeli hâlâ duruyor mu? Kalktıysa Engeli kaldır’a bas.');
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(sonHatirlatma([{ tip: 'not', kim: ben, ozet: 'Hatırlatma: x', zaman: '2026-11-09T01:00:00Z' }], ben, now)).toBe(true);
    expect(sonHatirlatma([{ tip: 'not', kim: ben, ozet: 'Hatırlatma: x', zaman: '2026-11-08T10:00:00Z' }], ben, now)).toBe(false);
  });
  it('AI yapsın işinin önündeki görev: bitince kim başlar; çıktı şartı', () => {
    const A = [{ no: 4, oto: true, durum: 'sirada', bagimli: [3], sahip: 'Ece’nin agent’ı', agent_sahibi: 'Ece Kaya' }];
    expect(aiArdilCumlesi({ no: 3, durum: 'hazir' }, A, ben, (x) => x.split(' ')[0])).toBe('Bu görev bitince Ece’nin agent’ı 4. göreve kendiliğinden başlar (AI yapsın).');
    expect(aiArdilCumlesi({ no: 3, durum: 'hazir', cikti_bekleniyor: true }, A, ben, (x) => x.split(' ')[0])).toMatch(/çıktısız bitirilirse AI başlamaz/);
    expect(aiArdilCumlesi({ no: 2, durum: 'hazir' }, A, ben, (x) => x)).toBe(null);
  });
});
