import { describe, expect, it } from 'vitest';
import { bagIsareti, beklenenler, benCumlesi, bosKuyruk, kararKarti, soruKarti, gorevCumlesi, gorevHaritasi, gruplar, haftaCizgileri, suzgecAdresi, suzgecOku } from './model';

const NOW = Date.parse('2026-10-14T10:00:00+03:00');
const g = (o: any) => ({ akis: 'A', akis_baslik: 'Hasat', sahip: 'Berkin', sahip_tip: 'insan', durum: 'hazir', onceki: [], sonraki: [], ...o });

describe('görevler', () => {
  it('süzgeç adresten okunur ve varsayılanlar adrese yazılmaz', () => {
    const s = suzgecOku(new URLSearchParams('kisi=Selin&akis=A,B&durum=hepsi'));
    expect(s).toEqual({ kisi: 'Selin', akis: ['A', 'B'], durum: 'hepsi' });
    expect(suzgecAdresi(s)).toBe('/gorevler?kisi=Selin&akis=A%2CB&durum=hepsi');
    expect(suzgecAdresi(suzgecOku(new URLSearchParams()))).toBe('/gorevler');
  });
  it('cümle kişiye göre çekimlenir', () => {
    expect(gorevCumlesi([g({}), g({}), g({ durum: 'engelli' })], 'ben', 'Berkin', 'acik')).toBe('Sende 2 görev sırada; biri engelli.');
    expect(gorevCumlesi([g({ sahip: 'Selin' })], 'Selin', 'Berkin', 'acik')).toBe('Selin’de 1 görev sırada.');
    expect(gorevCumlesi([], 'ben', 'Berkin', 'acik')).toBe('Şu an senden beklenen görev yok.');
  });
  it('gruplar ekran sırasında, boşlar atlanır', () => {
    expect(gruplar([g({ durum: 'tamam' }), g({}), g({ durum: 'sirada' })]).map(([a]) => a)).toEqual(['SIRASI GELEN', 'SIRADA', 'BİTTİ']);
  });
  it('bağımlılık işareti: sıradaki iş kimi bekliyor, sırası gelen işi kim bekliyor', () => {
    expect(bagIsareti(g({ durum: 'sirada', onceki: [{ sahip: 'Claude' }] }), 'Berkin')).toBe('← Claude’u bekliyor');
    expect(bagIsareti(g({ sonraki: [{ sahip: 'Selin' }, { sahip: 'Emre' }] }), 'Berkin')).toBe('→ Selin seni bekliyor +1');
    expect(bagIsareti(g({ sahip: 'Selin', sonraki: [{ sahip: 'Berkin' }] }), 'Berkin')).toBe('→ sen bekliyorsun');
    expect(bagIsareti(g({ durum: 'tamam', sonraki: [{ sahip: 'Selin' }] }), 'Berkin')).toBeNull();
  });
  it('harita: tek kişide akış şeritleri, yakın görevler dikeyde ayrışır, bugün eksende', () => {
    const t = new Date(NOW + 3 * 864e5).toISOString();
    const G = [g({ en_erken_bitis: t }), g({ en_erken_bitis: t }), g({ akis: 'B', akis_baslik: 'Ege', en_erken_bitis: t })];
    const H = gorevHaritasi(G, { kisiBasina: false, now: NOW });
    expect(H.seritler.map((s) => s.ad)).toEqual(['Hasat', 'Ege']);
    const [p, q] = H.noktalar.filter((n) => n.serit === 0);
    expect(p.x).toBeCloseTo(q.x, 6);
    expect(Math.abs(p.y - q.y)).toBe(8);
    expect(H.bugunX).toBeGreaterThan(H.x0);
    expect(H.bugunX).toBeLessThan(p.x);
    expect(gorevHaritasi(G, { kisiBasina: true, now: NOW }).seritler).toHaveLength(1);
  });
  it('K8: haftalık çizgiler İstanbul saatiyle pazartesi 00:00', () => {
    const T = haftaCizgileri(NOW - 2 * 864e5, NOW + 30 * 864e5);
    const tr = (t: number) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(t);
    for (const t of T) expect(tr(t)).toMatch(/Pazartesi.*00:00/);
    // 14 Eki çarşamba: sonraki çizgi 19 Eki, bugünün yanına 15 Eki düşmez
    expect(tr(T[0])).toContain('19 Eki');
  });
});

