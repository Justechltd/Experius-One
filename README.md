# Experius website: hi-fi prototype v0.3

**Date:** 5 Nov 2026 · **Status:** clickable prototype for testing and developer handoff. Not production.
**v0.2:** all 18 fixes from the design review, heuristic evaluation and persona test applied. See [../reviews/00-fix-list.md](../reviews/00-fix-list.md).
**Developer spec:** [../handoff.md](../handoff.md). Read it before porting.
**Built from:** [../source-brief.md](../source-brief.md), [../plan.md](../plan.md), [../ia-map.md](../ia-map.md), [../design-tokens.md](../design-tokens.md)

## Run it

From the `prototype` folder (works in PowerShell, cmd and Git Bash):

```bash
npm start
```

This rebuilds the pages and serves them at **http://localhost:4400**. Stop it with Ctrl+C. `npm run build` only rebuilds. There are no npm dependencies: the scripts just call Python.

Without npm, from any folder:

```bash
python -m http.server 4400 --bind 127.0.0.1 --directory "E:/Work/Claude Space/claude-workspace/Projects/EXPERIUS/website-redesign/prototype"
```

If you see a "Directory listing" page instead of the site, another server is using that port from a different folder. Pick another port number, or stop the other server.

## How it's put together

| Path | What it is | Production equivalent |
|---|---|---|
| `src/pages/*.html` | Each page's `<main>` content, with front matter (title, description, future URL path, breadcrumb) | One route or page component each |
| `src/partials/` | Shared `head`, `header`, `footer` | Layout components |
| `build.py` | Wraps pages in the partials and writes static HTML to this folder. Expands `{{icon:…}}` and `{{cta:…}}` | Your framework's layout system |
| `css/tokens.css` | All design decisions as CSS variables. **Copy as-is** | Theme / tokens file |
| `css/base.css`, `css/layout.css` | Element defaults and layout primitives | Global styles |
| `css/components/*.css` | One file per component, named after brief §9.2 | One component each |
| `js/site.js` | Dropdown nav, mobile menu, scroll reveal | Header and motion components |
| `js/review-form.js` | Business Review validation and states; POSTs to the `submit_review_request` RPC, which validates again | Form component |
| `js/config.js` | Backend URL and public anon key (empty = backend off) | Env config |
| `js/analytics.js` | First-party analytics: no cookies, no third parties, honours DNT/GPC | Analytics module |
| `admin/`, `js/admin.js`, `css/admin.css` | Admin panel at `/admin/`: Business Review requests (status, notes, CSV) and analytics. Supabase Auth + RLS. Not passed through `build.py` | Admin app |
| `supabase/` | Migration (tables, RLS, RPCs, Telegram trigger) and the `notify-review-request` Edge Function. See `docs/backend.md` and `docs/admin-contract.md` | Backend |
| `assets/` | Logo trimmed from the PNGs: mark, wordmark, stacked; black and white | Replace with SVGs from the source file |

Rules the developer should keep: components use semantic tokens only, never raw hex values. Dark sections are `data-surface="dark"`. No inline styles.

## Pages (23)

| File | Future URL | IA step | Notes |
|---|---|---|---|
| index.html | / | 2, 3 | Hero, symptoms, before/after diagram, pillars, 4 audiences, process, demos, POV |
| who-we-help.html | /who-we-help | 4 | 4 audiences, "not listed?", agency route |
| expertise-personal-brands.html | /who-we-help/expertise-personal-brands | 4, 5 | Audience template |
| clinics-wellness.html | /who-we-help/clinics-wellness | 4, 5 | Audience template + data-handling note |
| education-training.html | /who-we-help/education-training | 4, 5 | Audience template |
| solar-battery-installers.html | /who-we-help/solar-battery-installers | 4, 5 | Audience template, **content-led**, international |
| solutions.html | /solutions | 5 | Pillars, how they combine, illustrative examples |
| business-operating-systems.html | /solutions/business-operating-systems | 5 | 7 capabilities: problem → better process → what's built → what we need to know |
| content-creation-management.html | /solutions/content-creation-management | 5 | Areas plus explicit scope tiers |
| websites.html | /solutions/websites | 5 | R2 in the IA; built anyway |
| our-approach.html | /our-approach | 5, 6 | Understand → Demonstrate → Solve → Document → Repeat |
| work.html | /work | 6 | Evidence labels; client section shows the **empty state** |
| demo-solar-pipeline.html | /work/solar-pipeline-demonstration | 6 | Pipeline board, synthetic data |
| demo-clinic-inquiry.html | /work/clinic-inquiry-demonstration | 6 | Inquiry table, synthetic data |
| about.html | /about | 6 | Team placeholders pending consent |
| insights.html | /insights | 3 | 1 article live, 2 drafts |
| insight-better-flow.html | /insights/better-flow-not-another-tool | 3 | Full article template |
| contact.html | /contact | 7 | Email route + partner route. No second form |
| business-review.html | /business-review | 7, 8 | The conversion page |
| thank-you.html | /thank-you | 9 | Personalised from sessionStorage, never the URL |
| privacy.html | /privacy | 8 | **Draft for legal review** |
| terms.html | /terms | none | **Placeholder** |
| 404.html | /404 | 2 | Routes to Home, Who We Help, Business Review |

