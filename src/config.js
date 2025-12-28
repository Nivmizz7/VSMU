const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  modsPath: "/opt/vintagestory/server/Mods",
  apiBase: "https://mods.vintagestory.at"
};

function configPath(cwd) {
  return path.join(cwd, "vsmu.config.json");
}

function loadConfig(cwd) {
  const filePath = configPath(cwd);
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    const data = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...data
    };
  } catch (err) {
    throw new Error("Invalid vsmu.config.json. Fix JSON syntax.");
  }
}

function saveConfig(cwd, config) {
  const filePath = configPath(cwd);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  configPath
};
