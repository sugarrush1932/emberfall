// EMBERFALL - core simulation.
// Pure logic, no rendering, no DOM. Fixed-step friendly: callers
// pass dt (already time-scaled) and a control snapshot, and get
// back a bitmask of events that happened during the step.

import {
  FIELD, STAR, PLAYER, SHARDS_TO_WIN, RUN_SECONDS,
  SHARD, DEBRIS, COMBO, SURGE, PALETTE,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_FEVER_START = 4;
export const EVENT_FEVER_END = 8;
export const EVENT_WIN = 16;
export const EVENT_LOSE = 32;
export const EVENT_DASH = 64;
export const EVENT_NEAR_MISS = 128;
export const EVENT_LAUNCH = 256;

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function gravityAccelAt(dist) {
  return Math.min(
    STAR.maxGravityAccel,
    STAR.gravity / (dist + STAR.gravitySoftening),
  );
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    bestCombo: 0,
    shardsCollected: 0,
    combo: 0,
    comboTimer: 0,
    fever: false,
    feverTimer: 0,
    integrity: 100,
    collapse: 0,
    surge: false,
    surgeTimer: SURGE.period,
    phase: 'play',
    loseReason: '',
    slowmo: 0,
    shake: 0,
    star: { x: STAR.x, y: STAR.y, radius: STAR.coreRadius, pulse: 0 },
    player: {
      x: STAR.x + 250, y: STAR.y, vx: 0, vy: 0,
      radius: PLAYER.radius, invulnerable: 0,
      dashTimer: 0, dashCooldownTimer: 0, dead: false,
    },
    shards: [],
    debris: [],
    particles: [],
    rings: [],
    floaters: [],
    spawnTimers: { shard: 0.4, debris: 1.6 },
  };

  function burst(x, y, count, color, speed, size) {
    for (let i = 0; i < count; i++) {
      const a = random.angle();
      const s = random.range(speed * 0.25, speed);
      const life = random.range(0.25, 0.7);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, maxLife: life,
        size: random.range(size * 0.5, size * 1.4),
        color,
        drag: 2.2,
      });
    }
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, life: 0.9, color });
  }

  function addRing(radius, alpha, width) {
    state.rings.push({ radius, alpha, width });
  }

  function spawnShard() {
    const a = random.angle();
    const orbit = random.range(SHARD.minOrbit, SHARD.maxOrbit);
    const x = clamp(state.star.x + Math.cos(a) * orbit, 24, FIELD.width - 24);
    const y = clamp(state.star.y + Math.sin(a) * orbit, 24, FIELD.height - 24);
    const dx = x - state.star.x;
    const dy = y - state.star.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const sign = random.next() < 0.5 ? -1 : 1;
    const orbitSpeed = Math.sqrt(gravityAccelAt(dist) * dist) * 0.32;
    state.shards.push({
      x, y,
      vx: (-dy / dist) * orbitSpeed * sign,
      vy: (dx / dist) * orbitSpeed * sign,
      age: 0,
      seed: random.next(),
    });
  }

  function spawnDebris() {
    const edge = random.int(0, 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = random.range(0, FIELD.width); y = -30; }
    else if (edge === 1) { x = random.range(0, FIELD.width); y = FIELD.height + 30; }
    else if (edge === 2) { x = -30; y = random.range(0, FIELD.height); }
    else { x = FIELD.width + 30; y = random.range(0, FIELD.height); }
    const tx = state.star.x + random.range(-170, 170);
    const ty = state.star.y + random.range(-170, 170);
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = random.range(DEBRIS.minSpeed, DEBRIS.maxSpeed);
    state.debris.push({
      x, y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      radius: random.range(DEBRIS.minRadius, DEBRIS.maxRadius),
      spin: random.range(-2.2, 2.2),
      angle: random.angle(),
      nearMissed: false,
    });
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.bestCombo = 0;
    state.shardsCollected = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.fever = false;
    state.feverTimer = 0;
    state.integrity = 100;
    state.collapse = 0;
    state.surge = false;
    state.surgeTimer = SURGE.period;
    state.phase = 'play';
    state.loseReason = '';
    state.slowmo = 0;
    state.shake = 0;
    state.star.x = STAR.x;
    state.star.y = STAR.y;
    state.star.radius = STAR.coreRadius;
    state.star.pulse = 0;
    const dist = 250;
    const speed = Math.sqrt(gravityAccelAt(dist) * dist);
    state.player.x = STAR.x + dist;
    state.player.y = STAR.y;
    state.player.vx = 0;
    state.player.vy = speed; // clockwise tangent from the right side
    state.player.radius = PLAYER.radius;
    state.player.invulnerable = 0;
    state.player.dashTimer = 0;
    state.player.dashCooldownTimer = 0;
    state.player.dead = false;
    state.shards.length = 0;
    state.debris.length = 0;
    state.particles.length = 0;
    state.rings.length = 0;
    state.floaters.length = 0;
    state.spawnTimers.shard = 0.4;
    state.spawnTimers.debris = 1.6;
  }

  function updateEffects(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      const dragF = Math.exp(-(p.drag || 0) * dt);
      p.vx *= dragF;
      p.vy *= dragF;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = state.floaters.length - 1; i >= 0; i--) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 36 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    for (let i = state.rings.length - 1; i >= 0; i--) {
      const r = state.rings[i];
      r.radius += 280 * dt;
      r.alpha -= 0.85 * dt;
      if (r.alpha <= 0) state.rings.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 1.6);
    // slowmo is counted down with the dt the world receives; main.js
    // applies the actual time scale to the dt it passes in.
    state.slowmo = Math.max(0, state.slowmo - dt);
  }

  function emitTrail() {
    const p = state.player;
    for (let i = 0; i < 2; i++) {
      const life = random.range(0.18, 0.38);
      state.particles.push({
        x: p.x + random.range(-4, 4),
        y: p.y + random.range(-4, 4),
        vx: -p.vx * 0.12 + random.range(-16, 16),
        vy: -p.vy * 0.12 + random.range(-16, 16),
        life, maxLife: life,
        size: random.range(1.6, 3.6),
        color: state.fever ? PALETTE.feverGold : PALETTE.trail,
        drag: 1.4,
      });
    }
    if (state.particles.length > 420) {
      state.particles.splice(0, state.particles.length - 420);
    }
  }

  function lose(reason, events) {
    if (state.phase !== 'play') return events;
    state.phase = 'lost';
    state.loseReason = reason;
    return events | EVENT_LOSE;
  }

  function step(dt, control, attract) {
    let events = 0;
    const ctrl = control || { ax: 0, ay: 0, dash: false, launch: null };
    const p = state.player;
    state.time += dt;

    // Star pulse and growth with collapse.
    state.star.pulse = Math.sin(state.time * 2.1) * 0.6
      + Math.sin(state.time * 3.7) * 0.4;
    const growth = 1 + 0.35 * state.collapse;
    state.star.radius = STAR.coreRadius
      * (1 + 0.05 * state.star.pulse) * growth;

    // Surge cycle.
    state.surgeTimer -= dt;
    if (!state.surge && state.surgeTimer <= 0) {
      state.surge = true;
      state.surgeTimer = SURGE.duration;
      addRing(state.star.radius + 6, 0.9, 3);
    } else if (state.surge && state.surgeTimer <= 0) {
      state.surge = false;
      state.surgeTimer = SURGE.period;
    }

    if (state.phase !== 'play') {
      updateEffects(dt);
      return events;
    }

    // Collapse (the star slowly eats the run).
    if (!attract) {
      let rate = dt / RUN_SECONDS;
      if (state.surge) rate *= SURGE.collapseScale;
      if (state.collapse > 0.5) rate *= 1.35;
      if (state.fever) rate *= 0.5;
      state.collapse = clamp(state.collapse + rate, 0, 1);
      if (state.collapse >= 1) {
        events = lose('collapse', events);
        updateEffects(dt);
        return events;
      }
    }

    // Timers.
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (p.dashCooldownTimer > 0) p.dashCooldownTimer -= dt;
    if (p.dashTimer > 0) p.dashTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.fever) {
      state.feverTimer -= dt;
      if (state.feverTimer <= 0) {
        state.fever = false;
        state.feverTimer = 0;
        events |= EVENT_FEVER_END;
      }
    }

    const dxs = state.star.x - p.x;
    const dys = state.star.y - p.y;
    const distStar = Math.max(1, Math.hypot(dxs, dys));
    const nsx = dxs / distStar;
    const nsy = dys / distStar;

    if (attract) {
      // Auto-orbit: steer toward a tangential velocity that holds
      // a roughly 250 px orbit, correcting radial drift.
      const orbitSpeed = Math.sqrt(gravityAccelAt(250) * 250) * 0.92;
      const tx = -nsy;
      const ty = nsx;
      const radialError = distStar - 250;
      const desiredVx = tx * orbitSpeed + nsx * radialError * 1.4;
      const desiredVy = ty * orbitSpeed + nsy * radialError * 1.4;
      const steer = Math.min(1, dt * 2.2);
      p.vx += (desiredVx - p.vx) * steer;
      p.vy += (desiredVy - p.vy) * steer;
    } else {
      // Slingshot launch overrides velocity.
      if (ctrl.launch) {
        const lvx = ctrl.launch.x || 0;
        const lvy = ctrl.launch.y || 0;
        const lLen = Math.hypot(lvx, lvy);
        const cap = 900;
        const scale = lLen > cap ? cap / lLen : 1;
        p.vx = lvx * scale;
        p.vy = lvy * scale;
        events |= EVENT_LAUNCH;
      }
      // Dash along the current heading.
      if (ctrl.dash && p.dashCooldownTimer <= 0 && !p.dead) {
        let hx = p.vx;
        let hy = p.vy;
        if (Math.hypot(hx, hy) < 10) { hx = ctrl.ax || 0; hy = ctrl.ay || 0; }
        if (Math.hypot(hx, hy) < 1) { hx = -nsy; hy = nsx; }
        const hLen = Math.max(1, Math.hypot(hx, hy));
        p.vx = (hx / hLen) * PLAYER.dashSpeed;
        p.vy = (hy / hLen) * PLAYER.dashSpeed;
        p.dashTimer = PLAYER.dashTime;
        p.dashCooldownTimer = PLAYER.dashCooldown;
        state.slowmo = Math.max(state.slowmo, 0.18);
        burst(p.x, p.y, 10, PALETTE.emberBright, 190, 3);
        events |= EVENT_DASH;
      }
      // Gravity (halved while dashing) plus player thrust.
      const gravScale = (state.surge ? SURGE.gravityScale : 1)
        * (p.dashTimer > 0 ? 0.5 : 1);
      const g = gravityAccelAt(distStar) * gravScale;
      p.vx += nsx * g * dt;
      p.vy += nsy * g * dt;
      p.vx += (ctrl.ax || 0) * PLAYER.thrustAccel * dt;
      p.vy += (ctrl.ay || 0) * PLAYER.thrustAccel * dt;
    }

    // Integrate, damp, clamp.
    const damp = Math.exp(-PLAYER.spaceDrag * dt);
    p.vx *= damp;
    p.vy *= damp;
    if (p.dashTimer <= 0) {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > PLAYER.maxSpeed) {
        p.vx = (p.vx / sp) * PLAYER.maxSpeed;
        p.vy = (p.vy / sp) * PLAYER.maxSpeed;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx) * PLAYER.wallBounce; }
    if (p.x > FIELD.width - p.radius) {
      p.x = FIELD.width - p.radius;
      p.vx = -Math.abs(p.vx) * PLAYER.wallBounce;
    }
    if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy) * PLAYER.wallBounce; }
    if (p.y > FIELD.height - p.radius) {
      p.y = FIELD.height - p.radius;
      p.vy = -Math.abs(p.vy) * PLAYER.wallBounce;
    }

    // Singe zone and direct star contact (play mode only).
    if (!attract && !p.dead) {
      const ndx = p.x - state.star.x;
      const ndy = p.y - state.star.y;
      const nd = Math.max(1, Math.hypot(ndx, ndy));
      if (nd < STAR.singeRadius) {
        state.integrity -= 20 * dt;
        p.vx += (ndx / nd) * 240 * dt;
        p.vy += (ndy / nd) * 240 * dt;
      }
      if (nd < state.star.radius + p.radius && p.invulnerable <= 0) {
        state.integrity -= 25;
        p.vx = (ndx / nd) * 520;
        p.vy = (ndy / nd) * 520;
        p.invulnerable = PLAYER.invulnerableTime;
        state.shake = 1;
        burst(p.x, p.y, 16, PALETTE.starCorona, 260, 3.5);
        events |= EVENT_HIT;
        if (state.integrity <= 0) {
          state.integrity = 0;
          p.dead = true;
          burst(p.x, p.y, 42, PALETTE.ember, 380, 4);
          events = lose('scattered', events);
        }
      }
    }

    if (!p.dead) emitTrail();

    // Shards: spawn, drift, magnet, collect.
    state.spawnTimers.shard -= dt;
    if (state.spawnTimers.shard <= 0) {
      state.spawnTimers.shard = attract
        ? SHARD.spawnInterval * 2.5
        : SHARD.spawnInterval;
      const cap = attract ? 4 : SHARD.maxAlive;
      if (state.shards.length < cap) spawnShard();
    }
    for (let i = state.shards.length - 1; i >= 0; i--) {
      const s = state.shards[i];
      s.age += dt;
      if (s.age >= SHARD.lifetime) { state.shards.splice(i, 1); continue; }
      const sdx = state.star.x - s.x;
      const sdy = state.star.y - s.y;
      const sd = Math.max(1, Math.hypot(sdx, sdy));
      s.vx += (sdx / sd) * 2 * dt;
      s.vy += (sdy / sd) * 2 * dt;
      if (state.fever && !attract) {
        const fdx = p.x - s.x;
        const fdy = p.y - s.y;
        const fd = Math.hypot(fdx, fdy);
        if (fd > 1 && fd < 190) {
          s.vx += (fdx / fd) * 300 * dt;
          s.vy += (fdy / fd) * 300 * dt;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (!attract && !p.dead) {
        const cdx = p.x - s.x;
        const cdy = p.y - s.y;
        if (Math.hypot(cdx, cdy) < SHARD.collectRadius + p.radius) {
          state.shards.splice(i, 1);
          state.shardsCollected += 1;
          state.combo = state.comboTimer > 0
            ? Math.min(COMBO.maxCombo, state.combo + 1)
            : 1;
          state.comboTimer = COMBO.windowSeconds;
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          const gain = SHARD.scoreBase * state.combo
            * (state.fever ? 2 : 1);
          state.score += gain;
          addFloater(s.x, s.y - 10, '+' + gain, PALETTE.shard);
          burst(s.x, s.y, 10, PALETTE.shard, 210, 3);
          events |= EVENT_PICKUP;
          if (!state.fever && state.combo >= COMBO.feverAt) {
            state.fever = true;
            state.feverTimer = COMBO.feverSeconds;
            addRing(state.star.radius + 10, 0.55, 2);
            events |= EVENT_FEVER_START;
          }
          if (state.shardsCollected >= SHARDS_TO_WIN) {
            state.score += Math.round(state.integrity) * 5
              + Math.round((1 - state.collapse) * RUN_SECONDS) * 10;
            state.phase = 'won';
            burst(p.x, p.y, 36, PALETTE.feverGold, 340, 4);
            events |= EVENT_WIN;
          }
        }
      }
    }

    // Debris: spawn, move, near miss, collide.
    state.spawnTimers.debris -= dt;
    if (state.spawnTimers.debris <= 0) {
      state.spawnTimers.debris = attract
        ? DEBRIS.spawnInterval * 2.2
        : DEBRIS.spawnInterval;
      if (state.debris.length < (attract ? 3 : 10)) spawnDebris();
    }
    for (let i = state.debris.length - 1; i >= 0; i--) {
      const d = state.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.angle += d.spin * dt;
      if (d.x < -80 || d.x > FIELD.width + 80
        || d.y < -80 || d.y > FIELD.height + 80) {
        state.debris.splice(i, 1);
        continue;
      }
      if (attract || p.dead) continue;
      const ddx = p.x - d.x;
      const ddy = p.y - d.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd < d.radius + p.radius - 4) {
        if (p.invulnerable > 0) continue;
        state.integrity -= DEBRIS.hitDamage;
        const nx = dd > 1 ? ddx / dd : 1;
        const ny = dd > 1 ? ddy / dd : 0;
        p.vx = nx * 460 + d.vx * 0.3;
        p.vy = ny * 460 + d.vy * 0.3;
        p.invulnerable = PLAYER.invulnerableTime;
        state.shake = 1;
        burst(p.x, p.y, 18, PALETTE.debrisCrack, 280, 3.5);
        state.debris.splice(i, 1);
        events |= EVENT_HIT;
        if (state.integrity <= 0) {
          state.integrity = 0;
          p.dead = true;
          burst(p.x, p.y, 46, PALETTE.ember, 400, 4);
          events = lose('scattered', events);
          break;
        }
      } else if (!d.nearMissed && dd < DEBRIS.nearMissRadius + d.radius) {
        d.nearMissed = true;
        state.score += DEBRIS.nearMissScore;
        state.slowmo = Math.max(state.slowmo, 0.22);
        addFloater(p.x, p.y - 20, 'CLOSE +' + DEBRIS.nearMissScore, PALETTE.hudText);
        events |= EVENT_NEAR_MISS;
      }
    }

    updateEffects(dt);
    return events;
  }

  reset();
  return { state, reset, step };
}
