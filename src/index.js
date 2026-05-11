const puppeteer = require("puppeteer");
const axios = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require('pdf-lib');

const URL_GITBOOK = "https://sunniys-organization.gitbook.io/aryaverse-wiki/";

// Function to fetch the sitemap XML and parse it
async function fetchSitemap(url) {
  try {
    const response = await axios.get(url);
    const sitemapXML = response.data;

    // Parse the XML sitemap into JSON
    const parsedSitemap = await xml2js.parseStringPromise(sitemapXML);
    
    if (parsedSitemap.urlset && parsedSitemap.urlset.url) {
      return parsedSitemap.urlset.url.map((url) => url.loc[0]);
    } else if (parsedSitemap.sitemapindex && parsedSitemap.sitemapindex.sitemap) {
      // If it's a sitemapindex, find the sitemap-pages.xml or just the first one
      const sitemaps = parsedSitemap.sitemapindex.sitemap;
      const pagesSitemap = sitemaps.find(s => s.loc[0].includes('sitemap-pages.xml')) || sitemaps[0];
      console.log(`Found sitemap index, fetching nested sitemap: ${pagesSitemap.loc[0]}`);
      return await fetchSitemap(pagesSitemap.loc[0]);
    }

    throw new Error("Could not find urlset or sitemapindex in the sitemap.");
  } catch (error) {
    console.error("Error fetching or parsing sitemap:", error);
  }
}

// Function to convert a page to PDF with selectable text and high-quality images
async function takeFullPagePdf(page, url, outputPath) {
  try {
    // Set the viewport to a reasonable width (e.g., 1280px) for full-page capture
    await page.setViewport({ width: 1280, height: 800 });

    // Set device scale factor for high DPI (2 is Retina)
    await page.emulate({
      viewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
      userAgent: "",
    });

    // Go to the page and wait for it to load completely
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Remove elements by setting display to 'none'
    await page.evaluate(() => {
      // Remove the AppBar element
      const appBar = document.querySelector("div.appBarClassName"); // Replace with the correct selector for the AppBar
      if (appBar) {
        appBar.style.display = "none"; // Hide the AppBar
      }

      // Remove the element with class "scroll-nojump"
      const scrollNoJump = document.querySelector(".scroll-nojump");
      if (scrollNoJump) {
        scrollNoJump.style.display = "none"; // Hide the scroll-nojump element
      }

      // Remove the menu element
      const menu = document.querySelector(
        "aside.relative.group.flex.flex-col.basis-full.bg-light"
      );
      if (menu) {
        menu.style.display = "none"; // Hide the menu
      }

      // Remove the search button
      const searchButton = document.querySelector(
        "div.flex.md\\:w-56.grow-0.shrink-0.justify-self-end"
      );
      if (searchButton) {
        searchButton.style.display = "none"; // Hide the search button div
      }

      // Remove the next button div
      const nextButton = document.querySelector(
        "div.flex.flex-col.md\\:flex-row.mt-6.gap-2.max-w-3xl.mx-auto.page-api-block\\:ml-0"
      );
      if (nextButton) {
        nextButton.style.display = "none"; // Hide the next button div
      }

      // Remove the "Last updated" info
      const lastUpdatedInfo = document.querySelector(
        "div.flex.flex-row.items-center.mt-6.max-w-3xl.mx-auto.page-api-block\\:ml-0"
      );
      if (lastUpdatedInfo) {
        lastUpdatedInfo.style.display = "none"; // Hide the "Last updated" div
      }
    });

    // Convert the page to PDF with high-quality images
    await page.pdf({
      path: outputPath,
      format: "A4", // Use A4 paper size for PDF
      printBackground: true, // Ensure background images and colors are included
      scale: 1, // Keep the original scale
      preferCSSPageSize: true, // Ensure that the page uses CSS page size
    });

    console.log(`Saved PDF for: ${url} at ${outputPath}`);
  } catch (error) {
    console.error(`Failed to take PDF for: ${url}`, error);
  }
}

// Function to group URLs based on their categories (like 'settings', 'android')
function categorizeUrl(url) {
  const parts = url.split("/");
  if (parts.length < 5) {
    console.error(`URL structure is incorrect: ${url}`);
    return "unknown"; // Return a fallback category
  }
  const category = parts[4]; // Assuming categories are the 5th part of the URL
  return category; // Return the category name (e.g., 'settings', 'android')
}
// function categorizeUrl(url) {
//   const parts = url.split("/");
//   const category = parts[4]; // Assuming categories are the 5th part of the URL

//   return category; // Return the category name (e.g., 'settings', 'android')
// }

// Main function to run the script
async function run() {
  const sitemapUrl = `${URL_GITBOOK}/sitemap.xml`; // Replace with the actual sitemap URL
  const saveDir = "./pdfs"; // Directory where PDFs will be saved

  // Create the output directory if it doesn't exist
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir);
  }

  // Fetch the sitemap URLs
  const urls = await fetchSitemap(sitemapUrl);
  if (!urls) return;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Initialize the page counter
  let pageCounter = 1;

  // Loop through each URL in the sitemap
  for (const url of urls) {
    // Determine the category based on the URL
    const category = categorizeUrl(url);
    const categoryDir = path.join(saveDir, category);

    // Create a folder for the category if it doesn't exist
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    // Generate a sequential filename for the PDF (page_1.pdf, page_2.pdf, ...)
    const pdfFileName = `page_${pageCounter}.pdf`; // Use pageCounter for unique file names
    const pdfPath = path.join(categoryDir, pdfFileName);

    // Capture the full page as a PDF
    await takeFullPagePdf(page, url, pdfPath);

    // Increment the page counter
    pageCounter++;
  }

  await browser.close();

  // Merge PDFs
  console.log("Merging PDFs...");
  const mergedPdf = await PDFDocument.create();
  const pdfFiles = [];

  // Recursive function to get all pdf files in order
  function getPdfFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getPdfFiles(fullPath);
      } else if (file.endsWith('.pdf')) {
        pdfFiles.push(fullPath);
      }
    }
  }

  getPdfFiles(saveDir);
  
  // Sort pdf files by page number if they follow page_N.pdf pattern
  pdfFiles.sort((a, b) => {
    const aNum = parseInt(a.match(/page_(\d+)/)?.[1] || 0);
    const bNum = parseInt(b.match(/page_(\d+)/)?.[1] || 0);
    return aNum - bNum;
  });

  for (const pdfPath of pdfFiles) {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  const outputPath = path.join(saveDir, "complete_aryaverse_wiki.pdf");
  fs.writeFileSync(outputPath, mergedPdfBytes);
  console.log(`Merged PDF saved at: ${outputPath}`);
}

run().catch(console.error);
