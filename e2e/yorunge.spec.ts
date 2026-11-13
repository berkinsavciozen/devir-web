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

test('telefon: işe dokununca kutu açılır, işi örtmez, harita yerinde kalır; ikinci dokunuş görevi açar', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai');
  const kam0 = await page.locator('.ky-kap svg.ky-svg > g').first().getAttribute('transform');
  await dokun(page, '.ky-svg .gz[data-no="6"]');
  const k = page.getByRole('dialog', { name: /^6\. Post görseli/ });
  await expect(k).toBeVisible();
  await expect(k.getByRole('button', { name: 'Onayla, bitir' })).toBeVisible();
  // kutu işi örtmez (iş alttaysa kutu üstte açılır) ve harita yerinden oynamaz
  const kb = (await k.boundingBox())!, gb = (await page.locator('.ky-svg .gz[data-no="6"]').boundingBox())!, gy = gb.y + gb.height / 2;
  expect(gy < kb.y || gy > kb.y + kb.height).toBe(true);
  expect(await page.locator('.ky-kap svg.ky-svg > g').first().getAttribute('transform')).toBe(kam0);
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
  test(`yakınlaşma · ${w}: sürgü yukarı çekilince işler aralanır, çerçeve yerinde kalır; çift tık açılış ölçeği`, async ({ page }) => {
    await ac(page, '/akis/RK8R?senaryo=berkin&hal=rk8r-g12&tanitim=0', w, h);
    const surgu = page.getByRole('slider', { name: /^Yakınlaştırma/ });
    await expect(surgu).toBeVisible();
    await expect(surgu).toHaveAttribute('aria-valuenow', '100');
    const kamera = () => page.locator('.ky-kap svg.ky-svg > g').first().getAttribute('transform');
    const yer = async () => { const b = (await page.locator('.ky-svg .gz[data-no="10"]').boundingBox())!; return b.x + b.width / 2; };
    const k0 = await kamera(), x0 = await yer();
    const b = (await surgu.boundingBox())!, tb = (await page.locator('.ky-zoom-top').boundingBox())!;
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, b.y + b.height * .38, { steps: 5 }); await page.mouse.up();
    expect(Number(await surgu.getAttribute('aria-valuenow'))).toBeGreaterThan(150);
    expect(await kamera()).toBe(k0); // çerçeve kıpırdamaz
    expect(await yer()).toBeGreaterThan(x0 + 12); // ileri tarihli iş iğneden uzaklaşır
    await surgu.focus(); await page.keyboard.press('ArrowDown');
    expect(Number(await surgu.getAttribute('aria-valuenow'))).toBeLessThan(200);
    await page.locator('.ky-zoom-top').dblclick();
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

test('araca dokununca kişi kutusu: durum, iş ve hamle; işe dokununca görev kutusu açılır; telefonda sığdır haritayı bozmaz', async ({ page }) => {
  await ac(page, '/akis/RK8R?senaryo=berkin&hal=rk8r-g12&tanitim=0');
  const kam0 = await page.locator('.ky-kap svg.ky-svg > g').first().getAttribute('transform');
  await dokun(page, '.ky-svg .arac-g[data-kisi="Mert"] .arac-alan');
  const k = page.getByRole('dialog', { name: /^Mert: durum ve hamleler/ });
  await expect(k).toBeVisible();
  await expect(k).toContainText('çalışıyor');
  await expect(k.getByRole('button', { name: /Şimdiki işi/ })).toContainText('8.');
  await expect(k.getByRole('group', { name: 'Bekleyen hamleler' }).getByRole('button').first()).toContainText('Bitir');
  await k.getByRole('button', { name: /Şimdiki işi/ }).click();
  await expect(k).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /^8\. / })).toBeVisible();
  await page.getByRole('button', { name: 'Haritayı sığdır' }).click();
  expect(await page.locator('.ky-kap svg.ky-svg > g').first().getAttribute('transform')).toBe(kam0);
  expect(await page.locator('.ky-kap').evaluate((e) => getComputedStyle(e).touchAction)).toBe('none');
});

