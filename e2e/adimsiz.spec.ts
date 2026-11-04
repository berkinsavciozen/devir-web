import { expect, test } from '@playwright/test';

// 4 Kas (TMPH): kurulum yarıda kalan adımsız akış haritayı kırmaz; açıklama ve "Akışlara dön" görünür
test('adımsız akış: harita hata kartı açıklar, sayfa çökmez', async ({ page }) => {
  const hatalar: string[] = [];
  page.on('pageerror', (e) => hatalar.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?senaryo=berkin');
  await expect(page.getByRole('main', { name: 'Evren' })).toBeVisible();
  await page.evaluate(async () => {
    const s = (window as any).__devirSahte; const a = (await s.db.many('akis', {}))[0];
    await s.db.insert('akis', [{ kisa_kod: 'BOS1', sahip_id: a.sahip_id, baslik: 'Boş akış', hedef_tarih: '2026-12-16', durum: 'aktif', kurallar: {}, baglam: {} }]);
    history.pushState(null, '', '/akis/BOS1'); dispatchEvent(new Event('devir:yol'));
  });
  await expect(page.getByRole('alert')).toContainText('adımsız kaldı');
  await expect(page.getByRole('button', { name: 'Akışlara dön' })).toBeVisible();
  expect(hatalar).toEqual([]);
});
