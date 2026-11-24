// Token lint (DESIGN.md §7): components use design tokens, never raw values.
//
//   npm run lint:tokens                 every .ts/.tsx/.css file under src/
//   npm run lint:tokens -- src/design   only files under the given path(s)
//
// Flags, outside src/design/tokens.css:
//   raw-color   hex colors (#abc, #aabbcc, #aabbccdd) and rgb()/rgba()/hsl()/hsla()
//   raw-px      <n>px lengths
//   raw-ms      <n>ms durations, and decimal-second durations like 0.2s
//   raw-style   numeric values for spacing, size, font, radius and duration props in TS
//               style objects (e.g. `padding: 12`, `fontSize: 13`, `duration: 0.2`), and
//               numeric font-weight/line-height/letter-spacing in CSS
// Allowlist (documented in DESIGN.md §7):
//   - the values 0 and 1 (0px, 1px hairlines, `width: 1`)
//   - percentages; flex, z-index, opacity and order numbers (they aren't in the prop list)
//   - SVG geometry attributes in JSX (`width={16}`, `strokeWidth={1.5}`, `viewBox="0 0 16 16"`, `d="…"`)
//   - px inside @media / @container conditions (custom properties can't be used there)
//   - comments
//   - a line ending in `// lint-tokens-allow: <reason>` (or /* lint-tokens-allow: <reason> */)
// Prints file:line:col findings, a per-folder summary, and exits 1 when anything is found.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const EXCLUDE = new Set([join(SRC, 'design', 'tokens.css')]);
const targets = (process.argv.slice(2).length ? process.argv.slice(2) : ['src']).map(p => resolve(root, p));

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f), out); }
  else if (/\.(tsx?|css)$/.test(p) && !p.endsWith('.d.ts') && !EXCLUDE.has(p)) out.push(p);
  return out;
}

/** Blank out comments but keep line/column positions, so findings point at real code. */
function stripComments(src, isCss) {
  let out = '';
  let i = 0;
  let str = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (str) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === str) str = null;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (!isCss && c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c;
    out += c;
    i++;
  }
  return out;
}

const STYLE_PROPS = [
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingInline', 'paddingBlock',
  'paddingInlineStart', 'paddingInlineEnd', 'paddingBlockStart', 'paddingBlockEnd',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginInline', 'marginBlock',
  'marginInlineStart', 'marginInlineEnd', 'marginBlockStart', 'marginBlockEnd',
  'gap', 'rowGap', 'columnGap', 'top', 'right', 'bottom', 'left', 'inset',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'flexBasis', 'inlineSize', 'blockSize',
  'fontSize', 'lineHeight', 'letterSpacing', 'fontWeight',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'borderWidth', 'outlineWidth', 'outlineOffset',
  'transitionDuration', 'animationDuration', 'transitionDelay', 'animationDelay', 'duration', 'delay',
];
const RULES = [
  { id: 'raw-color', re: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g },
  { id: 'raw-color', re: /\b(?:rgba?|hsla?)\(/g },
  { id: 'raw-px', re: /(?<![\w.])(\d*\.?\d+)px\b/g, allow: m => Number(m[1]) === 0 || Number(m[1]) === 1 },
  { id: 'raw-ms', re: /(?<![\w.])(\d*\.?\d+)ms\b/g, allow: m => Number(m[1]) === 0 },
  { id: 'raw-ms', re: /(?<![\w.])(\d*\.\d+)s\b/g },
  {
    id: 'raw-style', ts: true,
    re: new RegExp(`(?<![\\w-])(${STYLE_PROPS.join('|')})\\s*:\\s*(-?\\d*\\.?\\d+)(?![\\w%.])`, 'g'),
    allow: m => Number(m[2]) === 0 || Number(m[2]) === 1,
  },
  { id: 'raw-style', css: true, re: /(?<![\w-])(font-weight|line-height|letter-spacing)\s*:\s*-?\d/g },
];

const findings = [];
for (const file of targets.flatMap(t => walk(t))) {
  const isCss = file.endsWith('.css');
  const raw = readFileSync(file, 'utf8');
  const rawLines = raw.split('\n');
  const lines = stripComments(raw, isCss).split('\n');
  lines.forEach((line, idx) => {
    if (/lint-tokens-allow:/.test(rawLines[idx])) return;
    if (isCss && /@(media|container)\b/.test(line)) return;
    for (const rule of RULES) {
      if (rule.ts && isCss) continue;
      if (rule.css && !isCss) continue;
      rule.re.lastIndex = 0;
      for (const m of line.matchAll(rule.re)) {
        if (rule.allow?.(m)) continue;
        findings.push({ file: relative(root, file), line: idx + 1, col: m.index + 1, rule: rule.id, text: m[0].trim() });
      }
    }
  });
}

for (const f of findings) console.log(`${f.file}:${f.line}:${f.col}  ${f.rule.padEnd(9)}  ${f.text}`);
const byDir = {};
for (const f of findings) {
  const parts = f.file.split(sep);
  const key = parts.slice(0, Math.min(parts.length - 1, 3)).join('/') || f.file;
  byDir[key] = (byDir[key] ?? 0) + 1;
}
const byRule = {};
for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
console.log(`\n${findings.length} finding(s)` + (findings.length ? `  (${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''));
for (const [dir, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${dir}`);
process.exit(findings.length ? 1 : 0);
