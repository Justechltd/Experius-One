"""Assemble the prototype pages.

Each file in src/pages/ holds only the page's <main> content, with a front-matter comment on top.
This script wraps it in the shared head, header, breadcrumb and footer, and writes plain static HTML
next to this file. Run:  python build.py

Front matter keys (all optional except title):
  title        Page title, used in <title> and Open Graph
  description  Meta description
  path         Future production URL path, e.g. /who-we-help/solar-battery-installers
  nav          solutions | who  (marks the dropdown toggle as current)
  crumbs       "Label=file.html | Label=file.html | Current label"
  scripts      Extra JS files in js/, comma separated
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
SITE_URL = "https://experius.xyz"

ICONS = {
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "x-circle": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    "alert": '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "mail": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    "break": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
}

DEFAULT_CTA = """
<section class="cta-banner" data-surface="dark" aria-labelledby="cta-title">
  <div class="container cta-banner__inner">
    <div>
      <h2 id="cta-title">{title}</h2>
      <p>{text}</p>
    </div>
    <div>
      <a class="btn btn--primary" href="business-review.html{query}">Book a Business Review</a>
      <p class="reassure">Free · 25–30 minutes · No generic pitch.</p>
    </div>
  </div>
</section>"""


def icon(name):
    return f'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


def parse(text):
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text.strip()


def breadcrumb(spec):
    items = ['<li><a href="index.html">Home</a></li>']
    parts = [p.strip() for p in spec.split("|")]
    for p in parts[:-1]:
        label, href = p.split("=")
        items.append(f'<li><a href="{href.strip()}">{label.strip()}</a></li>')
    items.append(f'<li><span aria-current="page">{parts[-1]}</span></li>')
    return ('<nav class="breadcrumb container" aria-label="Breadcrumb"><ol>'
            + "".join(items) + "</ol></nav>")


def expand(html, slug, meta):
    html = re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: icon(m.group(1)), html)
    html = re.sub(r"\{\{cur:(\w+)\}\}", lambda m: " is-current" if meta.get("nav") == m.group(1) else "", html)

    # {{cta}} or {{cta:Title|Text}} or {{cta:Title|Text|type}}; type pre-selects the business on the review form.
    def cta(m):
        parts = (m.group(1) or "There may be a better way for your business to work. Let's find it.|"
                 "Book an Experius Business Review: a focused conversation about your business, what is getting in the way and what may be worth improving.").split("|")
        query = f"?type={parts[2].strip()}" if len(parts) > 2 else ""
        return DEFAULT_CTA.format(title=parts[0].strip(), text=parts[1].strip(), query=query)
    html = re.sub(r"\{\{cta(?::(.*?))?\}\}", cta, html)
    return html


def tag_events(html):
    # Analytics hook (brief §13.6): every link to the Business Review carries the CTA event name. No personal data.
    return re.sub(r'<a ([^>]*?)href="business-review\.html', r'<a \1data-event="business_review_cta_click" href="business-review.html', html)


def mark_current(html, slug):
    # aria-current on every link to this page (header, mobile menu, footer), so the visitor knows where they are.
    return html.replace(f'href="{slug}.html"', f'href="{slug}.html" aria-current="page"')


def build():
    head_tpl = (SRC / "partials" / "head.html").read_text(encoding="utf-8")
    header = (SRC / "partials" / "header.html").read_text(encoding="utf-8")
    footer = (SRC / "partials" / "footer.html").read_text(encoding="utf-8")
    pages = sorted((SRC / "pages").glob("*.html"))
    for page in pages:
        slug = page.stem
        meta, body = parse(page.read_text(encoding="utf-8"))
        title = meta["title"]
        full_title = "Experius: business systems for service businesses" if slug == "index" else f"{title} · Experius"
        scripts = "".join(f'\n<script src="js/{s.strip()}" defer></script>' for s in meta.get("scripts", "").split(",") if s.strip())
        head = head_tpl.format(
            title=full_title, og_title=title,
            description=meta.get("description", ""),
            url=SITE_URL + meta.get("path", "/" + slug),
            scripts=scripts,
        )
        crumbs = breadcrumb(meta["crumbs"]) if meta.get("crumbs") else ""
        shell = mark_current(expand(header, slug, meta), slug)
        foot = mark_current(expand(footer, slug, meta), slug)
        main = expand(body, slug, meta)
        out = tag_events(f"{head}\n<body>\n{shell}\n{crumbs}\n<main id=\"main\" tabindex=\"-1\">\n{main}\n</main>\n{foot}\n</body>\n</html>\n")
        (ROOT / f"{slug}.html").write_text(out, encoding="utf-8")
    print(f"Built {len(pages)} pages")


if __name__ == "__main__":
    build()
