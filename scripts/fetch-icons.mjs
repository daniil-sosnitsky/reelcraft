#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   Логотип-пайплайн: докачивает брендовые SVG в engine/public/shared/icons/
   и сам дописывает engine/public/shared/icons/manifest.json.

   Запуск из корня проекта:
     node scripts/fetch-icons.mjs python nodejs kubernetes
     node scripts/fetch-icons.mjs --force docker        # перекачать существующий
     node scripts/fetch-icons.mjs golang=go             # ключ=слаг-в-источнике

   Источники (по приоритету):
     1. LobeHub Icons  — ЦВЕТНЫЕ логотипы AI-брендов (claude, openai, midjourney…)
     2. Devicon        — ЦВЕТНЫЕ логотипы дев-инструментов (python, docker, k8s…)
     3. Simple Icons   — 3300+ брендов монохромом; глиф качаем БЕЛЫМ,
                         брендовый цвет уходит в bg (как у старых иконок)
     4. LobeHub моно   — фолбэк для AI-брендов без цветного варианта
                         (midjourney и т.п.), глиф красится белым

   Manifest: у цветных иконок style:"color", bg — нейтральный тёмный
   (squircle не красить); у монохромных style:"mono", bg — брендовый цвет,
   color:#ffffff. Это соответствует blocks/app-connector.html.

   Правило workflow (CLAUDE.md → App Icon Library): на этапе сториборда
   выписать все упоминаемые бренды и прогнать этот скрипт ДО вёрстки.
   ══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = resolve(ROOT, "engine/public/shared/icons");
const MANIFEST = resolve(ICONS_DIR, "manifest.json");

/* Частые расхождения имя→слаг, чтобы не гадать руками */
const SLUG_FIX = {
  golang: "go", k8s: "kubernetes", node: "nodejs", js: "javascript",
  ts: "typescript", gpt: "openai", chatgpt: "openai", postgres: "postgresql",
};

const args = process.argv.slice(2).filter(a => a !== "--force");
const force = process.argv.includes("--force");
if (!args.length) {
  console.log("Использование: node scripts/fetch-icons.mjs <имя> [имя2 …] [--force]");
  console.log("               node scripts/fetch-icons.mjs golang=go   (ключ=слаг)");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

const label = s => s.charAt(0).toUpperCase() + s.slice(1);

async function tryFetch(url) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return null;
    const text = await r.text();
    return text.trimStart().startsWith("<svg") ? text : null;
  } catch { return null; }
}

/* Возвращает {svg, style, bg, color, source} или null */
async function fetchIcon(slug) {
  // 1. LobeHub — цветные AI-бренды
  let svg = await tryFetch(`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${slug}-color.svg`);
  if (svg) return { svg, style: "color", bg: "#1A1A1A", color: null, source: "lobehub" };

  // 2. Devicon — цветные дев-инструменты
  for (const variant of ["original", "plain"]) {
    svg = await tryFetch(`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-${variant}.svg`);
    if (svg) return { svg, style: "color", bg: "#1A1A1A", color: null, source: `devicon-${variant}` };
  }

  // 3. Simple Icons — глиф белым, брендовый цвет в bg
  const branded = await tryFetch(`https://cdn.simpleicons.org/${slug}`);
  if (branded) {
    const bg = (branded.match(/fill="(#[0-9A-Fa-f]{6})"/) || [])[1] || "#1A1A1A";
    const white = await tryFetch(`https://cdn.simpleicons.org/${slug}/ffffff`);
    return { svg: white || branded, style: "mono", bg, color: "#ffffff", source: "simple-icons" };
  }

  // 4. LobeHub моно (у части брендов нет -color варианта) — красим глиф белым
  svg = await tryFetch(`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${slug}.svg`);
  if (svg) {
    svg = svg.replace(/fill="currentColor"/g, 'fill="#ffffff"');
    return { svg, style: "mono", bg: "#1A1A1A", color: "#ffffff", source: "lobehub-mono" };
  }
  return null;
}

let added = 0, skipped = 0, failed = 0;

for (const arg of args) {
  let [key, slug] = arg.toLowerCase().split("=");
  slug = slug || SLUG_FIX[key] || key;

  const exists = manifest.icons[key] ||
    Object.values(manifest.icons).some(i => (i.aliases || []).includes(key));
  if (exists && !force) {
    console.log(`· ${key} — уже в библиотеке, пропуск (--force чтобы перекачать)`);
    skipped++; continue;
  }

  const hit = await fetchIcon(slug);
  if (!hit) {
    console.error(`✗ ${key} — не найден ни в одном источнике (слаг «${slug}»).`);
    console.error(`  Проверь слаг: lobehub.com/icons · devicon.dev · simpleicons.org`);
    failed++; continue;
  }

  writeFileSync(resolve(ICONS_DIR, `${key}.svg`), hit.svg);
  manifest.icons[key] = {
    file: `${key}.svg`,
    label: manifest.icons[key]?.label || label(key),
    bg: hit.bg,
    color: hit.color,
    style: hit.style,
    source: hit.source,
    aliases: manifest.icons[key]?.aliases || (slug !== key ? [slug] : []),
  };
  console.log(`✓ ${key} ← ${hit.source} (${hit.style === "color" ? "цветной" : `моно, bg ${hit.bg}`})`);
  added++;
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nИтог: +${added} новых · ${skipped} пропущено · ${failed} не найдено`);
console.log(`Манифест обновлён: engine/public/shared/icons/manifest.json (${Object.keys(manifest.icons).length} иконок)`);
if (added) console.log("⚠ Цветные SVG вставлять в композицию инлайн как обычно; squircle у style:\"color\" НЕ красить брендом — bg нейтральный.");
