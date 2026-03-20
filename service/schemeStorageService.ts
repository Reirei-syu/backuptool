import { createDefaultScheme } from '../config/backupDefaults';
import type { BackupScheme } from '../types';

const DB_NAME = 'GlassBackupDB';
const STORE_NAME = 'schemes';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const loadSchemes = async (): Promise<BackupScheme[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const loadInitialSchemes = async (): Promise<BackupScheme[]> => {
  const schemes = await loadSchemes();
  return schemes.length > 0 ? schemes : [createDefaultScheme()];
};

export const saveSchemes = async (schemes: BackupScheme[]) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      if (schemes.length === 0) {
        resolve();
        return;
      }

      let completedCount = 0;
      schemes.forEach((scheme) => {
        const request = store.put(scheme);
        request.onsuccess = () => {
          completedCount += 1;
          if (completedCount === schemes.length) {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    };

    clearRequest.onerror = () => reject(clearRequest.error);
  });
};
