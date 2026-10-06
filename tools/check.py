"""Smoke check every route: page errors, horizontal overflow, the right view shown.

usage: python tools/check.py [BASE_URL]
"""
import sys
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
routes = ["", "#mew2", "#oracle", "#mychart", "#intune", "#resume"]
if "--about" in sys.argv:
    routes.append("#about-me")

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ok = True
    for w in (1440, 390):
        pg = b.new_page(viewport={"width": w, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        for r in routes:
            pg.goto(base + r)
            pg.wait_for_timeout(700)
            if pg.evaluate("document.documentElement.scrollWidth > innerWidth"):
                errs.append("overflow " + r)
            view = r[1:] or "home"
            if not pg.evaluate(f"!!document.querySelector('[data-view=\"{view}\"]:not([hidden])')"):
                errs.append("not shown " + (r or "home"))
        print(w, errs or "ok")
        ok = ok and not errs
    sys.exit(0 if ok else 1)
