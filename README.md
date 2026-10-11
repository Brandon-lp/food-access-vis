# Food Access Vis

An editorial-style data visualization starter for a data visualization class. It is a static site, so it can be hosted directly with GitHub Pages.

## Run locally

Open `index.html` in a browser. To load the CSV consistently, use VS Code's Live Server extension or any local static server.

## Customize

The main page is split into five independently editable files:

- `sections/01-hero.html`: opening screen and visual introduction
- `sections/02-story.html`: context and key statistics
- `sections/03-explore.html`: interactive chart screen
- `sections/04-about.html`: closing argument and project link
- `sections/05-footer.html`: footer content

1. Replace the sample values in `data/food-access.csv` with your source data.
2. Keep the CSV columns as `county,distance,lowAccess,noCar`, or update the parser in `script.js`.
3. Edit each screen in its own file under `sections/`; use `styles.css` for shared layout and styling.
4. Replace the placeholder GitHub link in `sections/04-about.html` with your repository URL.

The shell and loading order live in `index.html` and `script.js`. Do not open `index.html` directly with a `file://` URL when testing, because browsers block the section and CSV fetches. Use VS Code Live Server or another local static server.

## Publish with GitHub Pages

Create a repository named `food-access-vis`, push these files to the `main` branch, then open **Settings > Pages**. Choose **Deploy from a branch**, select `main` and `/ (root)`, and save.