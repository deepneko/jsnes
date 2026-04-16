const DB_NAME = 'jsnes-battery';
const DB_VERSION = 1;
const STORE_NAME = 'batterySaves';
const SRAM_SIZE = 0x2000;

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
        db.createObjectStore(STORE_NAME, { keyPath: 'romId' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function toSramBytes(sram) {
  const bytes = new Uint8Array(SRAM_SIZE);
  if (!sram) return bytes;

  const size = Math.min(SRAM_SIZE, sram.length || 0);
  for (let i = 0; i < size; i++) {
    bytes[i] = sram[i] & 0xff;
  }
  return bytes;
}

function clampSlot(slot) {
  const n = Number(slot);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(9, Math.floor(n)));
}

function keyFor(romId, slot = 0) {
  return `${romId}#slot${clampSlot(slot)}`;
}

export async function loadBatterySave(romId, slot = 0) {
  if (!romId) return null;
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(keyFor(romId, slot));

    req.onsuccess = () => {
      const record = req.result;
      if (record && record.sram) {
        resolve(toSramBytes(record.sram));
        return;
      }

      // Backward compatibility: old records used romId as key.
      if (clampSlot(slot) !== 0) {
        resolve(null);
        return;
      }

      const fallbackReq = store.get(romId);
      fallbackReq.onsuccess = () => {
        const fallback = fallbackReq.result;
        if (!fallback || !fallback.sram) {
          resolve(null);
          return;
        }
        resolve(toSramBytes(fallback.sram));
      };
      fallbackReq.onerror = () => reject(fallbackReq.error);
    };

    req.onerror = () => reject(req.error);
  });
}

export async function saveBatterySave(romId, sram, slot = 0) {
  if (!romId) return;
  const db = await openDb();
  if (!db) return;

  const record = {
    romId: keyFor(romId, slot),
    baseRomId: romId,
    slot: clampSlot(slot),
    schemaVersion: 1,
    updatedAt: Date.now(),
    sram: toSramBytes(sram),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listBatterySaves(romId) {
  if (!romId) return [];
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const records = req.result || [];
      const slotMap = new Map();

      for (const record of records) {
        if (!record) continue;

        const isLegacy = record.romId === romId && !record.baseRomId;
        const isCurrent = record.baseRomId === romId;
        if (!isLegacy && !isCurrent) continue;

        const slot = isLegacy ? 0 : clampSlot(record.slot);
        const updatedAt = Number(record.updatedAt) || 0;
        const prev = slotMap.get(slot);

        if (!prev || updatedAt >= prev.updatedAt) {
          slotMap.set(slot, { slot, updatedAt });
        }
      }

      const items = Array.from(slotMap.values()).sort((a, b) => a.slot - b.slot);
      resolve(items);
    };

    req.onerror = () => reject(req.error);
  });
}