// İlerleme sayımı sunucuyla aynı (S1, sunucu ilerlemeSay): atlanan ve ertelenen adım bitmiş sayılmaz, toplamdan düşer.
export interface Ilerleme { tamam: number; toplam: number; atlandi: number; ertelendi: number }

export function ilerleme(A: { durum: string }[]): Ilerleme {
  const atlandi = A.filter((a) => a.durum === 'atlandi').length, ertelendi = A.filter((a) => a.durum === 'ertelendi').length;
  return { tamam: A.filter((a) => a.durum === 'tamam').length, toplam: A.length - atlandi - ertelendi, atlandi, ertelendi };
}

/** Akışın ilerlemesi: detay geldiyse adımlardan, yoksa kartın (sunucu) ilerlemesi. */
export function akisIlerlemesi(k: any, d?: any): Ilerleme {
  if (d?.adimlar) return ilerleme(d.adimlar);
  const i = k?.ilerleme || {};
  return { tamam: i.tamam ?? 0, toplam: i.toplam ?? 0, atlandi: i.atlandi ?? 0, ertelendi: i.ertelendi ?? 0 };
}

/** "8/12 adım" ya da "8/12 adım · 2 atlandı" */
export const ilerlemeMetni = (i: Ilerleme) => `${i.tamam}/${i.toplam} adım${i.atlandi ? ` · ${i.atlandi} atlandı` : ''}${i.ertelendi ? ` · ${i.ertelendi} ertelendi` : ''}`;
