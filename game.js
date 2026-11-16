/* Stick Showdown - an original stickman brawler. MIT licensed. */
(() => {
'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = 960, H = 540, GY = 450;
const $ = id => document.getElementById(id);
const menu = $('menu'), btn = $('start'), btn2 = $('train');

// ---------- input (with a short buffer so attacks feel responsive) ----------
const KEYS = { KeyA:'l', ArrowLeft:'l', KeyD:'r', ArrowRight:'r', KeyW:'u', ArrowUp:'u', Space:'u',
               KeyJ:'p', KeyK:'k', KeyL:'b', KeyS:'b', ArrowDown:'b',
               ShiftLeft:'d', ShiftRight:'d', KeyI:'d', KeyU:'x' };
const held = {}, buf = {};
let time = 0, clock = 0, mute = false, reducedMotion = false, storageWarning = '';
const press = k => { if (!held[k]) buf[k] = time; held[k] = true; };
const release = k => { held[k] = false; };
const want = k => time - (buf[k] ?? -9) < .18;
const eat = k => { buf[k] = -9; };

addEventListener('keydown', e => {
  if (mode !== 'play' && mode !== 'pause') {
    if (e.code === 'Escape' && !$('shop').classList.contains('hide')) { $('shop').classList.add('hide'); clearInput(); return; }
    const target = e.target;
    if (e.code === 'Enter' && (mode === 'menu' || mode === 'over') && $('shop').classList.contains('hide') && target === document.body) start(false);
    return;
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) return togglePause();
  if (e.code === 'KeyM') { setMute(!mute); return; }
  if (mode !== 'play') return;
  if (e.code === 'KeyT') { addMinion(); return; }
  const k = KEYS[e.code];
  if (k) { e.preventDefault(); if (!e.repeat) press(k); }
});
addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) release(k); });
function clearInput() {
  Object.keys(held).forEach(release); Object.keys(buf).forEach(k => buf[k] = -9);
  joyId = null; if (knob) knob.style.transform = '';
}
addEventListener('blur', () => { clearInput(); if (mode === 'play') togglePause(); });
document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'play') press(k); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => release(k)));
});
// virtual joystick: left/right to move, push up to jump, pull down to block
const joy = $('joy'), knob = $('knob');
let joyId = null;
function joyMove(e) {
  if (mode !== 'play') { joyEnd(); return; }
  const r = joy.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
  const m = Math.hypot(dx, dy); if (m > R) { dx *= R / m; dy *= R / m; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  const nx = dx / R, ny = dy / R;
  (nx < -.3 ? press : release)('l'); (nx > .3 ? press : release)('r');
}
function joyEnd() { joyId = null; knob.style.transform = ''; ['l', 'r'].forEach(release); }
joy.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
['pointerup', 'pointercancel'].forEach(ev => joy.addEventListener(ev, joyEnd));
let kind = 'w';
const listOf = () => kind === 'w' ? WEAPONS : kind === 'a' ? ABIL : MAPS;
function renderShop() {
  $('shopTitle').textContent = kind === 'w' ? 'Weapons' : kind === 'a' ? 'Abilities' : 'Choose a map';
  $('shopCoins').textContent = kind === 'm' ? '' : `Coins: ${coins}`;
  $('items').innerHTML = listOf().map((w, i) => {
    const own = kind === 'w' ? owned.includes(w.id) : kind === 'a' ? has(w.id) : true, cost = w.cost || 0;
    const on = kind === 'w' ? equipped === w.id : kind === 'm' ? mapI === i : own;
    const label = on ? (kind === 'a' ? 'Owned' : kind === 'm' ? 'Selected' : 'Equipped') : own ? (kind === 'm' ? 'Select' : 'Equip') : coins >= cost ? 'Buy' : 'Need ' + (cost - coins) + ' more';
    const detail = (w.desc || 'Blocks rise from wave 3 (and in Training).') + (w.id === 'vit' ? ' Takes effect next run; it does not refill current health.' : '');
    return `<div class="item"><b style="color:${w.c || '#fff'}">${w.name}</b>${cost ? ' &middot; ' + cost + ' coins' : ''}<br>${detail}<br><button data-i="${i}">${label}</button></div>`;
  }).join('');
}
$('items').addEventListener('click', e => {
  const i = e.target.dataset && e.target.dataset.i; if (i == null) return;
  const w = listOf()[+i];
  if (kind === 'm') setMap(+i);
  else {
    const mine = kind === 'w' ? owned : abil;
    if (!mine.includes(w.id)) { if (coins < w.cost) return; coins -= w.cost; mine.push(w.id); saveCoins(); sfx(700, .15, 'sine', .06); }
    if (kind === 'w') equipped = w.id;
  }
  saveW(); renderShop(); syncPrefs();
});
const openShop = k => { clearInput(); kind = k; renderShop(); $('shop').classList.remove('hide'); };
$('shopBtn').addEventListener('click', () => openShop('w'));
$('mapBtn').addEventListener('click', () => openShop('m'));
$('abBtn').addEventListener('click', () => openShop('a'));
$('shopBack').addEventListener('click', () => { clearInput(); $('shop').classList.add('hide'); syncPrefs(); });
$('pauseBtn').addEventListener('click', togglePause);
$('muteBtn').addEventListener('click', () => setMute(!mute));
$('motionBtn').addEventListener('click', () => { reducedMotion = !reducedMotion; savePrefs(); syncPrefs(); });
$('rewardChoices').addEventListener('click', e => {
  const choice = e.target.dataset && e.target.dataset.reward;
  if (!['heal', 'damage', 'dash'].includes(choice) || mode !== 'reward') return;
  if ((choice === 'damage' && runDamage >= 1.8 - 1e-9) || (choice === 'dash' && runDash <= .55)) return;
  if (choice === 'heal') player.hp = Math.min(player.max, player.hp + player.max * .35);
  if (choice === 'damage') runDamage = Math.min(1.8, Math.round((runDamage + .2) * 100) / 100);
  if (choice === 'dash') runDash = Math.max(.55, runDash - .1);
  rewardedWave = wave; $('reward').classList.add('hide'); clearInput(); mode = 'play'; waveWait = .75;
  banner(choice === 'heal' ? 'Recovery chosen' : choice === 'damage' ? 'Damage boost chosen' : 'Dash boost chosen');
});
$('exit').addEventListener('click', () => start(false));
$('foe').addEventListener('pointerdown', e => { e.preventDefault(); addMinion(); });
btn.addEventListener('click', () => mode === 'pause' ? togglePause() : start());
btn2.addEventListener('click', () => start(mode === 'pause' ? !training : true));
cv.addEventListener('pointerdown', () => window.focus());

// ---------- audio ----------
let ac;
function sfx(f, d = .08, type = 'square', v = .06) {
  if (mute) return;
  try {
    ac = ac || new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f / 3), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g).connect(ac.destination); o.start(); o.stop(t + d);
  } catch (e) { /* audio unavailable */ }
}

