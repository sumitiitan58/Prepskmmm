/**
 * prepskm.in — Firebase v10+ Modular Initialization, Auth State Listener,
 * Firestore & Storage Helpers
 * Master Admin: Sumit586kumar@gmail.com
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadString,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

export const MASTER_ADMIN_EMAIL = 'saurv586kumar@gmail.com';
export const LEGACY_MASTER_ADMIN_EMAIL = 'sumit586kumar@gmail.com';
export const SECONDARY_ADMIN_EMAIL = 'sumitiitair01@gmail.com';

export const firebaseConfig = {
  apiKey: 'AIzaSyDBP0nnOKLP3dk4or8xblLjZmIUKwRosjM',
  authDomain: 'prepskm-ad1ce.firebaseapp.com',
  databaseURL: 'https://prepskm-ad1ce-default-rtdb.firebaseio.com',
  projectId: 'prepskm-ad1ce',
  storageBucket: 'prepskm-ad1ce.firebasestorage.app',
  messagingSenderId: '1033326786252',
  appId: '1:1033326786252:web:199494f2628703d07ff469',
  measurementId: 'G-HYL8GGSTZ2',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export let analytics = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

/**
 * Checks whether an email address belongs to the Master Admin (saurv586kumar@gmail.com)
 */
export function isMasterAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return (
    normalized === MASTER_ADMIN_EMAIL.toLowerCase() ||
    normalized === LEGACY_MASTER_ADMIN_EMAIL.toLowerCase() ||
    normalized === SECONDARY_ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Uploads a DataURL (e.g. from Cropper.js / Canvas) to Firebase Storage at `path`
 * and returns the download URL (falls back to the DataURL if Storage bucket is unreachable).
 */
export async function uploadDataUrlToStorage(path, dataUrl) {
  try {
    const fileRef = storageRef(storage, path);
    await uploadString(fileRef, dataUrl, 'data_url');
    return await getDownloadURL(fileRef);
  } catch {
    return dataUrl;
  }
}

/**
 * Uploads a File/Blob (e.g. PDF or Thumbnail) to Firebase Storage at `path`
 * and returns the public download URL.
 */
export async function uploadFileToStorage(path, file, fallbackUrl = '') {
  try {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  } catch {
    return fallbackUrl;
  }
}

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
