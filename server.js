const express = require("express");
const cron = require("node-cron");
const fs = require("fs");
const { scrapeArticles } = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3000;

cron.schedule("*/15 * * * *", async () => {
  console.log("⏱ Aggiornamento feed JSON...");
  const data = await scrapeArticles();
  fs.writeFileSync("/tmp/feed.json", JSON.stringify(data, null, 2));
});

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

