// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC40-dwjYoDbPAbxFrtvVhoB1snpC4F6yc",
  authDomain: "scale-up-nano.firebaseapp.com",
  projectId: "scale-up-nano",
  storageBucket: "scale-up-nano.firebasestorage.app",
  messagingSenderId: "1075963546243",
  appId: "1:1075963546243:web:7e0921d622fad9694c29b6",
  measurementId: "G-FFVB7K9FT1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
