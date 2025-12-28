const fs = require("fs");
const path = require("path");
const https = require("https");
const AdmZip = require("adm-zip");
const { progressBar } = require("./tui");

function isZipFile(name) {
  return name.toLowerCase().endsWith(".zip");
}

function readModInfo(zipPath) {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry("modinfo.json");
  if (!entry) {
    return null;
  }
  const raw = entry.getData().toString("utf8");
  try {
    const info = JSON.parse(raw);
    if (!info.modid) {
      return null;
    }
    return {
      modid: String(info.modid),
      version: String(info.version || "0.0.0"),
      name: String(info.name || info.modid),
      path: zipPath
    };
  } catch (err) {
    return null;
  }
}

function compareVersions(a, b) {
  const pa = String(a).split(/[^0-9A-Za-z]+/).filter(Boolean);
  const pb = String(b).split(/[^0-9A-Za-z]+/).filter(Boolean);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] || "0";
    const vb = pb[i] || "0";
    const na = Number(va);
    const nb = Number(vb);
    const bothNum = !Number.isNaN(na) && !Number.isNaN(nb);
    if (bothNum) {
      if (na > nb) return 1;
      if (na < nb) return -1;
    } else {
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
  }
  return 0;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(getJson(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function findRemoteMod(apiBase, modid) {
  const searchUrl = `${apiBase}/api/mods?search=${encodeURIComponent(modid)}`;
  const searchData = await getJson(searchUrl);
  const list = searchData?.mods || searchData?.data || searchData || [];
  const lower = modid.toLowerCase();
  const match = Array.isArray(list)
    ? list.find((m) => String(m.modid || m.modidstr || "").toLowerCase() === lower)
    : null;
  if (match && (match.modid || match.modidstr)) {
    const id = match.modid || match.modidstr;
    try {
      return await getJson(`${apiBase}/api/mod/${encodeURIComponent(id)}`);
    } catch (err) {
      return match;
    }
  }
  if (Array.isArray(list) && list.length > 0) {
    return list[0];
  }
  return null;
}

function pickLatestRelease(modData) {
  if (!modData) return null;
  if (modData.latestrelease) {
    return modData.latestrelease;
  }
  const releases = modData.releases || modData.Releases || modData.versions || [];
  if (!Array.isArray(releases) || releases.length === 0) {
    return null;
  }
  const sorted = [...releases].sort((a, b) => compareVersions(a.version || a.Version || "0", b.version || b.Version || "0"));
  return sorted[sorted.length - 1];
}

function resolveDownloadUrl(apiBase, release) {
  if (!release) return null;
  const candidate = release.download || release.file || release.url || release.mainfile || release.filename;
  if (!candidate) return null;
  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    return candidate;
  }
  if (candidate.startsWith("/")) {
    return `${apiBase}${candidate}`;
  }
  return `${apiBase}/${candidate}`;
}

function downloadFile(url, destPath, label) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(downloadFile(res.headers.location, destPath, label));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const total = Number(res.headers["content-length"] || 0);
        let received = 0;
        res.on("data", (chunk) => {
          received += chunk.length;
          if (total > 0) {
            progressBar(label, received, total, 40);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            process.stdout.write("\n");
            resolve();
          });
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => reject(err));
      });
  });
}

function listLocalMods(modsPath) {
  const entries = fs.readdirSync(modsPath, { withFileTypes: true });
  const zips = entries.filter((e) => e.isFile() && isZipFile(e.name)).map((e) => path.join(modsPath, e.name));
  const mods = zips.map((zipPath) => readModInfo(zipPath)).filter(Boolean);
  return mods;
}

function groupByModId(mods) {
  const map = new Map();
  mods.forEach((mod) => {
    const id = mod.modid.toLowerCase();
    if (!map.has(id)) {
      map.set(id, []);
    }
    map.get(id).push(mod);
  });
  return map;
}

function pickLatestLocal(mods) {
  return [...mods].sort((a, b) => compareVersions(a.version, b.version))[mods.length - 1];
}

async function runUpdate(config, ui) {
  const modsPath = config.modsPath;
  if (!fs.existsSync(modsPath)) {
    throw new Error(`Mods path not found: ${modsPath}`);
  }

  ui.clearScreen();
  console.log("Vintage Story Mods Updater");
  console.log(`Mods path: ${modsPath}`);
  console.log("Scanning local mods...\n");

  const localMods = listLocalMods(modsPath);
  if (localMods.length === 0) {
    console.log("No mods found in Mods folder.");
    return { updated: 0, removed: 0, skipped: 0 };
  }

  const grouped = groupByModId(localMods);
  const keep = [];
  const removeCandidates = [];

  grouped.forEach((mods) => {
    if (mods.length === 1) {
      keep.push(mods[0]);
      return;
    }
    const latest = pickLatestLocal(mods);
    keep.push(latest);
    mods.forEach((m) => {
      if (m.path !== latest.path) {
        removeCandidates.push(m);
      }
    });
  });

  if (removeCandidates.length > 0) {
    removeCandidates.forEach((m) => fs.unlinkSync(m.path));
  }

  const tableRows = keep.map((m) => [m.modid, m.version, m.name, "..."]);
  ui.printTable("Local Mods", ["ModID", "Version", "Name", "Status"], tableRows);

  let updated = 0;
  let removed = removeCandidates.length;
  let skipped = 0;

  for (const mod of keep) {
    const statusRow = tableRows.find((r) => r[0] === mod.modid);
    try {
      const remote = await findRemoteMod(config.apiBase, mod.modid);
      if (!remote) {
        statusRow[3] = "not found";
        skipped += 1;
        continue;
      }
      const release = pickLatestRelease(remote);
      const remoteVersion = String(release?.version || release?.Version || remote.version || "0.0.0");
      if (compareVersions(remoteVersion, mod.version) <= 0) {
        statusRow[3] = "up-to-date";
        skipped += 1;
        continue;
      }
      const url = resolveDownloadUrl(config.apiBase, release);
      if (!url) {
        statusRow[3] = "no file";
        skipped += 1;
        continue;
      }
      const fileName = `${mod.modid}-${remoteVersion}.zip`;
      const tempPath = path.join(modsPath, `${fileName}.part`);
      console.log(`Downloading ${mod.modid} ${remoteVersion}`);
      await downloadFile(url, tempPath, mod.modid);
      const finalPath = path.join(modsPath, fileName);
      fs.renameSync(tempPath, finalPath);
      fs.unlinkSync(mod.path);
      statusRow[3] = `updated to ${remoteVersion}`;
      updated += 1;
    } catch (err) {
      statusRow[3] = "error";
      console.log(`Error with ${mod.modid}: ${err.message}`);
      skipped += 1;
    }
  }

  ui.clearScreen();
  ui.printTable("Result", ["ModID", "Version", "Name", "Status"], tableRows);
  console.log(`Updated: ${updated}, Removed old: ${removed}, Skipped: ${skipped}`);

  return { updated, removed, skipped };
}

module.exports = {
  runUpdate
};
