// MJ Sound Machine — a grid of pads that play short synthesized sounds.
// Each pad can be replaced by dropping an audio file onto it; the file is
// stored in localStorage (as base64) so it persists across reloads.

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

const PADS = [
  { id: "hee", label: "Hee-hee!", synth: heeHee },
  { id: "shamone", label: "Shamone!", synth: shamone },
  { id: "ow", label: "Ow!", synth: ow },
  { id: "woo", label: "Woo!", synth: woo },
  { id: "snap", label: "Finger Snap", synth: snap },
  { id: "kick", label: "Kick", synth: kick },
  { id: "snare", label: "Snare", synth: snare },
  { id: "hat", label: "Hi-Hat", synth: hat },
  { id: "bass", label: "Bass Stab", synth: bassStab },
  { id: "whoosh", label: "Moonwalk", synth: whoosh },
  { id: "creak", label: "Thriller Creak", synth: creak },
  { id: "chime", label: "Billie Chime", synth: chime },
];

let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ---- Synth helpers -------------------------------------------------------

function envGain(ctx, { attack = 0.005, release = 0.2, peak = 0.8 } = {}) {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  return g;
}

function noiseBuffer(ctx, duration = 0.3) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function connect(nodes, destination) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  nodes[nodes.length - 1].connect(destination);
}

// ---- The 12 synth voices -------------------------------------------------

function heeHee(ctx, out) {
  // Quick two-note vocal-ish chirp
  const notes = [880, 1320];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const g = envGain(ctx, { attack: 0.01, release: 0.12, peak: 0.35 });
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = freq;
    filt.Q.value = 6;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    osc.frequency.exponentialRampToValueAtTime(
      freq * 1.2,
      ctx.currentTime + i * 0.12 + 0.08,
    );
    connect([osc, filt, g], out);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.15);
  });
}

function shamone(ctx, out) {
  // Syllable-ish pulse pair, low-mid then higher
  [260, 420].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1200;
    const g = envGain(ctx, { attack: 0.015, release: 0.18, peak: 0.3 });
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
    connect([osc, filt, g], out);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.22);
  });
}

function ow(ctx, out) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = 700;
  filt.Q.value = 4;
  const g = envGain(ctx, { attack: 0.005, release: 0.22, peak: 0.32 });
  osc.frequency.setValueAtTime(520, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.22);
  connect([osc, filt, g], out);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function woo(ctx, out) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  const g = envGain(ctx, { attack: 0.02, release: 0.3, peak: 0.3 });
  osc.frequency.setValueAtTime(320, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(940, ctx.currentTime + 0.28);
  connect([osc, g], out);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
}

function snap(ctx, out) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.08);
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = 4000;
  const g = envGain(ctx, { attack: 0.001, release: 0.06, peak: 0.6 });
  connect([src, filt, g], out);
  src.start();
  src.stop(ctx.currentTime + 0.08);
}

function kick(ctx, out) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const g = envGain(ctx, { attack: 0.002, release: 0.25, peak: 0.9 });
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.2);
  connect([osc, g], out);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function snare(ctx, out) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.2);
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = 1500;
  const g = envGain(ctx, { attack: 0.001, release: 0.18, peak: 0.55 });
  connect([src, filt, g], out);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 220;
  const og = envGain(ctx, { attack: 0.001, release: 0.1, peak: 0.25 });
  connect([osc, og], out);

  src.start();
  src.stop(ctx.currentTime + 0.2);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

function hat(ctx, out) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.06);
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = 7000;
  const g = envGain(ctx, { attack: 0.001, release: 0.05, peak: 0.35 });
  connect([src, filt, g], out);
  src.start();
  src.stop(ctx.currentTime + 0.06);
}

function bassStab(ctx, out) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 700;
  const g = envGain(ctx, { attack: 0.005, release: 0.25, peak: 0.4 });
  osc.frequency.setValueAtTime(82, ctx.currentTime);
  connect([osc, filt, g], out);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function whoosh(ctx, out) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.6);
  const filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.Q.value = 1.5;
  filt.frequency.setValueAtTime(400, ctx.currentTime);
  filt.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.55);
  const g = envGain(ctx, { attack: 0.05, release: 0.55, peak: 0.45 });
  connect([src, filt, g], out);
  src.start();
  src.stop(ctx.currentTime + 0.6);
}

