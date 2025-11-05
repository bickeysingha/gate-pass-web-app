// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVjvoZEazBnq-2CBDwk3U0FMP_3kCwWIM",
  authDomain: "gate-pass-6465e.firebaseapp.com",
  projectId: "gate-pass-6465e",
  storageBucket: "gate-pass-6465e.firebasestorage.app",
  messagingSenderId: "466556708101",
  appId: "1:466556708101:web:81f4aa3df1a849cf66436c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
