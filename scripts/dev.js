#!/usr/bin/env node
/**
 * Live development server for Projectify ($:/plugins/mblackman/projectify).
 * Watches plugins/mblackman/projectify/ and automatically restarts
 * the TiddlyWiki server on port 8080 when source files change.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const pluginDir = path.join(rootDir, "plugins", "mblackman", "projectify");
const demoDir = path.join(rootDir, "demo");
const debugDir = path.join(rootDir, "debug");
const twBin = path.join(rootDir, "node_modules", "tiddlywiki", "tiddlywiki.js");
const port = process.env.PORT || "8080";
const host = process.env.HOST || "0.0.0.0";

let tiddlyWikiProcess = null;
let debounceTimer = null;
let isRestarting = false;

function syncDebugWiki() {
  if (!fs.existsSync(debugDir)) {
    fs.cpSync(demoDir, debugDir, { recursive: true });
  } else {
    fs.copyFileSync(
      path.join(demoDir, "tiddlywiki.info"),
      path.join(debugDir, "tiddlywiki.info")
    );
    const shouldIgnore = (f) =>
      f.startsWith("$__UpgradeLibrary") ||
      f.startsWith("$__info") ||
      f.startsWith("$__currentTiddler");

    for (const file of fs.readdirSync(path.join(demoDir, "tiddlers"))) {
      if (shouldIgnore(file)) continue;
      fs.copyFileSync(
        path.join(demoDir, "tiddlers", file),
        path.join(debugDir, "tiddlers", file)
      );
    }
  }
  if (fs.existsSync(path.join(debugDir, "tiddlers"))) {
    for (const file of fs.readdirSync(path.join(debugDir, "tiddlers"))) {
      if (
        file.startsWith("$__UpgradeLibrary") ||
        file.startsWith("$__info") ||
        file.startsWith("$__currentTiddler")
      ) {
        fs.rmSync(path.join(debugDir, "tiddlers", file), { force: true });
      }
    }
  }
}

function startServer() {
  if (tiddlyWikiProcess) return;
  syncDebugWiki();
  console.log(`🌐 Starting Projectify dev server on http://${host}:${port} ...`);
  tiddlyWikiProcess = spawn(
    process.execPath,
    [twBin, "debug", "--listen", `port=${port}`, `host=${host}`],
    {
      stdio: "inherit",
      cwd: rootDir,
      env: { ...process.env, TIDDLYWIKI_PLUGIN_PATH: "plugins" },
    }
  );

  tiddlyWikiProcess.on("exit", () => {
    tiddlyWikiProcess = null;
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!tiddlyWikiProcess) {
      resolve();
      return;
    }
    const proc = tiddlyWikiProcess;
    proc.once("exit", () => {
      if (tiddlyWikiProcess === proc) {
        tiddlyWikiProcess = null;
      }
      resolve();
    });
    proc.kill("SIGKILL");
  });
}

async function restartServer() {
  if (isRestarting) return;
  isRestarting = true;
  try {
    await stopServer();
    startServer();
  } finally {
    isRestarting = false;
  }
}

startServer();

console.log(`👀 Watching ${pluginDir} for changes...`);
fs.watch(pluginDir, { recursive: true }, (eventType, filename) => {
  if (!filename || filename.startsWith(".")) return;
  console.log(`📝 Change detected in ${filename} (${eventType}) — restarting server...`);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    restartServer();
  }, 300);
});

const shutdown = async () => {
  await stopServer();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
