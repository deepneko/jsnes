const DB_NAME = 'jsnes-quickstate';
const DB_VERSION = 1;
const STORE_NAME = 'quickStates';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function clampSlot(slot) {
  const n = Number(slot);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(9, Math.floor(n)));
}

function keyFor(romId, slot = 0) {
  return `${romId}#slot${clampSlot(slot)}`;
}

export async function saveQuickState(romId, slot, state) {
  if (!romId || !state) return;
  const db = await openDb();
  if (!db) return;

  const record = {
    id: keyFor(romId, slot),
    baseRomId: romId,
    slot: clampSlot(slot),
    updatedAt: Date.now(),
    schemaVersion: 1,
    state,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadQuickState(romId, slot = 0) {
  if (!romId) return null;
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(keyFor(romId, slot));
    req.onsuccess = () => {
      const record = req.result;
      resolve(record && record.state ? record.state : null);
    };
    req.onerror = () => reject(req.error);
  });
}