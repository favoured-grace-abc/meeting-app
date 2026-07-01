import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

let analytics = null;
try {
  import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) analytics = getAnalytics(app);
    });
  });
} catch {}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

export const meetingsRef = () => collection(db, 'meetings');
export const meetingDoc = (id) => doc(db, 'meetings', id);
export const participantsRef = (meetingId) =>
  collection(db, 'meetings', meetingId, 'participants');
export const messagesRef = (meetingId) =>
  collection(db, 'meetings', meetingId, 'messages');
export const recordingsRef = () => collection(db, 'recordings');

export const getUserMeetings = (userId) =>
  query(
    meetingsRef(),
    where('hostId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

export const getUserRecordings = (userId) =>
  query(
    recordingsRef(),
    where('hostId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

export const addDocument = async (collectionRef, data) =>
  addDoc(collectionRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

export const updateDocument = async (docRef, data) =>
  updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });

export {
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
};
