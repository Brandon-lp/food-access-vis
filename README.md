# Food Access Vis

An editorial-style data visualization starter for a data visualization class. It is a static site, so it can be hosted directly with GitHub Pages.

## Run locally

Open `index.html` in a browser. To load the CSV consistently, use VS Code's Live Server extension or any local static server.

## Customize

The main page is split into five independently editable files:

- `sections/01-hero.html`: opening screen and visual introduction
- `sections/02-story.html`: context and key statistics
- `sections/03-explore.html`: interactive county comparison chart
- `sections/04-about.html`: interactive U.S. food access map and project link
- `sections/05-footer.html`: footer content

1. The interactive county map reads `data/food_atlas_cleaned.csv`. Its bubble size uses the `Low Income & Low Access Population 2019` column; the selected-county detail also shows `Pct Low Income & Low Access Population 2019`.
2. County boundaries are loaded from the US Atlas TopoJSON dataset, and the map uses D3 and TopoJSON Client from jsDelivr. A connection is needed to load those libraries and boundaries.
3. Edit each screen in its own file under `sections/`; use `styles.css` for shared layout and styling.
4. Replace the placeholder GitHub link in `sections/04-about.html` with your repository URL.

The page sections and comparison chart are loaded by `script.js`; the standalone county map is in `map.js`. Both initialize after the page sections have loaded. Do not open `index.html` directly with a `file://` URL when testing, because browsers block the section and CSV fetches. Use VS Code Live Server or another local static server.

## Publish with GitHub Pages
https://brandon-lp.github.io/food-access-vis/
Create a repository named `food-access-vis`, push these files to the `main` branch, then open **Settings > Pages**. Choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
