import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Paste your real Firebase project's config values below,
// replacing the YOUR_... placeholders.
const firebaseConfig = {
  apiKey: "AIzaSyC40-dwjYoDbPAbxFrtvVhoB1snpC4F6yc",
  authDomain: "scale-up-nano.firebaseapp.com",
  projectId: "scale-up-nano",
  storageBucket: "scale-up-nano.firebasestorage.app",
  messagingSenderId: "1075963546243",
  appId: "1:1075963546243:web:7e0921d622fad9694c29b6",
  measurementId: "G-FFVB7K9FT1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION = "club_data";

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Request timed out - check your Firebase setup and internet connection.")),
        ms
      )
    ),
  ]);
}

export async function storeGet(key) {
  try {
    const snap = await withTimeout(getDoc(doc(db, COLLECTION, key)));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().value);
  } catch (e) {
    console.error("storeGet failed", key, e);
    return null;
  }
}

export async function storeSet(key, value) {
  try {
    await withTimeout(setDoc(doc(db, COLLECTION, key), { value: JSON.stringify(value) }));
    return true;
  } catch (e) {
    console.error("storeSet failed", key, e);
    return false;
  }
}

export async function testConnection() {
  try {
    await withTimeout(
      setDoc(doc(db, COLLECTION, "_connection_test"), {
        value: JSON.stringify({ ok: true, at: Date.now() }),
      })
    );
    await withTimeout(getDoc(doc(db, COLLECTION, "_connection_test")));
    return { ok: true, message: "" };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}