// ---------- data ----------
const ATK = {
  punch: { dur: .24, hit: .09, reach: 58, dmg: 7,  kb: 170, stun: .25 },
  kick:  { k: 1, dur: .38, hit: .15, reach: 82, dmg: 13, kb: 340, stun: .40 },
};
const TYPES = {
  hero:  { c: '#f3efe6', hp: 120, spd: 250, s: 1,    dmg: 1,   stm: 1,  cd: 0,   blk: 0,   pts: 0 },
  grunt: { c: '#c7cde0', hp: 50,  spd: 150, s: 1,    dmg: 1,   stm: 1,  cd: 1.3, blk: .15, pts: 100 },
  ninja: { c: '#5aa9ff', hp: 38,  spd: 250, s: .95,  dmg: .8,  stm: 1,  cd: .8,  blk: .3,  pts: 150 },
  brute: { c: '#ff6b57', hp: 120, spd: 110, s: 1.3,  dmg: 1.6, stm: .5, cd: 1.6, blk: .1,  pts: 250 },
  boss:  { c: '#ffb703', hp: 320, spd: 140, s: 1.55, dmg: 1.8, stm: .35, cd: .9, blk: .35, pts: 1000 },
};
const BEST_KEY = 'stick-showdown-best';
const PREF_KEY = 'stick-showdown-prefs';
let best = 0;
try { const value = Number(localStorage.getItem(BEST_KEY)); best = Number.isFinite(value) && value >= 0 ? value : 0; } catch (e) { storageWarning = 'Storage unavailable: best score and preferences may not save.'; }
try {
  const pref = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  if (pref && typeof pref === 'object') { mute = pref.mute === true; reducedMotion = pref.reducedMotion === true; }
} catch (e) { storageWarning = 'Saved preferences could not be read; safe defaults are active.'; }

const WEAPONS = [
  { id: 'fists', name: 'Bare Fists', cost: 0, c: '#f3efe6', len: 0, dmg: 1, reach: 0, speed: 1, heal: 5, ult: 'shock', desc: 'Ability: heal 5 HP per kill. Ultimate: Shockwave blasts everyone nearby.' },
  { id: 'staff', name: 'Bamboo Staff', cost: 60, c: '#d9b36c', len: 58, dmg: 1.1, reach: 26, speed: 1, lift: 1, ult: 'cyclone', desc: 'Ability: long reach, punches pop enemies up. Ultimate: Cyclone spins and drags enemies in.' },
  { id: 'daggers', name: 'Twin Daggers', cost: 150, c: '#c7cde0', len: 16, dmg: 0.75, reach: 0, speed: 0.8, dot: [3, 3], twin: 1, ult: 'daggers', desc: 'Ability: every punch stabs twice and causes bleeding. Ultimate: throw 5 daggers that hit for 45 each.' },
  { id: 'nunchucks', name: 'Nunchucks', cost: 220, c: '#c97b4a', len: 30, dmg: 0.9, reach: 10, speed: 0.8, frenzy: 1, ult: 'fury', desc: 'Ability: damage grows with your combo. Ultimate: Dragon Fury, a 10 hit barrage on the nearest enemy.' },
  { id: 'katana', name: 'Iron Katana', cost: 300, c: '#e8eefc', len: 42, dmg: 1.5, reach: 12, speed: 0.95, crit: .2, ult: 'dash', desc: 'Ability: 20% chance of triple damage. Ultimate: Blade Dash slices through everyone in front of you.' },
  { id: 'hammer', name: 'War Hammer', cost: 550, c: '#9a8f7a', len: 44, dmg: 2, reach: 8, speed: 1.35, quake: 1, ult: 'smash', desc: 'Ability: punches shake the ground. Ultimate: Mega Smash marks a spot, then crushes it.' },
  { id: 'frost', name: 'Frost Blade', cost: 850, c: '#7fe3ff', len: 46, dmg: 1.35, reach: 14, speed: 0.9, slow: 1, ult: 'blizzard', desc: 'Ability: hits slow enemies. Ultimate: Blizzard freezes everyone on screen.' },
  { id: 'scythe', name: 'Reaper Scythe', cost: 1000, c: '#b58cff', len: 56, dmg: 1.5, reach: 24, speed: 1.1, leech: .25, ult: 'harvest', desc: 'Ability: heal 25% of damage dealt. Ultimate: Harvest hurts everyone and heals you for each enemy hit.' },
  { id: 'flame', name: 'Flame Spear', cost: 1300, c: '#ff7b3a', len: 64, dmg: 1.6, reach: 30, speed: 1, dot: [7, 3], ult: 'firewave', desc: 'Ability: huge reach, hits burn. Ultimate: Fire Wave, a fireball that burns everything it passes.' },
  { id: 'thunder', name: 'Thunder Gauntlets', cost: 2000, c: '#ffe066', len: 14, dmg: 2.2, reach: 6, speed: 0.85, chain: 1, ultx: 1.8, ult: 'storm', desc: 'Ability: hits zap 2 nearby enemies, ultimate charges faster. Ultimate: Storm strikes every enemy with lightning.' },
];
const ABIL = [
  { id: 'djump', name: 'Double Jump', cost: 200, desc: 'Jump again in mid-air.' },
  { id: 'vit', name: 'Tough Skin', cost: 250, desc: '+40 max health.' },
  { id: 'charge', name: 'Quick Charge', cost: 300, desc: 'Ultimate charges 30% faster.' },
  { id: 'magnet', name: 'Coin Magnet', cost: 120, desc: 'Coins fly to you from much further away.' },
  { id: 'revive', name: 'Second Chance', cost: 600, desc: 'Once per run, get back up with half health.' },
];
const MAPS = [
  { name: 'Moonlit Dojo', sky: ['#0b0d17', '#241a3f', '#5b2a52'], h: ['#2a2050', '#171233'], gr: '#0d0b1c', ln: '#4a3a7a', blk: '#3b3170', blocks: [[150, 170, 350], [640, 170, 350]] },
  { name: 'Sunset Ridge', sky: ['#2b1b3d', '#a63d57', '#f2a65a'], h: ['#7a2f4a', '#4a1f3a'], gr: '#2a1424', ln: '#d9774a', blk: '#8a4a3a', blocks: [[90, 130, 360], [415, 130, 335], [740, 130, 360]] },
  { name: 'Frozen Peak', sky: ['#0a1a33', '#27507a', '#9fd3ea'], h: ['#5d86ad', '#3b5f87'], gr: '#16283f', ln: '#bfe8ff', blk: '#6fa6c9', blocks: [[320, 320, 345], [60, 110, 360], [790, 110, 360]] },
  { name: 'Neon Alley', sky: ['#07040f', '#2a0a3f', '#7a1fa0'], h: ['#1c0b33', '#10051f'], gr: '#0a0414', ln: '#ff3bd4', blk: '#3a1262', blocks: [[100, 100, 360], [280, 100, 335], [560, 100, 335], [740, 100, 360]] },
];
const WKEY = 'stick-showdown-weapons';
let owned = ['fists'], equipped = 'fists', abil = [], mapI = 0;
const weaponIds = new Set(WEAPONS.map(w => w.id)), abilityIds = new Set(ABIL.map(a => a.id));
try {
  const sv = JSON.parse(localStorage.getItem(WKEY) || 'null');
  if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
    const badWeapons = sv.owned !== undefined && (!Array.isArray(sv.owned) || sv.owned.some(id => !weaponIds.has(id)));
    const badAbilities = sv.abil !== undefined && (!Array.isArray(sv.abil) || sv.abil.some(id => !abilityIds.has(id)));
    const badMap = sv.mapI !== undefined && (!Number.isInteger(sv.mapI) || sv.mapI < 0 || sv.mapI >= MAPS.length);
    if (badWeapons || badAbilities || badMap) storageWarning = 'Saved loadout contains invalid entries; safe values are active. It has not been rewritten automatically.';
    if (Array.isArray(sv.owned)) owned = [...new Set(sv.owned.filter(id => weaponIds.has(id)))];
    if (!owned.includes('fists')) owned.unshift('fists');
    if (typeof sv.equipped === 'string' && weaponIds.has(sv.equipped) && owned.includes(sv.equipped)) equipped = sv.equipped;
    if (Array.isArray(sv.abil)) abil = [...new Set(sv.abil.filter(id => abilityIds.has(id)))];
    if (Number.isInteger(sv.mapI) && sv.mapI >= 0 && sv.mapI < MAPS.length) mapI = sv.mapI;
  } else if (sv !== null) storageWarning = 'Saved loadout format is invalid; safe defaults are active. It has not been rewritten automatically.';
} catch (e) { storageWarning = 'Saved loadout could not be read; a safe default is active. It has not been rewritten automatically.'; }
const validCurrency = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
const has = id => abil.includes(id);
const weapon = () => WEAPONS.find(w => w.id === equipped) || WEAPONS[0];
const saveW = () => { try { localStorage.setItem(WKEY, JSON.stringify({ owned, equipped, abil, mapI })); } catch (e) { storageWarning = 'Storage unavailable: loadout changes may not save.'; } };
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ mute, reducedMotion })); } catch (e) { storageWarning = 'Storage unavailable: sound and motion preferences may not save.'; } }
function setMute(value) { mute = !!value; savePrefs(); syncPrefs(); }
function syncPrefs() {
  $('muteBtn').textContent = mute ? 'Sound off' : 'Sound on';
  $('muteBtn').setAttribute('aria-label', mute ? 'Unmute sound' : 'Mute sound');
  $('motionBtn').textContent = 'Reduced motion: ' + (reducedMotion ? 'on' : 'off');
  $('status').textContent = (storageWarning ? storageWarning + ' ' : '') + `Equipped: ${weapon().name} · Map: ${MAPS[mapI].name} · Coins: ${coins}`;
}
function scaled(name) { const a = ATK[name], w = weapon(); return { ...a, dur: a.dur * w.speed, hit: a.hit * w.speed, reach: a.reach + w.reach, dmg: a.dmg * w.dmg }; }

