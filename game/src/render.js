// EMBERFALL - canvas renderer.
// Everything is drawn in field coordinates (1280 x 800). Decoration
// (nebula, starfield) is generated once from a fixed seed so every
// frame and every screenshot looks the same.

import { FIELD, STAR, SHARD, COMBO, SHARDS_TO_WIN, PALETTE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_OVER = 'over';

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,3,13,0.45)';
  roundedRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.restore();
}

function text(ctx, value, x, y, font, color, align) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
  ctx.restore();
}

export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

  // Deterministic decoration, built once.
  const decorRandom = createRandom(20261);
  const nebulaKeys = [
    'nebulaViolet', 'nebulaPurple', 'nebulaTeal', 'nebulaTealBright',
    'nebulaViolet', 'nebulaPurple',
  ];
  const nebula = [];
  for (let i = 0; i < 16; i++) {
    nebula.push({
      x: decorRandom.range(0, FIELD.width),
      y: decorRandom.range(0, FIELD.height),
      r: decorRandom.range(140, 380),
      colorKey: nebulaKeys[i % nebulaKeys.length],
      alpha: decorRandom.range(0.10, 0.26),
    });
  }
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: decorRandom.range(0, FIELD.width),
      y: decorRandom.range(0, FIELD.height),
      r: decorRandom.range(0.6, 1.9),
      layer: i % 3 === 0 ? 1 : (i % 3 === 1 ? 0.55 : 0.25),
      tw: decorRandom.range(0, Math.PI * 2),
    });
  }

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.bgDeep);
    grad.addColorStop(1, PALETTE.bgMid);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawNebula() {
    for (const blob of nebula) {
      const color = PALETTE[blob.colorKey];
      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = blob.alpha;
      ctx.fillStyle = grad;
      ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
      ctx.restore();
    }
  }

  function drawStarfield(state) {
    const px = state.player ? state.player.x : FIELD.width / 2;
    const py = state.player ? state.player.y : FIELD.height / 2;
    for (const s of stars) {
      const ox = (px - 640) * -0.012 * s.layer;
      const oy = (py - 400) * -0.012 * s.layer;
      const twinkle = 0.55 + 0.45 * Math.sin(state.time * 1.7 + s.tw);
      ctx.save();
      ctx.globalAlpha = clamp(twinkle, 0.1, 1);
      ctx.fillStyle = PALETTE.hudText;
      ctx.beginPath();
      ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFeverGlow(state) {
    if (!state.fever) return;
    const r = 340;
    const grad = ctx.createRadialGradient(state.star.x, state.star.y, 0, state.star.x, state.star.y, r);
    grad.addColorStop(0, PALETTE.feverGlow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.20 + 0.06 * Math.sin(state.time * 6);
    ctx.fillStyle = grad;
    ctx.fillRect(state.star.x - r, state.star.y - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawVignette(state) {
    const r = Math.max(FIELD.width, FIELD.height) * 0.72;
    const grad = ctx.createRadialGradient(640, 400, r * 0.35, 640, 400, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    let alpha = 0.28 + state.collapse * 0.5;
    let edge = '0,0,0';
    if (state.collapse > 0.72 || state.surge) {
      alpha += 0.10 + 0.08 * Math.sin(state.time * 5.2);
      edge = '120,10,10';
    }
    grad.addColorStop(1, 'rgba(' + edge + ',' + clamp(alpha, 0, 0.9).toFixed(3) + ')');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    if (state.fever) {
      const grad2 = ctx.createRadialGradient(640, 400, r * 0.4, 640, 400, r);
      grad2.addColorStop(0, 'rgba(0,0,0,0)');
      grad2.addColorStop(1, 'rgba(80,50,0,0.35)');
      ctx.save();
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.restore();
    }
  }

  function drawGravityArcs(state) {
    ctx.save();
    ctx.strokeStyle = PALETTE.hudMuted;
    ctx.globalAlpha = 0.10;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 14]);
    ctx.lineDashOffset = -state.time * 12;
    for (const r of [120, 200, 290]) {
      ctx.beginPath();
      ctx.arc(state.star.x, state.star.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStar(state) {
    const sx = state.star.x;
    const sy = state.star.y;
    const radius = state.star.radius * (1 + 0.04 * Math.sin(state.time * 2.4 + (state.star.pulse || 0)));
    // Outer glow.
    const glowR = radius * 5.2;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
    glow.addColorStop(0, PALETTE.starGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    ctx.restore();
    // Corona layers.
    const flickA = 0.28 + 0.08 * Math.sin(state.time * 7.3);
    const flickB = 0.38 + 0.08 * Math.sin(state.time * 11.7);
    const layers = [
      { scale: 1.55, color: PALETTE.starGlow, alpha: flickA },
      { scale: 1.3, color: PALETTE.starCorona, alpha: flickB },
      { scale: 1.12, color: PALETTE.starInner, alpha: 0.55 },
    ];
    for (const layer of layers) {
      ctx.save();
      ctx.globalAlpha = clamp(layer.alpha, 0.05, 0.8);
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.arc(sx, sy, radius * layer.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Core.
    const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    core.addColorStop(0, PALETTE.starCore);
    core.addColorStop(0.55, PALETTE.starInner);
    core.addColorStop(1, PALETTE.starCorona);
    ctx.save();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Expanding warning rings.
    for (const ring of state.rings) {
      ctx.save();
      ctx.globalAlpha = clamp(ring.alpha, 0, 1);
      ctx.strokeStyle = PALETTE.ringWarn;
      ctx.lineWidth = ring.width || 2;
      ctx.beginPath();
      ctx.arc(sx, sy, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShards(state) {
    for (const shard of state.shards) {
      const pulse = 1 + 0.16 * Math.sin(state.time * 4 + shard.seed * 20);
      let alpha = 1;
      if (shard.age > SHARD.lifetime - 3) {
        alpha = 0.35 + 0.3 * Math.sin(state.time * 16);
      }
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0.05, 1);
      ctx.fillStyle = PALETTE.shardGlow;
      ctx.globalAlpha = clamp(alpha * 0.35, 0.02, 0.4);
      ctx.beginPath();
      ctx.arc(shard.x, shard.y, 20 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = clamp(alpha, 0.05, 1);
      const half = 11 * pulse;
      const rot = state.time * 1.5 + shard.seed * 6;
      ctx.translate(shard.x, shard.y);
      ctx.rotate(rot);
      ctx.fillStyle = shard.seed > 0.55 ? PALETTE.shardGold : PALETTE.shard;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half * 0.7, 0);
      ctx.lineTo(0, half);
      ctx.lineTo(-half * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(4.5 * 0.7, 0);
      ctx.lineTo(0, 4.5);
      ctx.lineTo(-4.5 * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDebris(state) {
    for (const rock of state.debris) {
      ctx.save();
      ctx.translate(rock.x, rock.y);
      ctx.rotate(rock.angle);
      ctx.fillStyle = PALETTE.debrisBody;
      ctx.beginPath();
      ctx.arc(0, 0, rock.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.debrisEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = PALETTE.debrisCrack;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const a = ((rock.radius * (i + 2)) % 6.28) + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * rock.radius * 0.85, Math.sin(a) * rock.radius * 0.85);
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.ember;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(rock.radius * 0.3, -rock.radius * 0.2, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      const ratio = p.maxLife > 0 ? clamp(p.life / p.maxLife, 0, 1) : 0;
      ctx.save();
      ctx.globalAlpha = ratio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * ratio), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (!player || player.dead) return;
    let alpha = 1;
    if (player.invulnerable > 0 && Math.floor(state.time * 14) % 2 === 0) alpha = 0.35;
    const speed = Math.hypot(player.vx, player.vy);
    ctx.save();
    ctx.globalAlpha = alpha;
    // Dash streaks.
    if (player.dashTimer > 0 && speed > 1) {
      const ux = player.vx / speed;
      const uy = player.vy / speed;
      ctx.strokeStyle = PALETTE.trail;
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = alpha * (0.5 - i * 0.12);
        ctx.beginPath();
        ctx.moveTo(player.x - ux * i * 12, player.y - uy * i * 12 + (i % 2 === 0 ? 3 : -3));
        ctx.lineTo(player.x - ux * (i * 12 + 14), player.y - uy * (i * 12 + 14) + (i % 2 === 0 ? 3 : -3));
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    }
    // Flame behind the ember, opposite its motion.
    if (speed > 12) {
      const ux = player.vx / speed;
      const uy = player.vy / speed;
      const flameLen = 16 + speed * 0.02;
      ctx.fillStyle = PALETTE.ember;
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.moveTo(player.x - ux * player.radius - uy * 6, player.y - uy * player.radius + ux * 6);
      ctx.lineTo(player.x - ux * (player.radius + flameLen), player.y - uy * (player.radius + flameLen));
      ctx.lineTo(player.x - ux * player.radius + uy * 6, player.y - uy * player.radius - ux * 6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    const body = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.radius);
    body.addColorStop(0, PALETTE.emberCore);
    body.addColorStop(0.5, PALETTE.emberBright);
    body.addColorStop(1, PALETTE.ember);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function gravityAccel(x, y, star) {
    const dx = star.x - x;
    const dy = star.y - y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const accel = Math.min(STAR.maxGravityAccel, STAR.gravity / (dist + STAR.gravitySoftening));
    return { x: (dx / dist) * accel, y: (dy / dist) * accel };
  }

  function drawAim(state, aim) {
    const player = state.player;
    if (!player || player.dead) return;
    const len = Math.hypot(aim.dx, aim.dy);
    if (len < 1) return;
    ctx.save();
    ctx.strokeStyle = PALETTE.feverGold;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + aim.dx, player.y + aim.dy);
    ctx.stroke();
    ctx.setLineDash([]);
    // Gravity-bent preview dots.
    let px = player.x;
    let py = player.y;
    let vx = aim.dx * 4.5;
    let vy = aim.dy * 4.5;
    const dt = 0.05;
    ctx.fillStyle = PALETTE.feverGold;
    for (let i = 0; i < 14; i++) {
      const g = gravityAccel(px, py, state.star);
      vx += g.x * dt;
      vy += g.y * dt;
      px += vx * dt;
      py += vy * dt;
      if (i % 3 === 0) {
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawFloaters(state) {
    for (const f of state.floaters) {
      const alpha = clamp(f.life / 0.9, 0, 1);
      const rise = (0.9 - f.life) * 34;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillStyle = f.color || PALETTE.hudText;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y - rise);
      ctx.restore();
    }
  }

  function drawBar(x, y, w, h, ratio, fillColor) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
    ctx.strokeStyle = 'rgba(244,234,216,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawHud(state, best) {
    // Top-left score cluster.
    panel(ctx, 16, 14, 168, 76);
    text(ctx, 'SCORE', 28, 36, '600 11px system-ui, sans-serif', PALETTE.hudMuted);
    text(ctx, String(state.score).padStart(6, '0'), 28, 68, '800 30px system-ui, sans-serif', PALETTE.hudText);
    text(ctx, 'BEST ' + String(Math.max(best, state.score)).padStart(6, '0'), 28, 84, '600 14px system-ui, sans-serif', PALETTE.hudMuted);
    // Top-centre combo / fever.
    if (state.fever) {
      const pulse = 1 + 0.06 * Math.sin(state.time * 8);
      ctx.save();
      ctx.translate(640, 0);
      ctx.scale(pulse, pulse);
      text(ctx, 'FEVER!', 0, 42, '900 26px system-ui, sans-serif', PALETTE.feverGold, 'center');
      ctx.restore();
      drawBar(565, 52, 150, 8, state.feverTimer / COMBO.feverSeconds, PALETTE.feverGold);
    } else if (state.combo >= 2) {
      text(ctx, 'COMBO x' + state.combo, 640, 40, '800 22px system-ui, sans-serif', PALETTE.emberBright, 'center');
      drawBar(565, 50, 150, 7, state.comboTimer / COMBO.windowSeconds, PALETTE.emberBright);
    }
    // Top-right shards.
    panel(ctx, 1024, 14, 240, 52);
    ctx.save();
    ctx.translate(1046, 40);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.shard;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    text(ctx, state.shardsCollected + ' / ' + SHARDS_TO_WIN + ' SHARDS', 1252, 47, '700 18px system-ui, sans-serif', PALETTE.hudText, 'right');
    // Bottom-left hull.
    panel(ctx, 16, 724, 210, 58);
    text(ctx, 'HULL', 28, 744, '600 11px system-ui, sans-serif', PALETTE.hudMuted);
    const hullColor = state.integrity < 30 ? PALETTE.hudDanger : PALETTE.emberBright;
    drawBar(28, 752, 170, 10, state.integrity / 100, hullColor);
    // Bottom-right star stability.
    panel(ctx, 1054, 724, 210, 58);
    text(ctx, 'STAR STABILITY', 1076, 744, '600 11px system-ui, sans-serif', PALETTE.hudMuted);
    if (state.surge && Math.floor(state.time * 4) % 2 === 0) {
      text(ctx, 'SURGE!', 1252, 716, '800 15px system-ui, sans-serif', PALETTE.hudDanger, 'right');
    }
    const stabColor = state.collapse > 0.75 ? PALETTE.hudDanger : PALETTE.starInner;
    drawBar(1076, 752, 170, 10, 1 - state.collapse, stabColor);
    // Bottom-centre hint.
    text(ctx, 'WASD / arrows: thrust - drag mouse: slingshot - SPACE: dash - P: pause', 640, 782, '500 12.5px system-ui, sans-serif', PALETTE.hudMuted, 'center');
  }

  function dimField(color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
  }

  function drawTitle(state, best) {
    dimField('rgba(5,3,13,0.42)');
    ctx.save();
    try { ctx.letterSpacing = '6px'; } catch (err) { /* older canvas */ }
    const grad = ctx.createLinearGradient(340, 0, 940, 0);
    grad.addColorStop(0, PALETTE.emberBright);
    grad.addColorStop(0.5, PALETTE.starCorona);
    grad.addColorStop(1, PALETTE.feverGold);
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = grad;
    ctx.fillText('EMBERFALL', 640, 250);
    ctx.restore();
    text(ctx, 'The last star is dying. Feed it light, or fall with it.', 640, 292, '400 19px system-ui, sans-serif', PALETTE.hudText, 'center');
    panel(ctx, 340, 330, 600, 150);
    const lines = [
      'Gather 24 light shards before the star collapses.',
      'Thrust with WASD or the arrow keys. Drag the mouse to slingshot.',
      'SPACE dashes. Chain shards to build combo - 8 in a row lights FEVER.',
      'Dodge the dark debris. Do not kiss the star.',
    ];
    lines.forEach((line, i) => {
      text(ctx, line, 640, 368 + i * 30, '400 16px system-ui, sans-serif', PALETTE.hudText, 'center');
    });
    const pulseAlpha = 0.55 + 0.45 * Math.sin(state.time * 3.2);
    ctx.save();
    ctx.globalAlpha = clamp(pulseAlpha, 0.1, 1);
    text(ctx, 'CLICK OR PRESS ENTER TO IGNITE', 640, 560, '800 20px system-ui, sans-serif', PALETTE.feverGold, 'center');
    ctx.restore();
    if (best > 0) {
      text(ctx, 'BEST SCORE ' + best, 640, 600, '600 15px system-ui, sans-serif', PALETTE.hudMuted, 'center');
    }
  }

  function drawPaused(state) {
    dimField('rgba(5,3,13,0.5)');
    text(ctx, 'PAUSED', 640, 390, '900 44px system-ui, sans-serif', PALETTE.hudText, 'center');
    text(ctx, 'P or ENTER to resume', 640, 428, '400 16px system-ui, sans-serif', PALETTE.hudMuted, 'center');
  }

  function drawEndPanel(state, best, won) {
    if (won) {
      dimField('rgba(40,26,0,0.45)');
      text(ctx, 'THE STAR REKINDLES', 640, 320, '900 46px system-ui, sans-serif', PALETTE.feverGold, 'center');
      text(ctx, 'SCORE ' + state.score, 640, 376, '700 22px system-ui, sans-serif', PALETTE.hudText, 'center');
      text(ctx, 'BEST COMBO x' + state.bestCombo, 640, 410, '400 18px system-ui, sans-serif', PALETTE.hudText, 'center');
      text(ctx, 'HULL ' + Math.ceil(state.integrity) + '%', 640, 442, '400 18px system-ui, sans-serif', PALETTE.hudText, 'center');
    } else {
      dimField('rgba(40,4,4,0.5)');
      const title = state.loseReason === 'collapse' ? 'THE STAR FELL DARK' : 'THE EMBER SCATTERS';
      text(ctx, title, 640, 320, '900 44px system-ui, sans-serif', '#ff7a5c', 'center');
      text(ctx, 'SCORE ' + state.score, 640, 376, '700 22px system-ui, sans-serif', PALETTE.hudText, 'center');
      text(ctx, 'BEST ' + Math.max(best, state.score), 640, 410, '400 18px system-ui, sans-serif', PALETTE.hudMuted, 'center');
    }
    const pulseAlpha = 0.55 + 0.45 * Math.sin(state.time * 3.2);
    ctx.save();
    ctx.globalAlpha = clamp(pulseAlpha, 0.1, 1);
    text(ctx, won ? 'Press ENTER to play again' : 'Press ENTER to try again', 640, 500, '800 18px system-ui, sans-serif', PALETTE.hudText, 'center');
    ctx.restore();
  }

  function draw(state, screen, best, aim) {
    ctx.save();
    const shakeAmount = (state.shake || 0) * 9;
    if (shakeAmount > 0.01) {
      const ox = Math.sin(state.time * 91) * shakeAmount;
      const oy = Math.cos(state.time * 113) * shakeAmount;
      ctx.translate(ox, oy);
    }
    drawBackground(state);
    drawNebula();
    drawStarfield(state);
    drawFeverGlow(state);
    drawGravityArcs(state);
    drawStar(state);
    drawShards(state);
    drawDebris(state);
    drawParticles(state);
    drawPlayer(state);
    if (aim && screen === SCREEN_PLAY) drawAim(state, aim);
    drawFloaters(state);
    ctx.restore();
    drawVignette(state);
    if (screen !== SCREEN_TITLE) drawHud(state, best || 0);
    if (screen === SCREEN_TITLE) drawTitle(state, best || 0);
    else if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_WON) drawEndPanel(state, best || 0, true);
    else if (screen === SCREEN_OVER) drawEndPanel(state, best || 0, false);
  }

  return { draw };
}
