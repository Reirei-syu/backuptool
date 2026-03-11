
import { BackupScheme } from '../types';

const DB_NAME = 'GlassBackupDB';
const STORE_NAME = 'schemes';
const DB_VERSION = 1;

// 打开数据库
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

// 保存所有方案
export const saveSchemesToDB = async (schemes: BackupScheme[]) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // 清空旧数据并写入新数据（简单策略）
    const clearReq = store.clear();
    
    clearReq.onsuccess = () => {
      if (schemes.length === 0) {
        resolve();
        return;
      }
      
      let count = 0;
      schemes.forEach(scheme => {
        const req = store.put(scheme);
        req.onsuccess = () => {
          count++;
          if (count === schemes.length) resolve();
        };
        req.onerror = () => reject(req.error);
      });
    };
    
    clearReq.onerror = () => reject(clearReq.error);
  });
};

// 加载所有方案
export const loadSchemesFromDB = async (): Promise<BackupScheme[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    
    req.onsuccess = () => {
      resolve(req.result || []);
    };
    req.onerror = () => reject(req.error);
  });
};
