// Firebase configuration.
//
// To enable cloud-hosted sounds:
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Add a Web App and paste the config values below.
//   3. In Authentication, enable the Google sign-in provider.
//   4. In Firestore Database, create a database (Native mode).
//   5. In Storage, create the default bucket.
//   6. Deploy the included storage.rules and firestore.rules files, and set
//      ownerUid below to your Firebase Auth UID so only you can upload.
//
// If apiKey is left empty, the app runs in local-only mode (drag-dropped
// sounds are saved to this browser's localStorage).

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// Set to your Firebase Auth UID (visible under Authentication → Users after
// signing in once). Only this user will be able to upload sounds. If left
// empty, any authenticated user can upload — useful while testing.
export const ownerUid = "";

export const isConfigured = Boolean(firebaseConfig.apiKey);
