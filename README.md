# SumCalculator.net

A static, browser-based sum calculator with About, Privacy Policy, and Terms of Use pages. Totals and extremes use decimal-string arithmetic with `BigInt`; averages are rounded to 10 decimal places.

## Preview locally

Serve the `dist` directory with any static server, for example:

```sh
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`.

## Deploy later to Cloudflare Pages

Connect this repository to Cloudflare Pages. Set the build command to none and the output directory to `dist`. Add `sumcalculator.net` as a custom domain after deploying. The repository already includes `robots.txt`, `sitemap.xml`, canonical URLs, and per-page metadata for that domain.

Before launch, create and monitor `hello@sumcalculator.net` and `privacy@sumcalculator.net`, or replace those addresses in the legal pages with working contact addresses. Review the legal pages against the actual operator, jurisdiction, and any analytics or advertising added during deployment.
