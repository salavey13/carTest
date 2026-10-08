import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 840 } });
await p.goto("file:///tmp/skintest/skin.html", { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await p.waitForTimeout(7000);
await p.screenshot({ path: "/home/z/my-project/task84-skin-visual.png" });
console.log("shot saved");
await b.close();
