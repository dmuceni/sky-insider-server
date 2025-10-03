const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Funzione per estrarre la data dal link
function extractDateFromLink(link) {
  if (!link) return null;
  const match = link.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (match) {
    const [_, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

// Funzione di scraping singolo sito
async function scrapeSkySite(url, source) {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);
  const results = [];

  $(".c-set-of-cards-container .c-card").each((i, el) => {
    const article = $(el);

    const title = article.find(".c-card__title, .c-card__title-link").text().trim();

    let link =
      article.attr("href") ||
      article.find("a.c-card").attr("href") ||
      article.find("a.c-card--editorial-premium").attr("href") ||
      article.find("a.c-card--blog").attr("href") ||
      article.find("a").attr("href");

    if (link && !link.startsWith("http")) {
      link = url.replace(/\/$/, "") + link;
    }

    let image =
      article.find(".c-card__img.j-lazyload").attr("data-src") ||
      article.find(".c-card__img.j-lazyload").attr("src") ||
      article.find(".c-card__img.j-lazyload").attr("data-srcset");

    if (image && image.includes(" ")) {
      image = image.split(" ")[0];
    }

    const authorName = article.find(".c-card__author-name-no-intro").text().trim() || null;

    let authorImage =
      article.find(".c-card__author-img-wrapper .o-image-circle__img.j-lazyload").attr("data-src") ||
      article.find(".c-card__author-img-wrapper .o-image-circle__img.j-lazyload").attr("src") ||
      article.find(".c-card__author-img-wrapper .o-image-circle__img.j-lazyload").attr("data-srcset");

    if (authorImage && authorImage.includes(" ")) {
      authorImage = authorImage.split(" ")[0];
    }

    if (title) {
      results.push({
        title,
        link: link || null,
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

// Funzione che unisce e ordina gli articoli
async function scrapeArticles() {
  const tg24 = await scrapeSkySite("https://tg24.sky.it/", "Tg24 Insider");
  const sport = await scrapeSkySite("https://sport.sky.it/", "Sport Insider");
  let all = [...tg24, ...sport];

  // Ordina per data desc
  all = all.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  // Alternanza tg24/sport per stessa data
  const grouped = {};
  all.forEach((article) => {
    const d = article.date || "no-date";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(article);
  });

  const ordered = [];
  Object.keys(grouped)
    .sort((a, b) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return new Date(b) - new Date(a);
    })
    .forEach((date) => {
      const group = grouped[date];
      const tg = group.filter((x) => x.category === "Tg24 Insider");
      const sp = group.filter((x) => x.category === "Sport Insider");
      let i = 0,
        j = 0;
      while (i < tg.length || j < sp.length) {
        if (i < tg.length) ordered.push(tg[i++]);
        if (j < sp.length) ordered.push(sp[j++]);
      }
    });

  return ordered;
}

// Funzione che genera e salva il feed
async function generateFeed() {
  try {
    console.log("🔄 Generazione feed JSON...");
    const data = await scrapeArticles();
    fs.writeFileSync("/tmp/feed.json", JSON.stringify(data, null, 2));
    console.log("✅ Feed aggiornato con", data.length, "articoli");
  } catch (err) {
    console.error("❌ Errore durante la generazione del feed:", err.message);
  }
}

// Schedula aggiornamento ogni 15 min
cron.schedule("*/15 * * * *", generateFeed);

// Genera subito al primo avvio
generateFeed();

// Endpoint che serve il feed
app.get("/feed.json", (req, res) => {
  try {
    const data = fs.readFileSync("/tmp/feed.json", "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.send(data);
  } catch {
    res.json({ error: "Feed non ancora generato" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server avviato su http://localhost:${PORT}`);
});

