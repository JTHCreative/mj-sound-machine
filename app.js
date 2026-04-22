// MJ Sound Machine — a grid of pads that play short synthesized sounds.
// When Firebase is configured, the owner can upload audio to Cloud Storage
// and all visitors hear the uploaded clips. Otherwise the app falls back to
// saving drag-dropped files in localStorage for the current browser only.

import { firebaseConfig, ownerUid, isConfigured } from "./firebase-config.js";

const FIREBASE_VERSION = "10.12.0";
const PAD_DOC_PATH = ["soundboard", "pads"]; // collection, doc

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

// ---- Web Audio plumbing -------------------------------------------------

let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
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

const LOCAL_KEY = "mj-sound-machine:samples:v1";
const localSamples = loadLocalSamples(); // id -> dataURL (fallback mode only)
const decoded = new Map(); // id -> { key, buffer }  (key invalidates on change)
const pendingDecodes = new Map(); // id -> Promise

function loadLocalSamples() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalSamples() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localSamples));
  } catch (err) {
    console.warn("Could not persist sample to localStorage:", err);
  }
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
  `;
  return btn;
}

function setPadCustom(btn, isCustom) {
  btn.classList.toggle("custom", Boolean(isCustom));
}

async function triggerPad(def, btn, remoteSamples) {
  const ctx = getCtx();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const remote = remoteSamples[def.id];
  let buffer = null;
  if (remote && remote.url) {
    buffer = await ensureDecoded(def.id, remote.url, remote.key || remote.url);
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

async function loadFirebaseModules() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [app, auth, storage, firestore] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-storage.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  return { app, auth, storage, firestore };
}

function extensionForFile(file) {
  const fromName = file.name && file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  const fromMime = (file.type || "").split("/")[1] || "";
  return fromMime.replace(/[^a-z0-9]/g, "") || "bin";
}

// ---- App wiring ----------------------------------------------------------

function initLocalOnlyMode(padRefs) {
  const hint = document.getElementById("storage-hint");
  hint.textContent =
    "Running in local-only mode — drag-dropped sounds are saved to this browser only. Add your Firebase config to enable cloud sharing.";

  padRefs.forEach(({ def, btn }) => {
    setPadCustom(btn, Boolean(localSamples[def.id]));

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
      const dataURL = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      localSamples[def.id] = dataURL;
      decoded.delete(def.id);
      saveLocalSamples();
      setPadCustom(btn, true);
    });

    btn.addEventListener("dblclick", () => {
      delete localSamples[def.id];
      decoded.delete(def.id);
      saveLocalSamples();
      setPadCustom(btn, false);
    });
  });

  return { getRemoteSamples: () => ({}) };
}

async function initFirebaseMode(padRefs) {
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
    return initLocalOnlyMode(padRefs);
  }

  const { initializeApp } = modules.app;
  const {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
  } = modules.auth;
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL, deleteObject } =
    modules.storage;
  const { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } =
    modules.firestore;

  const fbApp = initializeApp(firebaseConfig);
  const auth = getAuth(fbApp);
  const storage = getStorage(fbApp);
  const db = getFirestore(fbApp);
  const provider = new GoogleAuthProvider();
  const padsDoc = doc(db, PAD_DOC_PATH[0], PAD_DOC_PATH[1]);

  let remoteSamples = {}; // id -> { url, path, key }
  let currentUser = null;

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

    padRefs.forEach(({ btn }) => {
      btn.title = isOwner(currentUser)
        ? "Drop an audio file to replace this pad"
        : "Tap to play";
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

  onSnapshot(
    padsDoc,
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const next = {};
      Object.keys(data || {}).forEach((id) => {
        const entry = data[id];
        if (entry && entry.url) {
          next[id] = { url: entry.url, path: entry.path || "", key: entry.key || entry.url };
        }
      });
      remoteSamples = next;
      padRefs.forEach(({ def, btn }) => {
        const hasRemote = Boolean(remoteSamples[def.id]);
        setPadCustom(btn, hasRemote || Boolean(localSamples[def.id]));
        if (hasRemote) {
          // Warm the decoder so the first tap is instant.
          ensureDecoded(
            def.id,
            remoteSamples[def.id].url,
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
    if (file.size > 5 * 1024 * 1024) {
      hint.textContent = "File is larger than 5 MB. Trim it down first.";
      hint.classList.add("error");
      return;
    }

    btn.classList.add("uploading");
    try {
      const ext = extensionForFile(file);
      const path = `pads/${def.id}-${Date.now()}.${ext}`;
      const objectRef = storageRef(storage, path);
      await uploadBytes(objectRef, file, { contentType: file.type });
      const url = await getDownloadURL(objectRef);

      // Delete the previous object, if any, to keep storage tidy.
      const prev = remoteSamples[def.id];

      await setDoc(
        padsDoc,
        {
          [def.id]: {
            url,
            path,
            key: path,
            updatedAt: serverTimestamp(),
            uploadedBy: currentUser.uid,
          },
        },
        { merge: true },
      );

      if (prev && prev.path && prev.path !== path) {
        deleteObject(storageRef(storage, prev.path)).catch((err) => {
          console.warn("Could not delete previous sample:", err);
        });
      }

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
    const prev = remoteSamples[def.id];
    try {
      await setDoc(padsDoc, { [def.id]: null }, { merge: true });
      if (prev && prev.path) {
        deleteObject(storageRef(storage, prev.path)).catch(() => {});
      }
      decoded.delete(def.id);
    } catch (err) {
      console.error(err);
      hint.textContent = `Reset failed: ${err.message}`;
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
    btn.addEventListener("dblclick", () => resetPad(def, btn));
  });

  hint.textContent =
    "Cloud mode active. Sign in as the owner, then drag an audio file onto any pad to upload it.";
  hint.classList.remove("error");

  return { getRemoteSamples: () => remoteSamples };
}

function init() {
  const grid = document.getElementById("pad-grid");
  const padRefs = PADS.map((def, i) => {
    const btn = createPad(def, i);
    grid.appendChild(btn);
    return { def, btn };
  });
  const byKey = new Map();
  padRefs.forEach(({ def, btn }, i) => {
    if (KEYS[i]) byKey.set(KEYS[i], { def, btn });
  });

  const mode = isConfigured
    ? initFirebaseMode(padRefs)
    : Promise.resolve(initLocalOnlyMode(padRefs));

  let getRemoteSamples = () => ({});
  Promise.resolve(mode).then((api) => {
    if (api && api.getRemoteSamples) getRemoteSamples = api.getRemoteSamples;
  });

  padRefs.forEach(({ def, btn }) => {
    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      triggerPad(def, btn, getRemoteSamples());
    });
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    const hit = byKey.get(ev.key);
    if (!hit) return;
    triggerPad(hit.def, hit.btn, getRemoteSamples());
  });
}

document.addEventListener("DOMContentLoaded", init);
