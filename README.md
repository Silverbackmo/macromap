# MacroMap

A working prototype of Mostaque Tahamid's Entrepreneurship 3310 concept, built with AI assistance.

Choose University of Houston, Downtown Houston, Midtown, Montrose or The Galleria, then browse 25 sample meals and 10 drinks, filter by budget, nutrition and sample dietary tags, see why each match fits, sort by protein per dollar, compare items, save favorites, and build a meal with combined totals. Empty searches offer explicit adjustments that preserve dietary choices. Restaurant names, nutrition, caffeine, prices, dietary tags and distances are fictional.

Delivery and pickup links open external services to find real options; sample items are not transferred and no orders or payments are submitted by this prototype. The selected area, favorites and meal plans are stored locally in the visitor's browser. Area presets change sample distances, radius filters, closest sorting, meal pairings and pickup search context. They preserve all nutrition, prices and meal selections and do not request device location.

## GitHub Pages

Publish the main branch from the repository root in Settings > Pages. The root contains index.html and .nojekyll, so no build step or API credentials are required.

## Verify locally

Open index.html in a browser. To check dietary tags, protein value ranking and search alternative constraints, run `node tests/discovery.test.cjs` and `node tests/locations.test.cjs`.
