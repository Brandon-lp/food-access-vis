const sections = [
  ['top', 'sections/01-hero.html'],
  ['top', 'sections/02-story.html'],
  ['top', 'sections/03-explore.html'],
  ['top', 'sections/04-about.html'],
  ['site-footer', 'sections/05-footer.html']
];

function loadSection([targetId, file]) {
  return fetch(file)
    .then((response) => response.ok ? response.text() : Promise.reject(new Error(`${file} unavailable`)))
    .then((markup) => document.querySelector(`#${targetId}`).insertAdjacentHTML('beforeend', markup));
}

function dispatchSectionsLoaded() {
  document.dispatchEvent(new CustomEvent('sections:loaded', { bubbles: true }));
}

Promise.all(sections.map(loadSection))
  .then(() => {
    dispatchSectionsLoaded();
  })
  .catch(() => {
    document.querySelector('#top').innerHTML = '<p class="load-error">The page sections could not be loaded. Use a local server such as VS Code Live Server to run this project.</p>';
  });