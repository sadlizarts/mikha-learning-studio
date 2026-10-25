// Hero runtime renderer (v1.9.0): PixiJS v8 puppet built from layered textures on the 1024x1536 rig.
// It only draws what it is given (placeholder SVG or approved PNG URLs); it never talks to an AI service.
import { W, H, layerSVGs, ANCHORS } from './art.js';
import { AURAS } from './items.js';

let PIXI = null;
const loadPixi = async () => (PIXI ||= await import('../../vendor/pixi.min.mjs'));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ORDER = ['back', 'hairBack', 'body', 'outfit', 'armor', 'hairFront', 'accessory', 'weapon'];
/** smooth loop through a list of 0xRRGGBB colours; t in "steps" */
function cycleColor(list, t) {
  const n = list.length, i = Math.floor(t) % n, f = t - Math.floor(t), a = list[i], b = list[(i + 1) % n];
  const mix = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
const ease = { out: t => 1 - Math.pow(1 - t, 3), inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 };

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
/** SVG markup or PNG url -> canvas at `scale` of the rig; alpha 250-254 snapped to 255 (AI PNG edges). */
async function rasterize(src, scale) {
  const cw = Math.round(W * scale), ch = Math.round(H * scale);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  if (!src || src === 'none') return cv;
  const isSvg = /^\s*</.test(src);
  const url = isSvg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${cw}" height="${ch}">${src}</svg>`) : src;
  const img = await loadImage(url);
  const g = cv.getContext('2d', { willReadFrequently: !isSvg });
  g.drawImage(img, 0, 0, cw, ch);
  if (!isSvg) {
    const d = g.getImageData(0, 0, cw, ch), a = d.data;
    for (let i = 3; i < a.length; i += 4) if (a[i] >= 250) a[i] = 255;
    g.putImageData(d, 0, 0);
  }
  return cv;
}

export class HeroStage {
  constructor(el) { this.el = el; this.layers = {}; this.anim = []; this.t = 0; this.dead = false; this.look = null; }

  async init() {
    await loadPixi();
    const app = this.app = new PIXI.Application();
    await app.init({ backgroundAlpha: 0, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, resizeTo: this.el });
    if (this.dead) { app.destroy(true); return; }
    this.el.appendChild(app.canvas);
    app.canvas.setAttribute('aria-hidden', 'true');
    this.root = new PIXI.Container(); app.stage.addChild(this.root);
    this.dim0 = new PIXI.Graphics(); this.root.addChild(this.dim0);
    this.floor = new PIXI.Graphics(); this.root.addChild(this.floor);
    this.dim = new PIXI.Graphics(); this.root.addChild(this.dim);
    this.auraG = new PIXI.Graphics(); this.root.addChild(this.auraG);
    this.hero = new PIXI.Container(); this.root.addChild(this.hero);
    this.torso = new PIXI.Container(); this.hero.addChild(this.torso);
    for (const k of ORDER) { const s = new PIXI.Sprite(PIXI.Texture.EMPTY); s.anchor.set(0.5); s.position.set(W / 2, H / 2); this.layers[k] = s; (k === 'weapon' ? this.hero : this.torso).addChild(s); }
    this.hero.removeChild(this.layers.weapon); this.hero.addChild(this.layers.weapon);
    this.parts = new PIXI.Container(); this.root.addChild(this.parts);
    this.fx = new PIXI.Graphics(); app.stage.addChild(this.fx);
    this.motes = [];
    this.layout();
    app.renderer.on('resize', () => this.layout());
    app.ticker.add((tk) => this.tick(tk.deltaMS / 1000));
    this.onVis = () => { if (document.hidden) app.ticker.stop(); else app.ticker.start(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  layout() {
    const w = this.app.screen.width, h = this.app.screen.height;   // CSS pixels (renderer.width already excludes resolution in v8)
    this.vw = w; this.vh = h;
    const s = Math.min((h * 0.74) / 1350, (w * 0.9) / 760);
    this.scale = s;
    this.hero.pivot.set(512, 1440); this.hero.position.set(w / 2, h * 0.88); this.hero.scale.set(s);
    this.auraG.position.set(w / 2, h * 0.88 - (1440 - ANCHORS.aura[1]) * s);
    this.floor.clear();
    this.floor.ellipse(w / 2, h * 0.88, 230 * s * 1.6, 46 * s * 1.6).fill({ color: 0x8B5CF6, alpha: 0.18 }).stroke({ width: 2, color: 0xC9B6FF, alpha: 0.55 });
    this.floor.ellipse(w / 2, h * 0.88, 150 * s * 1.6, 28 * s * 1.6).stroke({ width: 1.5, color: 0xFFD233, alpha: 0.45 });
  }

  /** look = { stage, equipped, assets: { [layerName]: url } } ; layers without an approved asset use the placeholder SVG */
  async setLook(look, { animate = null } = {}) {
    const prev = this.look; this.look = look;
    const svg = layerSVGs(look);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = Math.min(1, Math.max(0.35, this.scale * dpr * 1.15));
    const pick = (l, s2, k) => l.assets?.[k] ?? s2[k];
    const psvg = prev ? layerSVGs(prev) : null;
    const changed = ORDER.filter(k => !prev || pick(look, svg, k) !== pick(prev, psvg, k) || JSON.stringify(look.anchors?.[k] || null) !== JSON.stringify(prev.anchors?.[k] || null));
    const tex = {};
    await Promise.all(changed.map(async k => {
      const src = pick(look, svg, k);
      try { tex[k] = PIXI.Texture.from(await rasterize(src, scale)); }
      catch { tex[k] = PIXI.Texture.from(await rasterize(svg[k], scale)); }
    }));
    if (this.dead) return;
    const apply = () => {
      for (const k of changed) {
        const sp = this.layers[k], a = look.anchors?.[k] || { x: 0, y: 0, scale: 1 };
        sp.texture = tex[k]; sp.scale.set((1 / scale) * (a.scale || 1)); sp.position.set(W / 2 + (a.x || 0), H / 2 + (a.y || 0));
      }
      this.auraColor = AURAS[look.equipped?.aura]?.color ?? null;
      this.auraCycle = AURAS[look.equipped?.aura]?.cycle || null;   // v3.4 legendary auras shift colour
    };
    if (animate === 'equip' && !reduced()) {
      const ks = changed.filter(k => ['weapon', 'armor', 'accessory'].includes(k));
      await this.tween(0.25, t => ks.forEach(k => { this.layers[k].alpha = 1 - t; }));
      apply();
      this.burst(0xFFFFFF, 18, 0.6);
      await this.tween(0.4, t => ks.forEach(k => { const sp = this.layers[k]; sp.alpha = t; }), ease.out);
    } else apply();
  }

  /* ---------- animation helpers ---------- */
  tween(dur, fn, e = ease.inOut) {
    return new Promise(res => { this.anim.push({ t: 0, dur: reduced() ? Math.min(dur, 0.2) : dur, fn, e, res }); });
  }
  burst(color, n = 36, life = 1) {
    if (reduced()) return;
    const cx = this.vw / 2, cy = this.vh * 0.88 - 700 * this.scale;
    for (let i = 0; i < n; i++) {
      const g = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 4).fill({ color, alpha: 1 });
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
      g.position.set(cx, cy); this.parts.addChild(g);
      this.motes.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life, age: 0, grav: 260 });
    }
  }

  async celebrate(color = 0xFFD233) {
    if (!this.app) return;
    this.burst(color, 44, 1.1);
    const y0 = this.hero.position.y;
    await this.tween(1.2, t => {
      const jump = Math.sin(Math.min(1, t / 0.6) * Math.PI);
      this.hero.position.y = y0 - jump * 28;
      const sq = t < 0.08 ? t / 0.08 : t > 0.55 && t < 0.68 ? 1 - Math.abs(t - 0.615) / 0.065 : 0;
      this.hero.scale.set(this.scale * (1 + sq * 0.04), this.scale * (1 - sq * 0.05));
      this.fx.clear(); if (t < 0.25) this.fx.rect(0, 0, this.vw, this.vh).fill({ color: 0xFFFFFF, alpha: 0.35 * (1 - t / 0.25) });
    }, x => x);
    this.hero.position.y = y0; this.hero.scale.set(this.scale); this.fx.clear();
  }

  /** Evolution: dark stage, white silhouette, light pillar, 3 pulses, swap to the new look, shockwave. */
  async evolve(nextLook) {
    if (!this.app) return;
    if (reduced()) { await this.setLook(nextLook); return; }
    const cm = new PIXI.ColorMatrixFilter(); this.hero.filters = [cm];
    const white = (v) => { cm.matrix = [1 - v, 0, 0, 0, v, 0, 1 - v, 0, 0, v, 0, 0, 1 - v, 0, v, 0, 0, 0, 1, 0]; };
    const cx = this.vw / 2, bot = this.vh * 0.88;
    const dark = (a) => { this.dim0.clear(); if (a > 0) this.dim0.rect(0, 0, this.vw, this.vh).fill({ color: 0x05040C, alpha: a }); };
    const pillar = (k, a) => { this.dim.clear(); if (a <= 0) return; this.dim.rect(cx - k / 2, 0, k, bot).fill({ color: 0xFFE7A0, alpha: a * 0.55 }); this.dim.rect(cx - k / 5, 0, k / 2.5, bot).fill({ color: 0xFFFFFF, alpha: Math.min(1, a) }); };
    await this.tween(0.6, t => { white(t); dark(0.7 * t); });
    const swap = this.setLook(nextLook);
    await this.tween(1.4, t => {
      white(1); const p = Math.abs(Math.sin(t * Math.PI * 3));
      this.hero.scale.set(this.scale * (1 + p * 0.035));
      pillar(60 + t * 220, 0.3 + 0.6 * t);
      if (Math.random() < 0.3) this.burst(0xFFE7A0, 3, 0.8);
    }, x => x);
    await swap;
    this.burst(0xFFD233, 60, 1.3);
    await this.tween(1.5, t => {
      white(1 - t); this.hero.scale.set(this.scale); dark(0.7 * (1 - t));
      this.fx.clear(); this.fx.circle(cx, bot - 600 * this.scale, 40 + t * Math.max(this.vw, this.vh)).stroke({ width: 10 * (1 - t) + 1, color: 0xFFF3C4, alpha: 1 - t });
      pillar(280 * (1 - Math.min(1, t / 0.35)), 0.9 * (1 - Math.min(1, t / 0.35)));
    }, ease.out);
    this.fx.clear(); this.dim.clear(); this.dim0.clear(); this.hero.filters = null;
  }

  tick(dt) {
    this.t += dt;
    for (const a of [...this.anim]) { a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(a.e(k)); if (k >= 1) { this.anim.splice(this.anim.indexOf(a), 1); a.res(); } }
    for (const m of [...this.motes]) {
      m.age += dt; m.vy += (m.grav || 0) * dt; m.g.x += m.vx * dt; m.g.y += m.vy * dt; m.g.alpha = Math.max(0, 1 - m.age / m.life);
      if (m.age >= m.life) { m.g.destroy(); this.motes.splice(this.motes.indexOf(m), 1); }
    }
    if (reduced()) return;
    // idle: breathing, hair sway, weapon float, aura pulse + rising motes
    const b = Math.sin(this.t * (Math.PI * 2 / 3.2));
    this.torso.scale.set(1, 1 + b * 0.006); this.torso.position.set(0, -b * 4);
    const hb = this.layers.hairBack, hf = this.layers.hairFront;
    hf.rotation = hb.rotation = Math.sin(this.t * 1.7) * 0.012;
    this.layers.weapon.position.y = H / 2 + (this.look?.anchors?.weapon?.y || 0) + Math.sin(this.t * 2) * 4;
    this.auraG.clear();
    if (this.auraColor != null) {
      if (this.auraCycle) this.auraColor = cycleColor(this.auraCycle, this.t / 1.6);
      const p = 0.5 + 0.5 * Math.sin(this.t * 2.2), s = this.scale;
      for (let i = 4; i >= 1; i--) this.auraG.ellipse(0, 0, (230 + i * 46 + p * 20) * s, (520 + i * 60 + p * 26) * s).fill({ color: this.auraColor, alpha: 0.05 + 0.02 * p });
      if (Math.random() < dt * 14) {
        const g = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 3).fill({ color: this.auraColor, alpha: 0.9 });
        g.position.set(this.vw / 2 + (Math.random() - 0.5) * 420 * s, this.vh * 0.88 - Math.random() * 300 * s); this.parts.addChild(g);
        this.motes.push({ g, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 60, life: 1.6 + Math.random(), age: 0, grav: 0 });
      }
    }
  }

  destroy() {
    this.dead = true;
    document.removeEventListener('visibilitychange', this.onVis || (() => {}));
    try { this.app?.destroy(true, { children: true, texture: true }); } catch { /* ignore */ }
    this.app = null;
  }
}
