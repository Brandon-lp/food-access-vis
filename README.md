# Food Access Vis

An editorial-style data visualization starter for a data visualization class. It is a static site, so it can be hosted directly with GitHub Pages.

## Run locally

Open `index.html` in a browser. To load the CSV consistently, use VS Code's Live Server extension or any local static server.

## Customize

The main page follows the storyboard and is split into independently editable files:

- `sections/01-hook-overview.html`: Hook 1, opening screen
- `sections/02-hook-definition.html`: Hook 2, definition of food insecurity (placeholder)
- `sections/03-hook-dimensions.html`: Hook 3, the dimensions of food insecurity (placeholder)
- `sections/04-physical-access.html`: Part 2, physical access maps
- `sections/05-race.html`: Part 3, low access by demographic
- `sections/06-economic-access.html`: Part 4, food sales and income
- `sections/06b-daily-budget.html`: Part 4b, daily food budget (what a state's average daily food-benefit amount per person buys)
- `sections/07-main-message.html`: Part 5, who receives SNAP
- `sections/08-solution.html`: Solution, taking action and project link (placeholder copy)
- `sections/09-footer.html`: footer content

1. The interactive map reads `data/food_atlas_cleaned.csv`. The national view colors states by the unweighted average of county percentages in `Pct Low Income & Low Access Population 2019`; selecting a state switches to county bubbles sized by `Low Income & Low Access Population 2019`.
2. The animated high-striker below the map follows the selected state. Its moving striker peaks according to the state's total reported food-bank count (`Food Banks 2021`); the bell marks the state's total low-income, low-access population (`Low Income & Low Access Population 2019`). Food-bank counts represent locations, not food volume or service capacity.
3. County boundaries are loaded from the US Atlas TopoJSON dataset, and the map uses D3 and TopoJSON Client from jsDelivr. A connection is needed to load those libraries and boundaries.
4. Edit each screen in its own file under `sections/`; use `styles.css` for shared layout and styling.
5. Replace the placeholder GitHub link in `sections/08-solution.html` with your repository URL.

The page sections and comparison chart are loaded by `script.js`. The interactive county bubble map appears in the Physical access section; its rendering logic is in `map.js` and it reads `data/food_atlas_cleaned.csv`. Both initialize after the page sections have loaded. Do not open `index.html` directly with a `file://` URL when testing, because browsers block the section and CSV fetches. Use VS Code Live Server or another local static server.

## Publish with GitHub Pages
https://brandon-lp.github.io/food-access-vis/
Create a repository named `food-access-vis`, push these files to the `main` branch, then open **Settings > Pages**. Choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
