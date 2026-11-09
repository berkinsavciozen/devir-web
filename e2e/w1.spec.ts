import { expect, test, type Page } from '@playwright/test';

// W1 (4 Kas): görev detayının eylem çubuğu; düğme matrisi (eylemler.test.ts) ekranda.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.locator('.gd-bas').waitFor();
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });
const cubuk = (p: Page) => p.getByRole('group', { name: 'Eylemler' });
const menu = async (p: Page, ad: string) => { await cubuk(p).getByRole('button', { name: 'Diğer eylemler' }).click(); await p.getByRole('menuitem', { name: ad }).click(); };

test('W1 · çıktı beklenen iş: ana düğme Çıktı ekle; engel bildirilir ve kaldırılır', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin&hal=w1');
  await expect(page.locator('.gd-cumle')).toContainText('TestFlight davet bağlantısı bekleniyor. Ekleyince bitirebilirsin.');
  await expect(cubuk(page).getByRole('button', { name: 'Çıktı ekle' })).toBeVisible();
  await expect(cubuk(page).getByRole('button', { name: 'Bitti', exact: true })).toHaveCount(0);
  await cubuk(page).getByRole('button', { name: 'Diğer eylemler' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Başladım', 'Çıktısız bitir', 'Engel bildir']);
  await cek(page, 'W1-menu-390');
  await page.getByRole('menuitem', { name: 'Engel bildir' }).click();
  await cubuk(page).getByRole('textbox', { name: 'Neye takıldın' }).fill('Apple geliştirici hesabı onayı');
  await cubuk(page).getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.locator('.gd-haplar')).toContainText('Engelli');
  await expect(page.locator('.gd-engel')).toContainText('Apple geliştirici hesabı onayı');
  await cubuk(page).getByRole('button', { name: 'Engeli kaldır' }).click();
  await expect(page.locator('.gd-haplar')).not.toContainText('Engelli');
  await expect(cubuk(page).getByRole('button', { name: 'Çıktı ekle' })).toBeVisible();
});

test('W1 · çıktı beklenen iş ⋯ Çıktısız bitir görevi tamamlar; bitmiş görev yeniden açılır', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin&hal=w1');
  await menu(page, 'Çıktısız bitir');
  await expect(page.locator('.gd-bas')).toContainText(/bitti|bitirdin/i);
  await menu(page, 'Yeniden aç');
  await expect(page.locator('.gd-bas')).not.toContainText(/bitti|bitirdin/i);
  await expect(cubuk(page).getByRole('button', { name: 'Çıktı ekle' })).toBeVisible();
});

test('W1 · AI kapalı agent işi: AI yapsın tek dokunuşla açılır', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/9?senaryo=berkin&hal=w1');
  const b = page.getByRole('region', { name: 'AI YAPSIN' });
  await expect(b.getByRole('status')).toHaveText(/^Kapalı\./);
  await cubuk(page).getByRole('button', { name: 'AI yapsın', exact: true }).click();
  await expect(b.getByRole('status')).toHaveText(/^Açık\./);
  await expect(cubuk(page).getByRole('button', { name: 'AI yapsın', exact: true })).toHaveCount(0);
});

test('W1 · AI yapamadı: cümle nedenini söyler; Yeniden dene engeli kaldırır', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/10?senaryo=berkin&hal=w1');
  // W5 ikinci tur: başlık cümlesi "yapamadı", engel bandı nedeni söyler
  await expect(page.locator('.gd-bas')).toContainText('yapamadı');
  await expect(page.locator('.gd-engel')).toContainText('Rutin işi aldı ama bitiremedi');
  await cek(page, 'W1-ai-hata-390');
  await cubuk(page).getByRole('button', { name: 'Yeniden dene' }).click();
  await expect(page.locator('.gd-haplar')).not.toContainText('Engelli');
  await expect(page.locator('.gd-cumle')).toHaveText('9. görev bitince Berkin’in Claude’u başlar.');
});

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`W1 · ${w}: karar görevinde form eylemlerin hemen altında; "Seçenekleri gör" yok`, async ({ page }) => {
    await ac(page, '/akis/RTD5/adim/4?senaryo=berkin', w, h);
    await expect(page.getByRole('button', { name: 'Seçenekleri gör' })).toHaveCount(0);
    await expect(cubuk(page).getByRole('button', { name: 'Claude’la düşün' })).toBeVisible();
    // W5 ikinci tur: karar görevinde karar formu eylemlerin hemen altında, sonra NE · NEDEN · NE ZAMAN
    const sira = await page.locator('.gd > .gd-eylem, .gd > section, .gd > div.gd-bolum').evaluateAll((L) => L.map((e) => e.getAttribute('aria-label') || e.className));
    expect(sira.filter((x) => ['Eylemler', 'KARAR', 'NE YAPILACAK', 'NEDEN', 'NE ZAMAN'].includes(x))).toEqual(['Eylemler', 'KARAR', 'NE YAPILACAK', 'NEDEN', 'NE ZAMAN']);
    await cek(page, `W1-karar-${w}`);
  });
  test(`W1 · ${w}: onay bekleyen AI işi`, async ({ page }) => {
    await ac(page, '/akis/RTD5/adim/6?senaryo=berkin&hal=ai', w, h);
    await cek(page, `W1-ai-onay-${w}`);
  });
}
