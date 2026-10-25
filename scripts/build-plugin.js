#!/usr/bin/env node
/**
 * Builds the Projectify plugin ($:/plugins/mblackman/projectify):
 * Minifies embedded JS in the output artifacts (build/projectify.tid,
 * build/projectify-plugin.json, and dist/projectify-plugin.json) without modifying source files.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const esbuild = require("esbuild");

const ROOT_DIR = path.resolve(__dirname, "..");
const PLUGIN_SRC = path.join(ROOT_DIR, "plugins", "mblackman", "projectify");
const BUILD_DIR = path.join(ROOT_DIR, "build");
const DIST_DIR = path.join(ROOT_DIR, "dist");

function minifyTwJsWithHeader(source) {
  const headerMatch = source.match(/^(\/\*\\[\s\S]*?\\\*\/\s*)/);
  const header = headerMatch ? headerMatch[1] : "";
  const body = headerMatch ? source.slice(header.length) : source;
  const minified = esbuild.transformSync(body, {
    loader: "js",
    minify: true,
    target: "es2018",
  });
  return header + minified.code;
}

function main() {
  const jsFiles = [
    path.join(PLUGIN_SRC, "lib", "pikaday.js"),
    path.join(PLUGIN_SRC, "ui", "widgets", "date-picker.js"),
  ];

  const backups = new Map();
  for (const file of jsFiles) {
    backups.set(file, fs.readFileSync(file, "utf8"));
  }

  try {
    for (const file of jsFiles) {
      fs.writeFileSync(file, minifyTwJsWithHeader(backups.get(file)), "utf8");
    }

    fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.mkdirSync(DIST_DIR, { recursive: true });

    execSync(
      "npx cross-env TIDDLYWIKI_PLUGIN_PATH=plugins tiddlywiki demo --output build --build projectify",
      { stdio: "inherit", cwd: ROOT_DIR }
    );

    const rawJsonPath = path.join(BUILD_DIR, "projectify-plugin.json");
    if (fs.existsSync(rawJsonPath)) {
      const pluginObj = JSON.parse(fs.readFileSync(rawJsonPath, "utf8"));
      const dragDropBundle = Array.isArray(pluginObj) ? pluginObj : [pluginObj];
      fs.writeFileSync(
        path.join(DIST_DIR, "projectify-plugin.json"),
        JSON.stringify(dragDropBundle, null, 2),
        "utf8"
      );
    }

    console.log(
      "✅ Built build/projectify.tid, build/projectify-plugin.json, and dist/projectify-plugin.json"
    );
  } finally {
    for (const [file, originalContent] of backups.entries()) {
      fs.writeFileSync(file, originalContent, "utf8");
    }
  }
}

if (require.main === module) {
  main();
}
