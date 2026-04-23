// MJ Sound Machine — a grid of pads that play short synthesized sounds.
// When Firebase is configured, the owner can upload short audio clips that
// are stored inline (base64) in Firestore so every visitor hears them.
// Otherwise the app falls back to saving drag-dropped files in localStorage
// for the current browser only.

import { firebaseConfig, ownerUid, isConfigured } from "./firebase-config.js";

const FIREBASE_VERSION = "10.12.0";
const PADS_COLLECTION = "pads";
// ~786 KB of raw audio fits in a 1 MiB Firestore doc after base64 inflation.
// 500 KB gives comfortable headroom for JSON overhead.
const MAX_UPLOAD_BYTES = 500 * 1024;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

// ---- Web Audio plumbing -------------------------------------------------

let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
    // Safari keeps output silent until a sample plays, even after resume().
    // Kick the pipeline with a one-sample zero buffer so the next scheduled
    // audio is actually heard.
    try {
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    } catch {
      // some browsers may throw if called pre-gesture; harmless
    }
  }
  return audioCtx;
}

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

// ---- Synth voices --------------------------------------------------------

function heeHee(ctx, out) {
  [880, 1320].forEach((freq, i) => {
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

// ---- Sample cache --------------------------------------------------------

const LOCAL_SAMPLES_KEY = "mj-sound-machine:samples:v1";
const LOCAL_LABELS_KEY = "mj-sound-machine:labels:v1";
const LOCAL_ORDER_KEY = "mj-sound-machine:order:v1";
const HOLD_RESET_MS = 5000;
const DRAG_THRESHOLD_PX = 8;
const localSamples = loadLocalJSON(LOCAL_SAMPLES_KEY); // id -> dataURL
const localLabels = loadLocalJSON(LOCAL_LABELS_KEY); // id -> label
const decoded = new Map(); // id -> { key, buffer }  (key invalidates on change)
const pendingDecodes = new Map(); // id -> Promise
const holdTimers = new WeakMap(); // btn -> timeoutId

function loadLocalJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveLocalJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Could not persist ${key}:`, err);
  }
}

function saveLocalSamples() {
  saveLocalJSON(LOCAL_SAMPLES_KEY, localSamples);
}

function saveLocalLabels() {
  saveLocalJSON(LOCAL_LABELS_KEY, localLabels);
}

async function decodeFromSource(source) {
  const ctx = getCtx();
  const res = await fetch(source);
  const buf = await res.arrayBuffer();
  return await ctx.decodeAudioData(buf);
}

function ensureDecoded(id, source, key) {
  const cached = decoded.get(id);
  if (cached && cached.key === key) return Promise.resolve(cached.buffer);
  const pending = pendingDecodes.get(id);
  if (pending && pending.key === key) return pending.promise;

  const promise = decodeFromSource(source)
    .then((buffer) => {
      decoded.set(id, { key, buffer });
      pendingDecodes.delete(id);
      return buffer;
    })
    .catch((err) => {
      pendingDecodes.delete(id);
      console.warn("Could not decode sample for", id, err);
      return null;
    });
  pendingDecodes.set(id, { key, promise });
  return promise;
}

function playBuffer(ctx, out, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(out);
  src.start();
}

// ---- Pad DOM + triggering -----------------------------------------------

function createPad(def, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pad";
  btn.dataset.id = def.id;
  btn.innerHTML = `
    <span class="hint-key">${KEYS[index] || ""}</span>
    <span class="badge">custom</span>
    <span class="label">${def.label}</span>
    <span class="hold-progress" aria-hidden="true"></span>
    <span class="edit-btn" role="button" tabindex="-1" aria-label="Rename pad">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
    </span>
  `;
  return btn;
}

function setPadCustom(btn, isCustom) {
  btn.classList.toggle("custom", Boolean(isCustom));
}

function setPadEditable(btn, canEdit) {
  btn.classList.toggle("can-edit", Boolean(canEdit));
}

function setPadLabel(btn, text) {
  const node = btn.querySelector(".label");
  if (node && node.textContent !== text) node.textContent = text;
}

function startHold(btn, onFire) {
  cancelHold(btn);
  // Force-reflow so the progress animation restarts on rapid re-holds.
  btn.classList.remove("holding");
  void btn.offsetWidth;
  btn.classList.add("holding");
  const timer = setTimeout(() => {
    cancelHold(btn);
    onFire();
  }, HOLD_RESET_MS);
  holdTimers.set(btn, timer);
}

function cancelHold(btn) {
  const t = holdTimers.get(btn);
  if (t) clearTimeout(t);
  holdTimers.delete(btn);
  btn.classList.remove("holding");
}

function promptRename(currentLabel) {
  const next = window.prompt("New label for this pad:", currentLabel);
  if (next === null) return null;
  const trimmed = next.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40);
}

function sanitizeOrder(order, defaults) {
  const valid = new Set(defaults);
  const seen = new Set();
  const out = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      if (valid.has(id) && !seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function applyOrderToGrid(grid, order, padsById) {
  order.forEach((id) => {
    const btn = padsById.get(id);
    if (btn) grid.appendChild(btn);
  });
}

function swapInOrder(order, aId, bId) {
  const next = order.slice();
  const ai = next.indexOf(aId);
  const bi = next.indexOf(bId);
  if (ai < 0 || bi < 0 || ai === bi) return next;
  [next[ai], next[bi]] = [next[bi], next[ai]];
  return next;
}

async function triggerPad(def, btn, remoteSamples) {
  const ctx = getCtx();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const remote = remoteSamples[def.id];
  let buffer = null;
  if (remote && remote.source) {
    buffer = await ensureDecoded(def.id, remote.source, remote.key);
  } else if (localSamples[def.id]) {
    buffer = await ensureDecoded(
      def.id,
      localSamples[def.id],
      "local:" + def.id,
    );
  }

  if (buffer) playBuffer(ctx, master, buffer);
  else def.synth(ctx, master);

  btn.classList.add("is-playing");
  setTimeout(() => btn.classList.remove("is-playing"), 260);
}

// ---- Firebase-backed storage --------------------------------------------

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function loadFirebaseModules() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [app, auth, firestore] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  return { app, auth, firestore };
}

// ---- App wiring ----------------------------------------------------------

function initLocalOnlyMode(ctx) {
  const { padRefs, grid, padsById, defaultOrder } = ctx;
  const hint = document.getElementById("storage-hint");
  hint.textContent =
    "Running in local-only mode — drag-dropped sounds are saved to this browser only. Add your Firebase config to enable cloud sharing.";

  let currentOrder = sanitizeOrder(
    loadLocalJSON(LOCAL_ORDER_KEY),
    defaultOrder,
  );
  applyOrderToGrid(grid, currentOrder, padsById);

  function resetLocal(def, btn) {
    delete localSamples[def.id];
    delete localLabels[def.id];
    decoded.delete(def.id);
    saveLocalSamples();
    saveLocalLabels();
    setPadCustom(btn, false);
    setPadLabel(btn, def.label);
  }

  function renameLocal(def, btn) {
    const current = localLabels[def.id] || def.label;
    const next = promptRename(current);
    if (next === null || next === current) return;
    localLabels[def.id] = next;
    saveLocalLabels();
    setPadLabel(btn, next);
  }

  function reorderLocal(aId, bId) {
    currentOrder = swapInOrder(currentOrder, aId, bId);
    saveLocalJSON(LOCAL_ORDER_KEY, currentOrder);
    applyOrderToGrid(grid, currentOrder, padsById);
  }

  padRefs.forEach(({ def, btn }) => {
    setPadCustom(btn, Boolean(localSamples[def.id]));
    setPadLabel(btn, localLabels[def.id] || def.label);
    setPadEditable(btn, true);

    btn.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      btn.classList.add("dragover");
    });
    btn.addEventListener("dragleave", () => btn.classList.remove("dragover"));
    btn.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      btn.classList.remove("dragover");
      const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!file || !file.type.startsWith("audio/")) return;
      const dataURL = await readFileAsDataURL(file);
      localSamples[def.id] = dataURL;
      decoded.delete(def.id);
      saveLocalSamples();
      setPadCustom(btn, true);
    });
  });

  return {
    getRemoteSamples: () => ({}),
    resetPad: resetLocal,
    renamePad: renameLocal,
    reorderPads: reorderLocal,
    canEdit: () => true,
  };
}

async function initFirebaseMode(ctx) {
  const { padRefs, grid, padsById, defaultOrder } = ctx;
  const hint = document.getElementById("storage-hint");
  const authBar = document.getElementById("auth-bar");
  const authStatus = document.getElementById("auth-status");
  const authButton = document.getElementById("auth-button");
  authBar.hidden = false;

  let modules;
  try {
    modules = await loadFirebaseModules();
  } catch (err) {
    console.error("Failed to load Firebase SDK:", err);
    hint.textContent =
      "Could not load Firebase SDK — falling back to local-only mode.";
    hint.classList.add("error");
    authBar.hidden = true;
    return initLocalOnlyMode(ctx);
  }

  const { initializeApp } = modules.app;
  const {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
  } = modules.auth;
  const {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    setDoc,
    deleteDoc,
    serverTimestamp,
  } = modules.firestore;

  const fbApp = initializeApp(firebaseConfig);
  const auth = getAuth(fbApp);
  const db = getFirestore(fbApp);
  const provider = new GoogleAuthProvider();
  const padsCol = collection(db, PADS_COLLECTION);
  const orderDoc = doc(db, "meta", "order");

  let remoteSamples = {}; // id -> { source: dataUrl, key }
  let currentUser = null;
  let currentOrder = defaultOrder.slice();
  applyOrderToGrid(grid, currentOrder, padsById);

  function isOwner(user) {
    if (!user) return false;
    if (!ownerUid) return true; // unlocked: any signed-in user counts
    return user.uid === ownerUid;
  }

  function renderAuth() {
    if (!currentUser) {
      authStatus.textContent = "Sign in to upload sounds";
      authStatus.classList.remove("owner");
      authButton.textContent = "Sign in";
    } else if (isOwner(currentUser)) {
      authStatus.textContent = `${currentUser.displayName || currentUser.email || "Owner"} — uploads enabled`;
      authStatus.classList.add("owner");
      authButton.textContent = "Sign out";
    } else {
      authStatus.textContent = `Signed in as ${currentUser.displayName || currentUser.email} (viewer)`;
      authStatus.classList.remove("owner");
      authButton.textContent = "Sign out";
    }

    const editable = isOwner(currentUser);
    padRefs.forEach(({ btn }) => {
      btn.title = editable
        ? "Drop an audio file to replace this pad"
        : "Tap to play";
      setPadEditable(btn, editable);
    });
  }

  authButton.addEventListener("click", async () => {
    try {
      if (currentUser) await signOut(auth);
      else await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      hint.textContent = `Auth error: ${err.message}`;
      hint.classList.add("error");
    }
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    renderAuth();
  });

  const remoteLabels = {}; // id -> label string

  onSnapshot(
    padsCol,
    (snap) => {
      const nextSamples = {};
      const nextLabels = {};
      snap.forEach((padDoc) => {
        const data = padDoc.data() || {};
        if (data.dataUrl) {
          nextSamples[padDoc.id] = {
            source: data.dataUrl,
            key: data.key || padDoc.id + ":" + (data.updatedAt?.seconds || ""),
          };
        }
        if (typeof data.label === "string" && data.label.trim()) {
          nextLabels[padDoc.id] = data.label;
        }
      });
      remoteSamples = nextSamples;
      Object.keys(remoteLabels).forEach((k) => delete remoteLabels[k]);
      Object.assign(remoteLabels, nextLabels);

      padRefs.forEach(({ def, btn }) => {
        const hasRemote = Boolean(remoteSamples[def.id]);
        setPadCustom(btn, hasRemote || Boolean(localSamples[def.id]));
        setPadLabel(btn, remoteLabels[def.id] || def.label);
        if (hasRemote) {
          // Warm the decoder so the first tap is instant.
          ensureDecoded(
            def.id,
            remoteSamples[def.id].source,
            remoteSamples[def.id].key,
          );
        }
      });
    },
    (err) => {
      console.error("Firestore subscription failed:", err);
      hint.textContent = `Could not load cloud sounds: ${err.message}`;
      hint.classList.add("error");
    },
  );

  async function uploadToPad(def, btn, file) {
    if (!isOwner(currentUser)) {
      hint.textContent = "Sign in as the owner to upload sounds.";
      hint.classList.add("error");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      hint.textContent = "Only audio files can be uploaded.";
      hint.classList.add("error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const kb = Math.round(MAX_UPLOAD_BYTES / 1024);
      hint.textContent = `File is larger than ${kb} KB. Trim or re-encode it first.`;
      hint.classList.add("error");
      return;
    }

    btn.classList.add("uploading");
    try {
      const dataUrl = await readFileAsDataURL(file);
      const key = String(Date.now());
      await setDoc(
        doc(padsCol, def.id),
        {
          dataUrl,
          contentType: file.type,
          key,
          updatedAt: serverTimestamp(),
          uploadedBy: currentUser.uid,
        },
        { merge: true },
      );

      hint.textContent = `Uploaded "${file.name}" to ${def.label}.`;
      hint.classList.remove("error");
    } catch (err) {
      console.error(err);
      hint.textContent = `Upload failed: ${err.message}`;
      hint.classList.add("error");
    } finally {
      btn.classList.remove("uploading");
    }
  }

  async function resetPad(def, btn) {
    if (!isOwner(currentUser)) return;
    try {
      await deleteDoc(doc(padsCol, def.id));
      decoded.delete(def.id);
      setPadCustom(btn, false);
      setPadLabel(btn, def.label);
    } catch (err) {
      console.error(err);
      hint.textContent = `Reset failed: ${err.message}`;
      hint.classList.add("error");
    }
  }

  async function reorderPads(aId, bId) {
    if (!isOwner(currentUser)) return;
    const next = swapInOrder(currentOrder, aId, bId);
    try {
      await setDoc(
        orderDoc,
        {
          sequence: next,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        },
        { merge: true },
      );
    } catch (err) {
      console.error(err);
      hint.textContent = `Reorder failed: ${err.message}`;
      hint.classList.add("error");
    }
  }

  onSnapshot(
    orderDoc,
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const seq = data && Array.isArray(data.sequence) ? data.sequence : null;
      currentOrder = sanitizeOrder(seq, defaultOrder);
      applyOrderToGrid(grid, currentOrder, padsById);
    },
    (err) => {
      console.warn("Order subscription failed:", err);
    },
  );

  async function renamePad(def, btn) {
    if (!isOwner(currentUser)) {
      hint.textContent = "Sign in as the owner to rename pads.";
      hint.classList.add("error");
      return;
    }
    const current = remoteLabels[def.id] || def.label;
    const next = promptRename(current);
    if (next === null || next === current) return;
    try {
      await setDoc(
        doc(padsCol, def.id),
        {
          label: next,
          updatedAt: serverTimestamp(),
          uploadedBy: currentUser.uid,
        },
        { merge: true },
      );
      hint.textContent = `Renamed to "${next}".`;
      hint.classList.remove("error");
    } catch (err) {
      console.error(err);
      hint.textContent = `Rename failed: ${err.message}`;
      hint.classList.add("error");
    }
  }

  padRefs.forEach(({ def, btn }) => {
    btn.addEventListener("dragover", (ev) => {
      if (!isOwner(currentUser)) return;
      ev.preventDefault();
      btn.classList.add("dragover");
    });
    btn.addEventListener("dragleave", () => btn.classList.remove("dragover"));
    btn.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      btn.classList.remove("dragover");
      const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!file) return;
      await uploadToPad(def, btn, file);
    });
  });

  hint.textContent =
    "Cloud mode active. Sign in as the owner, then drag an audio file (under 500 KB) onto any pad to upload it.";
  hint.classList.remove("error");

  return {
    getRemoteSamples: () => remoteSamples,
    resetPad,
    renamePad,
    reorderPads,
    canEdit: () => isOwner(currentUser),
  };
}

function init() {
  const grid = document.getElementById("pad-grid");
  const padRefs = PADS.map((def, i) => {
    const btn = createPad(def, i);
    grid.appendChild(btn);
    return { def, btn };
  });
  const padsById = new Map(padRefs.map(({ def, btn }) => [def.id, btn]));
  const defaultOrder = PADS.map((p) => p.id);
  const byKey = new Map();
  padRefs.forEach(({ def, btn }, i) => {
    if (KEYS[i]) byKey.set(KEYS[i], { def, btn });
  });

  const ctx = { padRefs, grid, padsById, defaultOrder };
  const mode = isConfigured
    ? initFirebaseMode(ctx)
    : Promise.resolve(initLocalOnlyMode(ctx));

  let api = {
    getRemoteSamples: () => ({}),
    resetPad: () => {},
    renamePad: () => {},
    reorderPads: () => {},
    canEdit: () => false,
  };
  Promise.resolve(mode).then((resolved) => {
    if (resolved) api = { ...api, ...resolved };
  });

  const lastPointerType = new WeakMap(); // btn -> "mouse" | "touch" | "pen"
  let drag = null; // { def, btn, startX, startY, pointerId, dragging, target }

  function onDragMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      cancelHold(drag.btn);
      drag.btn.classList.add("dragging");
    }
    drag.btn.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
    drag.btn.style.pointerEvents = "none";
    const elem = document.elementFromPoint(ev.clientX, ev.clientY);
    drag.btn.style.pointerEvents = "";
    const targetPad =
      elem && elem !== drag.btn ? elem.closest(".pad") : null;
    const newTarget = targetPad && targetPad !== drag.btn ? targetPad : null;
    if (newTarget !== drag.target) {
      if (drag.target) drag.target.classList.remove("drop-target");
      if (newTarget) newTarget.classList.add("drop-target");
      drag.target = newTarget;
    }
  }

  function onDragEnd(ev) {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    if (!drag) return;
    const { btn, target, def, dragging } = drag;
    if (dragging) {
      btn.classList.remove("dragging");
      btn.style.transform = "";
      if (target) target.classList.remove("drop-target");
      if (target && target.dataset.id && target.dataset.id !== def.id) {
        api.reorderPads(def.id, target.dataset.id);
      }
    }
    drag = null;
  }

  padRefs.forEach(({ def, btn }) => {
    const editBtn = btn.querySelector(".edit-btn");

    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      lastPointerType.set(btn, ev.pointerType || "mouse");
      triggerPad(def, btn, api.getRemoteSamples());
      if (!api.canEdit()) return;
      startHold(btn, () => api.resetPad(def, btn));
      drag = {
        def,
        btn,
        startX: ev.clientX,
        startY: ev.clientY,
        pointerId: ev.pointerId,
        dragging: false,
        target: null,
      };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
      window.addEventListener("pointercancel", onDragEnd);
    });
    const stopHoldIfNotDragging = () => {
      if (!drag || !drag.dragging) cancelHold(btn);
    };
    btn.addEventListener("pointerup", stopHoldIfNotDragging);
    btn.addEventListener("pointerleave", stopHoldIfNotDragging);
    btn.addEventListener("pointercancel", stopHoldIfNotDragging);

    // Desktop-only right-click rename. On touch, browsers fire contextmenu
    // from long-press, which would collide with hold-to-reset.
    btn.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      if (!api.canEdit()) return;
      if (lastPointerType.get(btn) !== "mouse") return;
      api.renamePad(def, btn);
    });

    // Pencil icon (shown for owner / in local mode) — works on touch too.
    if (editBtn) {
      editBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      editBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (api.canEdit()) api.renamePad(def, btn);
      });
    }
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    const hit = byKey.get(ev.key);
    if (!hit) return;
    triggerPad(hit.def, hit.btn, api.getRemoteSamples());
  });
}

document.addEventListener("DOMContentLoaded", init);