// ---------- state ----------
let mode = 'menu', player, enemies = [], parts = [], queue = [];
let wave = 0, score = 0, kills = 0, combo = 0, comboT = 0, shake = 0, freeze = 0, waveWait = 0, spawnT = 0, overT = 0;
let ult = 0, ring = 0, training = false, drops = [], coins = 0, spawnI = 0; const done = {};
let shots = [], cyc = 0, smash = null, fury = null, reviveUsed = false; const platforms = [];
try { coins = validCurrency(localStorage.getItem('stick-showdown-coins')); } catch (e) { storageWarning = 'Storage unavailable: coins and upgrades may not save.'; }
let runDamage = 1, runDash = 1, rewardedWave = 0, runEarned = 0;
let bannerText = '', bannerT = 0;
const stars = Array.from({ length: 70 }, () => [Math.random() * W, Math.random() * 260, Math.random() * 1.6 + .4]);

class Fighter {
  constructor(x, y, type, isP) {
    this.T = TYPES[type]; this.type = type; this.isP = isP;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.dir = isP ? 1 : -1;
    this.state = 'idle'; this.t = 0; this.stun = 0; this.flash = 0; this.ph = 0;
    this.did = false; this.blocking = false; this.gr = y >= GY; this.cd = 1; this.bt = 0;
    this.dashCd = 0; this.dashT = 0; this.inv = 0; this.slow = 0; this.dot = 0; this.dps = 0; this.cur = ATK.punch;
    this.windup = 0; this.windupKind = ''; this.windupTarget = 0; this.recover = 0;
    this.c = this.T.c; this.s = this.T.s; this.spd = this.T.spd;
    this.max = this.hp = this.ghost = this.T.hp;
  }
  atk(name) {
    this.state = name; this.t = 0; this.did = false; this.blocking = false; this.cur = this.isP ? scaled(name) : ATK[name]; this.did2 = false;
    sfx(name === 'kick' ? 260 : 340, .07, 'triangle', .04);
    if (this.isP) { eat('p'); eat('k'); tick(name); if (name === 'kick' && !this.gr) tick('airkick'); }
  }
  update(dt, c) {
    this.flash = Math.max(0, this.flash - dt); this.dashCd -= dt; this.inv -= dt;
    this.slow -= dt; this.spd = this.T.spd * (this.slow > 0 ? .4 : 1);
    if (this.dot > 0) {
      this.dot -= dt; if (this.state !== 'dead') hurt(this, this.dps * dt, 1, !!this.dotPlayer);
      if (Math.random() < .25) sparks(this.x, this.y - 50, '#ff7b3a', 1);
    }
    this.ghost += (this.hp - this.ghost) * Math.min(1, dt * 3);
    if (this.state === 'dead') { this.t += dt; this.vx *= .96; }
    else if (this.state === 'windup') {
      this.windup -= dt; this.vx *= .75;
      if (this.windup <= 0) {
        const kind = this.windupKind; this.windupKind = '';
        if (kind === 'slam') { this.state = 'slam'; this.t = 0; }
        else this.atk(kind || 'punch');
      }
    } else if (this.state === 'slam') {
      this.t += dt; this.vx = 0;
      if (this.t >= .2) {
        if (Math.abs(player.x - this.windupTarget) < 98 && player.y > GY - 72 && player.inv <= 0) {
          if (player.blocking) hurt(player, 18, this.windupTarget < player.x ? 1 : -1);
          else hurt(player, 44 * (1 + wave * .03), this.windupTarget < player.x ? 1 : -1);
          if (player.state !== 'dead') { player.vy = -260; player.gr = false; }
        }
        this.state = 'recovery'; this.t = 0; this.recover = .72;
        shake = Math.max(shake, 12); sparks(this.windupTarget, GY, '#ffb703', 20);
      }
    } else if (this.state === 'recovery') {
      this.recover -= dt; this.vx = 0;
      if (this.recover <= 0) { this.state = 'idle'; this.t = 0; }
    }
    else if (this.stun > 0) {
      this.stun -= dt; this.vx *= .92;
      if (this.stun <= 0) this.state = 'idle';
    } else if (this.state === 'punch' || this.state === 'kick') {
      const a = this.cur; this.t += dt; this.vx *= .85;
      if (!this.did && this.t >= a.hit) { this.did = true; strike(this, a); }
      if (this.did && !this.did2 && this.isP && weapon().twin && this.t >= a.hit + .09) { this.did2 = true; strike(this, a); }
      if (this.t >= a.dur) { this.state = 'idle'; this.t = 0; }
    } else {
      this.blocking = !!c.b && this.gr; if (this.blocking && this.isP) tick('block');
      const ax = (c.r ? 1 : 0) - (c.l ? 1 : 0);
      if (this.blocking) this.vx = 0;
      else { this.vx = ax * this.spd; if (ax) { this.dir = ax; if (this.isP) { tick('move'); if (!this.gr) tick('jumpmove'); } } }
      if (c.u && this.gr && !this.blocking) { this.vy = -650; this.gr = false; if (this.isP) { eat('u'); tick('jump'); } sfx(420, .08, 'sine', .04); }
      else if (c.u && this.isP && !this.gr && !this.dj && has('djump')) { this.dj = true; this.vy = -600; eat('u'); sparks(this.x, this.y, '#7fd0ff', 8); sfx(520, .08, 'sine', .05); }
      if (c.d && this.dashCd <= 0 && !this.blocking) { this.dashT = .2; this.dashCd = .9 * (this.isP ? runDash : 1); this.inv = Math.max(this.inv, .22); sfx(300, .1, 'sine', .05); if (this.isP) { eat('d'); tick('dash'); } }
      if (this.dashT > 0) { this.dashT -= dt; this.vx = this.dir * 640; if (Math.random() < .7) sparks(this.x, this.y - 30, '#7fd0ff', 1); }
      if (!this.blocking) {
        if (c.k && !this.gr && c.b) { this.atk('kick'); this.vy = 900; this.vx = this.dir * 330; if (this.isP) tick('dive'); }
        else if (c.p) this.atk('punch'); else if (c.k) this.atk('kick');
      }
    }
    if (this.state !== 'idle') this.blocking = false;
    const py = this.y; this.vy += 1700 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    let fl = GY;
    for (const p of platforms) if (this.vy >= 0 && this.x > p.x - 6 && this.x < p.x + p.w + 6 && py <= p.y + 2 && this.y >= p.y && p.y < fl) fl = p.y;
    if (this.y >= fl) {
      if (!this.gr && this.vy > 450) sparks(this.x, fl, '#667', 5);
      this.y = fl; this.vy = 0; this.gr = true; this.dj = false;
    } else this.gr = false;
    this.x = Math.max(30, Math.min(W - 30, this.x));
    this.ph += Math.abs(this.vx) * dt * .035;
  }
}

