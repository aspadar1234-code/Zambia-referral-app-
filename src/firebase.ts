import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { initializeFirestore, doc, collection, onSnapshot, addDoc, setDoc, getDoc, serverTimestamp, query, orderBy, limit, getDocFromServer, deleteDoc, updateDoc, enableMultiTabIndexedDbPersistence, where, or } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence is not supported by this browser');
    }
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  doc, 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  getDocFromServer,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteDoc,
  updateDoc,
  where,
  or
};
export type { User };

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
