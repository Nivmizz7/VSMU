const fs = require("fs");
const path = require("path");
const { loadConfig, saveConfig, configPath, DEFAULT_CONFIG } = require("./config");
const ui = require("./tui");
const { runUpdate } = require("./updater");

function resolveCwd() {
  return process.cwd();
}

async function runSetup(cwd) {
  ui.clearScreen();
  console.log("Vintage Story Mods Updater - Setup\n");
  console.log(`Default mods path: ${DEFAULT_CONFIG.modsPath}`);
  const input = await ui.promptInput(`Mods folder path (${DEFAULT_CONFIG.modsPath}): `);
  const modsPath = input.trim() || DEFAULT_CONFIG.modsPath;
  if (!fs.existsSync(modsPath)) {
    console.log("Warning: path does not exist yet. You can create it later.");
  }
  const config = {
    modsPath,
    apiBase: DEFAULT_CONFIG.apiBase
  };
  saveConfig(cwd, config);
  console.log(`Saved config to ${configPath(cwd)}`);
}

function showConfig(cwd) {
  const config = loadConfig(cwd);
  console.log(JSON.stringify(config, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const cwd = resolveCwd();
  const wantsSetup = args.includes("--setup");
  const wantsOnce = args.includes("--once") || args.length === 0;
  const wantsConfig = args.includes("--config");

  if (wantsSetup) {
    await runSetup(cwd);
    return;
  }

  if (wantsConfig) {
    showConfig(cwd);
    return;
  }

  if (!wantsOnce) {
    console.log("Usage: node src/index.js --once | --setup | --config");
    return;
  }

  const config = loadConfig(cwd);
  const menuChoice = await ui.menu("Main Menu", ["Run update now", "Setup", "Show config", "Exit"]);
  if (menuChoice === 1) {
    await runSetup(cwd);
    return;
  }
  if (menuChoice === 2) {
    showConfig(cwd);
    return;
  }
  if (menuChoice !== 0) {
    return;
  }

  await runUpdate(config, ui);
}

main().catch((err) => {
  console.log(err.message);
  process.exitCode = 1;
});
