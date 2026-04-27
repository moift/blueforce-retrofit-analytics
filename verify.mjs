import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("requestfailed", (request) => errors.push(`${request.url()} :: ${request.failure()?.errorText}`));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} :: ${response.url()}`);
});

await page.goto("http://localhost:8765/", { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

const title = await page.locator("h1").textContent();
const metric = await page.locator(".metric-card strong").first().textContent();
const chartProbe = await page.locator("#scenario-chart").evaluate((svg) => ({
  childCount: svg.childElementCount,
  rect: {
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
  },
}));

const canvasPixels = await page.locator("#globe-canvas").evaluate((canvas) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { has2d: false, nonBlack: 0, width: canvas.width, height: canvas.height };

  const sampleWidth = Math.min(canvas.width, 180);
  const sampleHeight = Math.min(canvas.height, 180);
  const imageData = ctx.getImageData(
    Math.floor((canvas.width - sampleWidth) / 2),
    Math.floor((canvas.height - sampleHeight) / 2),
    sampleWidth,
    sampleHeight,
  );

  let nonBlack = 0;
  for (let index = 0; index < imageData.data.length; index += 4) {
    if (imageData.data[index] > 8 || imageData.data[index + 1] > 8 || imageData.data[index + 2] > 8) {
      nonBlack += 1;
    }
  }

  return { has2d: true, nonBlack, width: canvas.width, height: canvas.height };
});

await page.screenshot({ path: "../output/playwright/retrofit-dashboard-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(900);
await page.screenshot({ path: "../output/playwright/retrofit-dashboard-mobile.png", fullPage: true });

console.log(JSON.stringify({ title, metric, chartProbe, canvasPixels, errors }, null, 2));
await browser.close();
