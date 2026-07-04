// ينسخ ملفات اللعبة الثابتة (بدون أي أدوات بناء) إلى www/ ليستخدمها Capacitor كـwebDir
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");

const FILES = [
  "index.html", "game.js", "scene3d.js", "audio.js", "styles.css",
  "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "logo.png",
];
const DIRS = ["models"];

function copyFile(name) {
  const src = path.join(ROOT, name);
  const dst = path.join(WWW, name);
  if (!fs.existsSync(src)) { console.warn("تحذير: الملف غير موجود:", name); return; }
  fs.copyFileSync(src, dst);
}

function copyDir(name) {
  const src = path.join(ROOT, name);
  const dst = path.join(WWW, name);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
}

fs.mkdirSync(WWW, { recursive: true });
for (const f of FILES) copyFile(f);
for (const d of DIRS) copyDir(d);
console.log("تم نسخ ملفات اللعبة إلى www/ بنجاح.");
