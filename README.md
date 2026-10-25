# Projectify

Simple and beautiful project management for **[TiddlyWiki](https://tiddlywiki.com)** (`>=5.4.0`), published as `$:/plugins/mblackman/projectify`.

[![CI](https://github.com/mblackman/Projectify/actions/workflows/ci.yml/badge.svg)](https://github.com/mblackman/Projectify/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/mblackman/Projectify?color=blue)](https://github.com/mblackman/Projectify/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Demo-Interactive%20Preview-brightgreen)](https://mblackman.github.io/Projectify/)

Projectify brings GTD-inspired project and task management to TiddlyWiki, inspired by tools like [Todoist](https://todoist.com) and [Basecamp](https://basecamp.com). This is a maintained, modernized fork by [Matt Blackman](https://github.com/mblackman) of the original Projectify plugin created by [Nicolas Petton](https://github.com/NicolasPetton/Projectify).

👉 **[Try the Live Demo](https://mblackman.github.io/Projectify/)**

---

## Features

* 📥 **Inbox & Quick Capture**: Capture thoughts into your Inbox from anywhere using the Quick Capture keyboard shortcut (`Alt+C` by default).
* 🗂️ **Projects, Sub-Projects & Categories**: Organize tasks into projects, group projects by color-coded categories, view projects as cards or lists, and track progress with live pie charts.
* 📅 **Scheduling & Priority**: Schedule due dates with an interactive calendar picker (`Today`, `Tomorrow`, `Next week`, or any date), assign priorities, and review tasks in the **Today**, **Upcoming**, and **Next Actions** views.
* 🔀 **Drag & Drop Refiling**: Drag and drop any tiddler into a project to add it as a task, or drag tasks between the Inbox and projects.
* 🎨 **Modern TiddlyWiki 5.4+ Integration**: Built with TiddlyWiki 5.4+ procedures, conditional syntax, and `--tpc-*` palette variables for seamless light and dark theme support.

---

## Installation

### Drag & Drop (Fastest)
1. Open your TiddlyWiki in a browser.
2. Open the [Live Demo](https://mblackman.github.io/Projectify/) or download `projectify.tid` / `projectify-plugin.json` from the [Latest Release](https://github.com/mblackman/Projectify/releases/latest).
3. Drag and drop the plugin into your wiki, click **Import**, and save & reload.

### Node.js Edition
Clone into your wiki's `plugins` folder:
```bash
git clone https://github.com/mblackman/Projectify.git plugins/mblackman/projectify
```
And add `"mblackman/projectify"` to the `plugins` list in your `tiddlywiki.info`.

---

## Development & Build Commands

```bash
# Install dependencies
npm install

# Start live-reloading development server on http://127.0.0.1:8080
npm run dev

# Run Jest test suite
npm test

# Build plugin artifacts (build/projectify.tid, build/projectify-plugin.json, dist/projectify-plugin.json), demo wiki, and plugin library
npm run build-all
```

---

## Credits & License

Originally created by [Nicolas Petton](https://nicolas.petton.fr) ([upstream repository](https://github.com/NicolasPetton/Projectify)).
Maintained and modernized for TiddlyWiki 5.4+ by [Matt Blackman](https://github.com/mblackman).

MIT License — see [LICENSE](LICENSE).
