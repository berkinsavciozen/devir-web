import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', e => console.log('HATA', (e.stack||'').slice(0, 600)));
await p.goto('http://localhost:5174/?senaryo=berkin'); await p.waitForTimeout(3000);
console.log(await p.locator('nav').count());
await b.close();
