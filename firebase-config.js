/**
 * prepskm.in — Firebase v10+ Modular Initialization, Auth State Listener,
 * Firestore & Storage Helpers
 * Master Admin: Sumit586kumar@gmail.com
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
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
import firebaseAppletConfig from './firebase-applet-config.json';

export const MASTER_ADMIN_EMAIL = 'Sumit586kumar@gmail.com';
export const SECONDARY_ADMIN_EMAIL = 'sumitiitair01@gmail.com';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseAppletConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Checks whether an email address belongs to the Master Admin (Sumit586kumar@gmail.com)
 */
export function isMasterAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return (
    normalized === MASTER_ADMIN_EMAIL.toLowerCase() ||
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
