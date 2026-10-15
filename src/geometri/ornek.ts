// Tasarım verisinden (tasarim/kaynak/veri.json + tasarim/veri/ornek-veri.json) geometri girdisi kurar.
// Yalnız test ve CLI içindir; uygulama girdiyi API'den apidenAkis ile kurar.
import type { GirdiAkis } from './galaksi-geometri';

export const SIMDI = Date.parse('2026-10-14T10:00:00+03:00');

export function ornekAkislar(veri: Record<string, any>, ham: any | null): Record<string, GirdiAkis> {
  const out: Record<string, GirdiAkis> = {};
  for (const kod of Object.keys(veri)) {
    const F = veri[kod], A = ham && ham.akis.find((a: any) => a.kisa_kod === kod);
    const ol = A ? ham.olay.filter((e: any) => e.akis_id === A.id).map((e: any) => ({ t: Date.parse(e.created_at), kim: e.kim, kim_tip: e.kim_tip, arac: e.arac, tip: e.tip, adim_no: e.adim_no })) : [];
    out[kod] = {
      t0: F.created, hedef: Date.parse(F.hedef + 'T23:59:00+03:00'), kapandi: F.kapandi, sahip: 'Berkin', kritik_yol: F.chain, olaylar: ol,
      adimlar: F.steps.map((s: any) => ({ no: s.no, sahip: s.sahip, sahip_tip: s.tip, durum: s.durum, bagimli: s.dep, t: ['tamam', 'atlandi', 'ertelendi'].includes(s.durum) ? (s.bitisAt || s.ef) : s.ef, hazir_at: s.hazirAt, basla_plan: s.sure ? s.ef - s.sure * 864e5 : null, bekleme_saat: null })),
    };
  }
  return out;
}
