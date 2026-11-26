// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop.
// A chase view: the plane sits centre-frame, the valley scrolls past under it, the next ring
// or the runway waits ahead. The whole scene rolls with the bank, so the horizon tilts as
// the pilot turns. No images: sky, terrain, river, runway and aircraft are all drawn.

import { FIELD, FONT, MISSIONS, PALETTE, RING_RADIUS, RUNWAY } from './config.js';
import { riverX, terrainHeight } from './world.js';
import { noise1 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LANDED = 'landed';

const FOCAL = 760;
const HORIZON_BASE = 330;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, font) {
    const key = `${size}:${font || FONT}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${font || FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  /** Project a world point into screen space from the chase camera. Returns null behind. */
  function project(state, wx, wy, wz) {
    const plane = state.plane;
    const headingRad = (plane.heading * Math.PI) / 180;
    const fx = Math.sin(headingRad);
    const fz = Math.cos(headingRad);
    const dx = wx - plane.x;
    const dz = wz - plane.z;
    const forward = dx * fx + dz * fz;
    const lateral = dx * fz - dz * fx;
    if (forward < 12) return null;
    const up = wy - plane.alt;
    const horizonY = HORIZON_BASE - plane.pitch * 7;
    const scale = FOCAL / forward;
    return {
      x: FIELD.width / 2 + lateral * scale,
      y: horizonY - up * scale,
      scale,
      forward,
    };
  }

  function drawSky(state) {
    const dusk = state.mission.dusk;
    const top = dusk ? PALETTE.skyDusk[0] : PALETTE.skyDay[0];
    const mid = dusk ? PALETTE.skyDusk[1] : PALETTE.skyDay[1];
    const low = dusk ? PALETTE.skyDusk[2] : PALETTE.skyDay[2];
    const horizonY = HORIZON_BASE - state.plane.pitch * 7;
    const gradient = context.createLinearGradient(0, 0, 0, horizonY + 40);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.62, mid);
    gradient.addColorStop(1, low);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, horizonY + 40);
    // Sun (low and amber at dusk, high and pale by day).
    const sunX = FIELD.width / 2 + Math.sin((state.plane.heading * Math.PI) / 180) * 900;
    const sunY = dusk ? horizonY - 60 : 110;
    const glow = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, dusk ? 'rgba(255,190,90,0.95)' : 'rgba(255,250,220,0.95)');
    glow.addColorStop(0.25, dusk ? 'rgba(255,150,80,0.45)' : 'rgba(255,244,200,0.4)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 140, sunY - 140, 280, 280);
    // Clouds: soft ellipses drifting with the heading.
    context.fillStyle = dusk ? 'rgba(214,120,140,0.5)' : 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 9; i += 1) {
      const drift = ((i * 977 + state.plane.heading * 14) % 1500) - 110;
      const cy = 60 + (i % 4) * 42 + noise1(i * 3.3, 5) * 30;
      const cw = 120 + noise1(i * 7.7, 9) * 130;
      context.beginPath();
      context.ellipse(drift, cy, cw, 13 + (i % 3) * 5, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawRidges(state) {
    const horizonY = HORIZON_BASE - state.plane.pitch * 7;
    const layers = [
      { amp: 74, base: 0, color: state.mission.dusk ? '#4a3a6e' : '#8fa8c8', seed: 41 },
      { amp: 46, base: 26, color: state.mission.dusk ? '#3a2d58' : '#6f87a8', seed: 77 },
    ];
    for (const layer of layers) {
      context.fillStyle = layer.color;
      context.beginPath();
      context.moveTo(0, horizonY + 2);
      for (let x = 0; x <= FIELD.width; x += 16) {
        const worldAngle = state.plane.heading + (x - FIELD.width / 2) / 9;
        const h = layer.amp * noise1(worldAngle * 0.045, layer.seed)
          + layer.amp * 0.4 * noise1(worldAngle * 0.13, layer.seed + 3);
        context.lineTo(x, horizonY + 2 - h - layer.base);
      }
      context.lineTo(FIELD.width, horizonY + 2);
      context.closePath();
      context.fill();
    }
  }

  function drawGround(state) {
    const plane = state.plane;
    const horizonY = HORIZON_BASE - plane.pitch * 7;
    const dusk = state.mission.dusk;
    // Ground base: green valley darkening toward the horizon.
    const base = context.createLinearGradient(0, horizonY, 0, FIELD.height);
    base.addColorStop(0, dusk ? '#3d4a2e' : '#7fae62');
    base.addColorStop(1, dusk ? '#232b1a' : '#4e7d3a');
    context.fillStyle = base;
    context.fillRect(0, horizonY, FIELD.width, FIELD.height - horizonY);
    // Field patchwork: projected quads, colours from a hash of their grid cell.
    const rows = 14;
    const cols = 14;
    const cell = 260;
    const startRow = Math.floor((plane.z - 40) / cell);
    for (let r = 0; r < rows; r += 1) {
      const z0 = (startRow + r) * cell;
      const z1 = z0 + cell;
      for (let c = -cols / 2; c < cols / 2; c += 1) {
        const x0 = Math.floor(plane.x / cell + c) * cell;
        const x1 = x0 + cell;
        const p00 = project(state, x0, terrainHeight(x0, z0), z0);
        const p10 = project(state, x1, terrainHeight(x1, z0), z0);
        const p11 = project(state, x1, terrainHeight(x1, z1), z1);
        const p01 = project(state, x0, terrainHeight(x0, z1), z1);
        if (!p00 || !p10 || !p11 || !p01) continue;
        const hash = noise1((startRow + r) * 31 + (c + cols) * 7.3, 17);
        const shades = dusk
          ? ['#4a5c33', '#55663a', '#3f522c', '#5d6b3d']
          : ['#86b364', '#7aa858', '#93bd6d', '#6d9c4e', '#a8b96a'];
        context.fillStyle = shades[Math.floor(hash * shades.length)];
        context.beginPath();
        context.moveTo(p00.x, p00.y);
        context.lineTo(p10.x, p10.y);
        context.lineTo(p11.x, p11.y);
        context.lineTo(p01.x, p01.y);
        context.closePath();
        context.fill();
      }
    }
    // The river: a blue ribbon winding down the valley.
    context.strokeStyle = dusk ? '#3a5f8a' : '#4a90d9';
    context.lineCap = 'round';
    for (let z = plane.z + 60; z < plane.z + 4200; z += 160) {
      const a = project(state, riverX(z), terrainHeight(riverX(z), z) + 2, z);
      const b = project(state, riverX(z + 160), terrainHeight(riverX(z + 160), z + 160) + 2, z + 160);
      if (!a || !b) continue;
      context.lineWidth = Math.max(1.5, 26 * a.scale);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // The road to the airstrip, pale and straight.
    context.strokeStyle = dusk ? '#8a7a5a' : '#c9b896';
    for (let z = plane.z + 60; z < RUNWAY.z + 200; z += 220) {
      const a = project(state, RUNWAY.x - 260, terrainHeight(RUNWAY.x - 260, z) + 2, z);
      const b = project(state, RUNWAY.x - 260, terrainHeight(RUNWAY.x - 260, z + 220) + 2, z + 220);
      if (!a || !b) continue;
      context.lineWidth = Math.max(1, 9 * a.scale);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  function drawRunway(state) {
    const z0 = RUNWAY.z - RUNWAY.length / 2;
    const z1 = RUNWAY.z + RUNWAY.length / 2;
    const corners = [
      project(state, RUNWAY.x - RUNWAY.width / 2, RUNWAY.elevation + 1, z0),
      project(state, RUNWAY.x + RUNWAY.width / 2, RUNWAY.elevation + 1, z0),
      project(state, RUNWAY.x + RUNWAY.width / 2, RUNWAY.elevation + 1, z1),
      project(state, RUNWAY.x - RUNWAY.width / 2, RUNWAY.elevation + 1, z1),
    ];
    if (corners.some((p) => p === null)) return;
    context.fillStyle = '#3c4148';
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (const p of corners.slice(1)) context.lineTo(p.x, p.y);
    context.closePath();
    context.fill();
    context.strokeStyle = '#e8e8e8';
    context.lineWidth = 2;
    context.stroke();
    // Centreline dashes and the big 27 threshold numbers.
    const mid = project(state, RUNWAY.x, RUNWAY.elevation + 1.5, (z0 + z1) / 2);
    if (mid && mid.forward < 2600) {
      context.strokeStyle = '#f5f5f5';
      context.lineWidth = Math.max(1.5, 5 * mid.scale);
      context.beginPath();
      const a = project(state, RUNWAY.x, RUNWAY.elevation + 1.5, z0 + 60);
      const b = project(state, RUNWAY.x, RUNWAY.elevation + 1.5, z1 - 60);
      if (a && b) {
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      }
      context.stroke();
      text('27', mid.x, mid.y, Math.max(12, 34 * mid.scale), '#ffffff', 'center');
    }
    // Edge lights: amber dots down both sides, brighter at dusk.
    const dusk = state.mission.dusk;
    for (let z = z0 + 40; z <= z1 - 20; z += 110) {
      for (const side of [-1, 1]) {
        const p = project(state, RUNWAY.x + side * RUNWAY.width / 2, RUNWAY.elevation + 2, z);
        if (!p) continue;
        context.fillStyle = dusk ? '#ffb454' : '#ffd27a';
        context.beginPath();
        context.arc(p.x, p.y, Math.max(1.6, 4 * p.scale), 0, Math.PI * 2);
        context.fill();
      }
    }
    // Hangars and a windsock beside the strip.
    const hangar = project(state, RUNWAY.x + 120, RUNWAY.elevation + 8, RUNWAY.z - 120);
    if (hangar && hangar.forward < 3000) {
      const s = hangar.scale;
      context.fillStyle = '#5a6a7a';
      context.fillRect(hangar.x - 26 * s, hangar.y - 16 * s, 52 * s, 16 * s);
      context.fillStyle = '#7a8a9a';
      context.beginPath();
      context.moveTo(hangar.x - 26 * s, hangar.y - 16 * s);
      context.lineTo(hangar.x, hangar.y - 30 * s);
      context.lineTo(hangar.x + 26 * s, hangar.y - 16 * s);
      context.closePath();
      context.fill();
    }
  }

  function drawRings(state) {
    for (const ring of state.rings) {
      if (ring.hit) continue;
      const centre = project(state, ring.x, ring.alt, ring.z);
      if (!centre) continue;
      const rr = RING_RADIUS * centre.scale;
      const isNext = state.rings.find((g) => !g.hit) === ring;
      context.save();
      context.globalAlpha = clamp(1.2 - centre.forward / 5200, 0.25, 1);
      // A faint beam from the ring down to the ground, so a far ring still reads as a gate.
      const groundPoint = project(state, ring.x, terrainHeight(ring.x, ring.z) + 2, ring.z);
      if (groundPoint) {
        context.strokeStyle = isNext ? 'rgba(255,180,84,0.5)' : 'rgba(103,232,249,0.4)';
        context.lineWidth = Math.max(1, rr * 0.05);
        context.beginPath();
        context.moveTo(centre.x, centre.y + rr);
        context.lineTo(groundPoint.x, groundPoint.y);
        context.stroke();
      }
      context.lineWidth = Math.max(3, rr * 0.2);
      context.strokeStyle = isNext ? '#ffb454' : '#67e8f9';
      context.shadowColor = isNext ? '#ff9a2e' : '#22d3ee';
      context.shadowBlur = isNext ? 18 : 8;
      context.beginPath();
      context.arc(centre.x, centre.y, rr, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = isNext ? '#ffb454' : '#a5f3fc';
      context.beginPath();
      context.arc(centre.x, centre.y, Math.max(2, rr * 0.1), 0, Math.PI * 2);
      context.fill();
      if (centre.forward < 2400) {
        text(`RING ${ring.index + 1}`, centre.x, centre.y - rr - 12, Math.max(13, 15 + rr * 0.12), '#ffffff', 'center');
        text(`${Math.round(centre.forward)} m`, centre.x, centre.y + rr + 20, Math.max(12, 13 + rr * 0.1), '#e8f4fb', 'center');
      }
      context.restore();
    }
  }

  function drawNextTargetArrow(state, target) {
    if (!target) return;
    const projected = project(state, target.x, target.alt, target.z);
    if (projected && projected.x > 60 && projected.x < FIELD.width - 60
      && projected.y > 60 && projected.y < FIELD.height - 200) return;
    // Off-screen: a chevron at the screen edge pointing the way.
    const plane = state.plane;
    const dx = target.x - plane.x;
    const dz = target.z - plane.z;
    const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
    let rel = bearing - plane.heading;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    const edgeX = clamp(FIELD.width / 2 + rel * 9, 70, FIELD.width - 70);
    context.fillStyle = '#ffb454';
    context.beginPath();
    context.moveTo(edgeX, 96);
    context.lineTo(edgeX - 14, 76);
    context.lineTo(edgeX + 14, 76);
    context.closePath();
    context.fill();
    text(target.label, edgeX, 66, 15, '#ffb454', 'center');
  }

  function drawAircraft(state, timeMs) {
    const plane = state.plane;
    const cx = FIELD.width / 2;
    const cy = 418;
    context.save();
    context.translate(cx, cy);
    context.rotate((-plane.bank * Math.PI) / 180);
    const bob = Math.sin(timeMs / 420) * 2;
    context.translate(0, bob);
    // Soft shadow under the plane on the panel edge.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 96, 150, 10, 0, 0, Math.PI * 2);
    context.fill();
    // Wings: broad, slightly swept, sunlit on top.
    context.fillStyle = '#d7dee8';
    context.beginPath();
    context.moveTo(-14, 8);
    context.lineTo(-168, 26);
    context.lineTo(-168, 40);
    context.lineTo(-10, 26);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(14, 8);
    context.lineTo(168, 26);
    context.lineTo(168, 40);
    context.lineTo(10, 26);
    context.closePath();
    context.fill();
    context.fillStyle = '#b7c2cf';
    context.fillRect(-168, 26, 336, 5);
    // Engines under the wings.
    for (const side of [-1, 1]) {
      context.fillStyle = '#9aa7b5';
      context.beginPath();
      context.ellipse(side * 82, 34, 20, 11, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b3440';
      context.beginPath();
      context.ellipse(side * 82, 34, 8, 6, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Fuselage: tapered rear view, tail cone toward the viewer.
    const fuselage = context.createLinearGradient(-26, -70, 26, 60);
    fuselage.addColorStop(0, '#f2f5f8');
    fuselage.addColorStop(0.55, '#c3cedb');
    fuselage.addColorStop(1, '#8b98a8');
    context.fillStyle = fuselage;
    context.beginPath();
    context.moveTo(-24, -64);
    context.quadraticCurveTo(-34, 10, -20, 62);
    context.quadraticCurveTo(0, 74, 20, 62);
    context.quadraticCurveTo(34, 10, 24, -64);
    context.quadraticCurveTo(0, -78, -24, -64);
    context.closePath();
    context.fill();
    // Tail fin and stabiliser.
    context.fillStyle = '#e2574c';
    context.beginPath();
    context.moveTo(-6, -66);
    context.lineTo(0, -108);
    context.lineTo(10, -66);
    context.closePath();
    context.fill();
    context.fillStyle = '#c3cedb';
    context.fillRect(-64, -58, 128, 9);
    // Courier stripe and tail number.
    context.fillStyle = '#e2574c';
    context.fillRect(-24, -8, 48, 10);
    text('M-27', 0, -84, 13, '#eef1f5', 'center');
    // Navigation lights: red port, green starboard, white strobe blinking.
    context.fillStyle = '#ff3b30';
    context.beginPath();
    context.arc(-168, 32, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#34d399';
    context.beginPath();
    context.arc(168, 32, 5, 0, Math.PI * 2);
    context.fill();
    if (Math.floor(timeMs / 500) % 2 === 0) {
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(0, -106, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  /** Paint the flying scene (sky, terrain, rings, runway, aircraft) without any HUD. */
  function drawScene(state, timeMs) {
    context.save();
    // Roll the world with the bank around the screen centre.
    context.translate(FIELD.width / 2, FIELD.height / 2);
    context.rotate((-state.plane.bank * Math.PI) / 180 * 0.55);
    context.translate(-FIELD.width / 2, -FIELD.height / 2);
    drawSky(state);
    drawRidges(state);
    drawGround(state);
    drawRunway(state);
    drawRings(state);
    context.restore();
    drawAircraft(state, timeMs);
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawScene, drawNextTargetArrow, text, project };
}
