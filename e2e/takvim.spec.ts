import { expect, test } from '@playwright/test';

// P1-E madde 10–11: Adım ekranında takvim ihlali; yedek motorla üretilen taslağın etiketi.

for (const [w, h] of [[1280, 800], [390, 844]] as const) test(`takvim ihlali ${w}×${h}: son tarihi aşan adımın tarih kutusu mercan ve en erken bitişi gösterir`, async ({ page }) => {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/?senaryo=berkin');
  await expect(page.getByRole('main', { name: 'Evren' })).toBeVisible();
  const yol = await page.evaluate(async () => {
    const s = (window as any).__devirSahte;
    const akislar = await s.db.many('akis', { durum: 'aktif' });
    for (const a of akislar) {
      const adimlar = await s.db.many('adim', { akis_id: a.id });
      const x = adimlar.find((d: any) => !['tamam', 'atlandi', 'ertelendi'].includes(d.durum) && d.bagimli?.length && Number(d.sure_tahmin_gun) >= 1);
      if (x) { await s.db.update('adim', { id: x.id }, { son_tarih: '2020-01-02' }); return `/akis/${a.kisa_kod}/adim/${x.no}`; }
    }
    return null;
  });
  expect(yol, 'senaryoda bağımlı, bitmemiş adım var').not.toBeNull();
  await page.evaluate((y) => { history.pushState(null, '', y); dispatchEvent(new Event('devir:yol')); }, yol!);
  const kutu = page.locator('.sayi-kutusu.ihlal');
  await expect(kutu).toBeVisible({ timeout: 10000 });
  await expect(kutu).toContainText('2 Oca');
  await expect(kutu.locator('small')).toContainText('en erken');
  expect(await kutu.locator('small').evaluate((e) => getComputedStyle(e).color)).not.toBe(await page.locator('.sayi-kutusu:not(.ihlal) small').first().evaluate((e) => getComputedStyle(e).color));
  await page.screenshot({ path: `test-results/takvim-ihlal-${w}.png` });
});

test('yedek motor: taslak yedek motorla üretildiyse etiketlenir, birincilde etiket yok', async ({ page }) => {
  await page.goto('/yeni/TEURX?senaryo=berkin');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(page.getByText(/Yedek motor/)).toHaveCount(0);
  await page.evaluate(async () => {
    const s = (window as any).__devirSahte;
    const { id, created_at, ...t } = await s.db.one('taslak', { kisa_kod: 'TEURX' });
    await s.db.insert('taslak', [{ ...t, kisa_kod: 'TEURZ', model: 'openai:gpt-4.1 (yedek; birincil: kredi bitti)' }]);
    history.pushState(null, '', '/yeni/TEURZ'); dispatchEvent(new Event('devir:yol'));
  });
  const hap = page.getByText('Yedek motor', { exact: true });
  await expect(hap).toBeVisible({ timeout: 10000 });
  await expect(hap).toHaveAttribute('title', /yedek motorla \(OpenAI gpt-4\.1\) üretildi; birincil motor yanıt vermedi/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/yedek-motor.png' });
});
