/**
 * W1 (4 Kas, düğme matrisi): görev detayının eylem çubuğu. Görevin türü, durumu ve kişinin rolü bir ana düğme,
 * bir ikincil düğme ve "⋯" menüsünü belirler. Saf işlev; matrisin 16 satırı eylemler.test.ts'te.
 */
export type Eylem =
  | 'bitti' | 'cikti_ekle' | 'ciktisiz_bitir' | 'claude' | 'claude_dusun' | 'engel_bildir' | 'engel_kaldir'
  | 'oto_ac' | 'oto_kur' | 'oto_kapat' | 'kendim_bitir' | 'oturum' | 'onayla' | 'duzelt' | 'kendim_yapacagim'
  | 'yeniden_dene' | 'yeniden_ac' | 'baglanti' | 'onizle';

export interface EylemPlani { ana: Eylem | null; ikincil: Eylem | null; menu: Eylem[] }

export const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
export const ajanMi = (ad: string, tip?: string) => tip === 'agent' || /agent|Claude/i.test(ad || '');
/** Sunucudaki DIS_FIIL ile aynı (sunucu/core.ts): dışarıya gönderme, yayın, ödeme işleri AI yapsın olmaz. */
const DIS_FIIL = /gönder(?!i)|ilet(?:\s|$|il)|yayınla|yayımla|paylaş|postala|başvur|sipariş\s*ver|satın\s*al|transfer|imzala|öde(?:\s|$|meyi|mesini)/i;
export const otoUygun = (a: any) => a.sahip_tip === 'agent' && !a.karar_adimi && !DIS_FIIL.test(String(a.ad || ''));

export interface EylemGirdisi {
  a: any;
  ben: string;
  /** açık alt görev sayısı */
  acikAlt: number;
  /** kişinin bağlı Claude rutini yok (biliniyorsa) */
  tetikYok: boolean;
}

const BOS: EylemPlani = { ana: null, ikincil: null, menu: [] };
const yap = (ana: Eylem | null, ikincil: Eylem | null, menu: (Eylem | null | false)[] = []): EylemPlani => ({ ana, ikincil, menu: menu.filter(Boolean) as Eylem[] });

export function eylemPlani({ a, ben, acikAlt, tetikYok }: EylemGirdisi): EylemPlani {
  const sahipAjan = ajanMi(a.sahip, a.sahip_tip);
  const sahipDis = !sahipAjan && a.sahip_tip === 'dis' && a.sahip !== ben;
  const agentBenim = sahipAjan && (!a.agent_sahibi || a.agent_sahibi === ben);
  const sahibi = a.sahip === ben || agentBenim;
  const claude = a.linkler?.claude ? 'claude' : null;
  // 16: bitmiş görev; sahibi yeniden açabilir
  if (BITTI(a.durum)) return yap(null, null, [sahibi && 'yeniden_ac']);
  // 13: açık alt görevleri olan üst görev; ilerleme alt görevlerden
  if (acikAlt > 0) return BOS;
  // 15: dış katılımcının işi
  if (sahipDis) return yap('baglanti', null, ['onizle']);
  // 14: ekipten başkasının işi (başkasının agent'ı dahil)
  if (!sahibi) return BOS;

  // 8–12: agent'ının işi, AI yapsın'a uygun
  if (agentBenim && otoUygun(a)) {
    if (!a.oto) {
      if (a.durum === 'engelli') return yap('engel_kaldir', claude);
      return yap(tetikYok ? 'oto_kur' : 'oto_ac', claude, [(a.durum === 'hazir' || a.durum === 'suruyor') && 'kendim_bitir']);
    }
    if (a.oto_durum === 'bakilacak') return yap('onayla', 'duzelt', ['kendim_yapacagim']);
    if (a.oto_durum === 'hata' || a.durum === 'engelli') return yap('yeniden_dene', claude, ['oto_kapat']);
    if (a.oto_durum === 'tetiklendi') return a.oto_oturum ? yap('oturum', null, ['oto_kapat']) : yap(null, claude, ['oto_kapat']);
    return yap(tetikYok ? 'oto_kur' : null, claude, ['oto_kapat']);
  }

  // 6–7: senin kararın
  if (a.karar_adimi) {
    if (a.durum === 'sirada') return BOS;
    if (a.durum === 'engelli') return yap('engel_kaldir', claude && 'claude_dusun');
    return yap(null, claude && 'claude_dusun', ['engel_bildir']);
  }
  // 1: sırada (öncüller bitmedi): hazırlık için Claude
  if (a.durum === 'sirada') return yap(null, claude);
  // 5: engelli
  if (a.durum === 'engelli') return yap('engel_kaldir', claude);
  // 2–4: hazır ya da sürüyor
  const bekleniyor = a.cikti_bekleniyor === true || !!a.beklenen_cikti;
  const ciktiVar = (a.ciktilar || []).length > 0 || a.cikti_sayisi > 0;
  if (ciktiVar) return yap('bitti', 'cikti_ekle', [claude, 'engel_bildir']);
  if (bekleniyor) return yap('cikti_ekle', claude, ['ciktisiz_bitir', 'engel_bildir']);
  return yap('bitti', claude, ['engel_bildir']);
}

