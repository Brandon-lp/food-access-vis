const sections = [
  ['top', 'sections/01-hook-overview.html'],
  ['top', 'sections/02-hook-definition.html'],
  ['top', 'sections/03-hook-dimensions.html'],
  ['top', 'sections/04-physical-access.html'],
  ['top', 'sections/05-race.html'],
  ['top', 'sections/06-economic-access.html'],
  ['top', 'sections/06b-daily-budget.html'],
  ['top', 'sections/06c-access-change.html'],
  ['top', 'sections/07-main-message.html'],
  ['top', 'sections/08-solution.html'],
  ['site-footer', 'sections/09-footer.html']
];

function loadSection([targetId, file]) {
  return fetch(file)
    .then((response) => response.ok ? response.text() : Promise.reject(new Error(`${file} unavailable`)))
    .then((markup) => [targetId, markup, file]);
}

// Sections download at the same time, but are added to the page only after all have arrived, in list order.
// Scripts inside a section are pulled out and run afterwards, because scripts inserted as HTML never execute.
function insertSections(loadedSections) {
  const sectionScripts = [];
  loadedSections.forEach(([targetId, markup, file]) => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    template.content.querySelectorAll('script').forEach((script) => {
      // Libraries a section loads for standalone viewing are already on the site; don't load them twice.
      if (!script.hasAttribute('data-standalone-only')) sectionScripts.push([script, new URL(file, location.href)]);
      script.remove();
    });
    document.querySelector(`#${targetId}`).append(template.content);
  });
  return sectionScripts.reduce((previous, [script, baseUrl]) => previous.then(() => runScript(script, baseUrl)), Promise.resolve());
}

function dispatchSectionsLoaded() {
  document.dispatchEvent(new CustomEvent('sections:loaded', { bubbles: true }));
}

// Recreates a section script so it runs. Relative src paths are resolved against the section file, not the page.
function runScript(original, baseUrl) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    if (original.hasAttribute('src')) {
      script.src = new URL(original.getAttribute('src'), baseUrl).href;
      script.onload = resolve;
      script.onerror = resolve;
    } else {
      script.textContent = original.textContent;
    }
    document.body.append(script);
    if (!original.hasAttribute('src')) resolve();
  });
}

Promise.all(sections.map(loadSection))
  .then(insertSections)
  .then(() => {
    dispatchSectionsLoaded();
  })
  .catch(() => {
    const exploreSectionExists = document.querySelector('#explore');

    if (!exploreSectionExists) {
      document.querySelector('#top').innerHTML = '<p class="load-error">The page sections could not be loaded. Use a local server such as VS Code Live Server to run this project.</p>';
    }
  });