Not built: the Partner page (R2, kept out of the nav) and the cookie notice (only needed if the analytics tool requires consent).

## States you can test

- **Business Review form:** submit it empty to see inline errors plus an error summary that takes focus. Fill it in and submit to see the loading state, then the thank-you page with your first name. It now sends for real to the Supabase backend (`docs/backend.md`). While `js/config.js` is empty, or if the request fails, the failure state shows: every value is kept, with a retry and an email fallback.
- **Navigation:** dropdowns open on click, close on Escape or an outside click, and return focus. Below 1100px the mobile menu takes over: focus moves into it, the page stops scrolling, and Escape closes it.
- **Empty states:** client case studies (Work, Expertise, Education) and Experiments.
- **Reduced motion:** turn on "reduce motion" in your OS and all reveals appear at once.

## Checked (5 Nov, re-run after v0.2 fixes)

- All 23 pages: no horizontal overflow at 320, 375, 768/800, 1024 or 1366px (320 added after the client cards went in; tags and grid items may now wrap or shrink). No broken internal links. One H1 per page. No duplicate IDs. Every image has alt text. No inline styles. No console errors.
- Form: every state exercised in the browser.
- Keyboard: dropdown and mobile menu open and close, with focus returning to the trigger.
- v0.2 scan at 375px: no contrast failures (text measured against its real background), no heading-level skips, no touch target under 44px. No orphan cards at 800px. The Business Review form now starts 667px down on mobile (was 2,042px). `?type=` pre-selects the business type.
- Reviews done: [design review](../reviews/01-design-review.md), [heuristic evaluation](../reviews/02-heuristic-evaluation.md), [persona acid test](../reviews/03-persona-acid-test.md).
- **Not yet done:** a screen-reader pass (NVDA/VoiceOver), and a real-device test on a mid-range Android.

## Things the developer must add

- The acknowledgement email to the visitor (brief Phase 4). Server-side validation, spam protection, storage and the internal Telegram notification are built (`docs/backend.md`)
- Analytics is built (`js/analytics.js`); a framework port should keep the same events and the no-personal-data rule
- Self-hosted Poppins, Latin subset, with 400 and 600 preloaded
- SVG logo from the source file (the PNG logos work; the share image `assets/og-image.png` and the icons `icon-512.png` and `apple-touch-icon.png` are generated)
- Search Console: add its verification meta tag to `src/partials/head.html`, then run PageSpeed Insights on the live URL

## Launch state (9 Nov 2026)

- All `[CONFIRM]` markers are cleared and the content is approved. Blocks that had no real data behind them were removed instead of shipped: the Contact WhatsApp link (no number), the social links (no URLs), and the "Where it stands" and client-proof paragraphs on the Work case studies (no approved text or screenshots).
- `LAUNCHED = True` in `build.py`, so pages are indexable. The 404 and thank-you pages stay `noindex`. `sitemap.xml`, `robots.txt` and `vercel.json` (clean URLs and redirects) are generated by the build.
- WhatsApp +880 1895-626386 and Facebook (facebook.com/experius.hq) are on Contact, in the footer and in the Organization schema. To add later: client-approved screenshots and quotes (Work).
- Admin has a Settings tab to change the password (checks the current password first, minimum 12 characters).

## v0.3 (8 Nov 2026)

- **Build:** `build.py` now bundles all CSS into `css/site.css` (no @import chain), escapes titles, adds `role="list"`, writes root-relative links and assets, and emits JSON-LD (Organization, WebSite, BreadcrumbList, Service, FAQPage). Serve from the site root.
- **Fonts:** Poppins self-hosted in `assets/fonts/` (400/500/600/700, Latin), 400 and 600 preloaded.
- **Content:** US spelling; reply promise "within 2 working days"; Austar hidden until signed; Noree Jewellery; team titles; Noholi + Construction OS + Clinic OS + two experiments on Work; Insights pillars; new `fix-the-flow-worksheet.html`; homepage self-check (`js/self-check.js`) passes `?improve=` to the Review form; WhatsApp field and contact route.
- **Asset slots** (drop files in, then swap the placeholder for an `<img>` with the same class): `assets/team/<name>.webp` 800×1000 · `assets/work/<client>.webp` 1600×1000 · `assets/recordings/<name>.mp4` ≤20s muted loop + `.jpg` poster.
- **Client proof asks:** `docs/client-proof-asks.md` (not sent).
