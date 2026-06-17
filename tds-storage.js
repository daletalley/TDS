(() => {
  const DB_NAME = 'tds-local-data';
  const DB_VERSION = 1;
  const STORE_NAME = 'records';

  const supportsIndexedDb = () => 'indexedDB' in window;

  let dbPromise = null;

  function openDb() {
    if (!supportsIndexedDb()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  function transact(db, mode, action) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = action(store);
      let result;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function readLegacy(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }

  async function get(key, fallback) {
    try {
      const db = await openDb();
      if (db) {
        const record = await transact(db, 'readonly', store => store.get(key));
        if (record && Object.prototype.hasOwnProperty.call(record, 'value')) {
          return record.value;
        }
      }
    } catch {
      // Fall through to legacy storage.
    }

    const legacy = readLegacy(key);
    if (legacy !== undefined) {
      set(key, legacy);
      return legacy;
    }

    return fallback;
  }

  async function set(key, value) {
    try {
      const db = await openDb();
      if (db) {
        await transact(db, 'readwrite', store => store.put({
          key,
          value,
          updatedAt: new Date().toISOString()
        }));
        return true;
      }
    } catch {
      // Fall through to legacy storage.
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  async function remove(key) {
    try {
      const db = await openDb();
      if (db) {
        await transact(db, 'readwrite', store => store.delete(key));
        return true;
      }
    } catch {
      // Fall through to legacy storage.
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  async function persist() {
    if (!navigator.storage?.persist) return false;
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  async function persisted() {
    if (!navigator.storage?.persisted) return false;
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }

  async function estimate() {
    if (!navigator.storage?.estimate) return null;
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  }

  window.TDSStorage = {
    get,
    set,
    remove,
    persist,
    persisted,
    estimate
  };
})();
