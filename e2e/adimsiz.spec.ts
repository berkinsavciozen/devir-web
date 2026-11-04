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

// 4 Kas: adımsız akış (TMPH) evren listesindeyken detayı yüklenince kur() üyesiz kalıp evreni "Bu ekran açılamadı"ya
// düşürüyordu; artık o galaksi yer tutucu kalır. Akış, sahte sunucu kurulurken (ilk istekten önce) eklenir.
for (const genislik of [390, 1440]) {
  test(`adımsız akış evreni düşürmez (${genislik})`, async ({ page }) => {
    const hatalar: string[] = [];
    page.on('pageerror', (e) => hatalar.push(e.message));
    await page.addInitScript(() => {
      let s: any;
      Object.defineProperty(window, '__devirSahte', { configurable: true, get: () => s, set: (v) => {
        s = v; const a = v.db.T.akis[0];
        v.db.T.akis.push({ ...a, id: 'bos2-akis', kisa_kod: 'BOS2', baslik: 'Boş akış', hedef_tarih: '2026-12-16', durum: 'aktif', kapandi_at: null, baglam: {}, kurallar: {} });
      } });
    });
    await page.setViewportSize({ width: genislik, height: 900 });
    await page.goto('/?senaryo=berkin');
    await expect(page.getByRole('main', { name: 'Evren' })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.evaluate(() => { history.pushState(null, '', '/akis/BOS2/bilgi'); dispatchEvent(new Event('devir:yol')); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { history.pushState(null, '', '/'); dispatchEvent(new Event('devir:yol')); });
    await expect(page.getByRole('main', { name: 'Evren' })).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Bu ekran açılamadı')).toHaveCount(0);
    expect(hatalar).toEqual([]);
  });
}