describe('W6 sen ve agent’ların', () => {
  const ben = 'Berkin';
  const G = [
    { no: 1, sahip: 'Berkin’in Claude’u', sahip_tip: 'agent', agent_sahibi: ben, oto: true, oto_durum: 'bakilacak', durum: 'suruyor' },
    { no: 2, sahip: ben, karar_adimi: true, durum: 'hazir' },
    { no: 3, sahip: ben, durum: 'hazir' },
    { no: 4, sahip: ben, durum: 'engelli', gec_risk: true },
    { no: 5, sahip: ben, durum: 'sirada' },
    { no: 6, sahip: 'Ayşe', durum: 'hazir' },
  ];
  it('öncelik: onay, karar, iş (riskli önce)', () => expect(beklenenler(G, ben).hepsi.map((a) => a.no)).toEqual([1, 2, 4, 3]));
  it('cümle', () => {
    expect(benCumlesi(beklenenler(G, ben), [{ simdi: [1], sirada: 4 }])).toBe('Senden 1 onay, 1 karar ve 2 iş bekleniyor. Agent’ların 1 iş yapıyor, 4 iş sırada.');
    expect(benCumlesi(beklenenler([], ben), null)).toBe('Şu an senden beklenen bir şey yok.');
    expect(benCumlesi(beklenenler([G[1]], ben), [{ simdi: [], sirada: 0 }])).toBe('Senden 1 karar bekleniyor. Agent’ların boşta.');
  });
});

describe('P5 karar kuyruğu', () => {
  it('hızlı onaylı AI çıktısı: Onayla', () => expect(kararKarti({ oto: true, oto_durum: 'bakilacak', inceleme: 'hizli_onay' })).toEqual({ alt: 'AI yazdı, onayını bekliyor', hizli: { etiket: 'Onayla', govde: { durum: 'tamam' } } }));
  it('yorumlu inceleme: hızlı eylem yok, sürüm sayılır', () => expect(kararKarti({ oto: true, oto_durum: 'bakilacak', inceleme: 'yorumlu_inceleme', inceleme_gecmisi: [{}] })).toEqual({ alt: 'AI yazdı (2. sürüm), incelemeni bekliyor', hizli: null }));
  it('AI önerisi: tek dokunuşla seç', () => {
    const k = kararKarti({ karar_adimi: true, karar: { secenekler: [{ ad: 'Ege' }, { ad: 'Marmara' }], oneri: { kim: 'Claude', secim: ['Ege'] } } });
    expect(k.alt).toBe('Claude önerdi: Ege');
    expect(k.hizli?.etiket).toBe('“Ege” seç');
    expect(k.hizli?.govde).toMatchObject({ durum: 'tamam', karar_secimi: ['Ege'] });
  });
  it('önerisiz seçim: seçenekler görünür, detayda verilir', () => expect(kararKarti({ karar_adimi: true, karar_tur: 'secim', karar: { secenekler: [{ ad: 'A' }, { ad: 'B' }, { ad: 'C' }, { ad: 'D' }] } })).toEqual({ alt: 'seçim: A / B / C …', hizli: null }));
  it('onay/red kararı', () => expect(kararKarti({ karar_adimi: true, karar_tur: 'onay_red' }).alt).toBe('onay/red'));
  it('boş kuyruk cümlesi', () => { expect(bosKuyruk(3, 0)).toBe('Şu an kararın yok; AI 3 iş üzerinde çalışıyor.'); expect(bosKuyruk(0, 0)).toBe('Şu an kararın yok.'); });
});

describe('K6 sonradan belli olan cevap', () => {
  it('dalların etkisi', () => expect(soruKarti({ secenekler: [{ deger: 'kazanildi', etiket: 'Kazanıldı' }, { deger: 'kaybedildi', etiket: 'Kaybedildi' }], etki: { kazanildi: 2, kaybedildi: 1 }, adim_no: 1 })).toBe('cevap bekliyor: Kazanıldı → 2 iş açılır · Kaybedildi → 1 iş açılır'));
  it('tarih sorusu', () => expect(soruKarti({ tip: 'tarih', etki: {}, tarihli: 3, adim_no: 2 })).toBe('cevap bekliyor: 3 iş bu tarihi bekliyor'));
  it('etkisiz soru', () => expect(soruKarti({ etki: {}, tarihli: 0, adim_no: 4 })).toBe('cevap bekliyor: 4. görev bitti'));
});
