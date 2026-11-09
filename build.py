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
import datetime
import html as htmllib
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
SITE_URL = "https://experius.xyz"
OG_IMAGE = SITE_URL + "/assets/og-image.png"
# Launch switch. True: pages are indexable. False: every page says noindex.
LAUNCHED = True
# Never indexed, whatever LAUNCHED says.
NOINDEX_ALWAYS = {"404", "thank-you"}

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


def list_roles(html):
    # Lists styled without bullets lose their list semantics in Safari/VoiceOver; role="list" restores them.
    return re.sub(r'<(ul|ol) class="([^"]*)"(?![^>]*role=)', r'<\1 class="\2" role="list"', html)


def root_relative(html):
    # Root-relative links and assets, so pages still work when served at nested production URLs.
    return re.sub(r'(href|src)="(?!/|#|https?:|mailto:|tel:|data:)([^"]+)"', r'\1="/\2"', html)


def bundle_css():
    # One stylesheet instead of an @import chain (main.css -> 16 files -> tokens). Order is kept.
    def read(path):
        out = []
        for line in path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*@import url\('([^']+)'\);", line)
            out.append(read(path.parent / m.group(1)) if m else line)
        return "\n".join(out)
    (ROOT / "css" / "site.css").write_text(
        "/* Generated by build.py from css/main.css. Edit the source files, not this one. */\n"
        + read(ROOT / "css" / "main.css") + "\n", encoding="utf-8")


def strip_tags(s):
    s = re.sub(r"<[^>]+>|\{\{[^}]*\}\}", " ", s)
    return htmllib.unescape(re.sub(r"\s+", " ", s)).strip()


ORG = {"@type": "Organization", "@id": SITE_URL + "/#org", "name": "Experius", "url": SITE_URL + "/",
       "logo": SITE_URL + "/assets/logo-stacked-black.png", "email": "hello@experius.xyz", "telephone": "+8801895626386",
       "sameAs": ["https://www.facebook.com/experius.hq/"],
       "description": "A business systems and content studio for service and expertise businesses.",
       "address": {"@type": "PostalAddress", "addressLocality": "Dhaka", "addressCountry": "BD"},
       "areaServed": "Worldwide"}
SERVICES = {"business-operating-systems": "Business Operating Systems",
            "content-creation-management": "Content Creation & Management",
            "websites": "Websites & connected digital experiences"}


def path_of(slug, metas):
    # Production URL path of a page, from its front matter (e.g. /who-we-help/special-education).
    return metas[slug].get("path", "/" + slug) if slug in metas else "/" + slug


def jsonld(slug, meta, body, metas):
    # Structured data: Organization + WebSite on home, BreadcrumbList, Service, and FAQPage wherever FAQs exist.
    graph = []
    if slug == "index":
        graph += [ORG, {"@type": "WebSite", "@id": SITE_URL + "/#site", "url": SITE_URL + "/",
                        "name": "Experius", "publisher": {"@id": SITE_URL + "/#org"}}]
    if meta.get("crumbs"):
        items = [("Home", SITE_URL + "/")]
        parts = [p.strip() for p in meta["crumbs"].split("|")]
        for p in parts[:-1]:
            label, href = p.split("=")
            target = href.strip()[:-5] if href.strip().endswith(".html") else href.strip()
            items.append((label.strip(), SITE_URL + path_of(target, metas)))
        items.append((parts[-1], SITE_URL + meta.get("path", "/" + slug)))
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]})
    if slug in SERVICES:
        graph.append({"@type": "Service", "name": SERVICES[slug], "description": meta.get("description", ""),
                      "provider": {"@id": SITE_URL + "/#org"}, "areaServed": "Worldwide"})
    faqs = re.findall(r'<details><summary>(.*?)</summary><div class="faq__answer">(.*?)</div></details>', body, re.S)
    if faqs:
        graph.append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": strip_tags(q), "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}}
            for q, a in faqs]})
    if not graph:
        return ""
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")
    return f'\n<script type="application/ld+json">{data}</script>'


def mark_current(html, slug):
    # aria-current on every link to this page (header, mobile menu, footer), so the visitor knows where they are.
    return html.replace(f'href="{slug}.html"', f'href="{slug}.html" aria-current="page"')


