const { loadStore, saveStore } = require("./storage");

const emptyStore = {
  matches: {},
  responses: {},
  confirmedLineups: {},
};

function normalizeStore(value) {
  return {
    matches: value?.matches || {},
    responses: value?.responses || {},
    confirmedLineups: value?.confirmedLineups || {},
  };
}

function getFirestoreClient(config) {
  const { Firestore } = require("@google-cloud/firestore");
  return new Firestore({
    projectId: config.firestoreProjectId || undefined,
    databaseId: config.firestoreDatabaseId || undefined,
  });
}

function getFirestoreDoc(config) {
  const db = getFirestoreClient(config);
  const collection = config.firestoreCollection || "attendanceStores";
  const storeId = config.storeId || "default";
  return db.collection(collection).doc(storeId);
}

async function loadAttendanceStore(config) {
  if (config.storageDriver === "firestore") {
    const snapshot = await getFirestoreDoc(config).get();
    return normalizeStore(snapshot.exists ? snapshot.data() : emptyStore);
  }

  return normalizeStore(await loadStore(config.storePath));
}

async function saveAttendanceStore(config, store) {
  const normalized = normalizeStore(store);
  if (config.storageDriver === "firestore") {
    await getFirestoreDoc(config).set(normalized, { merge: true });
    return;
  }

  await saveStore(config.storePath, normalized);
}

module.exports = {
  loadAttendanceStore,
  saveAttendanceStore,
};

