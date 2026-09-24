# SumCalculator.net

A sum calculator with About, Contact, Privacy Policy, and Terms of Use pages. Regular calculation runs in the browser. Totals and extremes use decimal-string arithmetic with `BigInt`; averages are rounded to 10 decimal places. An optional AI button extracts numbers from messy text through Cloudflare Workers AI, then asks users to review the proposed list before calculating.

## Preview locally

Serve the `dist` directory with any static server, for example:

```sh
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`.

## Deploy to Cloudflare Workers

The Cloudflare project shown in the dashboard is a static-assets-only Worker, so its Bindings control is disabled. This repository now includes a Worker entry point and `wrangler.jsonc` with a Workers AI binding named `AI`. Deploy the repository root with `npx wrangler deploy` after authenticating with `npx wrangler login`; uploading only `dist` will omit the Worker code and keep Bindings disabled. The static files remain in `dist`, and the Worker handles only `/api/*` requests. Keep the account on **Workers Free** to make the daily AI allowance a hard limit rather than a paid overage.

The AI button appears only when the entered text cannot be read as a plain number list. The AI route accepts POST `/api/parse` with JSON `{ "input": "..." }` (up to 2,000 characters). It uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, validates decimal strings in the returned list, and never computes the total. Do not send sensitive text to this optional endpoint. When AI quota is exhausted, the button reports the error and regular local calculation remains available. AI failures log a code, status, and message in Cloudflare Observability without logging the submitted text.

The public contact address is `yimin.space.fe@gmail.com`. Review the legal pages against the actual operator, jurisdiction, and any later analytics or advertising changes.

## Search and analytics

Every HTML page includes the Google Analytics tag `G-JYVVS98HSK`. The home page also contains the Google Search Console verification meta tag. `dist/robots.txt` points crawlers to `dist/sitemap.xml`, and each indexable page has a self-referencing canonical URL. The top-level `dist/404.html` lets Cloudflare Pages return a proper not-found page instead of treating unknown URLs as single-page app routes.

After the domain is live, verify the property in Search Console and submit `https://sumcalculator.net/sitemap.xml`. The Privacy Policy describes Google Analytics and its possible cookies.

`dist/llms.txt` provides a concise Markdown guide to the site, and `dist/llms-full.txt` contains a fuller plain-text account of the calculator and information pages. The five indexable HTML pages point to `llms.txt` with `rel="describedby"`. Keep these files aligned with the HTML pages when site content changes.
