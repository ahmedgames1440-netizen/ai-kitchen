import { chromium } from 'playwright-core';
import path from 'path';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const pg = await b.newPage({ viewport:{width:794,height:1123} });
await pg.goto('file://' + path.resolve('report.html'));
await pg.evaluate(() => document.fonts.ready);
await pg.waitForTimeout(500);
await pg.pdf({ path: 'report.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await b.close();