function strike(a, atk) {
  const targets = a.isP ? enemies : [player];
  for (const t of targets) {
    const dx = (t.x - a.x) * a.dir;
    if (t.state === 'dead' || t.hp <= 0 || t.inv > 0 || dx < -10 || dx > atk.reach * a.s + 14 || Math.abs(t.y - a.y) > 70) continue;
    const mx = (a.x + t.x) / 2 + a.dir * 10, my = t.y - 55 * t.s;
    const w = a.isP ? weapon() : {};
    let dmg = atk.dmg * a.T.dmg * (a.isP ? 1 : 1 + wave * .03);
    if (w.frenzy) dmg *= 1 + Math.min(combo, 10) * .08;
    if (w.crit && Math.random() < w.crit) { dmg *= 3; sparks(mx, my, '#ffd166', 14); sfx(500, .1, 'square', .08); }
    if (t.blocking && t.dir === -a.dir) {
      hurt(t, dmg * .12, a.dir, a.isP); if (t.state !== 'dead') t.vx = a.dir * 140; freeze = .03;
      sparks(mx, my, '#7fd0ff', 6); sfx(120, .06, 'triangle');
    } else {
      const before = t.hp, hitDamage = dmg * (a.isP ? runDamage : 1), survived = hurt(t, dmg, a.dir, a.isP), actualDamage = Math.min(before, hitDamage);
      if (survived) {
        t.state = 'hit'; t.t = 0; t.stun = atk.stun * t.T.stm; t.flash = .1; t.blocking = false;
        t.vx = a.dir * atk.kb * t.T.stm;
        if (atk.k) { t.vy = -220; t.gr = false; }
        if (a.isP) {
          if (w.dot) { t.dot = w.dot[1]; t.dps = w.dot[0]; t.dotPlayer = true; }
          if (w.slow) t.slow = 2;
          if (w.lift && !atk.k) { t.vy = -300; t.gr = false; }
        }
      }
      if (a.isP) {
        if (w.leech && player.state !== 'dead') player.hp = Math.min(player.max, player.hp + actualDamage * w.leech);
        if (w.quake && !atk.k) {
          shake = Math.max(shake, 16); sparks(t.x, GY, '#9a8f7a', 12);
          for (const o of enemies) if (o !== t && o.state !== 'dead' && Math.abs(o.x - a.x) < 140) { hurt(o, dmg * .5, a.dir, true); if (o.state !== 'dead') o.vx = a.dir * 160; }
        }
        if (w.chain) {
          let n = 0;
          for (const o of enemies) if (o !== t && o.state !== 'dead' && n < 2 && Math.abs(o.x - t.x) < 240) {
            n++; bolts.push({ x1: t.x, y1: t.y - 50, x2: o.x, y2: o.y - 50, l: .18 }); hurt(o, dmg * .4, a.dir, true); sparks(o.x, o.y - 50, '#ffe066', 6);
          }
        }
        combo++; comboT = 2; score += 5 * combo; ult = Math.min(100, ult + (atk.k ? 10 : 7) * (w.ultx || 1) * (has('charge') ? 1.3 : 1)); if (combo >= 5) tick('combo');
      } else { combo = 0; ult = Math.min(100, ult + 6); }
      sparks(mx, my, '#ffd166', 10); freeze = .06;
      shake = Math.max(shake, atk.k ? 9 : 5); sfx(atk.k ? 90 : 140, .1, 'sawtooth', .08);
    }
  }
}
function kill(t, a) {
  if (!t || t.state === 'dead' || t.hp > 0) return false;
  if (t.isP && has('revive') && !reviveUsed) {
    reviveUsed = true; t.hp = t.max * .5; t.state = 'idle'; t.stun = 0; t.inv = 2; ult = 100; banner('Second chance!'); sparks(t.x, t.y - 40, '#ffd166', 30); return;
  }
  t.hp = 0; t.state = 'dead'; t.t = 0; t.vx = a.dir * 300; t.vy = -320; t.gr = false; t.blocking = false;
  if (t.isP) { sfx(50, .6, 'sawtooth', .1); freeze = .15; return true; }
  kills++; score += t.T.pts + combo * 10;
  if (player && player.state !== 'dead' && weapon().heal) player.hp = Math.min(player.max, player.hp + weapon().heal);
  if (!training) for (let i = 0; i < Math.ceil(t.T.pts / 25); i++) drops.push({ x: t.x, y: t.y - 40, vx: (Math.random() - .5) * 260, vy: -300 - Math.random() * 200, t: 0 }); shake = 14; freeze = .1; sfx(60, .3, 'sawtooth', .1);
  sparks(t.x, t.y - 50, t.c, 16);
  return true;
}

function ai(e, dt) {
  const c = {}, p = player;
  if (e.dummy) { if (e.state === 'idle') e.dir = p.x < e.x ? -1 : 1; return c; }
  if (p.state === 'dead' || e.state === 'dead' || e.state === 'windup' || e.state === 'slam' || e.state === 'recovery') return c;
  const dx = p.x - e.x, ad = Math.abs(dx), reach = 56 * e.s;
  e.cd -= dt; e.bt -= dt;
  if (e.state === 'idle') e.dir = dx > 0 ? 1 : -1;
  if (ad < 120 * e.s + 30 && (p.state === 'punch' || p.state === 'kick') && Math.random() < e.T.blk * dt * 6) e.bt = .45;
  if (e.bt > 0) { c.b = 1; return c; }
  if (ad > reach * .85 + e.gap) c[dx > 0 ? 'r' : 'l'] = 1;
  else if (ad < reach * .4) c[dx > 0 ? 'l' : 'r'] = 1;
  if (e.state === 'idle' && e.stun <= 0 && ad < reach + 8 && e.cd <= 0 && Math.random() < dt * 4) {
    e.state = 'windup'; e.windupKind = e.type === 'boss' ? 'slam' : (Math.random() < .35 ? 'kick' : 'punch');
    e.windup = e.type === 'boss' ? .9 : .42;
    if (e.type === 'boss') { e.windupTarget = Math.max(54, Math.min(W - 54, p.x)); banner('Boss slam incoming!'); }
    e.cd = e.T.cd * (.7 + Math.random() * .6) + (e.type === 'boss' ? 1.1 : 0);
  }
  if (e.gr && Math.random() < dt * .15) c.u = 1;
  if (e.gr && p.y < e.y - 60 && ad < 220 && Math.random() < dt * 2) c.u = 1;
  return c;
}

