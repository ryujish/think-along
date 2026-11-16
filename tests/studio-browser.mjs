// Run against a started app: node tests/studio-browser.mjs http://127.0.0.1:3180
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function orca(...args) {
  const result = JSON.parse(execFileSync('rtk', ['proxy', 'orca', ...args, '--json'], { encoding: 'utf8' }));
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.result;
}

const { browserPageId } = orca('tab', 'create', '--url', new URL('/projects?view=studio', process.argv[2] || 'http://127.0.0.1:3180').href);
const page = ['--page', browserPageId];
orca('wait', '--selector', '.perspective', ...page);
for (const width of [1440, 900, 390]) {
  orca('exec', '--command', `set viewport ${width} 1000`, ...page);
  const result = orca('eval', '--expression', `(() => {
    const cards = [...document.querySelectorAll('.perspective')].filter(card => getComputedStyle(card).display !== 'none');
    const readable = cards.every(card => card.querySelector('.evidence').getBoundingClientRect().top >= card.querySelector('.tradeoffs').getBoundingClientRect().bottom);
    const links = [...document.querySelectorAll('.sidebar-bottom a')];
    return {width: innerWidth, readable, noOverflow: document.documentElement.scrollWidth <= innerWidth,
      navigation: innerWidth <= 720 || links.every(link => getComputedStyle(link).fontSize !== '0px' || link.querySelector('svg'))};
  })()`, ...page);
  const state = JSON.parse(result.result);
  assert.equal(state.width, width);
  assert.equal(state.readable, true, `Evidence overlaps comparison text at ${width}px`);
  assert.equal(state.noOverflow, true, `Horizontal overflow at ${width}px`);
  assert.equal(state.navigation, true, `Existing workspace links are invisible at ${width}px`);
}
console.log('Studio browser checks passed at 1440, 900 and 390px.');
