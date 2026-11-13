/**
 * Kişi durumu (12 Kas, harita durum denetimi P1): bir üyenin (insan, dış, agent) belli bir andaki tek durumu.
 * Gemi = kişi: harita, lejant ve panel bu işlevden okur. Sıra: engel, hamle, çalışıyor, bekliyor, gelecek, bitti.
 * 13 Kas (sentez): AI sırada ama işi alacak rutin yoksa (sunucu 0.36.0 `rutin_var === false`) durum `ai_rutinsiz`.
 */
export type KisiDurum = 'gelecek' | 'bekliyor' | 'sira' | 'calisiyor' | 'karar' | 'engel' | 'bitti'
  | 'ai_sirada' | 'ai_calisiyor' | 'ai_onay' | 'ai_hata' | 'ai_rutinsiz';
export interface KisiDurumu { durum: KisiDurum; no: number | null; tutan: number | null; gecGun: number }
interface Adim { no: number; sahip: string; tip?: string; durum: string; dep?: number[]; karar?: boolean; oto?: string | null; rutinYok?: boolean }
const GUN = 864e5;

/**
 * kendi: üyenin adımları; byNo: bütün adımlar; gorsel(no): o andaki görsel durum (lit, run, wait, block, dark, tahmin…);
 * t(no): adımın plan tarihi; an: bakılan an; t0: üyenin ilk işinin başlangıcı.
 */
export function kisiDurumu(kendi: number[], byNo: Record<number, Adim>, gorsel: (no: number) => string, t: (no: number) => number, an: number, t0: number): KisiDurumu {
  const acik = kendi.filter((no) => ['run', 'wait', 'block', 'dark'].includes(gorsel(no))).sort((a, b) => t(a) - t(b));
  const gec = (no: number) => Math.max(0, Math.floor((an - t(no)) / GUN));
  if (!acik.length) {
    const son = kendi.filter((no) => !['ghost'].includes(gorsel(no))).sort((a, b) => t(b) - t(a))[0] ?? null;
    return { durum: 'bitti', no: son, tutan: null, gecGun: 0 };
  }
  const SIRA: Record<string, number> = { block: 0, wait: 1, run: 2 };
  const aktif = acik.filter((no) => SIRA[gorsel(no)] != null).sort((a, b) => SIRA[gorsel(a)] - SIRA[gorsel(b)] || t(a) - t(b))[0];
  if (aktif != null) {
    const a = byNo[aktif], k = gorsel(aktif);
    let durum: KisiDurum;
    if (a.oto) durum = a.oto === 'hata' ? 'ai_hata' : a.oto === 'bakilacak' ? 'ai_onay' : a.oto === 'calisiyor' ? 'ai_calisiyor' : k === 'block' ? 'engel' : a.rutinYok ? 'ai_rutinsiz' : 'ai_sirada';
    else durum = k === 'block' ? 'engel' : a.karar ? 'karar' : k === 'run' ? 'calisiyor' : 'sira';
    return { durum, no: aktif, tutan: null, gecGun: gec(aktif) };
  }
  // açık işlerin hepsi karanlık: sıradaki iş kimi bekliyor?
  const sonraki = acik[0];
  const tutanlar = (byNo[sonraki].dep || []).filter((d) => byNo[d] && !['lit', 'ghost', 'ertele', 'tahmin'].includes(gorsel(d)));
  // tutan iş başka birindeyse en geç biteni; kendi önceki işiyse de bekliyor sayılır
  const tutan = tutanlar.sort((a, b) => t(b) - t(a))[0] ?? null;
  return { durum: an < t0 && tutan == null ? 'gelecek' : tutan != null ? 'bekliyor' : 'gelecek', no: sonraki, tutan, gecGun: 0 };
}

/** Kişiler listesi ve lejant için kısa ad (harita rozetleriyle aynı sözlük). */
export const KISI_DURUM_AD: Record<KisiDurum, string> = {
  gelecek: 'sırası gelecek', bekliyor: 'bekliyor', sira: 'sırası geldi', calisiyor: 'çalışıyor', karar: 'karar verecek',
  engel: 'takıldı', bitti: 'işi bitti', ai_sirada: 'AI sırada', ai_calisiyor: 'AI çalışıyor', ai_onay: 'onay bekliyor', ai_hata: 'AI yapamadı', ai_rutinsiz: 'rutin yok',
};
