import { describe, expect, it } from 'vitest';
import { ciktiCumlesi, eylemPlani, otoDurumCumlesi } from './eylemler';

const ben = 'Berkin';
const L = { claude: 'https://claude.ai/new?q=x' };
const p = (a: any, o: { acikAlt?: number; tetikYok?: boolean } = {}) => eylemPlani({ a: { linkler: L, ...a }, ben, acikAlt: o.acikAlt ?? 0, tetikYok: o.tetikYok ?? false });
const insan = { sahip: ben, sahip_tip: 'insan', ad: 'Rakip listesini çıkar' };
const agent = { sahip: 'Berkin’in Claude’u', sahip_tip: 'agent', agent_sahibi: ben, ad: 'Rakip tablosunu hazırla' };

describe('W1 düğme matrisi', () => {
  it('1 · senin işin, sırada: yalnız Claude (hazırlık)', () => expect(p({ ...insan, durum: 'sirada' })).toEqual({ ana: null, ikincil: 'claude', menu: [] }));
  it('2 · çıktı beklenmiyor: Bitti, Claude, ⋯ Engel bildir', () => expect(p({ ...insan, durum: 'hazir', cikti_bekleniyor: false })).toEqual({ ana: 'bitti', ikincil: 'claude', menu: ['engel_bildir'] }));
  it('3 · çıktı bekleniyor, yok: Çıktı ekle; Çıktısız bitir ⋯ içinde', () => expect(p({ ...insan, durum: 'suruyor', beklenen_cikti: 'Rapor PDF’i' })).toEqual({ ana: 'cikti_ekle', ikincil: 'claude', menu: ['ciktisiz_bitir', 'engel_bildir'] }));
  it('4 · çıktı var: Bitti, Çıktı ekle, ⋯ Claude ve Engel', () => expect(p({ ...insan, durum: 'hazir', beklenen_cikti: 'x', ciktilar: [{ id: 1 }] })).toEqual({ ana: 'bitti', ikincil: 'cikti_ekle', menu: ['claude', 'engel_bildir'] }));
  it('5 · engelli: Engeli kaldır', () => expect(p({ ...insan, durum: 'engelli' })).toEqual({ ana: 'engel_kaldir', ikincil: 'claude', menu: [] }));
  it('6 · senin kararın, hazır: form kendi düğmesiyle; Claude’la düşün', () => expect(p({ ...insan, karar_adimi: true, durum: 'hazir' })).toEqual({ ana: null, ikincil: 'claude_dusun', menu: ['engel_bildir'] }));
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
