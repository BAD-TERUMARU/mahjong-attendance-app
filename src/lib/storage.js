const fs = require("node:fs/promises");
const path = require("node:path");

async function readJson(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadStore(filePath) {
  return readJson(filePath, {
    matches: {},
    responses: {},
  });
}

async function saveStore(filePath, store) {
  await writeJson(filePath, store);
}

module.exports = {
  loadStore,
  saveStore,
};