function spawn(type) {
  const e = new Fighter(0, -60, type, false);
  e.x = player.x < W / 2 ? W - 80 - Math.random() * 120 : 80 + Math.random() * 120;
  e.gap = Math.random() * 25;
  e.max = e.hp = e.ghost = Math.round(e.T.hp * (1 + wave * .07));
  enemies.push(e);
}
function nextWave() {
  wave++; queue = [];
  const n = Math.min(20, wave <= 3 ? 2 * wave : wave <= 8 ? wave + 3 : 11 + ((wave - 8) >> 1));
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    queue.push(wave >= 4 && r > .8 ? 'brute' : wave >= 2 && r < .3 ? 'ninja' : 'grunt');
  }
  if (wave % 5 === 0) queue.push('boss');
  setBlocks(); banner(wave === 3 ? 'Wave 3: blocks rise!' : `Wave ${wave}`); spawnT = 1;
}
function banner(t) { bannerText = t; bannerT = 2; }
function openWaveReward() {
  if (training || rewardedWave === wave || mode !== 'play') return;
  clearInput(); mode = 'reward'; waveWait = 0;
  $('rewardChoices').innerHTML = [
    ['heal', 'Recovery', player.hp >= player.max ? 'Health is full. Choose this to continue without a run bonus.' : `Restore 35% max health · current HP ${Math.ceil(player.hp)}/${player.max}.`, false],
    ['damage', 'Damage', runDamage >= 1.8 - 1e-9 ? 'Run damage bonus at maximum (+80%).' : `All damage +${Math.round(Math.min(.2, 1.8 - runDamage) * 100)}% · current bonus +${Math.round((runDamage - 1) * 100)}% · maximum +80%.`, runDamage >= 1.8 - 1e-9],
    ['dash', 'Quick Dash', runDash <= .55 ? 'Dash cooldown bonus at maximum (45% shorter).' : `Dash cooldown ${Math.round((runDash - Math.max(.55, runDash - .1)) * 100)}% shorter · current ${Math.round((1 - runDash) * 100)}% shorter · maximum 45%.`, runDash <= .55],
  ].map(([id, name, desc, disabled]) => `<div class="rewardChoice"><b>${name}</b><br>${desc}<br><button data-reward="${id}"${disabled ? ' disabled' : ''}>${disabled ? 'At maximum' : id === 'heal' && player.hp >= player.max ? 'Continue' : 'Choose'}</button></div>`).join('');
  $('reward').classList.remove('hide');
}

function sparks(x, y, col, n) {
  if (reducedMotion) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = 100 + Math.random() * 260;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, l: .4 + Math.random() * .3, m: .7, c: col, r: 2 + Math.random() * 3 });
  }
}

// ---------- ultimate and training ----------
const TRAIN = [['move','Walk (A / D)'], ['jump','Jump (W)'], ['jumpmove','Jump and move (W + D together)'], ['punch','Punch (J)'],
  ['kick','Kick (K)'], ['block','Block (hold L)'], ['dash','Dash (Shift or I)'], ['airkick','Air kick (jump, then K)'],
  ['dive','Dive kick (in air: S + K)'], ['combo','Land a 5 hit combo'], ['ult','Ultimate (U)']];
function tick(n) {
  if (!training || done[n]) return;
  done[n] = 1; sfx(660, .12, 'sine', .05);
  if (TRAIN.every(([k]) => done[k])) banner('All moves learned!');
}
function ultimate() {
  const w = weapon(), U = w.ult, alive = enemies.filter(e => e.state !== 'dead'), pd = player.dir;
  if (U === 'shock') return shock();
  ult = 0; tick('ult'); player.inv = Math.max(player.inv, .5); sfx(90, .4, 'sawtooth', .1); shake = 12;
  const each = (d, st) => { for (const e of alive) { hurt(e, d, e.x < player.x ? -1 : 1, true); if (e.state !== 'dead') { e.state = 'hit'; e.t = 0; e.stun = st; e.flash = .15; } sparks(e.x, e.y - 50, w.c, 10); } };
  if (U === 'cyclone') cyc = 1.4;
  else if (U === 'daggers') for (let i = 0; i < 5; i++) shots.push({ x: player.x, y: player.y - 80 + i * 14, vx: pd * 950, dmg: 45, life: 1, c: '#c7cde0', dot: 1, playerSource: true });
  else if (U === 'fury') fury = { n: 10, t: 0 };
  else if (U === 'dash') {
    const x0 = player.x, x1 = Math.max(30, Math.min(W - 30, x0 + pd * 640)); bolts.push({ x1: x0, y1: player.y - 40, x2: x1, y2: player.y - 40, l: .3 });
    for (const e of alive) if ((e.x - x0) * pd > -20 && (e.x - x1) * pd < 20) { hurt(e, 85, pd, true); if (e.state !== 'dead') { e.state = 'hit'; e.t = 0; e.stun = .6; } sparks(e.x, e.y - 50, '#fff', 12); }
    player.x = x1; player.inv = .5; shake = 16;
  } else if (U === 'smash') {
    const n = alive.sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
    smash = { x: n ? n.x : Math.max(60, Math.min(W - 60, player.x + pd * 220)), t: .55 };
  } else if (U === 'blizzard') { each(30, 1.2); for (const e of alive) if (e.state !== 'dead') e.slow = 5; }
  else if (U === 'harvest') { each(40, .4); player.hp = Math.min(player.max, player.hp + 10 * alive.length); }
  else if (U === 'firewave') shots.push({ x: player.x, y: player.y - 35, vx: pd * 520, dmg: 40, life: 1.4, c: '#ff7b3a', big: 1, dot: 1, playerSource: true });
  else if (U === 'storm') { for (const e of alive) bolts.push({ x1: e.x, y1: 0, x2: e.x, y2: e.y - 40, l: .3 }); each(55, .5); }
}
function shock() {
  ult = 0; player.inv = .9; shake = 26; freeze = .12; ring = .5; tick('ult'); sfx(70, .5, 'sawtooth', .12);
  sparks(player.x, player.y - 40, '#ffd166', 40); sparks(player.x, player.y - 40, '#ff4d6d', 24);
  for (const e of enemies) {
    const d = e.x - player.x;
    if (e.state === 'dead' || Math.abs(d) > 320) continue;
    const dir = d < 0 ? -1 : 1;
    hurt(e, 45, dir, true);
    if (e.state !== 'dead') { e.state = 'hit'; e.t = 0; e.stun = .9; e.flash = .2; e.vx = dir * 520; e.vy = -420; e.gr = false; }
    sparks(e.x, e.y - 50, '#ffd166', 10);
    if (e.state !== 'dead') { combo++; comboT = 2; }
  }
}
const bolts = [];
function hurt(t, amt, dir, playerSource = false) {
  if (!t || t.state === 'dead' || t.hp <= 0) return false;
  t.hp -= amt * (playerSource ? runDamage : 1); t.flash = .1;
  if (t.hp <= 0) kill(t, { dir });
  return t.state !== 'dead';
}
function addMinion() {
  if (!training || mode !== 'play' || enemies.filter(e => !e.dummy && e.state !== 'dead').length >= 8) return;
  spawn(['grunt', 'ninja', 'brute', 'boss'][spawnI++ % 4]);
}
function saveCoins() { try { localStorage.setItem('stick-showdown-coins', String(validCurrency(coins))); } catch (e) { storageWarning = 'Storage unavailable: coin changes may not save.'; syncPrefs(); } }
function spawnDummy() {
  const e = new Fighter(player.x < W / 2 ? player.x + 220 : player.x - 220, -60, 'grunt', false);
  e.dummy = true; e.max = e.hp = e.ghost = 400; e.gap = 0; enemies.push(e);
}
function trainUpdate() {
  player.hp = player.max; ult = 100;
  if (!enemies.some(e => e.dummy)) spawnDummy();
  for (const e of enemies) if (e.dummy && e.state === 'idle') e.hp = e.max;
}

