import { connect } from './net.js';

const W = 800, H = 600, PW = 10, PH = 100, BALL = 12, LX = 20, RX = 770;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const url = params.get('ws') || `ws://${location.hostname}:8000/ws`;

// latest server state + interpolated render state
let target = null;
let shown = null;
const clone = (s) => ({ ball: { ...s.ball }, paddles: { ...s.paddles } });

const net = connect({
  url,
  onState(s) {
    target = s;
    if (!shown) shown = clone(s);
    window.__pongStates = (window.__pongStates || 0) + 1;
  },
  onStatus(st, attempt, delay) {
    statusEl.className = 'status ' + st;
    statusEl.textContent = st === 'connected' ? 'Connected'
      : st === 'connecting' ? (attempt ? 'Reconnecting...' : 'Connecting...')
      : `Disconnected - retrying in ${(delay / 1000).toFixed(1)}s`;
  },
});

// ---- input ----
const UP = new Set(['w', 'W', 'ArrowUp']), DOWN = new Set(['s', 'S', 'ArrowDown']);
const held = []; // ordered, most recent last
let lastDir = 0;
function sendDir() {
  let dir = 0;
  const last = held[held.length - 1];
  if (last) dir = UP.has(last) ? -1 : 1;
  if (dir !== lastDir) { lastDir = dir; net.send({ type: 'input', dir }); }
}
addEventListener('keydown', (e) => {
  if (UP.has(e.key) || DOWN.has(e.key)) {
    e.preventDefault();
    if (!held.includes(e.key)) held.push(e.key);
    sendDir();
  } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
    e.preventDefault();
    if (target && target.winner) net.send({ type: 'reset' });
  }
});
addEventListener('keyup', (e) => {
  const i = held.indexOf(e.key);
  if (i >= 0) { held.splice(i, 1); sendDir(); }
});
addEventListener('blur', () => { held.length = 0; sendDir(); });

// ---- sizing ----
let scale = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.min(innerWidth / W, innerHeight / H) * 0.96;
  canvas.style.width = W * s + 'px';
  canvas.style.height = H * s + 'px';
  canvas.width = Math.round(W * s * dpr);
  canvas.height = Math.round(H * s * dpr);
  scale = canvas.width / W;
}
addEventListener('resize', resize);
resize();

// ---- render ----
let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (target && shown) {
    // frame-rate independent smoothing; snap on big jumps (e.g. after a point)
    const k = 1 - Math.exp(-dt * 40);
    const lerp = (a, b) => (Math.abs(b - a) > 200 ? b : a + (b - a) * k);
    shown.ball.x = lerp(shown.ball.x, target.ball.x);
    shown.ball.y = lerp(shown.ball.y, target.ball.y);
    shown.paddles.left = lerp(shown.paddles.left, target.paddles.left);
    shown.paddles.right = lerp(shown.paddles.right, target.paddles.right);
  }
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  ctx.setLineDash([12, 12]);
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('You', W / 4, 24);
  ctx.fillText('CPU', (3 * W) / 4, 24);

  if (!target) {
    ctx.fillStyle = '#aaa';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Waiting for game...', W / 2, H / 2);
    return;
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px monospace';
  ctx.fillText(String(target.score.left), W / 4, 90);
  ctx.fillText(String(target.score.right), (3 * W) / 4, 90);

  ctx.fillRect(LX, shown.paddles.left, PW, PH);
  ctx.fillRect(RX, shown.paddles.right, PW, PH);
  ctx.fillRect(shown.ball.x, shown.ball.y, BALL, BALL);

  if (target.winner) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText(target.winner === 'left' ? 'You win!' : 'CPU wins', W / 2, H / 2 - 10);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Press Space to play again', W / 2, H / 2 + 35);
  }
}
requestAnimationFrame(frame);
