import { ozelEk } from '../../metin/turkce';

/**
 * W1 (4 Kas, düğme matrisi): görev detayının eylem çubuğu. Görevin türü, durumu ve kişinin rolü bir ana düğme,
 * bir ikincil düğme ve "⋯" menüsünü belirler. Saf işlev; matrisin 16 satırı eylemler.test.ts'te.
 */
export type Eylem =
  | 'bitti' | 'cikti_ekle' | 'ciktisiz_bitir' | 'claude' | 'claude_basla' | 'claude_dusun' | 'basladim' | 'karar_ver' | 'engel_bildir' | 'engel_kaldir'
  | 'oto_ac' | 'oto_kur' | 'oto_kapat' | 'kendim_bitir' | 'oturum' | 'onayla' | 'geri_gonder' | 'reddet' | 'duzelt' | 'kendim_yapacagim'
  | 'yeniden_dene' | 'yeniden_ac' | 'baglanti' | 'onizle' | 'hatirlat' | 'tarih_degistir';

/** Sunucudaki INCELEME_TUR_SINIRI ile aynı (sunucu/yurutme.ts). */
export const INCELEME_TUR_SINIRI = 4;
/** Sunucudaki RED_NEDENLERI ile aynı: hazır red nedenleri. */
export const RED_NEDENLERI = ['Bilgi yanlış ya da eksik', 'İstediğim bu değildi', 'Kalite yetersiz'] as const;

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
  /** bakan kişi akışın sahibi */
  akisSahibi?: boolean;
  /** alt görev satırı (karar 5: alt görevde akış sahibi de sahibi gibi yönetir) */
  alt?: boolean;
  /** kişinin bağlı uygulaması Claude değil (AI yapsın yalnız Claude rutiniyle çalışır) */
  claudeYok?: boolean;
  /** bakan kişi bu görevi son 20 saatte hatırlattı */
  hatirlatildi?: boolean;
}

const BOS: EylemPlani = { ana: null, ikincil: null, menu: [] };
const yap = (ana: Eylem | null, ikincil: Eylem | null, menu: (Eylem | null | false)[] = []): EylemPlani => ({ ana, ikincil, menu: menu.filter(Boolean) as Eylem[] });

/**
 * 9 Kas (düğme tablosu kararları 1–7): sırası gelen insan işinde "Başladım" (Claude bağlantısı varsa "Claude’da başla"
 * açar ve başlatır), karar görevinde "Karar ver", başkasının engelinde "Hatırlat", dış katılımcının engelini ekip kaldırır,
 * alt görevde düğmeler yalnız sahibine ve akış sahibine, agent'ın alt görevinde AI yapsın, biten alt görev yeniden açılır.
 * AI'ın sırası olan işte (AI çalışıyor, AI yapsın açık bekliyor) kimseden bir şey beklenmez.
 */
