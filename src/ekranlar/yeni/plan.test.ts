import { describe, expect, it } from 'vitest';
import { adimRozetleri, zamanSeridi } from './plan';

describe('P6 plan ekranı', () => {
  it('senin zamanın şeridi', () => expect(zamanSeridi({ karar: 4, bakis: 3, dk: 25, ai: 9, senin: 2, dis: 1 })).toBe('Senin zamanın: ~25 dk, 4 karar anı, 3 AI çıktısına bakış, 2 iş · AI: 9 iş · dış: 1 iş'));
  it('sende iş yoksa', () => expect(zamanSeridi({ karar: 0, bakis: 0, dk: 0, ai: 3, senin: 0, dis: 0 })).toBe('Senin zamanın: yok · AI: 3 iş'));
  it('pay yoksa şerit yok', () => expect(zamanSeridi(null)).toBeNull());
  it('AI adımı: AI yapar + inceleme', () => expect(adimRozetleri({ yurutme: 'ai_yapar', sahip_tip: 'agent', inceleme: 'hizli_onay' }).map((r) => r.metin)).toEqual(['AI yapar', 'hızlı onay']));
  it('insan adımında AI hazırlar = Claude’la hazırla', () => expect(adimRozetleri({ yurutme: 'ai_hazirlar_insan_bitirir', sahip_tip: 'insan', karar: true, karar_tur: 'onay_red' }).map((r) => r.metin)).toEqual(['Claude’la hazırla', 'onay/red']));
  it('dış adım', () => expect(adimRozetleri({ yurutme: 'dis', sahip_tip: 'dis' }).map((r) => r.ton)).toEqual(['dis']));
  it('seçim kararı', () => expect(adimRozetleri({ yurutme: 'insan', sahip_tip: 'insan', karar: true, karar_tur: 'secim' }).map((r) => r.metin)).toEqual(['sen', 'seçim']));
});
