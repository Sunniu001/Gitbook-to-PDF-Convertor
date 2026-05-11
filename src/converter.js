const puppeteer = require("puppeteer");
const axios = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require('pdf-lib');

async function fetchSitemap(url) {
  try {
    const sitemapUrl = url.endsWith('.xml') ? url : `${url.replace(/\/$/, '')}/sitemap.xml`;
    const response = await axios.get(sitemapUrl);
    const sitemapXML = response.data;
    const parsedSitemap = await xml2js.parseStringPromise(sitemapXML);
    
    if (parsedSitemap.urlset && parsedSitemap.urlset.url) {
      return parsedSitemap.urlset.url.map((url) => url.loc[0]);
    } else if (parsedSitemap.sitemapindex && parsedSitemap.sitemapindex.sitemap) {
      const sitemaps = parsedSitemap.sitemapindex.sitemap;
      const pagesSitemap = sitemaps.find(s => s.loc[0].includes('sitemap-pages.xml')) || sitemaps[0];
      return await fetchSitemap(pagesSitemap.loc[0]);
    }
    throw new Error("Could not find urlset or sitemapindex in the sitemap.");
  } catch (error) {
    throw new Error(`Error fetching sitemap: ${error.message}`);
  }
}

async function takeFullPagePdf(page, url, outputPath) {
  await page.setViewport({ width: 1280, height: 800 });
  await page.emulate({
    viewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
    userAgent: "",
  });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  await page.evaluate(() => {
    const selectors = [
      "div.appBarClassName",
      ".scroll-nojump",
      "aside.relative.group.flex.flex-col.basis-full.bg-light",
      "div.flex.md\\:w-56.grow-0.shrink-0.justify-self-end",
      "div.flex.flex-col.md\\:flex-row.mt-6.gap-2.max-w-3xl.mx-auto.page-api-block\\:ml-0",
      "div.flex.row.items-center.mt-6.max-w-3xl.mx-auto.page-api-block\\:ml-0"
    ];
    selectors.forEach(s => {
      const el = document.querySelector(s);
      if (el) el.style.display = "none";
    });
  });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    scale: 1,
    preferCSSPageSize: true,
  });
}

function categorizeUrl(url) {
  const parts = url.split("/");
  return parts.length < 5 ? "general" : parts[4];
}

async function convertGitbook(gitbookUrl, outputDir, onProgress) {
  const urls = await fetchSitemap(gitbookUrl);
  if (!urls) throw new Error("No URLs found in sitemap.");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const pdfFiles = [];

  onProgress({ type: 'start', total: urls.length });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const category = categorizeUrl(url);
    const categoryDir = path.join(outputDir, category);
    if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });

    const pdfFileName = `page_${i + 1}.pdf`;
    const pdfPath = path.join(categoryDir, pdfFileName);

    onProgress({ type: 'progress', current: i + 1, total: urls.length, url });

    try {
      await takeFullPagePdf(page, url, pdfPath);
      pdfFiles.push(pdfPath);
    } catch (error) {
      console.error(`Failed to convert ${url}:`, error.message);
    }
  }

  await browser.close();

  onProgress({ type: 'merging' });

  const mergedPdf = await PDFDocument.create();
  for (const pdfPath of pdfFiles) {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  const finalPdfBytes = await mergedPdf.save();
  const finalPath = path.join(outputDir, "complete_gitbook.pdf");
  fs.writeFileSync(finalPath, finalPdfBytes);

  onProgress({ type: 'done', path: finalPath });
  return finalPath;
}

module.exports = { convertGitbook };