// U7b: çerçeve akışın kendisi (başlangıç ve bitiş çerçevenin uçlarında). Yakınlaşınca içerik büyür (yörünge aralığı ve işaretler),
// çerçeve ve gün çentikleri yerinde kalır; yakınlaşmışken dikey çekiş sığmayan yörüngeleri getirir.
for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`çerçeve · ${w}: harita yalnız akışın tarihlerini kapsar; yakınlaşınca yörünge aralığı ve işaretler büyür, çerçeve kıpırdamaz`, async ({ page }) => {
    await ac(page, '/akis/XPVZ?senaryo=berkin&tanitim=0', w, h);
    // ilk ve son gün çentiği akışın başlangıcı ve bitişi; ikisi de harita kutusunun içinde
    const uc = page.locator('.ky-svg .gun-c.uc'), kap = (await page.locator('.ky-kap').boundingBox())!;
    await expect(uc).toHaveCount(2);
    for (const i of [0, 1]) { const b = (await uc.nth(i).locator('line').boundingBox())!; expect(b.x).toBeGreaterThan(kap.x - 1); expect(b.x).toBeLessThan(kap.x + kap.width + 1); }
    const gunler = await page.locator('.ky-svg .gun-c').count();
    expect(gunler).toBeGreaterThan(60); expect(gunler).toBeLessThan(100); // 12 Eki – 2 Oca arası, daha uzun değil
    const olc = async () => { await page.waitForTimeout(350); return olc0(); }; // işaret boyu geçişle değişir
    const olc0 = async () => page.evaluate(() => {
      const y = (q: string) => { const r = document.querySelector(q)!.getBoundingClientRect(); return r.y + r.height / 2; };
      const a = [...document.querySelectorAll('.ky-svg .arac-g .arac-alan')].map((e) => e.getBoundingClientRect());
      const cer = document.querySelector('.ky-svg path.cerceve')!.getBoundingClientRect(), g = document.querySelector('.ky-svg .gun-c.uc line')!.getBoundingClientRect();
      return { ara: Math.abs(a[0].y - a[1].y), boy: document.querySelector('.ky-svg .arac-g .ol .govde-a')!.getBoundingClientRect().height, igne: y('.ky-svg .igne-kutu'), cer: [cer.x, cer.y, cer.width], gun: [g.x, g.y] };
    });
    const o0 = await olc();
    const tb = (await page.locator('.ky-zoom-top').boundingBox())!, rb = (await page.getByRole('slider', { name: /^Yakınlaştırma/ }).boundingBox())!;
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, rb.y + rb.height * .25, { steps: 5 }); await page.mouse.up();
    const o1 = await olc();
    expect(o1.ara).toBeGreaterThan(o0.ara * 1.25); // yörünge aralığı (dikey) büyür
    expect(o1.boy).toBeGreaterThan(o0.boy * 1.15); // işaretler büyür
    expect(o1.cer).toEqual(o0.cer); expect(o1.gun).toEqual(o0.gun); expect(o1.igne).toBe(o0.igne); // çerçeve, uç günler, gösterge yerinde
    // dikey çekiş içeriği kaydırır, çerçeve yine yerinde
    const ilk = (await page.locator('.ky-svg .arac-g .arac-alan').first().boundingBox())!;
    await page.mouse.move(kap.x + 60, kap.y + kap.height * .7); await page.mouse.down();
    await page.mouse.move(kap.x + 60, kap.y + kap.height * .7 - 60, { steps: 4 }); await page.mouse.up();
    const son = (await page.locator('.ky-svg .arac-g .arac-alan').first().boundingBox())!;
    expect(son.y).toBeLessThan(ilk.y - 20); expect(Math.abs(son.x - ilk.x)).toBeLessThan(1);
    expect((await olc()).cer).toEqual(o0.cer);
    // uzaklaşınca işaretler küçülür
    await page.locator('.ky-zoom-top').dblclick();
    await expect(page.getByRole('slider', { name: /^Yakınlaştırma/ })).toHaveAttribute('aria-valuenow', '100');
    await page.waitForTimeout(150);
    const t2 = (await page.locator('.ky-zoom-top').boundingBox())!;
    await page.mouse.move(t2.x + t2.width / 2, t2.y + t2.height / 2); await page.mouse.down();
    await page.mouse.move(t2.x + t2.width / 2, rb.y + rb.height * .98, { steps: 5 }); await page.mouse.up();
    const o2 = await olc();
    expect(o2.boy).toBeLessThan(o0.boy * .9); expect(o2.cer).toEqual(o0.cer);
    await expect(page.getByRole('slider', { name: /^Zaman/ })).toBeVisible(); // uzakta da zaman göstergesi durur
  });
}

test('görev detayı: telefonda arkada yeni harita (seçili iş işaretli, dokunulmaz); detay ve kartlarda haritadaki araç ve gezegen', async ({ page }) => {
  await ac(page, '/akis/RK8R/adim/10?senaryo=berkin&hal=rk8r-g12&tanitim=0');
  const arka = page.locator('.adim-arka-harita');
  await expect(arka.locator('.ky-svg .gz.secili')).toHaveCount(1);
  await expect(arka.locator('.ky-svg .gz.secili')).toHaveAttribute('data-no', '10');
  expect(await arka.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
  // eski sarmal çizilmez
  expect(await page.locator('.sahne-cizim').count() ? await page.locator('.sahne-cizim').first().innerHTML() : '').toBe('');
  // detay: sahibin aracı ve gezegenler haritadaki çizim; kartların küçük resmi de
  const gd = page.locator('.gd');
  await expect(gd.locator('.gd-r1-kim .ky-simge .kabuk')).toHaveCount(1);
  await expect(gd.locator('.gd-gezegen .ky-simge .gz .no')).toHaveText('10');
  await expect(gd.locator('.gorev-kart-harita .ky-simge .gz').first()).toBeAttached();
  // eski haritayı seçen eski arka planı görür
  await page.goto('/akis/RK8R/adim/10?senaryo=berkin&hal=rk8r-g12&tanitim=0&harita=spiral');
  await expect(page.locator('.sahne-cizim circle').first()).toBeAttached();
  await expect(page.locator('.adim-arka-harita')).toHaveCount(0);
});
