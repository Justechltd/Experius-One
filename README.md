# Experius website: hi-fi prototype v0.2

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
| `js/review-form.js` | Business Review validation and states | Form component plus **server-side validation** |
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

- **Business Review form:** submit it empty to see inline errors plus an error summary that takes focus. Fill it in and submit to see the loading state, then the thank-you page with your first name. Tick "simulate a failed submission" to see the failure state: every value is kept, with a retry and an email fallback.
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

- Server-side validation, spam protection, lead storage, the acknowledgement email and the internal notification (brief Phase 4)
- Analytics: every Business Review link already carries `data-event="business_review_cta_click"`, and the form has `data-event-start` / `data-event-submit`. Wire these to the analytics tool and add the rest of brief §13.6, with **no personal data** in events
- Self-hosted Poppins, Latin subset, with 400 and 600 preloaded
- SVG logo from the source file, a favicon set, and a 1200×630 share image
- Remove `noindex` and all `[CONFIRM]` markers before launch

## Open `[CONFIRM]` markers (28)

| Page | What's needed |
|---|---|
| Footer, Contact | Email address, social URLs |
| Thank-you | Response window the team can keep every time |
| Solar | Markets to name · wording of "why we work with installers" (NSW mention approved 5 Nov) |
| Work, Expertise | Tapika: display name, one-line description, what the system does · Noore Jewelry: scope · Austar Solar: content formats · approved screenshots for all five |
| About | Names, roles, photos and consent · Samir's bio |
| Content | Languages offered |
| Insight article | Author |
| Privacy | Storage, access, retention, analytics, date. **Legal review** |
| Terms | Legal entity and wording. **Legal review** |
| Head | Share image |