export function eylemPlani({ a, ben, acikAlt, tetikYok, akisSahibi = false, alt = false, claudeYok = false, hatirlatildi = false }: EylemGirdisi): EylemPlani {
  const sahipAjan = ajanMi(a.sahip, a.sahip_tip);
  const sahipDis = !sahipAjan && a.sahip_tip === 'dis' && a.sahip !== ben;
  const yonetir = alt && akisSahibi;
  const agentBenim = sahipAjan && (!a.agent_sahibi || a.agent_sahibi === ben || yonetir);
  const sahibi = a.sahip === ben || agentBenim || yonetir;
  const claude = a.linkler?.claude ? 'claude' : null;
  // 16: bitmiş görev; sahibi yeniden açabilir (karar 7: alt görevde de)
  if (BITTI(a.durum)) return yap(null, null, [sahibi && 'yeniden_ac']);
  // 13: açık alt görevleri olan üst görev; ilerleme alt görevlerden
  if (acikAlt > 0) return BOS;
  // 15: dış katılımcının işi; engelini ekip kaldırabilir (karar 4)
  if (sahipDis) return a.durum === 'engelli' ? yap('baglanti', 'engel_kaldir', ['onizle']) : yap('baglanti', null, ['onizle']);
  // 14: ekipten başkasının işi (başkasının agent'ı dahil): engelde "Hatırlat" (karar 3); akış sahibi sırası gelen işi de hatırlatır
  if (!sahibi) {
    const aiSirasi = a.oto && a.oto_durum !== 'bakilacak' && a.oto_durum !== 'hata' && a.durum !== 'engelli';
    if (hatirlatildi || aiSirasi || alt) return BOS;
    if (a.durum === 'engelli') return yap(null, 'hatirlat');
    if (akisSahibi && (a.durum === 'hazir' || a.durum === 'suruyor')) return yap(null, null, ['hatirlat']);
    return BOS;
  }

  // 8–12: agent'ın işi, AI yapsın'a uygun (karar 6: alt görevde de)
  if (agentBenim && otoUygun(a)) {
    const calisir = a.durum === 'hazir' || a.durum === 'suruyor';
    if (!a.oto) {
      if (a.durum === 'engelli') return yap('engel_kaldir', claude);
      // AI yapsın yalnız Claude rutiniyle çalışır: Claude'u bağlı olmayan kişiye "kur" ana düğme olmaz, ⋯ içinde kalır
      if (tetikYok && claudeYok) return calisir ? yap(claude || 'kendim_bitir', claude && 'kendim_bitir', ['oto_kur']) : yap(null, claude, ['oto_kur']);
      return yap(tetikYok ? 'oto_kur' : 'oto_ac', claude, [calisir && 'kendim_bitir']);
    }
    // P4 (0.33.0): AI çıktısı yorumla geri gönderilir ya da nedenle reddedilir; AI yeni sürüm yazar. 4 turdan sonra düzeltme kullanıcıda.
    if (a.oto_durum === 'bakilacak') return (a.inceleme_gecmisi || []).length >= INCELEME_TUR_SINIRI
      ? yap('onayla', 'duzelt', ['kendim_yapacagim'])
      : yap('onayla', 'geri_gonder', ['reddet', 'duzelt', 'kendim_yapacagim']);
    if (a.oto_durum === 'hata' || a.durum === 'engelli') return yap('yeniden_dene', claude, ['oto_kapat']);
    if (a.oto_durum === 'tetiklendi') return a.oto_oturum ? yap('oturum', null, ['oto_kapat']) : yap(null, claude, ['oto_kapat']);
    return yap(tetikYok ? 'oto_kur' : null, claude, ['oto_kapat']);
  }

  // 1. satır önerisi (12 Kas): kendi açık işinde son tarih ⋯ içinden değişir; alt görevin tarihi kendi satırında
  const tarih: Eylem | null = alt ? null : 'tarih_degistir';
  // 6–7: senin kararın; ana düğme seçenek şeridini açar (karar 2)
  if (a.karar_adimi) {
    if (a.durum === 'sirada') return yap(null, null, ['engel_bildir', tarih]);
    if (a.durum === 'engelli') return yap('engel_kaldir', claude && 'claude_dusun', [tarih]);
    return yap('karar_ver', claude && 'claude_dusun', ['engel_bildir', tarih]);
  }
  // 1: sırada (öncüller bitmedi): hazırlık için Claude; engel önceden bildirilir, tarih kaydırılır (1. satır önerisi)
  if (a.durum === 'sirada') return yap(null, claude, ['engel_bildir', tarih]);
  // 5: engelli
  if (a.durum === 'engelli') return yap('engel_kaldir', claude, [tarih]);
  // 2–4: hazır ya da sürüyor. Sırası gelmiş ama başlanmamış işte ikincil "Başladım" (karar 1); Claude bağlantısı varsa
  // "Claude’da başla" hem sohbeti açar hem işi başlatır, "Başladım" ⋯ içinde kalır
  const hazir = a.durum === 'hazir';
  const yan: Eylem | null = hazir ? (claude ? 'claude_basla' : 'basladim') : claude;
  const bas = hazir && claude ? 'basladim' : null;
  const bekleniyor = a.cikti_bekleniyor === true || !!a.beklenen_cikti;
  const ciktiVar = (a.ciktilar || []).length > 0 || a.cikti_sayisi > 0;
  if (ciktiVar) return yap('bitti', 'cikti_ekle', [yan, hazir && claude && 'basladim', 'engel_bildir', tarih]);
  if (bekleniyor) return yap('cikti_ekle', yan, [bas, 'ciktisiz_bitir', 'engel_bildir', tarih]);
  return yap('bitti', yan, [bas, 'engel_bildir', tarih]);
}

