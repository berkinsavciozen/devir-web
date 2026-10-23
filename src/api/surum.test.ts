import { describe, expect, it } from 'vitest';
import { SEMA, SURUM } from '../../sunucu/server.ts';
import { eskiMi, SUNUCU_SURUMU, uyumDurumu } from './surum';

describe('web–sunucu sürüm uyumu (N-8)', () => {
  it('web, depodaki sunucu sürümünü bekler (sunucu sürümü artınca bu da artmalı)', () => {
    expect(SUNUCU_SURUMU).toBe(SURUM);
  });
  it('noktalı sürüm karşılaştırması', () => {
    expect(eskiMi('0.21.0', '0.26.0')).toBe(true);
    expect(eskiMi('0.9.0', '0.10.0')).toBe(true);
    expect(eskiMi('0.26.0', '0.26.0')).toBe(false);
    expect(eskiMi('1.0.0', '0.26.0')).toBe(false);
  });
  it('eski sunucu, uygulanmamış migration ve tamam', () => {
    expect(uyumDurumu({ surum: '0.21.0' })).toEqual({ tamam: false, metin: 'Sunucu 0.21.0 · web 0.26.0 bekliyor, Edge kodu yüklenmeli' });
    expect(uyumDurumu({ surum: '0.26.0', sema: { beklenen: SEMA, canli: null, uyumlu: false } }).metin).toMatch(/migration bekleniyor/);
    expect(uyumDurumu({ surum: '0.26.0', sema: { beklenen: SEMA, canli: SEMA, uyumlu: true } })).toEqual({ tamam: true, metin: 'Sunucu 0.26.0 · erişim açık' });
    expect(uyumDurumu(undefined).tamam).toBe(false);
  });
});
