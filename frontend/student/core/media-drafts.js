const DB_NAME = "bnbu-student-media-drafts";
const STORE_NAME = "session-media";

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, action) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => database.close();
  });
}

export async function saveSessionMedia(sessionId, items) {
  if (!sessionId) return;
  await transaction("readwrite", (store) => store.put({ sessionId, items: items.map(({ file, mediaType, mimeType, size, source, durationSeconds, mediaId }) => ({ file, mediaType, mimeType, size, source, durationSeconds, mediaId })) }));
}

export async function loadSessionMedia(sessionId) {
  if (!sessionId) return [];
  const entry = await transaction("readonly", (store) => store.get(sessionId));
  return entry?.items || [];
}

export async function clearSessionMedia(sessionId) {
  if (!sessionId) return;
  await transaction("readwrite", (store) => store.delete(sessionId));
}
