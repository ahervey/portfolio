"""Full-page screenshots for design review.

usage: python tools/shoot.py URL OUT_PREFIX [--widths 1440,390] [--wait 1500]

Writes OUT_PREFIX-<width>.png for each width. Uses the installed Chrome.
"""
import argparse
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("url")
p.add_argument("out")
p.add_argument("--widths", default="1440,390")
p.add_argument("--wait", type=int, default=1500)
p.add_argument("--viewport-only", action="store_true")
a = p.parse_args()

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    for w in [int(x) for x in a.widths.split(",")]:
        page = browser.new_page(viewport={"width": w, "height": 900 if w > 600 else 844})
        page.goto(a.url, wait_until="networkidle", timeout=60000)
        # Trigger scroll-reveal animations before capturing
        page.evaluate("""async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 400) {
                window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
        }""")
        page.wait_for_timeout(a.wait)
        path = f"{a.out}-{w}.png"
        page.screenshot(path=path, full_page=not a.viewport_only)
        print(path)
        page.close()
    browser.close()
