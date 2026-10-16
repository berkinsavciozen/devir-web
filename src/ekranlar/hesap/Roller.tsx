// Roller (denetim planı, CELISKILER 61): rol tablosu, rol değişikliği önizlemesi, akış bazlı erişim, ekip sayıları.
// Ekip üyesinin akış erişimi uye.kapsam = "akis:KOD1,KOD2" (sunucu 0.11.0); boşsa bütün akışlar.

export type Rol = 'sahip' | 'ekip' | 'dis';
const ISARET = { evet: '✓', hayir: '–' } as const;
const SATIRLAR: [string, string, string, string][] = [
  ['Akışları görür', 'hepsi', 'hepsi ya da seçili', 'kendi adımları'],
  ['Adım günceller', ISARET.evet, ISARET.evet, 'kendi adımları'],
  ['Karar verir, iş açar', ISARET.evet, ISARET.evet, ISARET.hayir],
  ['Ekibi ve anahtarları yönetir', ISARET.evet, ISARET.hayir, ISARET.hayir],
];

/** Rol tablosu: üç rol, dört yetki; vurgulanan sütun kişinin kendi rolü. */
export function RolTablosu({ y, vurgu }: { y: number; vurgu?: string }) {
  const sutun = (r: Rol) => `rol-${r}${vurgu === r ? ' vurgu' : ''}`;
  return (
    <table className="rol-tablo" style={{ top: y }} aria-label="Roller ve yetkiler">
      <thead><tr><th scope="col"><span className="gorunmez">Yetki</span></th><th scope="col" className={sutun('sahip')}>Sahip</th><th scope="col" className={sutun('ekip')}>Ekip</th><th scope="col" className={sutun('dis')}>Dış</th></tr></thead>
      <tbody>
        {SATIRLAR.map(([ad, ...d]) => (
          <tr key={ad}><th scope="row">{ad}</th>{d.map((h, i) => <td key={i} className={sutun((['sahip', 'ekip', 'dis'] as Rol[])[i])} aria-label={h === ISARET.evet ? 'evet' : h === ISARET.hayir ? 'hayır' : h}>{h}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
export const ROL_TABLO_H = 36 * (SATIRLAR.length + 1);

/** "akis:RTD5,HSP2" → ['RTD5','HSP2']; ekip için yoksa null (bütün akışlar). */
export function akisErisimi(kapsam: string | null | undefined): string[] | null {
  const m = String(kapsam || '').match(/^akis:(.*)$/i);
  return m ? m[1].split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) : null;
}
export const akisKapsami = (kodlar: string[] | null) => (kodlar ? `akis:${kodlar.join(',')}` : null);

/** Rol değişikliği önizlemesi (tek cümle). */
export function rolOnizleme(ad: string, rol: Rol, o: { kodlar?: string[] | null; kapsam?: string }): string {
  if (rol === 'sahip') return `${ad} sahip olunca ekibi ve anahtarları da yönetir.`;
  if (rol === 'ekip') return o.kodlar ? `${ad} ekip olunca yalnız seçili ${o.kodlar.length} akışı ve kendi adımlarını görür; ekibi yönetemez.` : `${ad} ekip olunca bütün akışları görür ve günceller; ekibi yönetemez.`;
  return `${ad} dış katılımcı olunca yalnız “${o.kapsam || ad}” adındaki adımları görür.`;
}

/** Üye ve anahtar sayıları: Ayarlar satırı ile Ekip sayfası aynı hesabı kullanır. */
export function ekipSayilari(uyeler: any[], davetler: any[], anahtarlar: any[] | undefined) {
  const etkin = (anahtarlar || []).filter((k) => !k.iptal);
  const anahtarSayisi = (kisi: string | null | undefined) => etkin.filter((k) => kisi && k.kisi === kisi).length;
  const anahtarli = uyeler.filter((u) => anahtarSayisi(u.kisi) > 0).length;
  return { uye: uyeler.length, davet: davetler.length, anahtarli, anahtar: etkin.length, anahtarSayisi, bilinen: anahtarlar != null };
}
export function ekipOzeti(s: ReturnType<typeof ekipSayilari>): string {
  return [`${s.uye} üye`, s.bilinen ? `${s.anahtarli} kişide anahtar` : null, s.davet ? `${s.davet} davet bekliyor` : null].filter(Boolean).join(' · ');
}
