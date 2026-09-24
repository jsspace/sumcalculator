# SumCalculator.net

A static, browser-based sum calculator with About, Contact, Privacy Policy, and Terms of Use pages. Totals and extremes use decimal-string arithmetic with `BigInt`; averages are rounded to 10 decimal places.

## Preview locally

Serve the `dist` directory with any static server, for example:

```sh
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`.

## Deploy later to Cloudflare Pages

Connect this repository to Cloudflare Pages. Set the build command to none and the output directory to `dist`. Add `sumcalculator.net` as a custom domain after deploying. The repository already includes `robots.txt`, `sitemap.xml`, canonical URLs, and per-page metadata for that domain.

Before launch, create and monitor `hello@sumcalculator.net` and `privacy@sumcalculator.net`, or replace those addresses in the legal pages with working contact addresses. Review the legal pages against the actual operator, jurisdiction, and any later analytics or advertising changes.

## Search and analytics

Every HTML page includes the Google Analytics tag `G-JYVVS98HSK`. The home page also contains the Google Search Console verification meta tag. `dist/robots.txt` points crawlers to `dist/sitemap.xml`, and each indexable page has a self-referencing canonical URL. The top-level `dist/404.html` lets Cloudflare Pages return a proper not-found page instead of treating unknown URLs as single-page app routes.

After the domain is live, verify the property in Search Console and submit `https://sumcalculator.net/sitemap.xml`. The Privacy Policy describes Google Analytics and its possible cookies.

`dist/llms.txt` provides a concise Markdown guide to the site, and `dist/llms-full.txt` contains a fuller plain-text account of the calculator and information pages. The five indexable HTML pages point to `llms.txt` with `rel="describedby"`. Keep these files aligned with the HTML pages when site content changes.
