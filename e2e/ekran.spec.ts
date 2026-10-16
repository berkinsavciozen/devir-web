import { test } from '@playwright/test';
import { EKRANLAR } from './ekranlar';

// npm run ekran [-- -g A1]  →  karsilastirma/uygulama/<ad>.png (tasarım boyutunda, 2x)
for (const e of EKRANLAR) {
  test(e.ad, async ({ page }) => {
    await page.setViewportSize({ width: e.w ?? 390, height: e.h ?? 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (e.once) await e.once(page);
    await page.goto(e.yol);
    await page.evaluate(() => document.fonts.ready);
    if (e.hazirla) await e.hazirla(page);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `karsilastirma/uygulama/${e.ad}.png` });
  });
}
