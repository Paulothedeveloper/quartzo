import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:1420/_devtest";
const out = process.argv[3] ?? "devtest.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 880 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const clickText = process.argv[5];
if (clickText) {
  try {
    await page.getByText(clickText, { exact: false }).first().click();
    await page.waitForTimeout(500);
  } catch (e) {
    console.log("CLICK_FAIL", String(e));
  }
}
const scrollBy = Number(process.argv[4] ?? 0);
if (scrollBy) {
  await page.evaluate((y) => {
    document.querySelectorAll(".lumina-prose, .cm-scroller").forEach((el) => (el.scrollTop = y));
  }, scrollBy);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: out });
await browser.close();
console.log("SHOT_OK", out);
if (errors.length) console.log("CONSOLE_ERRORS:\n" + errors.join("\n"));
else console.log("NO_CONSOLE_ERRORS");
