# US Housing Market Dynamics

Simple static dashboard for the last problem in `Problem Statement - DV.pdf`.

## Run

Open `index.html` in a browser, or serve the folder with any static server.

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Data

The TinyURL from the PDF returned `404` during implementation, so the page includes a representative sample dataset and an `Import CSV` button.

Supported CSV columns are flexible, but should include:

- `date`, `period_begin`, `period_end`, `month`, or `week`
- `state` or `state_name`
- `county`, `county_name`, `region`, or `region_name`
- Metrics such as `median_sale_price`, `median_list_price`, `inventory`, `new_listings`, `median_days_on_market`, `sold_above_list`, and `price_drops`

## Features

- State and county hierarchy filters
- KPI cards for price, inventory, speed, and demand pressure
- Time trend chart
- Monthly seasonality chart
- County comparison
- Automatic buyer/seller insight bullets
