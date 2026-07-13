import puppeteer from 'puppeteer'; 
(async () => { 
  const browser = await puppeteer.launch(); 
  const page = await browser.newPage(); 
  page.on('console', msg => console.log('LOG:', msg.text())); 
  page.on('pageerror', err => console.log('ERROR:', err.toString())); 
  await page.goto('http://localhost:5173/complaints', { waitUntil: 'networkidle0' }); 
  await browser.close(); 
})();
