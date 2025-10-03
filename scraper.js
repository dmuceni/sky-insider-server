// scraper.js
const axios = require("axios");
const cheerio = require("cheerio");

function extractDateFromLink(link) {
  if (!link) return null;
  const match = link.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (match) {
    const [_, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function scrapeSkySite(url, source) {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);
  const results = [];

  $(".c-set-of-cards-container .c-card").each((i, el) => {
    const article = $(el);
    const title = article.find(".c-card__title, .c-card__title-link").text().trim();
    let link = article.find("a").attr("href");
    if (link && !link.startsWith("http")) {
      link = url.replace(/\/$/, "") + link;
    }
    const image = article.find(".c-card__img.j-lazyload").attr("data-src") || null;
    const authorName = article.find(".c-card__author-name-no-intro").text().trim() || null;
    const authorImage = article.find(".c-card__author-img-wrapper img").attr("data-src") || null;

    if (title) {
      results.push({
        title,
        link,
        image,
        authorName,
        authorImage,
        category: source,
        date: extractDateFromLink(link),
      });
    }
  });

  return results;
}

async function scrapeArticles() {
  const tg24 = await scrapeSkySite("https://tg24.sky.it/", "Tg24 Insider");
  const sport = await scrapeSkySite("https://sport.sky.it/", "Sport Insider");
  return [...tg24, ...sport];
}

module.exports = { scrapeArticles };

