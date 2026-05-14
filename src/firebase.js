import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics"; // Analytics is optional, commented out for now

const firebaseConfig = {
  apiKey: "AIzaSyBlamaWG5fE4O9iDUnI_xnUL3ELtP3duQY",
  authDomain: "arknightstier.firebaseapp.com",
  projectId: "arknightstier",
  storageBucket: "arknightstier.firebasestorage.app",
  messagingSenderId: "451832115992",
  appId: "1:451832115992:web:512ac2066d499257bfa46d",
  measurementId: "G-1PFHN9J29X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// export const analytics = getAnalytics(app);
export const db = getFirestore(app);
