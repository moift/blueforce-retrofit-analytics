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
await page.waitForTimeout(1400);

const title = await page.locator("h1").textContent();
const metrics = await page.locator("#metric-retrofits").textContent();
const canvasPixels = await page.locator("#globe-canvas").evaluate((canvas) => {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return { hasGL: false, nonBlack: 0, width: canvas.width, height: canvas.height };

  const width = Math.min(canvas.width, 160);
  const height = Math.min(canvas.height, 160);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(
    Math.floor((canvas.width - width) / 2),
    Math.floor((canvas.height - height) / 2),
    width,
    height,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );

  let nonBlack = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] > 8 || pixels[index + 1] > 8 || pixels[index + 2] > 8) {
      nonBlack += 1;
    }
  }

  return { hasGL: true, nonBlack, width: canvas.width, height: canvas.height };
});
const canvasBox = await page.locator("#globe-canvas").evaluate((canvas) => ({
  clientWidth: canvas.clientWidth,
  clientHeight: canvas.clientHeight,
  width: canvas.width,
  height: canvas.height,
  rect: {
    x: canvas.getBoundingClientRect().x,
    y: canvas.getBoundingClientRect().y,
    width: canvas.getBoundingClientRect().width,
    height: canvas.getBoundingClientRect().height,
  },
}));
const chartProbe = await page.locator("#benefit-chart").evaluate((svg) => ({
  childCount: svg.childElementCount,
  htmlStart: svg.innerHTML.slice(0, 120),
  rect: {
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
  },
}));

await page.screenshot({ path: "../output/playwright/retrofit-dashboard-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(900);
const mobileCanvas = await page.locator("#globe-canvas").boundingBox();
await page.screenshot({ path: "../output/playwright/retrofit-dashboard-mobile.png", fullPage: true });

console.log(JSON.stringify({ title, metrics, canvasPixels, canvasBox, chartProbe, mobileCanvas, errors }, null, 2));
await browser.close();
