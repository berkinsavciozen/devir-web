import { expect, test, type Page } from '@playwright/test';

// W0 (4 Kas, AI yapsın test bulguları): B15 Akışlar listesi kesilmez; B11/B16 çıktı üstte ve tıklanınca yeni sekmede okunur.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};

test('B15: telefonda Akışlar sayfası bütün akışları listeler, son satıra kaydırılır', async ({ page }) => {
  await ac(page, '/akislar?senaryo=berkin&hal=olcek');
  const L = page.getByRole('list', { name: 'Akışlar' }).getByRole('listitem');
  await expect.poll(() => L.count()).toBeGreaterThan(7);
  await page.getByRole('button', { name: 'Arşiv' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Arşiv' })).toBeInViewport();
  await L.last().scrollIntoViewIfNeeded();
  await expect(L.last()).toBeInViewport();
});

test('B11/B16: çıktı görev detayında üstte; adına basınca okunur sayfa yeni sekmede açılır', async ({ page, context }) => {
  await ac(page, '/akis/XPVZ/adim/1?senaryo=berkin&hal=karar');
  const cikti = page.getByRole('region', { name: 'Çıktılar' });
  await expect(cikti).toBeVisible();
  // W5: NE ZAMAN kartının altında, geçmişten önce
  const [yc, yz, yg] = await Promise.all([cikti.boundingBox(), page.getByRole('region', { name: 'NE ZAMAN' }).boundingBox(), page.locator('details.gd-gecmis').boundingBox()]);
  expect(yc!.y).toBeGreaterThan(yz!.y);
  expect(yc!.y).toBeLessThan(yg!.y);
  const [yeni] = await Promise.all([context.waitForEvent('page'), cikti.getByRole('button', { name: 'Önizle: Teklif paketi' }).click()]);
  await yeni.waitForLoadState();
  await expect(yeni).toHaveURL(/\/akis\/XPVZ\/cikti\/\d+/);
  await expect(yeni.getByRole('heading', { name: 'Teklif paketi', level: 1 })).toBeVisible();
  await expect(yeni.getByText('teslimden sonra 7 gün')).toBeVisible();
  await expect(yeni.getByRole('button', { name: 'Göreve git' })).toBeVisible();
});