/** Düğme adları; sohbet düğmeleri kişinin bağlı uygulamasının adıyla (9 Kas). */
export interface UygAdlari { ad: string; da: string; la: string }
const CLAUDE_AD: UygAdlari = { ad: 'Claude', da: 'Claude’da', la: 'Claude’la' };
export function eylemAdi(e: Eylem, U: UygAdlari = CLAUDE_AD): string {
  switch (e) {
    case 'claude': return `${U.da} aç`;
    case 'claude_basla': return `${U.da} başla`;
    case 'claude_dusun': return `${U.la} düşün`;
    // AI yapsın yalnız Claude rutiniyle çalışır: başka uygulama bağlıysa bunu düğmede söyler
    case 'oto_kur': return U.ad === 'Claude' ? 'AI yapsın’ı kur' : 'AI yapsın’ı kur (Claude gerekir)';
    default: return EYLEM_AD[e];
  }
}
export const EYLEM_AD: Record<Eylem, string> = {
  bitti: 'Bitti',
  cikti_ekle: 'Çıktı ekle',
  ciktisiz_bitir: 'Çıktısız bitir',
  claude: 'Claude’da aç',
  claude_basla: 'Claude’da başla',
  claude_dusun: 'Claude’la düşün',
  basladim: 'Başladım',
  karar_ver: 'Karar ver',
  engel_bildir: 'Engel bildir',
  tarih_degistir: 'Tarihi değiştir',
  engel_kaldir: 'Engeli kaldır',
  oto_ac: 'AI yapsın',
  oto_kur: 'AI yapsın’ı kur',
  oto_kapat: 'AI yapsın’ı kapat',
  kendim_bitir: 'Kendim yaptım, bitir',
  oturum: 'Claude oturumunu aç',
  onayla: 'Onayla, bitir',
  geri_gonder: 'Yorumla geri gönder',
  reddet: 'Reddet',
  duzelt: 'Claude’la düzelt',
  kendim_yapacagim: 'Kendim yapacağım (AI’ı kapat)',
  yeniden_dene: 'Yeniden dene',
  yeniden_ac: 'Yeniden aç',
  baglanti: 'Bağlantı gönder',
  onizle: 'Önizle',
  hatirlat: 'Hatırlat',
};

/** "Hatırlat" (karar 3): sahibine uygulama içi bildirim düşen not. Önek bildirimde "hatırlattı" diye okunur. */
export const HATIRLATMA = 'Hatırlatma';
export const hatirlatmaNotu = (a: any) => a.durum === 'engelli' && a.engel
  ? `${HATIRLATMA}: “${String(a.engel).split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '').slice(0, 80)}” engeli hâlâ duruyor mu? Kalktıysa Engeli kaldır’a bas.`
  : `${HATIRLATMA}: bu görevin sırası geldi, seni bekliyor.`;
/** Bakan kişi bu görevi son 20 saatte hatırlattı mı (olaylardan). */
export const sonHatirlatma = (olaylar: any[] | undefined, ben: string, now: number) =>
  (olaylar || []).some((e: any) => e.tip === 'not' && e.kim === ben && String(e.ozet || '').startsWith(HATIRLATMA) && now - Date.parse(e.zaman) < 20 * 3600e3);
