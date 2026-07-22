import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// 1. Go to https://console.firebase.google.com
// 2. Create a project (free) -> Build -> Firestore Database -> Create database
//    (start in "test mode" for now, we'll tighten rules below)
// 3. Project settings (gear icon) -> General -> "Your apps" -> Web app (</>)
// 4. Copy the config object it gives you and paste it below.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION = "club_data";

// Never let a request hang forever -- if Firestore doesn't answer within
// 8 seconds (bad config, blocked network, wrong rules), we bail out with
// a clear error instead of spinning forever.
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

// Same shape as before: storeGet(key) / storeSet(key, value)
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

// Used by the on-screen connection banner so problems show up on the site
// itself, not just in the browser console.
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
