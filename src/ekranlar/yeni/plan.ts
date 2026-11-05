/**
 * P6 (5 Kas, plan ekranı): taslağın "senin zamanın" şeridi ve adım satırı rozetleri. Saf işlevler; testleri plan.test.ts'te.
 * Sunucudaki insanPayi ve yurutmeEtiketi'nin (sunucu/yurutme.ts) arayüz karşılığı.
 */
export interface Pay { karar: number; bakis: number; dk: number; ai: number; senin: number; dis: number }

/** "Senin zamanın: ~25 dk · 4 karar anı · 3 AI çıktısına bakış · AI: 9 iş · dış: 1 iş" */
export function zamanSeridi(p: Pay | null | undefined): string | null {
  if (!p) return null;
  const sen = [p.dk ? `~${p.dk} dk` : null, p.karar ? `${p.karar} karar anı` : null, p.bakis ? `${p.bakis} AI çıktısına bakış` : null, p.senin ? `${p.senin} iş` : null].filter(Boolean);
  const diger = [p.ai ? `AI: ${p.ai} iş` : null, p.dis ? `dış: ${p.dis} iş` : null].filter(Boolean);
  return [`Senin zamanın: ${sen.length ? sen.join(', ') : 'yok'}`, ...diger].join(' · ');
}

/** Karar anı sınırı (sunucudaki KARAR_ANI_SINIRI). */
export const KARAR_ANI_SINIRI = 5;

const KARAR_AD: Record<string, string> = { secim: 'seçim', coklu_secim: 'çoklu seçim', onay_red: 'onay/red', tutar_tarih: 'tutar/tarih', serbest: 'karar' };
const INCELEME_AD: Record<string, string> = { hizli_onay: 'hızlı onay', yorumlu_inceleme: 'yorumlu inceleme' };

export type RozetTon = 'ai' | 'hazir' | 'sen' | 'dis';
/** Adım satırının rozetleri: kim yürütür, AI çıktısına nasıl bakılır, karar biçimi. */
export function adimRozetleri(x: any): { metin: string; ton: RozetTon | 'karar' | 'inceleme' }[] {
  const out: { metin: string; ton: RozetTon | 'karar' | 'inceleme' }[] = [];
  const y = x.yurutme, tip = x.sahip_tip;
  if (y === 'ai_yapar') out.push({ metin: 'AI yapar', ton: 'ai' });
  else if (y === 'ai_hazirlar_insan_bitirir') out.push({ metin: tip === 'agent' ? 'AI hazırlar' : 'Claude’la hazırla', ton: 'hazir' });
  else if (y === 'dis' || tip === 'dis') out.push({ metin: 'dış', ton: 'dis' });
  else out.push({ metin: 'sen', ton: 'sen' });
  if (tip === 'agent' && INCELEME_AD[x.inceleme]) out.push({ metin: INCELEME_AD[x.inceleme], ton: 'inceleme' });
  if (x.karar) out.push({ metin: KARAR_AD[x.karar_tur] || 'karar', ton: 'karar' });
  return out;
}
