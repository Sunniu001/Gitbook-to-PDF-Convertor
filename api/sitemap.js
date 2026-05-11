const axios = require("axios");
const xml2js = require("xml2js");

async function fetchSitemap(url) {
  const sitemapUrl = url.endsWith('.xml') ? url : `${url.replace(/\/$/, '')}/sitemap.xml`;
  const response = await axios.get(sitemapUrl);
  const parsedSitemap = await xml2js.parseStringPromise(response.data);
  
  if (parsedSitemap.urlset && parsedSitemap.urlset.url) {
    return parsedSitemap.urlset.url.map((url) => url.loc[0]);
  } else if (parsedSitemap.sitemapindex && parsedSitemap.sitemapindex.sitemap) {
    const sitemaps = parsedSitemap.sitemapindex.sitemap;
    const pagesSitemap = sitemaps.find(s => s.loc[0].includes('sitemap-pages.xml')) || sitemaps[0];
    return await fetchSitemap(pagesSitemap.loc[0]);
  }
  throw new Error("Invalid sitemap structure");
}

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const urls = await fetchSitemap(url);
    res.status(200).json({ urls });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
