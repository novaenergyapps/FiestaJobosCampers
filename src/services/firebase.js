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

function withTimeout(promise, ms = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('TIMEOUT_FIRESTORE'));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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
  // Immediately provide any saved local records so refresh never shows blank
  const initialLocal = getLocalBackupTransactions();
  if (initialLocal.length > 0) {
    onUpdate(initialLocal);
  }

  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAtMs', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: true },
    async (snapshot) => {
      const fromServer = !snapshot.metadata.fromCache;
      const cloudItems = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      const currentLocal = getLocalBackupTransactions();
      const pendingLocalItems = currentLocal.filter((item) =>
        String(item.id).startsWith('local_')
      );

      // If Firestore is connected to the server and we have local_* items waiting, sync them up!
      if (fromServer && pendingLocalItems.length > 0) {
        for (const pending of pendingLocalItems) {
          try {
            const { id: _oldId, savedInCloud: _sc, createdAt: _ca, ...cleanData } = pending;
            await addDoc(collection(db, COLLECTION_NAME), {
              ...cleanData,
              createdAt: serverTimestamp()
            });
          } catch (e) {
            console.warn('Failed to auto-sync local item:', e);
          }
        }
      }

      if (fromServer) {
        saveLocalBackupTransactions(cloudItems);
        if (onStatusChange) onStatusChange({ connected: true, error: null });
        onUpdate(cloudItems);
      } else {
        // Snapshot is only from local SDK memory cache (server not reached yet or Firestore disabled)
        if (cloudItems.length > 0) {
          const merged = [
            ...cloudItems,
            ...pendingLocalItems.filter(
              (p) => !cloudItems.some((c) => c.createdAtMs === p.createdAtMs)
            )
          ].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
          saveLocalBackupTransactions(merged);
          onUpdate(merged);
        } else {
          onUpdate(currentLocal);
        }
      }
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
  const basePayload = {
    ...txData,
    amount: Number(txData.amount) || 0,
    peopleCount: txData.type === 'deposit' ? (Number(txData.peopleCount) || 0) : 0,
    createdAtMs: txData.createdAtMs || nowMs,
    updatedAtMs: nowMs
  };

  try {
    const docRef = await withTimeout(
      addDoc(collection(db, COLLECTION_NAME), {
        ...basePayload,
        createdAt: serverTimestamp()
      }),
      3500
    );
    const savedItem = { id: docRef.id, ...basePayload, savedInCloud: true };
    const current = getLocalBackupTransactions().filter(
      (i) => i.createdAtMs !== basePayload.createdAtMs
    );
    saveLocalBackupTransactions([savedItem, ...current]);
    return savedItem;
  } catch (error) {
    console.warn('Firestore not reachable within 3.5s, saving locally until Firestore is enabled:', error);
    const localItem = {
      ...basePayload,
      id: `local_${nowMs}`,
      createdAt: new Date(nowMs).toISOString(),
      savedInCloud: false
    };
    const current = getLocalBackupTransactions();
    const next = [localItem, ...current];
    saveLocalBackupTransactions(next);
    return localItem;
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

  // Always update in local backup first so UI is instant
  const current = getLocalBackupTransactions();
  const next = current.map((item) => (item.id === id ? { ...item, ...payload } : item));
  saveLocalBackupTransactions(next);

  if (String(id).startsWith('local_')) {
    return { id, ...payload };
  }

  try {
    const ref = doc(db, COLLECTION_NAME, id);
    await withTimeout(updateDoc(ref, payload), 3500);
  } catch (err) {
    console.warn('Firestore update timed out, kept in local backup:', err);
  }
  return { id, ...payload };
}

export async function removeTransaction(id) {
  const current = getLocalBackupTransactions();
  const next = current.filter((item) => item.id !== id);
  saveLocalBackupTransactions(next);

  if (String(id).startsWith('local_')) {
    return true;
  }

  try {
    const ref = doc(db, COLLECTION_NAME, id);
    await withTimeout(deleteDoc(ref), 3500);
  } catch (err) {
    console.warn('Firestore delete timed out, removed from local backup:', err);
  }
  return true;
}