// ---------- flow ----------
function show(title, sub, label, label2 = 'Training') {
  clearInput(); $('shop').classList.add('hide'); $('reward').classList.add('hide');
  btn2.textContent = label2;
  $('title').textContent = title; $('sub').innerHTML = sub; btn.textContent = label; menu.classList.remove('hide'); btn.focus(); syncPrefs();
}
function start(isTrain) {
  clearInput(); $('shop').classList.add('hide'); $('reward').classList.add('hide');
  player = new Fighter(W / 2, GY, 'hero', true);
  if (has('vit')) player.max = player.hp = player.ghost = 160;
  enemies = []; parts = []; queue = [];
  wave = score = kills = combo = comboT = shake = freeze = waveWait = overT = ult = ring = 0;
  training = !!isTrain; runDamage = 1; runDash = 1; rewardedWave = 0; runEarned = 0;
  Object.keys(done).forEach(k => delete done[k]); drops = []; shots = []; bolts.length = 0; cyc = 0; smash = null; fury = null; reviveUsed = false;
  $('foe').classList.toggle('off', !training); $('exit').classList.toggle('off', !training);
  Object.keys(buf).forEach(k => buf[k] = -9);
  setBlocks();
  if (training) { spawnDummy(); banner('Training'); } else nextWave();
  mode = 'play'; menu.classList.add('hide'); btn.blur(); btn2.blur(); syncPrefs();
}
function togglePause() {
  if (!$('shop').classList.contains('hide')) { $('shop').classList.add('hide'); clearInput(); return; }
  if (mode === 'play') { mode = 'pause'; show('Paused', `Take a breath.<br>Current run: ${training ? 'Training' : 'Wave ' + wave}.`, 'Resume', training ? 'Switch to Survival' : 'Training'); }
  else if (mode === 'pause') { mode = 'play'; clearInput(); menu.classList.add('hide'); btn.blur(); }
}
function gameOver() {
  mode = 'over';
  const fresh = !training && score > best;
  if (fresh) { best = score; try { localStorage.setItem(BEST_KEY, best); } catch (e) { storageWarning = 'Storage unavailable: best score may not save.'; } }
  const earned = training ? 0 : runEarned;
  show(training ? 'Training ended' : 'Run summary', `${training ? 'Practice session' : `Reached wave ${wave}`} &middot; ${kills} defeated &middot; ${score} pts<br>${fresh ? 'New best score!' : 'Best: ' + best}<br>Map: ${MAPS[mapI].name} &middot; Weapon: ${weapon().name}<br>Run coins earned: ${earned} &middot; Wallet: ${coins}<br>Run bonuses: damage +${Math.round((runDamage - 1) * 100)}% · dash cooldown ${Math.round((1 - runDash) * 100)}% shorter`, 'Fight again');
}

function update(dt) {
  clock += dt; shake = Math.max(0, shake - 60 * dt);
  if (freeze > 0) { freeze -= dt; return; }
  time += dt; bannerT = Math.max(0, bannerT - dt); ring = Math.max(0, ring - dt);
  if (want('x') && ult >= 100 && player.state !== 'dead' && player.state !== 'hit') { eat('x'); ultimate(); }
  player.update(dt, { l: held.l, r: held.r, b: held.b, u: want('u'), p: want('p'), k: want('k'), d: want('d') });
  for (const e of enemies) e.update(dt, ai(e, dt));
  const all = [player, ...enemies].filter(f => f.state !== 'dead');
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], d = b.x - a.x, m = 26 * (a.s + b.s) / 2;
    if (Math.abs(d) < m && Math.abs(a.y - b.y) < 50) { const p = (m - Math.abs(d)) / 2 * (d < 0 ? -1 : 1); a.x -= p; b.x += p; }
  }
  enemies = enemies.filter(e => e.state !== 'dead' || e.t < 1.5);
  for (const p of parts) { p.l -= dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  parts = parts.filter(p => p.l > 0);
  for (const c of drops) {
    c.t += dt; c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.y >= GY - 6) { c.y = GY - 6; c.vy *= -.4; c.vx *= .8; }
    const dx = player.x - c.x, dy = player.y - 30 - c.y, d = Math.hypot(dx, dy) || 1;
    if (c.t > .4 && d < (has('magnet') ? 320 : 170)) { c.x += dx / d * 360 * dt; c.y += dy / d * 360 * dt; c.vy = 0; }
    if (c.t > .3 && d < 26 && player.state !== 'dead') { c.got = 1; coins++; if (!training) runEarned++; saveCoins(); sfx(880, .06, 'sine', .05); }
  }
  drops = drops.filter(c => !c.got && c.t < 20);
  for (let i = bolts.length - 1; i >= 0; i--) if ((bolts[i].l -= dt) <= 0) bolts.splice(i, 1);
  for (const s of shots) {
    s.x += s.vx * dt; s.life -= dt; s.h = s.h || new Set();
    for (const e of enemies) if (e.state !== 'dead' && !s.h.has(e) && Math.abs(e.x - s.x) < (s.big ? 40 : 22) && Math.abs(e.y - 45 - s.y) < 60) {
      s.h.add(e); hurt(e, s.dmg, Math.sign(s.vx), !!s.playerSource);
      if (e.state !== 'dead') { e.state = 'hit'; e.t = 0; e.stun = .35; e.vx = Math.sign(s.vx) * 200; }
      if (s.dot && e.state !== 'dead') { e.dot = 4; e.dps = 12; e.dotPlayer = !!s.playerSource; }
      sparks(e.x, e.y - 50, s.c, 8);
      if (!s.big) { s.life = 0; break; }
    }
  }
  shots = shots.filter(s => s.life > 0 && s.x > -50 && s.x < W + 50);
  if (cyc > 0) {
    cyc -= dt; player.inv = .2;
    if (((cyc * 5) | 0) !== (((cyc + dt) * 5) | 0)) {
      shake = 6; sparks(player.x, player.y - 40, '#d9b36c', 10);
  for (const e of enemies) if (e.state !== 'dead' && Math.abs(e.x - player.x) < 190) { hurt(e, 18, e.x < player.x ? -1 : 1, true); if (e.state !== 'dead') { e.x += (player.x - e.x) * .25; e.vy = -200; e.gr = false; } }
    }
  }
  if (smash && (smash.t -= dt) <= 0) {
    shake = 32; freeze = .1; sparks(smash.x, GY, '#9a8f7a', 40); sparks(smash.x, GY, '#ffd166', 20); sfx(50, .5, 'sawtooth', .12);
  for (const e of enemies) if (e.state !== 'dead' && Math.abs(e.x - smash.x) < 150) { hurt(e, 130, e.x < smash.x ? -1 : 1, true); if (e.state !== 'dead') { e.state = 'hit'; e.t = 0; e.stun = 1; e.vy = -450; e.gr = false; } }
    smash = null;
  }
  if (fury && (fury.t -= dt) <= 0) {
    fury.t = .07; player.inv = .3;
    const e = enemies.filter(x => x.state !== 'dead').sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
    if (!e || --fury.n < 0) fury = null;
    else { player.dir = e.x > player.x ? 1 : -1; player.x = e.x - player.dir * 40; hurt(e, 14, player.dir, true); if (e.state !== 'dead') { e.stun = .2; e.state = 'hit'; e.t = 0; } sparks(e.x, e.y - 50, '#fff', 4); sfx(200 + fury.n * 20, .04, 'square', .05); }
  }
  if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
  if (player.state === 'dead') { if ((overT += dt) > 1.6) gameOver(); return; }
  if (training) { trainUpdate(); return; }
  if (waveWait > 0) { if ((waveWait -= dt) <= 0) nextWave(); return; }
  const alive = enemies.filter(e => e.state !== 'dead').length;
  if (queue.length && alive < Math.min(2 + (wave >> 1), 5) && (spawnT -= dt) <= 0) { spawn(queue.shift()); spawnT = 1.2; }
  if (!queue.length && alive === 0 && rewardedWave !== wave) { banner('Wave clear'); sfx(520, .3, 'sine', .06); openWaveReward(); }
}

