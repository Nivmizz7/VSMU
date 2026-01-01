# dev version -> VSMU dont work acutally: 01/01/2026

# VSMU
Vintage Story Mods Updater (Node.js, TUI ASCII)

## What it does
- Reads the local Mods folder
- Detects installed mods from their modinfo.json inside each zip
- Checks the Vintage Story mods database for updates
- Downloads newer zip files and removes older versions
- Runs from the folder (no install, no service)

## Requirements
- Node.js 18+
- npm

## Quick start (Ubuntu Server)
```bash
cd /path/to/VSMU
npm install
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

## Setup
The setup writes `vsmu.config.json` in the project folder.
It asks for the Mods folder path.
Default path:
```
/opt/vintagestory/server/Mods
```

You can re-run setup any time:
```bash
node src/index.js --setup
```

Show current config:
```bash
node src/index.js --config
```

## Usage
Run the menu (TUI ASCII):
```bash
node src/index.js
```

Run update immediately:
```bash
node src/index.js --once
```

## Notes
- The updater uses the public API at https://mods.vintagestory.at
- If the API format changes, adjust the parsing in `src/updater.js`

## License
See `LICENSE`.
