import { describe, expect, it } from 'vitest';
import { hamle } from './hamle';
import { sohbetLinki } from '../ekranlar/akis/sohbet';

const ag = { sahip: 'Berkin’in agent’ı', sahip_tip: 'agent', agent_sahibi: 'Berkin' };
describe('9 Kas · hamle AI yapsın (harita denetimi A1, A2)', () => {
  it('AI çalışırken ya da sırasını beklerken kimsenin hamlesi yok', () => {
    expect(hamle({ ...ag, durum: 'suruyor', oto: true, oto_durum: 'tetiklendi' })).toBe(null);
    expect(hamle({ ...ag, durum: 'hazir', oto: true, oto_durum: null })).toBe(null);
    // haritanın kendi sözlüğü (otoRozet)
    expect(hamle({ ...ag, durum: 'suruyor', oto: true, oto_durum: 'calisiyor' })).toBe(null);
  });
  it('onay ve hata sahibinde; AI kapalıysa sahibin işi', () => {
    expect(hamle({ ...ag, durum: 'suruyor', oto: true, oto_durum: 'bakilacak' })?.tur).toBe('onayla');
    expect(hamle({ ...ag, durum: 'engelli', oto: true, oto_durum: 'hata' })).toMatchObject({ tur: 'engel' });
    expect(hamle({ ...ag, durum: 'hazir', oto: false })).toMatchObject({ tur: 'bitir', kim: 'Berkin' });
  });
  it('rutin yoksa sahibe "kur"; başkasına değil', () => {
    expect(hamle({ ...ag, durum: 'hazir', oto: true }, { ben: 'Berkin', rutinYok: true })).toMatchObject({ tur: 'kur', kim: 'Berkin' });
    expect(hamle({ ...ag, durum: 'hazir', oto: true }, { ben: 'Ece', rutinYok: true })).toBe(null);
  });
  it('H5 (sunucu 0.36.0): rutin_var sunucudan gelirse başkası da görür; hamle agent sahibinde', () => {
    expect(hamle({ ...ag, durum: 'hazir', oto: true, rutin_var: false })).toMatchObject({ tur: 'kur', kim: 'Berkin' });
    expect(hamle({ ...ag, durum: 'hazir', oto: true, rutin_var: false }, { ben: 'Ece' })).toMatchObject({ tur: 'kur', kim: 'Berkin' });
    // sunucu rutin var diyorsa yerel tetik listesi boş olsa da kur yok
    expect(hamle({ ...ag, durum: 'hazir', oto: true, rutin_var: true }, { ben: 'Berkin', rutinYok: true })).toBe(null);
    // sırasını bekleyen işte hamle yok
    expect(hamle({ ...ag, durum: 'sirada', oto: true, rutin_var: false })).toBe(null);
  });
});

describe('9 Kas · sohbet bağlı uygulamada', () => {
  const L = { claude: 'https://claude.ai/new?q=' + encodeURIComponent('Devir RK8R 3'), chatgpt: 'https://chatgpt.com/?q=' + encodeURIComponent('Devir RK8R 3') };
  it('uygulamaya göre adres; Gemini istemi panoya', () => {
    expect(sohbetLinki('claude', L)?.url).toBe(L.claude);
    expect(sohbetLinki('chatgpt', L)?.url).toBe(L.chatgpt);
    expect(sohbetLinki('grok', L)?.url).toBe('https://grok.com/?q=Devir%20RK8R%203');
    expect(sohbetLinki('gemini', L)).toEqual({ url: 'https://gemini.google.com/app', pano: 'Devir RK8R 3' });
    expect(sohbetLinki('claude', null)).toBe(null);
  });
});
