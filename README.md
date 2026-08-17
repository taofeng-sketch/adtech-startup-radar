# Adtech Startup Radar

A public-source, interactive scan of private adtech companies across targeting, optimization, measurement and commerce.

The site deliberately distinguishes ARR, annual revenue, net revenue, run-rate, transaction value and estimates. Each company dossier links revenue, valuation event, payer, named customers and investors back to its reviewed public sources. Named logos are customer evidence, not a claim about the largest account or customer concentration.

The radar uses three separate visual encodings: horizontal position is the marketing job from targeting through optimization to measurement; vertical position is company maturity from early stage to public; bubble size is disclosed ARR or the nearest comparable annual revenue metric. Financing stage determines maturity, with a late-stage override only for a completed acquisition, explicit mature growth/PE event, or strong disclosed operating scale.

## Local preview

Serve this directory with any static HTTP server, then open `index.html`.

## Data maintenance

Company records and source links live in `data.js`. Update the `asOf` field, metric label, valuation event/date and source links whenever a financial figure changes.
