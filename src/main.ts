import { createGame } from './game/createGame';
import { loadPreferences } from './platform/preferences';
import './style.css';

const preferences = loadPreferences(localStorage);
document.documentElement.classList.toggle(
  'reduced-motion',
  preferences.reducedMotion,
);
document.documentElement.dataset.screenShake = String(preferences.screenShake);

document.body.innerHTML = `<header><h1></h1><span>Playable prototype · Phase 3</span></header><main><div id="game" aria-label="Room and battlefield"></div><section id="interface" aria-label="Game controls"></section></main>`;
let game: ReturnType<typeof createGame> | null = null;
try {
  game = createGame();
} catch (error) {
  const panel = document.querySelector<HTMLElement>('#interface')!;
  panel.innerHTML = `<section role="alert"><h2>The game could not start</h2><p>Reload the page. If the problem continues, include this detail in a bug report:</p><pre></pre></section>`;
  panel.querySelector('pre')!.textContent =
    error instanceof Error ? error.message : 'Unknown startup error';
}

window.addEventListener('beforeunload', () => game?.destroy(true), {
  once: true,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game?.destroy(true);
  });
}