// ---------- drawing ----------
let sky;
function setMap(i, persist = true) {
  if (!Number.isInteger(i) || i < 0 || i >= MAPS.length) return;
  mapI = i; const m = MAPS[i]; sky = ctx.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, m.sky[0]); sky.addColorStop(.6, m.sky[1]); sky.addColorStop(1, m.sky[2]);
  setBlocks(); if (persist) saveW(); syncPrefs();
}
function setBlocks() {
  platforms.length = 0;
  if (training || wave >= 3) for (const [x, w, y] of MAPS[mapI].blocks) platforms.push({ x, w, y });
}
setMap(mapI, false);
function hills(off, amp, base, col, f) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, base + Math.sin((x + off) * f) * amp + Math.sin((x + off) * f * 2.3) * amp * .4);
  ctx.lineTo(W, H); ctx.fill();
}
function background() {
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of stars) { ctx.globalAlpha = reducedMotion ? .55 : .4 + .4 * Math.sin(clock * 2 + x); ctx.fillRect(x, y, r, r); }
  ctx.globalAlpha = 1;
  ctx.shadowColor = '#f3d9a4'; ctx.shadowBlur = 50; ctx.fillStyle = '#f6e6c1';
  ctx.beginPath(); ctx.arc(760, 120, 44, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  const px = player ? player.x : W / 2;
  const m = MAPS[mapI]; hills(px * .05, 40, 340, m.h[0], .006); hills(px * .12, 30, 390, m.h[1], .01);
  ctx.fillStyle = m.gr; ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = m.ln; ctx.fillRect(0, GY, W, 3);
  for (const p of platforms) { ctx.fillStyle = m.blk; ctx.fillRect(p.x, p.y, p.w, 16); ctx.fillStyle = m.ln; ctx.fillRect(p.x, p.y, p.w, 3); }
}
function ln(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function limb(x, y, ang, d, l = 21) {
  const mx = x + Math.cos(ang[0]) * l * d, my = y + Math.sin(ang[0]) * l;
  ln(x, y, mx, my); ln(mx, my, mx + Math.cos(ang[1]) * l * d, my + Math.sin(ang[1]) * l);
}
function drawF(f) {
  const d = f.dir, s = f.s, st = f.state, a = (st === 'punch' || st === 'kick') ? f.cur : null;
  const e = a ? Math.sin(Math.PI * Math.min(1, f.t / a.dur)) : 0;
  const moving = Math.abs(f.vx) > 20 && f.gr && st === 'idle';
  const sw = moving ? Math.sin(f.ph) * .7 : 0;
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, GY - f.y + 2, 22 * s, 5, 0, 0, 7); ctx.fill();
  if (st === 'dead') ctx.rotate(-d * Math.min(1, f.t * 4) * 1.45);
  ctx.scale(s, s); ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = 5;
  ctx.strokeStyle = ctx.fillStyle = f.flash > 0 ? '#fff' : f.slow > 0 ? '#9fe8ff' : f.c;
  const lean = st === 'punch' ? 7 : st === 'kick' ? -7 : st === 'hit' ? -10 : f.blocking ? -3 : 0;
  const hip = -42 + (st === 'idle' && f.gr && !moving ? Math.sin(clock * 4 + f.x) * .6 : 0);
  const nx = lean * d, ny = hip - 34, sy = ny + 5;
  let fl = [1.45 + sw, 1.5 + sw * .3], bl = [1.7 - sw, 1.65 - sw * .3], fa = [.6 + sw * .5, -1.1], ba = [.9 - sw * .5, -.8];
  if (!f.gr && st === 'idle') { fl = [1, 1.9]; bl = [1.9, 1.3]; fa = [-.5, -1.3]; ba = [-.2, -1.4]; }
  if (f.blocking) { fa = [.2, -1.5]; ba = [.35, -1.4]; }
  if (st === 'punch') fa = [.6 * (1 - e) - .05 * e, -1.1 * (1 - e)];
  if (st === 'kick') fl = [1.45 - 1.65 * e, 1.5 - 1.65 * e];
  if (st === 'hit' || st === 'dead') { fa = [2, 2.4]; ba = [2.4, 2.6]; fl = [1.2, 1.9]; bl = [1.9, 1.5]; }
  ctx.globalAlpha = .7; limb(0, hip, bl, d); limb(nx, sy, ba, d, 17); ctx.globalAlpha = 1;
  ln(0, hip, nx, ny); limb(0, hip, fl, d); limb(nx, sy, fa, d, 17);
  if (f.isP && weapon().len) {
    const w = weapon(), mx = nx + Math.cos(fa[0]) * 17 * d, my = sy + Math.sin(fa[0]) * 17;
    const hx = mx + Math.cos(fa[1]) * 17 * d, hy = my + Math.sin(fa[1]) * 17;
    const tx = hx + Math.cos(fa[1]) * w.len * d, ty = hy + Math.sin(fa[1]) * w.len;
    ctx.strokeStyle = w.c; ctx.fillStyle = w.c; ctx.lineCap = 'round';
    if (w.id === 'staff' || w.id === 'flame') {
      ctx.lineWidth = w.id === 'staff' ? 7 : 6; ln(hx, hy, tx, ty);
      if (w.id === 'flame') { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - d * 17, ty - 8); ctx.lineTo(tx - d * 17, ty + 8); ctx.closePath(); ctx.fill(); }
    } else if (w.id === 'daggers') {
      ctx.lineWidth = 3; ln(hx, hy, tx, ty); ln(hx - d * 7, hy + 5, tx - d * 7, ty + 5);
    } else if (w.id === 'nunchucks') {
      ctx.lineWidth = 6; ln(hx, hy, hx + d * 15, hy + 8); ctx.lineWidth = 2; ln(hx + d * 15, hy + 8, tx, ty); ctx.lineWidth = 6; ln(tx, ty, tx + d * 15, ty - 8);
    } else if (w.id === 'hammer') {
      ctx.lineWidth = 6; ln(hx, hy, tx, ty); ctx.save(); ctx.translate(tx, ty); ctx.rotate(-.3 * d); ctx.fillRect(-13, -9, 27, 18); ctx.restore();
    } else if (w.id === 'scythe') {
      ctx.lineWidth = 5; ln(hx, hy, tx - d * 16, ty + 8); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx - d * 8, ty - 10, 24, Math.PI * .15, Math.PI * .95, d < 0); ctx.stroke();
    } else if (w.id === 'thunder') {
      ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 7); ctx.stroke(); ctx.fillRect(tx - 5, ty - 5, 10, 10);
    } else {
      ctx.lineWidth = w.id === 'frost' ? 5 : 4; ln(hx, hy, tx, ty);
      if (w.id === 'frost') { ln(tx, ty, tx - d * 7, ty + 11); ln(tx, ty, tx + d * 4, ty + 10); }
      else if (w.id === 'katana') { ctx.lineWidth = 1.5; ln(hx + d * 3, hy - 3, tx + d * 3, ty - 3); }
    }
  }
  if (f.isP && a && e > .25) {
    ctx.save(); ctx.translate(0, -45); ctx.scale(d, 1); ctx.globalAlpha = .24 + .25 * e;
    ctx.strokeStyle = weapon().c; ctx.lineWidth = weapon().id === 'hammer' ? 9 : 5;
    ctx.beginPath(); ctx.arc(8, 0, f.cur.reach + 14, -.8, .8); ctx.stroke(); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(nx + d * 2, ny - 11, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#0b0d17'; ctx.beginPath(); ctx.arc(nx + d * 7, ny - 13, 2, 0, 7); ctx.fill();
  if (f.isP) {
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx, ny - 2);
    ctx.quadraticCurveTo(nx - d * 14, ny - 3 + Math.sin(clock * 10) * 3, nx - d * (26 + Math.abs(f.vx) * .05), ny + 4 + Math.sin(clock * 9) * 4); ctx.stroke();
  }
  if (f.blocking) {
    ctx.save(); ctx.scale(d, 1); ctx.strokeStyle = 'rgba(127,208,255,.65)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(lean + 8, -60, 34, -1, 1); ctx.stroke(); ctx.restore();
  }
  if (!f.isP && f.state === 'windup') {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 24px sans-serif'; ctx.fillStyle = f.type === 'boss' ? '#ffb703' : '#ff6b57'; ctx.fillText(f.type === 'boss' ? '!!' : '!', 0, -118); ctx.restore();
  }
  ctx.restore();
  if (!f.isP && st !== 'dead') {
    const w = 44 * s, x = f.x - w / 2, y = f.y - 100 * s;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = f.c; ctx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 5);
  }
}
function bar(x, y, w, h, p, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, p)), h); }
function hud() {
  if (!player || mode === 'menu') return;
  const rightHud = W - 180;
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(20, 18, 312, 26);
  bar(26, 24, 300, 14, player.ghost / player.max, '#ffffff88'); bar(26, 24, 300, 14, player.hp / player.max, '#ff4d6d');
  const full = ult >= 100;
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(20, 46, 212, 14);
  bar(24, 49, 204, 8, ult / 100, full && Math.sin(clock * 12) > 0 ? '#fff3b0' : '#ffd166');
  ctx.fillStyle = '#f3efe6'; ctx.font = '700 12px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left';
  ctx.fillText((full ? 'Ultimate ready (U)' : 'Ultimate') + '  |  ' + weapon().name, 238, 58);
  if (training) {
    ctx.font = '700 14px "Trebuchet MS", sans-serif';
    TRAIN.forEach(([k, label], i) => { ctx.fillStyle = done[k] ? '#7fe0a0' : '#f3efe6'; ctx.globalAlpha = done[k] ? 1 : .75; ctx.fillText((done[k] ? '\u2713 ' : '\u25cb ') + label, 24, 86 + i * 20); });
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffd166'; ctx.fillText('T or +Foe: add a fighter (grunt, ninja, brute, boss)', 24, 96 + TRAIN.length * 20);
  }
  ctx.fillStyle = '#f3efe6'; ctx.textAlign = 'right'; ctx.font = 'italic 900 22px "Trebuchet MS", sans-serif';
  ctx.fillText(training ? 'Training' : `Wave ${wave}`, rightHud, 36);
  ctx.font = '700 11px "Trebuchet MS", sans-serif'; ctx.fillText(MAPS[mapI].name, rightHud, 100);
  ctx.font = '700 16px "Trebuchet MS", sans-serif'; ctx.fillText(`${score} pts  \u00b7  best ${Math.max(best, score)}`, rightHud, 58);
  const ct = String(coins), cw = ctx.measureText(ct).width;
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(rightHud - cw - 12, 76, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#f3efe6'; ctx.fillText(ct, rightHud, 82);
  ctx.textAlign = 'center';
  if (combo > 1) { ctx.font = `italic 900 ${28 + Math.min(combo, 12)}px "Trebuchet MS", sans-serif`; ctx.fillStyle = '#ffd166'; ctx.fillText(`${combo} hit combo`, W / 2, 90); }
  if (bannerT > 0) {
    ctx.globalAlpha = reducedMotion ? 1 : Math.min(1, bannerT * 2); ctx.fillStyle = '#fff'; ctx.font = 'italic 900 56px "Trebuchet MS", sans-serif';
    ctx.fillText(bannerText, W / 2, 200); ctx.globalAlpha = 1;
  }
  if (mode === 'play' && wave <= 2) {
    ctx.globalAlpha = .6; ctx.fillStyle = '#f3efe6'; ctx.font = '700 15px "Trebuchet MS", sans-serif';
    ctx.fillText('A / D move    W jump    J punch    K kick    L block    Shift dash    U ultimate', W / 2, H - 22); ctx.globalAlpha = 1;
  }
  if (storageWarning && mode === 'play') { ctx.globalAlpha = .8; ctx.fillStyle = '#ffd166'; ctx.font = '700 11px "Trebuchet MS", sans-serif'; ctx.fillText('Save warning · open menu for details', W / 2, H - 8); ctx.globalAlpha = 1; }
  ctx.textAlign = 'left';
}
function draw() {
  ctx.save();
  if (shake > 0 && !reducedMotion) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  background();
  enemies.forEach(drawF); if (player) drawF(player);
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.l / p.m); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.r, p.r); }
  ctx.globalAlpha = 1;
  for (const c of drops) { ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, 7); ctx.fill(); ctx.stroke(); }
  for (const s of shots) {
    ctx.strokeStyle = ctx.fillStyle = s.c;
    if (s.big) { ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } else { ctx.lineWidth = 4; ln(s.x, s.y, s.x - Math.sign(s.vx) * 22, s.y); }
  }
  if (smash) { ctx.strokeStyle = 'rgba(255,77,109,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(smash.x, GY + 2, 150, 26, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(smash.x, GY + 2, 150 * (1 - smash.t / .55), 26 * (1 - smash.t / .55), 0, 0, 7); ctx.stroke(); }
  for (const e of enemies) if (e.type === 'boss' && (e.state === 'windup' || e.state === 'slam')) {
    ctx.save(); ctx.fillStyle = e.state === 'slam' ? 'rgba(255,183,3,.34)' : 'rgba(255,77,109,.2)'; ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(e.windupTarget, GY + 1, 98, 22, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.windupTarget - 98, GY - 5); ctx.lineTo(e.windupTarget + 98, GY - 5); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
  for (const b of bolts) { const jitter = reducedMotion ? 0 : 30; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo((b.x1 + b.x2) / 2 + (Math.random() - .5) * jitter, (b.y1 + b.y2) / 2 + (Math.random() - .5) * jitter); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
  if (ring > 0 && player && !reducedMotion) { ctx.strokeStyle = `rgba(255,209,102,${ring * 2})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(player.x, player.y - 40, (.5 - ring) * 700, 0, 7); ctx.stroke(); }
  ctx.restore(); hud();
}

// ---------- main loop ----------
player = new Fighter(W / 2, GY, 'hero', true);
let last = 0;
(function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode !== 'pause') clock += dt;
  draw(); requestAnimationFrame(loop);
})(0);
})();