/** Hatırlatmanın gideceği kişi: agent işinde agent'ın sahibi. */
export const hatirlatilan = (a: any) => (a.sahip_tip === 'agent' && a.agent_sahibi ? a.agent_sahibi : a.sahip);

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
    const tur = (a.inceleme_gecmisi || []).length;
    const ne = a.inceleme === 'yorumlu_inceleme' ? 'İncele; onayla ya da yorumla geri gönder.' : 'Bakıp onayla.';
    return `${Number.isFinite(t) ? `${ag} ${o.ek(o.zaman(t))}` : ag} ${son ? `“${son.ad}” ` : ''}${tur ? `çıktısının ${tur + 1}. sürümünü` : 'çıktısını'} yazdı. ${ne}`;
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
    const kim = yer ? (yer.sahip === o.ben ? ` Cevabı ${q.adim_no}. görevde vereceksin.` : ` Cevabı ${q.adim_no}. görevde ${o.kisa(yer.sahip)} verecek.`) : '';
    return `${/soru/i.test(ad) ? ad : `${ad} sorusu`} cevaplanınca ${ag} başlayacak.${kim}`;
  }
  const cikti = b.match(/^çıktı \(([\d, ]+)\)$/);
  if (cikti) return `${cikti[1]}. görevin çıktısı yazılınca ${ag} başlayacak.`;
  const gun = b.match(/^planlanan gün \((.+)\)$/);
  if (gun) return `${ag} planlanan günde, ${gun[1]}, başlayacak.`;
  if (b === 'öncüller') {
    const once = (a.bekledigi || []).filter((x: any) => !BITTI(x.durum)).map((x: any) => x.no);
    return once.length ? `${once.join(', ')}. görev bitince ${ag} başlayacak.` : `Öncüller bitince ${ag} başlayacak.`;
  }
  if (b === 'sürüyor') return `${ag} üzerinde çalışıyor.`;
  if (o.tetikYok) return `AI yapsın açık ama Claude rutinin kurulu değil; kurunca ${ag} başlayacak.`;
  return `Hazır; ${ag} bir sonraki taramada başlayacak.`;
}

/** Çıktı beklenen ve henüz çıktısı olmayan kendi işin: neyin beklendiği (W1 cümle tablosu). */
export function ciktiCumlesi(a: any, ben: string): string | null {
  if (BITTI(a.durum) || a.sahip !== ben || a.karar_adimi || !(a.durum === 'hazir' || a.durum === 'suruyor')) return null;
  if ((a.ciktilar || []).length || a.cikti_sayisi > 0) return null;
  if (!(a.cikti_bekleniyor === true || a.beklenen_cikti)) return null;
  const ne = String(a.beklenen_cikti || '').trim();
  return `${ne && ne.length <= 60 ? ne.replace(/\.$/, '') : 'Çıktı'} bekleniyor. Ekleyince bitirebilirsin.`;
}

/**
 * 9 Kas (AI yapsın netliği): bu görev bir AI yapsın işinin önündeyse ne olacağını söyler. AI işi öncülleri bitince
 * kendiliğinden başlar; beklenen çıktı yazılmadıysa başlamaz (sunucu otoBekledigi "çıktı (n)").
 */
export function aiArdilCumlesi(a: any, adimlar: any[], ben: string, kisa: (ad: string) => string): string | null {
  if (BITTI(a.durum)) return null;
  const L = adimlar.filter((x: any) => x.oto && !BITTI(x.durum) && (x.bagimli || []).includes(a.no));
  if (!L.length) return null;
  const kim = (x: any) => (x.agent_sahibi === ben ? 'senin agent’ın' : x.agent_sahibi ? `${ozelEk(kisa(x.agent_sahibi), 'in')} agent’ı` : kisa(x.sahip));
  const ilk = L[0];
  const ne = L.length > 1 ? `${L.map((x: any) => `${x.no}.`).join(', ')} görevdeki ${L.length} AI yapsın işi` : `${kim(ilk)} ${ilk.no}. göreve`;
  const ciktiSart = a.cikti_bekleniyor === true && !((a.ciktilar || []).length || a.cikti_sayisi > 0);
  return ciktiSart
    ? `Bu görevin çıktısı eklenip bitince ${ne} kendiliğinden başlayacak (AI yapsın); çıktısız bitirilirse AI başlamaz.`
    : `Bu görev bitince ${ne} kendiliğinden başlayacak (AI yapsın).`;
}
