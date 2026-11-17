import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA8wsRuCDt4zDbVneylZjANNu4aYNxeN2c",
  authDomain: "fiestajoboscampers.firebaseapp.com",
  projectId: "fiestajoboscampers",
  storageBucket: "fiestajoboscampers.firebasestorage.app",
  messagingSenderId: "88099263076",
  appId: "1:88099263076:web:be478ccdd66fbef0f48571"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLLECTION_NAME = 'transactions';
const LOCAL_BACKUP_KEY = 'fiesta_jobos_transactions_backup_v1';

export function getLocalBackupTransactions() {
  try {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalBackupTransactions(list) {
  try {
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Could not save local backup:', err);
  }
}

export function subscribeTransactions(onUpdate, onStatusChange) {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAtMs', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      saveLocalBackupTransactions(items);
      if (onStatusChange) onStatusChange({ connected: true, error: null });
      onUpdate(items);
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      const fallback = getLocalBackupTransactions();
      if (onStatusChange) {
        onStatusChange({
          connected: false,
          error: error?.message || 'Error conectando a Cloud Firestore',
          code: error?.code || 'unknown'
        });
      }
      onUpdate(fallback);
    }
  );

  return unsubscribe;
}

export async function createTransaction(txData) {
  const nowMs = Date.now();
  const payload = {
    ...txData,
    amount: Number(txData.amount) || 0,
    peopleCount: txData.type === 'deposit' ? (Number(txData.peopleCount) || 0) : 0,
    createdAtMs: txData.createdAtMs || nowMs,
    updatedAtMs: nowMs,
    createdAt: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    return { id: docRef.id, ...payload, savedInCloud: true };
  } catch (error) {
    console.error('Error saving to Firestore, storing in local backup:', error);
    const localItem = {
      ...payload,
      id: `local_${nowMs}`,
      createdAt: new Date(nowMs).toISOString(),
      savedInCloud: false
    };
    const current = getLocalBackupTransactions();
    const next = [localItem, ...current];
    saveLocalBackupTransactions(next);
    throw error;
  }
}

export async function updateTransaction(id, txData) {
  const nowMs = Date.now();
  const payload = {
    ...txData,
    amount: Number(txData.amount) || 0,
    peopleCount: txData.type === 'deposit' ? (Number(txData.peopleCount) || 0) : 0,
    updatedAtMs: nowMs
  };

  if (String(id).startsWith('local_')) {
    const current = getLocalBackupTransactions();
    const next = current.map((item) => (item.id === id ? { ...item, ...payload } : item));
    saveLocalBackupTransactions(next);
    return { id, ...payload };
  }

  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, payload);
  return { id, ...payload };
}

export async function removeTransaction(id) {
  if (String(id).startsWith('local_')) {
    const current = getLocalBackupTransactions();
    const next = current.filter((item) => item.id !== id);
    saveLocalBackupTransactions(next);
    return true;
  }

  const ref = doc(db, COLLECTION_NAME, id);
  await deleteDoc(ref);
  return true;
}
