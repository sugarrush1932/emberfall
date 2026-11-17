// EMBERFALL - deterministic screenshot scenes.
// A tiny autopilot flies the ember so staged screenshots show real
// gameplay instead of an empty field.

import { STEP, FIELD, STAR, SHARDS_TO_WIN } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WON, SCREEN_OVER } from './render.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

const ZERO = { ax: 0, ay: 0, dash: false, launch: null };

export function pilotControl(state) {
  const player = state.player;
  const star = state.star;
  // Nearest reachable shard is the target. Shards drift in nearly
  // straight lines, so aim at where the shard will be, and ignore
  // shards that have already drifted off the field when an on-field
  // shard exists.
  let target = null;
  let aimX = 0;
  let aimY = 0;
  let bestDist = Infinity;
  const onField = state.shards.filter((s) =>
    s.x >= -10 && s.x <= FIELD.width + 10 && s.y >= -10 && s.y <= FIELD.height + 10);
  const candidates = onField.length > 0 ? onField : state.shards;
  for (const shard of candidates) {
    const dist = Math.hypot(shard.x - player.x, shard.y - player.y);
    const lead = dist / 320;
    const px = shard.x + shard.vx * lead;
    const py = shard.y + shard.vy * lead;
    const aimDist = Math.hypot(px - player.x, py - player.y);
    if (aimDist < bestDist) {
      bestDist = aimDist;
      target = shard;
      aimX = px;
      aimY = py;
    }
  }
  let desX = 0;
  let desY = 0;
  if (target) {
    const dx = aimX - player.x;
    const dy = aimY - player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = dist > 60 ? 300 : dist * 3;
    desX = (dx / dist) * speed;
    desY = (dy / dist) * speed;
  } else {
    // No shard yet: hold a gentle tangential orbit around the star.
    const sx = player.x - star.x;
    const sy = player.y - star.y;
    const sDist = Math.max(1, Math.hypot(sx, sy));
    desX = (-sy / sDist) * 160;
    desY = (sx / sDist) * 160;
  }
  // Too close to the star: aim back out along the radius.
  const pdx = player.x - star.x;
  const pdy = player.y - star.y;
  const pDist = Math.max(1, Math.hypot(pdx, pdy));
  if (pDist < 150) {
    const blend = 1 - pDist / 150;
    desX = desX * (1 - blend) + (pdx / pDist) * 260 * blend;
    desY = desY * (1 - blend) + (pdy / pDist) * 260 * blend;
  }
  // Steer around nearby debris: a rock close ahead pushes the
  // desired velocity sideways so the run survives long enough to
  // chain pickups.
  for (const rock of state.debris) {
    const rx = player.x - rock.x;
    const ry = player.y - rock.y;
    const rDist = Math.max(1, Math.hypot(rx, ry));
    if (rDist < 110) {
      const push = (110 - rDist) * 2.4;
      desX += (rx / rDist) * push;
      desY += (ry / rDist) * push;
    }
  }
  return {
    ax: clamp((desX - player.vx) / 260, -1, 1),
    ay: clamp((desY - player.vy) / 260, -1, 1),
    dash: target ? bestDist > 220 : false,
    launch: null,
  };
}

function runPilot(world, maxSeconds, stopWhen) {
  const state = world.state;
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i++) {
    if (state.phase !== 'play') break;
    world.step(STEP, pilotControl(state), false);
    if (stopWhen && stopWhen(state)) break;
  }
  return state;
}

function endScreenFor(state) {
  if (state.phase === 'won') return SCREEN_WON;
  if (state.phase === 'lost') return SCREEN_OVER;
  return SCREEN_PLAY;
}

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.reset();
    runPilot(world, 16, null);
    return { screen: endScreenFor(state), best: state.score };
  }
  if (name === 'fever') {
    world.reset();
    let feverTime = 0;
    runPilot(world, 55, (s) => {
      if (s.fever) feverTime += STEP;
      return feverTime >= 0.5;
    });
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'end') {
    world.reset();
    runPilot(world, 140, null);
    return { screen: state.phase === 'won' ? SCREEN_WON : SCREEN_OVER, best: state.score };
  }
  // 'title' and anything unknown.
  world.reset();
  const steps = Math.floor(4 / STEP);
  for (let i = 0; i < steps; i++) world.step(STEP, ZERO, true);
  return { screen: SCREEN_TITLE, best: 0 };
}

// Referenced so tree-shaken builds keep the contract constants visible.
export const SHOT_CONTRACT = { FIELD, STAR, SHARDS_TO_WIN };