def robots_meta(slug):
    if not LAUNCHED or slug in NOINDEX_ALWAYS:
        return '<meta name="robots" content="noindex">'
    return '<meta name="robots" content="index, follow">'


def write_sitemap(metas):
    # Every page that is meant to be found. Pages in NOINDEX_ALWAYS are left out.
    today = datetime.date.today().isoformat()
    urls = sorted(path_of(s, metas) for s in metas if s not in NOINDEX_ALWAYS)
    rows = "".join(f"  <url><loc>{SITE_URL}{p}</loc><lastmod>{today}</lastmod></url>\n" for p in urls)
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "</urlset>\n", encoding="utf-8")


def write_robots():
    (ROOT / "robots.txt").write_text(
        "# Generated by build.py.\n"
        "User-agent: *\nAllow: /\n\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")


def write_vercel(metas):
    # Clean URLs: each page is served at its production path, and the old .html address redirects there,
    # so the canonical tags, the sitemap and the links all point at one address per page.
    rewrites, redirects = [], [{"source": "/index.html", "destination": "/", "permanent": True}]
    for slug in sorted(metas):
        p = path_of(slug, metas)
        if p == "/":
            continue
        rewrites.append({"source": p, "destination": f"/{slug}.html"})
        redirects.append({"source": f"/{slug}.html", "destination": p, "permanent": True})
    config = {"buildCommand": "python build.py", "outputDirectory": "public", "cleanUrls": False, "trailingSlash": False, "redirects": redirects, "rewrites": rewrites}
    (ROOT / "vercel.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def build():
    bundle_css()
    head_tpl = (SRC / "partials" / "head.html").read_text(encoding="utf-8")
    header = (SRC / "partials" / "header.html").read_text(encoding="utf-8")
    footer = (SRC / "partials" / "footer.html").read_text(encoding="utf-8")
    pages = sorted((SRC / "pages").glob("*.html"))
    parsed = {page.stem: parse(page.read_text(encoding="utf-8")) for page in pages}
    metas = {slug: meta for slug, (meta, _) in parsed.items()}
    for slug, (meta, body) in parsed.items():
        title = meta["title"]
        full_title = "Experius: business systems for service businesses" if slug == "index" else f"{title} · Experius"
        scripts = "".join(f'\n<script src="/js/{s.strip()}" defer></script>' for s in meta.get("scripts", "").split(",") if s.strip())
        head = head_tpl.format(
            title=htmllib.escape(full_title), og_title=htmllib.escape(title),
            description=htmllib.escape(meta.get("description", "")),
            url=SITE_URL + path_of(slug, metas),
            og_image=OG_IMAGE,
            robots=robots_meta(slug),
            scripts=scripts,
            jsonld=jsonld(slug, meta, body, metas),
        )
        crumbs = breadcrumb(meta["crumbs"]) if meta.get("crumbs") else ""
        shell = mark_current(expand(header, slug, meta), slug)
        foot = mark_current(expand(footer, slug, meta), slug)
        main = expand(body, slug, meta)
        out = root_relative(list_roles(tag_events(
            f"{head}\n<body>\n{shell}\n{crumbs}\n<main id=\"main\" tabindex=\"-1\">\n{main}\n</main>\n{foot}\n</body>\n</html>\n")))
        (ROOT / f"{slug}.html").write_text(out, encoding="utf-8")
    write_sitemap(metas)
    write_robots()
    write_vercel(metas)
    publish(pages)
    print(f"Built {len(pages)} pages, sitemap.xml, robots.txt, vercel.json, public/ (LAUNCHED={LAUNCHED})")


def publish(pages):
    # Vercel serves public/. Only the website goes in: no src/, docs/, supabase/ or build files.
    out = ROOT / "public"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    for page in pages:
        shutil.copy2(ROOT / f"{page.stem}.html", out)
    for name in ("sitemap.xml", "robots.txt"):
        shutil.copy2(ROOT / name, out)
    for folder in ("assets", "css", "js", "admin"):
        shutil.copytree(ROOT / folder, out / folder)


if __name__ == "__main__":
    build()
