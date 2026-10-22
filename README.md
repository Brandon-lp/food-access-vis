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
- `sections/07-main-message.html`: Part 5, who receives SNAP
- `sections/08-solution.html`: Solution, taking action and project link (placeholder copy)
- `sections/09-footer.html`: footer content

1. Replace the sample values in `data/food-access.csv` with your source data.
2. Keep the CSV columns as `county,distance,lowAccess,noCar`, or update the parser in `script.js`.
3. Edit each screen in its own file under `sections/`; use `styles.css` for shared layout and styling.
4. Replace the placeholder GitHub link in `sections/08-solution.html` with your repository URL.

The shell and loading order live in `index.html` and `script.js`. Do not open `index.html` directly with a `file://` URL when testing, because browsers block the section and CSV fetches. Use VS Code Live Server or another local static server.

## Publish with GitHub Pages
https://brandon-lp.github.io/food-access-vis/
Create a repository named `food-access-vis`, push these files to the `main` branch, then open **Settings > Pages**. Choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
