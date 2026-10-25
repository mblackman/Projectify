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

* 📥 **Inbox & Smart Quick Capture**: Capture thoughts into your Inbox or directly into any project from anywhere using the Quick Capture keyboard shortcut (`Alt+C` by default) or inline smart tokens (`!1`–`!3`, `@today`, `@tomorrow`, `~nextweek`, `#Project`, `@context`).
* 🔄 **Rich Task Lifecycle**: Track tasks across multi-stage statuses (`To Do`, `In Progress`, `Waiting`, `Someday / Maybe`, `Done`, `Cancelled`), set separate **Due (Deadline)** and **Start (Scheduled)** dates, configure **recurring tasks** (`daily`, `weekdays`, `weekly`, `monthly`, `yearly`), and define task dependencies (`blocked-by`).
* 🗂️ **Projects, Kanban Boards, Sections & Sub-Tasks**: View any project as a **List** or drag-and-drop **Kanban Board**, organize tasks under project **Sections**, choose between **Parallel** and **Sequential** project modes, expand **inline sub-tasks**, and track recursive progress rollups with live pie charts.
* 🧭 **Flexible Dashboards & Workflows**: Switch between **Projects**, **Today** (with one-click overdue rescheduling), **Upcoming**, **Next Actions** (with `@context` filtering), **Eisenhower Matrix**, and **Weekly Review & Completed Logbook** tabs—or apply one-click **Workflow Presets** (*Minimal*, *GTD Power*, *Kanban & Agile*, *Full Suite*).
* 🎨 **Modern TiddlyWiki 5.4+ Integration**: Built with TiddlyWiki 5.4+ `\procedure`, `\function`, `<%if%>`, and `--tpc-*` palette variables for seamless light and dark theme support.

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