export const EYLEM_AD: Record<Eylem, string> = {
  bitti: 'Bitti',
  cikti_ekle: 'Çıktı ekle',
  ciktisiz_bitir: 'Çıktısız bitir',
  claude: 'Claude’da aç',
  claude_dusun: 'Claude’la düşün',
  engel_bildir: 'Engel bildir',
  engel_kaldir: 'Engeli kaldır',
  oto_ac: 'AI yapsın',
  oto_kur: 'AI yapsın’ı kur',
  oto_kapat: 'AI yapsın’ı kapat',
  kendim_bitir: 'Kendim yaptım, bitir',
  oturum: 'Claude oturumunu aç',
  onayla: 'Onayla, bitir',
  duzelt: 'Claude’la düzelt',
  kendim_yapacagim: 'Kendim yapacağım (AI’ı kapat)',
  yeniden_dene: 'Yeniden dene',
  yeniden_ac: 'Yeniden aç',
  baglanti: 'Bağlantı gönder',
  onizle: 'Önizle',
};

/** "Claude'la düzelt" (D4): AI'ın oturumuna yapıştırılacak istem. */
export const duzeltIstemi = (kod: string, a: any) =>
  `Devir ${kod} akışının ${a.no}. görevi (${a.ad}) için yazdığın çıktıyı düzelt. devir_adim_oku ile görevi ve çıktını oku, düzeltilmiş çıktıyı devir_adim_guncelle ile yeni çıktı olarak yaz. Düzeltilecekler: `;

/**
 * Başlık altındaki tek cümlenin AI yapsın ve çıktı halleri (W1 cümle tablosu): ne oldu ve kimden ne bekleniyor.
 * null: genel cümle (adimCumlesi) geçerli.
 */
export function otoDurumCumlesi(a: any, o: { ben: string; tetikYok: boolean; sorular?: any[]; by?: Map<number, any>; zaman: (ms: number) => string; ek: (t: string) => string; kisa: (ad: string) => string }): string | null {
  if (BITTI(a.durum) || !a.oto || !ajanMi(a.sahip, a.sahip_tip)) return null;
  const ag = o.kisa(a.sahip);
  if (a.oto_durum === 'bakilacak') {
    const son = [...(a.ciktilar || [])].sort((x: any, y: any) => Date.parse(y.tarih) - Date.parse(x.tarih))[0];
    const t = son ? Date.parse(son.tarih) : NaN;
    return `${Number.isFinite(t) ? `${ag} ${o.ek(o.zaman(t))}` : ag} ${son ? `“${son.ad}” çıktısını` : 'çıktısını'} yazdı. Bakıp onayla.`;
  }
  if (a.oto_durum === 'hata') return `${ag} bu işi yapamadı${a.engel ? `: ${String(a.engel).replace(/\.$/, '')}` : ''}. Yeniden dene ya da Claude’da aç.`;
  if (a.oto_durum === 'tetiklendi') return `${ag} şu an bu görev üzerinde çalışıyor.`;
  if (a.durum === 'engelli') return null;
  const b = String(a.oto_bekledigi || '');
  if (b === 'açık soru') {
    const kod = a.capa_soru || a.cevap_soru;
    const q = (o.sorular || []).find((x: any) => x.kod === kod);
    const ad = q?.kisa || 'Açık soru';
    const yer = q?.adim_no != null ? o.by?.get(q.adim_no) : null;
    const kim = yer ? (yer.sahip === o.ben ? ` Cevabı ${q.adim_no}. görevde verirsin.` : ` Cevabı ${q.adim_no}. görevde ${o.kisa(yer.sahip)} verir.`) : '';
    return `${/soru/i.test(ad) ? ad : `${ad} sorusu`} cevaplanınca ${ag} başlar.${kim}`;
  }
  const cikti = b.match(/^çıktı \(([\d, ]+)\)$/);
  if (cikti) return `${cikti[1]}. görevin çıktısı yazılınca ${ag} başlar.`;
  const gun = b.match(/^planlanan gün \((.+)\)$/);
  if (gun) return `${ag} planlanan günde, ${gun[1]}, başlar.`;
  if (b === 'öncüller') {
    const once = (a.bekledigi || []).filter((x: any) => !BITTI(x.durum)).map((x: any) => x.no);
    return once.length ? `${once.join(', ')}. görev bitince ${ag} başlar.` : `Öncüller bitince ${ag} başlar.`;
  }
  if (b === 'sürüyor') return `${ag} üzerinde çalışıyor.`;
  if (o.tetikYok) return `AI yapsın açık ama Claude rutinin kurulu değil; kurunca ${ag} başlar.`;
  return `Hazır; ${ag} bir sonraki taramada başlar.`;
}

/** Çıktı beklenen ve henüz çıktısı olmayan kendi işin: neyin beklendiği (W1 cümle tablosu). */
export function ciktiCumlesi(a: any, ben: string): string | null {
  if (BITTI(a.durum) || a.sahip !== ben || a.karar_adimi || !(a.durum === 'hazir' || a.durum === 'suruyor')) return null;
  if ((a.ciktilar || []).length || a.cikti_sayisi > 0) return null;
  if (!(a.cikti_bekleniyor === true || a.beklenen_cikti)) return null;
  const ne = String(a.beklenen_cikti || '').trim();
  return `${ne && ne.length <= 60 ? ne.replace(/\.$/, '') : 'Çıktı'} bekleniyor. Ekleyince bitirebilirsin.`;
}
