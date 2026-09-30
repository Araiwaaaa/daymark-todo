# Baan Malak Cafe

A responsive cafe menu and pickup-ordering app. Menu filtering, cart totals, and sample order confirmation run entirely in the browser; no database or environment secrets are needed.

## Run locally

Requires Node.js 22 or newer. Run `npm start` and open [http://localhost:3000](http://localhost:3000). Cart contents are saved in the browser's local storage.

## Tests

Run `npm test` to exercise menu search/filtering and cart quantity/total calculations.

## Deploy to Vercel

Import this repository with the project root as the Root Directory. Vercel serves the root `index.html`, `styles.css`, and `app.js` as a static site. No database, environment variables, or Vercel Functions are required. Confirmed orders are a front-end demo only; connect an order API or POS before using this app to receive real orders.