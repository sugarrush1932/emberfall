// EMBERFALL - keyboard + mouse input.
// Keyboard: WASD and arrow keys thrust. Mouse: click / drag on the
// field builds a slingshot pull; releasing fires a launch.
// Edge-triggered actions are read (and cleared) via takeActions().

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Enter', 'ShiftLeft', 'ShiftRight',
  'KeyP', 'Escape',
]);

export function createInput(canvas, toField) {
  const held = new Set();
  let pendingActions = 0;
  let pendingLaunch = null;

  const pointer = {
    x: 0,
    y: 0,
    down: false,
    downX: 0,
    downY: 0,
  };

  function convert(event) {
    if (typeof toField === 'function') {
      const p = toField(event.clientX, event.clientY);
      return { x: p.x, y: p.y };
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function onKeyDown(event) {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') {
      pendingActions |= ACTION_CONFIRM;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      pendingActions |= ACTION_PAUSE;
    }
    if (
      event.code === 'Space' ||
      event.code === 'ShiftLeft' ||
      event.code === 'ShiftRight'
    ) {
      pendingActions |= ACTION_DASH;
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
    pointer.down = false;
  }

  function onPointerDown(event) {
    const p = convert(event);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.down = true;
    pointer.downX = p.x;
    pointer.downY = p.y;
    pendingActions |= ACTION_CONFIRM;
    if (canvas.setPointerCapture && event.pointerId !== undefined) {
      try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function onPointerMove(event) {
    const p = convert(event);
    pointer.x = p.x;
    pointer.y = p.y;
  }

  function onPointerUp(event) {
    const p = convert(event);
    pointer.x = p.x;
    pointer.y = p.y;
    if (pointer.down) {
      const dx = pointer.downX - pointer.x;
      const dy = pointer.downY - pointer.y;
      const len = Math.hypot(dx, dy);
      if (len >= 24) {
        // Map drag length to a launch speed, capped at 900.
        const speed = Math.min(900, len * 4.5);
        const scale = len > 0 ? speed / len : 0;
        pendingLaunch = { x: dx * scale, y: dy * scale };
      }
    }
    pointer.down = false;
  }

  function onPointerCancel() {
    pointer.down = false;
  }

  const keyTarget = typeof window !== 'undefined' ? window : canvas;
  keyTarget.addEventListener('keydown', onKeyDown);
  keyTarget.addEventListener('keyup', onKeyUp);
  keyTarget.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  function axisX() {
    let v = 0;
    if (held.has('KeyA') || held.has('ArrowLeft')) v -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) v += 1;
    return v;
  }

  function axisY() {
    let v = 0;
    if (held.has('KeyW') || held.has('ArrowUp')) v -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) v += 1;
    return v;
  }

  function takeActions() {
    const bits = pendingActions;
    pendingActions = 0;
    return bits;
  }

  function dragVector() {
    if (!pointer.down) return { x: 0, y: 0 };
    return { x: pointer.downX - pointer.x, y: pointer.downY - pointer.y };
  }

  function takeLaunch() {
    const launch = pendingLaunch;
    pendingLaunch = null;
    return launch;
  }

  function destroy() {
    keyTarget.removeEventListener('keydown', onKeyDown);
    keyTarget.removeEventListener('keyup', onKeyUp);
    keyTarget.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
  }

  return {
    pointer,
    axisX,
    axisY,
    takeActions,
    dragVector,
    takeLaunch,
    destroy,
  };
}
