import { expect, test, type Page } from '@playwright/test';

// Kişi Yörüngeleri (13 Kas, sentez): akış haritasının varsayılanı. Her kişi kendi yörüngesinde, bugün üstteki göstergenin altında;
// zaman göstergeden çekilir, altta kişi şeridi; işe dokununca kutu, ikinci dokunuş görevi açar. Önceki harita ?harita=spiral ile.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.ky-svg .gz').first().waitFor();
};
const gosterge = (p: Page) => p.getByRole('slider', { name: /^Zaman/ });
const an = async (p: Page) => Number(await gosterge(p).getAttribute('aria-valuenow'));
const dokun = async (p: Page, sec: string) => { const b = (await p.locator(sec).first().boundingBox())!; await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };

test('varsayılan harita Kişi Yörüngeleri; ?harita=spiral önceki haritayı açar, ?harita=yorunge geri döner', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await expect(page.locator('.ky-serit')).toBeVisible();
  await expect(page.locator('.surgu-ray')).toHaveCount(0);
  await page.goto('/akis/RTD5?senaryo=berkin&harita=spiral');
  await page.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
  await expect(page.locator('.ky-serit')).toHaveCount(0);
  await page.goto('/akis/RTD5?senaryo=berkin');
  await page.locator('.harita-gezinme .gezegen-hedef').first().waitFor(); // seçim bu cihazda kalır
  await page.goto('/akis/RTD5?senaryo=berkin&harita=yorunge');
  await expect(page.locator('.ky-serit')).toBeVisible();
});

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`zaman · ${w}: gösterge sağa çekilince ileri gider, dokununca bugüne döner; klavyede ok 3 saat`, async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin', w, h);
    const t0 = await an(page), b = (await page.locator('.ky-svg .igne-kutu').boundingBox())!, x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 80, y, { steps: 6 }); await page.mouse.up();
    const t1 = await an(page);
    expect(t1 - t0).toBeGreaterThan(3 * 36e5);
    expect(t1 % (15 * 60e3)).toBe(0); // bırakınca çeyrek saate oturur
    await expect(gosterge(page)).toHaveAttribute('aria-valuetext', /^Tahmin, /);
    await page.mouse.click(x, y);
    expect(await an(page)).toBe(t0);
    await gosterge(page).focus();
    await page.keyboard.press('ArrowLeft');
    expect(t0 - (await an(page))).toBe(3 * 36e5);
    await expect(gosterge(page)).toHaveAttribute('aria-valuetext', /^Geçmiş, /);
    await page.keyboard.press('Home');
    expect(await an(page)).toBe(t0);
  });
}

test('kişi şeridi: dokununca yalnız o kişi öne çıkar, çip ve Herkes ile kalkar; Kişiler kutusuyla aynı seçim', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  const serit = page.getByRole('group', { name: /^Kişiler: dokun/ });
  await expect(serit.getByRole('button', { name: 'Herkes' , exact: false }).first()).toHaveAttribute('aria-pressed', 'true');
  const sen = serit.getByRole('button', { name: /^Sen: / });
  await sen.click();
  await expect(sen).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ky-kap .ky-svg')).toHaveClass(/vurgulu/);
  const cip = page.getByRole('button', { name: /^Kişi: Berkin/ });
  await expect(cip).toBeVisible();
  await cip.click();
  await expect(sen).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.ky-kap .ky-svg')).not.toHaveClass(/vurgulu/);
  // şeridin her düğmesi ≥ 44 px
  for (const d of await serit.getByRole('button').all()) { const b = await d.boundingBox(); if (b) { expect(b.height).toBeGreaterThanOrEqual(44); expect(b.width).toBeGreaterThanOrEqual(44); } }
});

