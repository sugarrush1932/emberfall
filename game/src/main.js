// EMBERFALL - boot and game loop.
// Wires input, simulation, audio and rendering together with a
// fixed-timestep loop. Also supports ?shot=<name>&seed=<n> for
// deterministic screenshot staging.

import { STEP, BEST_KEY, FIELD } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_PICKUP, EVENT_HIT, EVENT_FEVER_START, EVENT_FEVER_END,
  EVENT_WIN, EVENT_LOSE, EVENT_DASH, EVENT_NEAR_MISS, EVENT_LAUNCH,
} from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_DASH } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_WON, SCREEN_OVER,
} from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && params.get('seed') !== null
  ? seedParam
  : (Date.now() % 2147483647);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

function announce(message) {
  if (statusEl) statusEl.textContent = message;
}

function loadBest() {
  try {
    const value = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (err) {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (err) { /* storage may be unavailable */ }
}

function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * FIELD.width / Math.max(1, rect.width),
    y: (clientY - rect.top) * FIELD.height / Math.max(1, rect.height),
  };
}

const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
let best = loadBest();

// Screenshot mode: stage one scene, draw it, signal readiness.
if (shotName) {
  const scene = stageShot(shotName, world);
  best = Math.max(best, scene.best);
  requestAnimationFrame(() => {
    renderer.draw(world.state, scene.screen, best, null);
    requestAnimationFrame(() => {
      renderer.draw(world.state, scene.screen, best, null);
      window.__shotReady = true;
    });
  });
} else {
  const input = createInput(canvas, toField);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let lastTime = performance.now();
  world.reset();

  function startRun() {
    audio.unlock();
    world.reset();
    screen = SCREEN_PLAY;
    announce('Emberfall. Gather shards, dodge debris, feed the star.');
  }

  function handleEvents(events) {
    const state = world.state;
    if (events & EVENT_PICKUP) audio.pickup(state.combo);
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_LAUNCH) audio.dash();
    if (events & EVENT_NEAR_MISS) audio.nearMiss();
    if (events & EVENT_HIT) {
      audio.hit();
      announce('Hull hit. Integrity ' + Math.ceil(state.integrity) + ' percent.');
    }
    if (events & EVENT_FEVER_START) {
      audio.feverStart();
      audio.setFever(true);
      announce('Fever! Shards are worth double.');
    }
    if (events & EVENT_FEVER_END) {
      audio.feverEnd();
      audio.setFever(false);
    }
    if (events & EVENT_WIN) {
      audio.win();
      audio.setFever(false);
      screen = SCREEN_WON;
      if (state.score > best) { best = state.score; saveBest(best); }
      announce('The star rekindles. Score ' + state.score + '. Press Enter to play again.');
    }
    if (events & EVENT_LOSE) {
      audio.lose();
      audio.setFever(false);
      screen = SCREEN_OVER;
      if (state.score > best) { best = state.score; saveBest(best); }
      announce('Game over. Score ' + state.score + '. Press Enter to try again.');
    }
  }

  function stepOnce(control, attract) {
    const events = world.step(STEP, control, attract);
    if (!attract) handleEvents(events);
  }

  function frame(now) {
    const frameDelta = Math.min(0.25, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const actions = input.takeActions();

    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_WON || screen === SCREEN_OVER) startRun();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Resumed.'); }
    }
    const dashQueued = (actions & ACTION_DASH) !== 0 && screen === SCREEN_PLAY;

    const scale = world.state.slowmo > 0 ? 0.35 : 1;
    accumulator += frameDelta * scale;
    let guard = 0;
    while (accumulator >= STEP && guard < 12) {
      guard++;
      accumulator -= STEP;
      if (screen === SCREEN_TITLE) {
        stepOnce({ ax: 0, ay: 0, dash: false, launch: null }, true);
      } else if (screen === SCREEN_PLAY) {
        const control = {
          ax: input.axisX(),
          ay: input.axisY(),
          dash: dashQueued && guard === 1,
          launch: guard === 1 ? input.takeLaunch() : null,
        };
        if (guard > 1) input.takeLaunch();
        stepOnce(control, false);
        if (screen !== SCREEN_PLAY) break;
      } else {
        break;
      }
    }
    if (guard >= 12) accumulator = 0;

    let aim = null;
    if (screen === SCREEN_PLAY && input.pointer.down) {
      const drag = input.dragVector();
      if (Math.hypot(drag.x, drag.y) > 4) aim = { dx: drag.x, dy: drag.y };
    }
    renderer.draw(world.state, screen, best, aim);
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());
  announce('Emberfall. Press Enter or click to start.');
  requestAnimationFrame(frame);
}
