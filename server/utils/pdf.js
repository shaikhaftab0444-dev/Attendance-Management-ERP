const puppeteer = require('puppeteer');

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  try {
    if (browserInstance) {
      await browserInstance.close().catch(() => {});
    }
  } catch (_) {}

  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });

  return browserInstance;
}

/**
 * Generates a PDF buffer from an HTML string using Puppeteer
 * @param {string} htmlString - Full HTML markup
 * @param {object} options - Puppeteer PDF options (landscape, format, etc.)
 * @returns {Promise<Buffer>}
 */
async function generatePdf(htmlString, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(htmlString, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Small delay to ensure all CSS styles are rendered
    await page.evaluateHandle('document.fonts.ready');
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape || false,
      printBackground: true,
      margin: options.margin || {
        top: '12mm',
        right: '10mm',
        bottom: '12mm',
        left: '10mm',
      },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = {
  generatePdf,
  getBrowser,
};
