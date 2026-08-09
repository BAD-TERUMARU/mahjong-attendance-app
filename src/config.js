const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv(filePath = path.join(process.cwd(), ".env")) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function firstExisting(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate));
}

function getConfig() {
  loadDotEnv();

  const root = process.cwd();
  const matchDaysCsv =
    process.env.MATCH_DAYS_CSV ||
    firstExisting([
      path.join(root, "data", "match-days.csv"),
      path.join(root, "data", "match-days.sample.csv"),
    ]);
  const membersCsv =
    process.env.MEMBERS_CSV ||
    firstExisting([
      path.join(root, "data", "members.csv"),
      path.join(root, "data", "members.sample.csv"),
    ]);
  const pointsCsv =
    process.env.POINTS_CSV ||
    firstExisting([
      path.join(root, "data", "opponent-points.csv"),
      path.join(root, "data", "opponent-points.sample.csv"),
    ]);

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    matchDaysCsv,
    membersCsv,
    pointsCsv,
    pointsCsvUrl: process.env.POINTS_CSV_URL,
    storageDriver: process.env.STORAGE_DRIVER || "local",
    firestoreProjectId: process.env.FIRESTORE_PROJECT_ID,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
    firestoreCollection: process.env.FIRESTORE_COLLECTION || "attendanceStores",
    storeId: process.env.STORE_ID || "default",
    storePath: process.env.ATTENDANCE_STORE || path.join(root, "data", "store.json"),
  };
}

module.exports = {
  getConfig,
};
