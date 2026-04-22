// Firebase configuration.
//
// This app stores audio clips inline (base64) in Firestore, which keeps it
// entirely on the free (Spark) plan — no Cloud Storage, no billing account.
// Firestore caps each document at 1 MiB, so clips should stay small: the
// client rejects uploads larger than 500 KB. A 2-second MP3 at 128 kbps is
// roughly 32 KB, so there is plenty of room.
//
// Setup:
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Add a Web App and paste the config values below.
//   3. Authentication → Sign-in method → enable Google.
//   4. Firestore Database → Create database (Native mode).
//   5. Sign in to the app once, copy your UID from Authentication → Users,
//      paste it into ownerUid below and into firestore.rules.
//   6. Deploy the rules: `firebase deploy --only firestore:rules` (or paste
//      them into the Firestore Rules tab in the console).
//
// If apiKey is left empty, the app runs in local-only mode and saves
// drag-dropped sounds to this browser's localStorage.

export const firebaseConfig = {
  apiKey: "AIzaSyDsH8aRU5Dy_tGEJm__KfoorZ23EOFI5DA",
  authDomain: "mj-sound-effects.firebaseapp.com",
  projectId: "mj-sound-effects",
  storageBucket: "mj-sound-effects.firebasestorage.app",
  messagingSenderId: "467502079855",
  appId: "1:467502079855:web:ab21204d29ede4b982929a",
};

// Set to your Firebase Auth UID. Only this user will be able to upload
// sounds. If left empty, any authenticated user can upload (useful for
// testing before you lock it down).
export const ownerUid = "";

export const isConfigured = Boolean(firebaseConfig.apiKey);