function creak(ctx, out) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.Q.value = 8;
  filt.frequency.value = 600;
  const g = envGain(ctx, { attack: 0.03, release: 0.7, peak: 0.25 });
  osc.frequency.setValueAtTime(110, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(175, ctx.currentTime + 0.7);
  // Slow amplitude wobble for creaky feel
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 11;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.15;
  lfo.connect(lfoGain).connect(g.gain);
  connect([osc, filt, g], out);
  osc.start();
  lfo.start();
  osc.stop(ctx.currentTime + 0.8);
  lfo.stop(ctx.currentTime + 0.8);
}

function chime(ctx, out) {
  // A bright two-note bell pattern reminiscent of the Billie Jean intro line
  [466.16, 392.0].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const g = envGain(ctx, { attack: 0.005, release: 0.5, peak: 0.28 });
    osc.frequency.value = freq;
    connect([osc, g], out);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.6);
  });
}

// ---- Persistence for user-supplied samples ------------------------------

const STORAGE_KEY = "mj-sound-machine:samples:v1";

function loadCustomSamples() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCustomSamples(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Could not persist sample (likely too large):", err);
  }
}

const customSamples = loadCustomSamples(); // id -> dataURL
const decoded = {}; // id -> AudioBuffer

async function decodeFromDataURL(dataURL) {
  const ctx = getCtx();
  const res = await fetch(dataURL);
  const buf = await res.arrayBuffer();
  return await ctx.decodeAudioData(buf);
}

async function ensureDecoded(id) {
  if (decoded[id]) return decoded[id];
  const dataURL = customSamples[id];
  if (!dataURL) return null;
  try {
    decoded[id] = await decodeFromDataURL(dataURL);
    return decoded[id];
  } catch (err) {
    console.warn("Could not decode stored sample for", id, err);
    return null;
  }
}

function playBuffer(ctx, out, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(out);
  src.start();
}

// ---- Pad wiring ----------------------------------------------------------

function createPad(def, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pad";
  btn.dataset.id = def.id;
  btn.innerHTML = `
    <span class="hint-key">${KEYS[index] || ""}</span>
    <span class="badge">custom</span>
    <span class="label">${def.label}</span>
  `;
  if (customSamples[def.id]) btn.classList.add("custom");
  return btn;
}

async function triggerPad(def, btn) {
  const ctx = getCtx();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const custom = await ensureDecoded(def.id);
  if (custom) {
    playBuffer(ctx, master, custom);
  } else {
    def.synth(ctx, master);
  }

  btn.classList.add("is-playing");
  // Re-trigger the animation even if the pad is already playing
  setTimeout(() => btn.classList.remove("is-playing"), 260);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function attachFileToPad(def, btn, file) {
  if (!file || !file.type.startsWith("audio/")) return;
  const dataURL = await readFileAsDataURL(file);
  customSamples[def.id] = dataURL;
  delete decoded[def.id];
  try {
    await ensureDecoded(def.id);
  } catch {
    // ignore; fallback to synth next time
  }
  saveCustomSamples(customSamples);
  btn.classList.add("custom");
}

function resetPad(def, btn) {
  delete customSamples[def.id];
  delete decoded[def.id];
  saveCustomSamples(customSamples);
  btn.classList.remove("custom");
}

function init() {
  const grid = document.getElementById("pad-grid");
  const byKey = new Map();

  PADS.forEach((def, i) => {
    const btn = createPad(def, i);
    grid.appendChild(btn);
    if (KEYS[i]) byKey.set(KEYS[i], { def, btn });

    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      triggerPad(def, btn);
    });

    btn.addEventListener("dblclick", () => resetPad(def, btn));

    btn.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      btn.classList.add("dragover");
    });
    btn.addEventListener("dragleave", () => btn.classList.remove("dragover"));
    btn.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      btn.classList.remove("dragover");
      const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
      await attachFileToPad(def, btn, file);
    });
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    const hit = byKey.get(ev.key);
    if (!hit) return;
    triggerPad(hit.def, hit.btn);
  });

  // Warm up decoding for any saved samples
  Object.keys(customSamples).forEach((id) => ensureDecoded(id));
}

document.addEventListener("DOMContentLoaded", init);