test('telefon: işe dokununca kutu açılır, iş kutunun üstünde kalır; ikinci dokunuş görevi açar', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai');
  await dokun(page, '.ky-svg .gz[data-no="6"]');
  const k = page.getByRole('dialog', { name: /^6\. Post görseli/ });
  await expect(k).toBeVisible();
  await expect(k.getByRole('button', { name: 'Onayla, bitir' })).toBeVisible();
  const kb = (await k.boundingBox())!, gb = (await page.locator('.ky-svg .gz[data-no="6"]').boundingBox())!;
  expect(gb.y + gb.height / 2).toBeLessThan(kb.y);
  await dokun(page, '.ky-svg .gz[data-no="6"]');
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('masaüstü: işe dokununca görev sağ panelde açılır, harita yerinde kalır', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  await dokun(page, '.ky-svg .gz[data-no="6"]');
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
  await expect(page.locator('.ky-svg .gz').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('harita dili: satır haritada o işareti öne çıkarır; çip ile kalkar', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Harita dili' }).click();
  const satir = page.getByRole('button', { name: /^Takıldı: \d+\./ }).first();
  await expect(satir).toBeVisible();
  await satir.click();
  await expect(page.locator('.ky-kap .ky-svg')).toHaveClass(/vurgulu/);
  expect(await page.locator('.ky-svg .v').count()).toBeGreaterThan(0);
  const cip = page.getByRole('button', { name: /^İşaret: Takıldı/ });
  await cip.click();
  await expect(page.locator('.ky-kap .ky-svg')).not.toHaveClass(/vurgulu/);
});

test('harita dokunuşu sayfayı kaydırmaz; gösterge ve şerit 360 px’te ekranda', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 360, 780);
  expect(await page.locator('.ky-kap .ky-svg').evaluate((e) => getComputedStyle(e).touchAction)).toBe('none');
  const W = 360, g = (await gosterge(page).boundingBox())!, s = (await page.locator('.ky-serit').boundingBox())!;
  expect(g.x).toBeGreaterThanOrEqual(0); expect(g.x + g.width).toBeLessThanOrEqual(W);
  expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x + s.width).toBeLessThanOrEqual(W + 1);
});

// U6: zaman yörüngesi sabit çerçeve. Yakınlaşma kamerayı oynatmaz, zaman ölçeğini açar; küçük yüzen sürgüyle de yapılır.
for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`yakınlaşma · ${w}: sürgü sağa çekilince işler aralanır, çerçeve yerinde kalır; çift tık açılış ölçeği`, async ({ page }) => {
    await ac(page, '/akis/RK8R?senaryo=berkin&hal=rk8r-g12&tanitim=0', w, h);
    const surgu = page.getByRole('slider', { name: /^Yakınlaştırma/ });
    await expect(surgu).toBeVisible();
    await expect(surgu).toHaveAttribute('aria-valuenow', '100');
    const kamera = () => page.locator('.ky-kap svg.ky-svg > g').first().getAttribute('transform');
    const yer = async () => { const b = (await page.locator('.ky-svg .gz[data-no="10"]').boundingBox())!; return b.x + b.width / 2; };
    const k0 = await kamera(), x0 = await yer();
    const b = (await surgu.boundingBox())!;
    await page.mouse.move(b.x + b.width * .34, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width * .62, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
    expect(Number(await surgu.getAttribute('aria-valuenow'))).toBeGreaterThan(150);
    expect(await kamera()).toBe(k0); // çerçeve kıpırdamaz
    expect(await yer()).toBeGreaterThan(x0 + 12); // ileri tarihli iş iğneden uzaklaşır
    await surgu.focus(); await page.keyboard.press('ArrowLeft');
    expect(Number(await surgu.getAttribute('aria-valuenow'))).toBeLessThan(200);
    await surgu.dblclick();
    await expect(surgu).toHaveAttribute('aria-valuenow', '100');
    expect(Math.abs((await yer()) - x0)).toBeLessThan(2);
  });
}

test('işaretler: aynı yörüngede gezegenler birbirine binmez (390 ve 1440)', async ({ page }) => {
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    await ac(page, '/akis/RK8R?senaryo=berkin&hal=rk8r-g12&tanitim=0', w, h);
    const binen = await page.evaluate(() => {
      const L = [...document.querySelectorAll('.ky-kap .gz')].filter((g) => getComputedStyle(g).opacity !== '0' && getComputedStyle(g).display !== 'none')
        .map((g) => { const c = g.querySelector('circle.govde, circle')!.getBoundingClientRect(); return { no: (g as HTMLElement).dataset.no, x: c.x + c.width / 2, y: c.y + c.height / 2, r: c.width / 2 }; });
      const s: string[] = [];
      L.forEach((a, i) => L.slice(i + 1).forEach((b) => { if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * .92) s.push(`${a.no}-${b.no}`); }));
      return s;
    });
    expect(binen, `${w}: binen gezegenler`).toEqual([]);
  }
});
