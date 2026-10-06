"""Add a fresh ?v= stamp to the CSS and JS links in index.html.

Browsers keep their own copy of styles.css and app.js for a while. If that copy
is older than index.html, the page and its script disagree and parts stop
working. A new stamp on every release makes browsers fetch matching files.

Usage: python tools/stamp_assets.py
"""
import re
import time
from pathlib import Path

page = Path(__file__).resolve().parent.parent / "index.html"
stamp = time.strftime("%Y%m%d%H%M")
html = page.read_text(encoding="utf-8")
html, n = re.subn(r'(href|src)="(styles\.css|theme-pastel\.css|case-visuals\.css|type\.css|app\.js)(\?v=\w+)?"', rf'\1="\2?v={stamp}"', html)
page.write_text(html, encoding="utf-8")
print(f"stamped {n} asset links with v={stamp}")
