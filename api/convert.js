const chromium = require("@sparticuz/chromium-min");
const puppeteer = require("puppeteer-core");

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(
        `https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar`
      ),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.evaluate(() => {
      const selectors = [
        "div.appBarClassName", ".scroll-nojump",
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

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      scale: 1,
      preferCSSPageSize: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.status(200).send(pdf);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
};
