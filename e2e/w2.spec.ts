import { expect, test, type Page } from '@playwright/test';

// W2 (4 Kas): AI yapsın görünürlüğü. Destek gemisi kendi sarmalında, kişinin gemisine iple bağlı (5 Kas); onay bekleyen işte camgöbeği flama;
// haritada AI çipi → AI etkinliği (durum grupları + zaman çizelgesi); listede AI durumu; harita dilinde AI satırları.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`W2 · ${w}: AI çipi onay sayısını söyler; AI etkinliği onay bekleyen işi ve zaman çizelgesini gösterir`, async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai', w, h);
    const cip = page.getByRole('button', { name: /^AI etkinliği: 1 onay/ });
    await expect(cip).toBeVisible();
    await cek(page, `W2-harita-${w}`);
    await cip.click();
    const d = page.getByRole('dialog', { name: 'AI etkinliği' });
    await expect(d.getByRole('region', { name: 'ONAYINI BEKLİYOR' })).toContainText('6. Post görseli');
    await expect(d.getByRole('region', { name: 'SIRADA' })).toContainText('10. Rapor');
    await expect(d.getByRole('link', { name: 'Oturumu aç' })).toHaveAttribute('href', 'https://claude.ai/code/session_sahte');
    await cek(page, `W2-ai-etkinligi-${w}`);
    await d.getByRole('button', { name: /6\. Post görseli/ }).first().click();
    await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
  });
}

test('W2 · 1440: listede AI durumu yazar; agent adı kısalmaz', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai', 1440, 900);
  // W6: panel önce akışa süzülmüş Pano; süzgeç kalkınca adım listesi
  await page.getByRole('button', { name: 'Akış süzgecini kaldır' }).click();
  // W4: liste satırı görev kartı; cümlede agent adı tam, ekran okuyucu etiketinde AI durumu
  await expect(page.getByRole('button', { name: /Berkin’in Claude’u · AI yazdı, onayını bekliyor/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Berkin’in Claude’u · AI yapsın açık/ })).toBeVisible();
  await expect(page.getByText('Post görseli: Berkin’in Claude’u yazdı, onayını bekliyor')).toBeVisible();
});

test('W2 · 390: harita dilinde AI satırları; onay satırı haritada gösterir', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai');
  await page.getByRole('button', { name: 'Harita dili' }).click();
  await expect(page.getByRole('button', { name: /AI yazdı, onayla: 1\./ })).toBeVisible();
  await expect(page.getByText('Agent', { exact: true }).first()).toBeVisible();
  await cek(page, 'W2-lejant-390');
});

test('W2 · AI işi olmayan akışta AI çipi yok', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Harita dili' }).waitFor();
  await expect(page.getByRole('button', { name: /^AI etkinliği/ })).toHaveCount(0);
});

// 12 Kas (D5): zaman spirali varsayılan; destek ipi eski haritanın dili, orada aynen kalır
test('W2 · 390: eski haritada destek agent kendi sarmalında gider, sahibinin gemisine iple bağlı', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai&harita=eski');
  const ip = page.locator('path.destek-ip').first();
  await expect(ip).toBeAttached();
  const d = await ip.getAttribute('d');
  const [, x0, y0, x1, y1] = /^M([\d.-]+),([\d.-]+) Q[\d.-]+,[\d.-]+ ([\d.-]+),([\d.-]+)$/.exec(d || '') || [];
  expect(Math.hypot(+x1 - +x0, +y1 - +y0)).toBeGreaterThan(19);
  await cek(page, 'W2-destek-ip-390');
});

test('W2 · 390: zaman spiralinde agent kendi işinin yanında ayrı robot, sahibine ip yok', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai');
  await page.getByRole('button', { name: 'Harita dili' }).waitFor();
  await expect(page.locator('path.destek-ip')).toHaveCount(0);
});
