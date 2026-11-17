// EMBERFALL - tuning constants
// All gameplay numbers live here so the simulation, renderer and
// HUD can share one source of truth.

export const FIELD = { width: 1280, height: 800 };

export const STEP = 1 / 60;

export const STAR = {
  x: 640,
  y: 400,
  coreRadius: 44,
  gravity: 95000,
  gravitySoftening: 90,
  maxGravityAccel: 1600,
  singeRadius: 74,
};

export const PLAYER = {
  radius: 11,
  thrustAccel: 560,
  maxSpeed: 660,
  spaceDrag: 0.10,
  dashSpeed: 1020,
  dashTime: 0.16,
  dashCooldown: 0.85,
  invulnerableTime: 1.2,
  wallBounce: 0.55,
};

export const SHARDS_TO_WIN = 24;
export const RUN_SECONDS = 150;

export const SHARD = {
  spawnInterval: 1.1,
  maxAlive: 7,
  lifetime: 14,
  collectRadius: 30,
  minOrbit: 185,
  maxOrbit: 520,
  scoreBase: 10,
};

export const DEBRIS = {
  spawnInterval: 2.6,
  minRadius: 14,
  maxRadius: 30,
  minSpeed: 60,
  maxSpeed: 145,
  hitDamage: 14,
  nearMissRadius: 52,
  nearMissScore: 5,
};

export const COMBO = {
  windowSeconds: 4.0,
  feverAt: 8,
  feverSeconds: 6,
  maxCombo: 24,
};

export const SURGE = {
  period: 21,
  duration: 5,
  gravityScale: 1.45,
  collapseScale: 1.8,
};

export const PALETTE = {
  bgDeep: '#05030d',
  bgMid: '#0b0620',
  nebulaViolet: '#3b1d6e',
  nebulaPurple: '#5a2a9e',
  nebulaTeal: '#0e4a5a',
  nebulaTealBright: '#177e8c',
  starCore: '#fff3c4',
  starInner: '#ffd76a',
  starCorona: '#ff9a3c',
  starGlow: '#ff6a1f',
  ember: '#ff7a2a',
  emberBright: '#ffb347',
  emberCore: '#ffe9b0',
  shard: '#54f0e0',
  shardGold: '#ffd76a',
  shardGlow: '#1fbfae',
  debrisBody: '#2a2733',
  debrisEdge: '#4a4458',
  debrisCrack: '#ff5a1f',
  hudText: '#f4ead8',
  hudMuted: '#9a8fb0',
  hudDanger: '#ff4d4d',
  feverGold: '#ffcf3f',
  feverGlow: '#ff9d00',
  ringWarn: '#ffcf3f',
  trail: '#ff8a3c',
};

export const BEST_KEY = 'emberfall-best';
