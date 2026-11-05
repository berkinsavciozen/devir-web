import { expect, test } from '@playwright/test';

// 0.31.0 (5 Kas): akışın altındaki "Adı ve arşiv" satırından ad değişir, akış arşive gider ve geri gelir
const KIYAS = process.env.KIYAS_DIZIN;
test('akış: adını değiştir, arşive at, arşivden çıkar', async ({ page }) => {
  const hatalar: string[] = [];
  page.on('pageerror', (e) => hatalar.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?senaryo=berkin');
  await expect(page.getByRole('main', { name: 'Evren' })).toBeVisible();
  const kod = await page.evaluate(async () => {
    const s = (window as any).__devirSahte; const a = (await s.db.many('akis', { durum: 'aktif' }))[0];
    history.pushState(null, '', `/akis/${a.kisa_kod}/bilgi`); dispatchEvent(new Event('devir:yol'));
    return a.kisa_kod as string;
  });
  const satir = page.getByRole('button', { name: 'Akışın adını değiştir ya da arşive at.' });
  await satir.scrollIntoViewIfNeeded();
  await expect(satir).toBeVisible();
  await satir.click();
  const alan = page.getByRole('textbox', { name: 'Akışın adı' });
  await expect(alan).toBeVisible();
  if (KIYAS) await page.screenshot({ path: `${KIYAS}/01-akisi-duzenle-360.png` });
  await alan.fill('Yoga stüdyosu açılışı');
  await page.getByRole('button', { name: 'Adı kaydet', exact: true }).click();
  await expect(alan).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yoga stüdyosu açılışı');

  await satir.click();
  await page.getByRole('button', { name: 'Arşive at', exact: true }).click();
  const arsivde = page.getByRole('button', { name: 'Bu akış arşivde. Arşivden çıkar ya da adını değiştir.' });
  await expect(arsivde).toBeVisible();
  if (KIYAS) { await arsivde.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${KIYAS}/02-arsivde-satir-360.png` }); }
  const durum = await page.evaluate(async (k) => (await (window as any).__devirSahte.db.one('akis', { kisa_kod: k })).durum, kod);
  expect(durum).toBe('arsiv');

  // Arşiv sayfasında görünür; Akışlar listesinde görünmez
  await page.evaluate(() => { history.pushState(null, '', '/akislar/arsiv'); dispatchEvent(new Event('devir:yol')); });
  await expect(page.getByRole('list', { name: 'Kapanan akışlar' })).toContainText('Yoga stüdyosu açılışı');
  if (KIYAS) await page.screenshot({ path: `${KIYAS}/03-arsiv-sayfasi-360.png` });
  await page.evaluate(() => { history.pushState(null, '', '/akislar'); dispatchEvent(new Event('devir:yol')); });
  await page.waitForTimeout(800);
  await expect(page.getByText('Yoga stüdyosu açılışı')).toHaveCount(0);

  await page.evaluate((k) => { history.pushState(null, '', `/akis/${k}/bilgi`); dispatchEvent(new Event('devir:yol')); }, kod);
  await arsivde.scrollIntoViewIfNeeded();
  await arsivde.click();
  if (KIYAS) await page.screenshot({ path: `${KIYAS}/04-arsivden-cikar-360.png` });
  await page.getByRole('button', { name: 'Arşivden çıkar', exact: true }).click();
  await expect(satir).toBeVisible();
  const son = await page.evaluate(async (k) => (await (window as any).__devirSahte.db.one('akis', { kisa_kod: k })).durum, kod);
  expect(son).toBe('aktif');
  expect(hatalar).toEqual([]);
});
