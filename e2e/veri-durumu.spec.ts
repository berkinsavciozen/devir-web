import { expect, test, type Page } from '@playwright/test';

// P1-B2 (M-M2, M-M3): Pano tetiği alt gezinmeye binmez; veri gelmeden boş sonuç gösterilmez; taslak Vazgeç ve aynı varlık onayı.

/** Sahte sunucunun isteklerini süzer: eşleşen yol bekler (asılı kalır) ya da verilen durumla döner. */
async function suz(p: Page, desen: string, tur: 'asili' | number) {
  await p.addInitScript(([d, t]) => {
    let v: any;
    Object.defineProperty(window, '__devirSahte', {
      configurable: true, get: () => v,
      set(s: any) {
        const o = s.istek.bind(s);
        (window as any).__devirSal = () => { (window as any).__devirSuz = false; };
        (window as any).__devirSuz = true;
        s.istek = (req: Request) => (!(window as any).__devirSuz || !new RegExp(d as string).test(req.url) ? o(req)
          : t === 'asili' ? new Promise((r) => { const i = setInterval(() => { if (!(window as any).__devirSuz) { clearInterval(i); r(o(req)); } }, 50); })
          : Promise.resolve(new Response(JSON.stringify({ hata: 'geçici hata' }), { status: t as number, headers: { 'content-type': 'application/json' } })));
        v = s;
      },
    });
  }, [desen, tur] as const);
}

for (const [w, h] of [[360, 800], [390, 844]] as const) {
  test(`Pano tetiği ${w}×${h}: alt gezinmeye binmez, 44 px, tek dokunuşta açar`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?senaryo=berkin');
    const t = page.getByRole('button', { name: 'Pano ve bekleyen işler' });
    await expect(t).toBeVisible();
    const a = (await t.boundingBox())!, n = (await page.locator('.alt-gezinme').boundingBox())!;
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(a.width).toBeGreaterThanOrEqual(44);
    expect(a.y + a.height, 'tetik alt gezinmenin üstünde biter').toBeLessThanOrEqual(n.y);
    // tetiğin ortasına dokunulan öğe tetiğin kendisi (üstüne binen yok)
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.textContent, [a.x + a.width / 2, a.y + a.height / 2])).toBe('Pano ve bekleyen işler');
    await t.click();
    const cip = page.getByRole('group', { name: /Duruma göre süz/ });
    await expect(async () => { const b = (await cip.boundingBox())!; expect(b.y).toBeLessThan(h * 0.6); expect(b.y).toBeGreaterThanOrEqual(0); }).toPass();
  });
}

test('Pano: işler gelmeden "bekleyen iş yok" denmez; yükleniyor notu 300 ms sonra', async ({ page }) => {
  await suz(page, '/akislar/detay', 'asili');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?senaryo=berkin');
  await page.getByRole('button', { name: 'Pano ve bekleyen işler' }).click();
  const not = page.getByRole('status').filter({ hasText: 'İşler yükleniyor' });
  await expect(not).toBeVisible();
  await expect(page.getByText('Şu an bekleyen iş yok.')).toHaveCount(0);
  await expect(page.getByText(/işler yükleniyor\.$/)).toBeVisible();
  await page.evaluate(() => (window as any).__devirSal());
  await expect(not).toHaveCount(0);
});

test('Görevler: yüklenirken not, hata olunca "yüklenemedi" ve yeniden dene', async ({ page }) => {
  await suz(page, '/gorevler', 503);
  await page.goto('/gorevler?senaryo=berkin');
  await expect(page.getByRole('status').filter({ hasText: 'Görevler yükleniyor' })).toBeVisible();
  const hata = page.getByRole('alert').filter({ hasText: 'Görevler yüklenemedi.' });
  await expect(hata).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => (window as any).__devirSal());
  await hata.getByRole('button', { name: 'Yeniden dene' }).click();
  await expect(hata).toHaveCount(0);
});

test('taslak Vazgeç: onaydan sonra taslak iptal, Evren açılır; kod açılınca "vazgeçildi"', async ({ page }) => {
  await page.goto('/yeni/TEURX?senaryo=berkin');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Taslaktan vazgeçilsin mi?' });
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: 'Taslaktan vazgeç' }).click();
  await expect(page).toHaveURL(/\/(\?|$)/);
  await expect(page.getByRole('main', { name: 'Evren' })).toBeVisible();
  // sahte sunucu sayfa yenilenince sıfırlanır: uygulama içinden aç
  await page.evaluate(() => { history.pushState(null, '', '/yeni/TEURX'); dispatchEvent(new Event('devir:yol')); });
  await expect(page.getByText('Bu taslaktan vazgeçildi.')).toBeVisible({ timeout: 10000 });
});

test('aynı varlık: 24 saat içinde kurulmuş akış varsa sorar; "Ayrı iş, yine de kur" kurar', async ({ page }) => {
  const cevapla = async () => {
    const soru = page.getByRole('heading', { level: 2 });
    await page.getByRole('button', { name: 'Hayır', exact: true }).click();
    await expect(soru).toContainText('vergi kaydı');
    await page.getByRole('button', { name: 'Evet', exact: true }).click();
    await expect(soru).toContainText('lojistik');
    await page.getByRole('button', { name: 'Hayır', exact: true }).click();
    await page.getByRole('button', { name: 'Akışı kur' }).click();
  };
  await page.goto('/yeni/TEURX?senaryo=berkin');
  await cevapla();
  await expect(page).toHaveURL(/\/akis\/[A-Z0-9]{4}/);
  const ilk = /\/akis\/([A-Z0-9]{4})/.exec(page.url())![1];
  // sahte taslak motoru hep TEURX'i döndürür: aynı taslağın kopyasını ikinci kez kurmayı dene
  await page.evaluate(async () => {
    const s = (window as any).__devirSahte;
    const { id, created_at, ...t } = await s.db.one('taslak', { kisa_kod: 'TEURX' });
    await s.db.insert('taslak', [{ ...t, kisa_kod: 'TEURY', durum: 'acik', akis_id: null }]);
    history.pushState(null, '', '/yeni/TEURY'); dispatchEvent(new Event('devir:yol'));
  });
  await cevapla();
  const d = page.getByRole('dialog', { name: 'Aynı iş olabilir' });
  await expect(d).toBeVisible();
  await expect(d).toContainText(ilk);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await d.getByRole('button', { name: 'Ayrı iş, yine de kur' }).click();
  await expect(page).toHaveURL(/\/akis\/[A-Z0-9]{4}/);
  expect(page.url()).not.toContain(`/akis/${ilk}`);
});
