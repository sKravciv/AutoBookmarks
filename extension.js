const vscode = require('vscode');
const path = require('path');

const config = () => vscode.workspace.getConfiguration('autoBookmarks');
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allowed(doc){ const xs=config().get('fileTypes',[]); return !xs.length || xs.includes(path.extname(doc.fileName).toLowerCase()); }

// ---------------------------------------------------------------------------
// Scanning: single regex pass, per-document-version cache, file size guard
// ---------------------------------------------------------------------------
const MB = 1024 * 1024;
const DEFAULT_MAX_FILE_SIZE_MB = 20;
const PREVIEW_MAX_LENGTH = 200;
const CACHE_MAX_ENTRIES = 20;
const REFRESH_DELAY_MS = 300;
const STATUS_MESSAGE_MS = 8000;

const scanCache = new Map();          // "uri::version" -> groups[]. Map order == recency (oldest first) => LRU.
const oversizedNotified = new Set();  // uri strings already told about the size limit

function escapeRegex(str){ return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function cacheKey(doc){ return doc.uri.toString() + '::' + doc.version; }
function cacheGet(key){
  const value = scanCache.get(key);
  if (value !== undefined) { scanCache.delete(key); scanCache.set(key, value); } // mark as most recently used
  return value;
}
function cacheSet(key, value){
  scanCache.delete(key);
  scanCache.set(key, value);
  while (scanCache.size > CACHE_MAX_ENTRIES) scanCache.delete(scanCache.keys().next().value); // drop oldest
}
function invalidateDocument(uri){
  const prefix = uri.toString() + '::';
  for (const key of [...scanCache.keys()]) if (key.startsWith(prefix)) scanCache.delete(key);
}

function maxFileSizeMB(){
  const v = config().get('maxFileSizeMB', DEFAULT_MAX_FILE_SIZE_MB);
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : DEFAULT_MAX_FILE_SIZE_MB;
}
// Size in UTF-16 code units (~bytes for source code). Measured through the line index, so no
// giant string has to be built just to find out that the file is too large to scan.
function documentLength(doc){ return doc.offsetAt(doc.lineAt(doc.lineCount - 1).range.end); }
function exceedsSizeLimit(doc){
  const limit = maxFileSizeMB();
  if (limit === 0 || documentLength(doc) <= limit * MB) return false;
  const id = doc.uri.toString();
  if (!oversizedNotified.has(id)) {
    oversizedNotified.add(id);
    vscode.window.setStatusBarMessage(`Auto Bookmarks: file exceeds configured ${limit} MB limit`, STATUS_MESSAGE_MS);
  }
  return true;
}

// One RegExp for all markers, longest first so that "TODO:" wins over "TODO" at the same position.
// Markers that differ only by case (case-insensitive mode) share one "key" and feed every label.
function buildMatcher(markers, caseSensitive){
  const norm = m => caseSensitive ? m : m.toLowerCase();
  const labels = [...new Set(markers.filter(m => typeof m === 'string' && m))]; // configured order, empties/duplicates dropped
  if (!labels.length) return null;
  const keys = [], keyIndex = new Map();
  for (const label of labels) {
    const n = norm(label);
    let i = keyIndex.get(n);
    if (i === undefined) { i = keys.length; keyIndex.set(n, i); keys.push({ norm: n, text: label, length: label.length, labels: [], shorter: [] }); }
    keys[i].labels.push(label);
  }
  // "shorter" = other markers that are a prefix of this one. The regex only reports the longest marker at a
  // position, so these are credited as well, which keeps "TODO" and "TODO:" both matching like before.
  keys.forEach((k, i) => keys.forEach((o, j) => { if (i !== j && o.norm.length < k.norm.length && k.norm.startsWith(o.norm)) k.shorter.push(j); }));
  const source = keys.map(k => k.text).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
  return { regex: new RegExp(source, caseSensitive ? 'g' : 'gi'), keys, keyIndex, labels };
}

// The RegExp is compiled once per (active markers, case mode) and reused for every document version; it holds no per-scan state.
let matcherCache = null;
function getMatcher(markers, caseSensitive){
  const key = JSON.stringify([markers, caseSensitive]);
  if (!matcherCache || matcherCache.key !== key) matcherCache = { key, matcher: buildMatcher(markers, caseSensitive) };
  return matcherCache.matcher;
}

function runScan(doc, matcher, caseSensitive){
  const text = doc.getText();
  const { regex, keys, keyIndex, labels } = matcher;
  const groupByLabel = new Map(labels.map(label => [label, { marker: label, hits: [] }])); // fresh result groups for every scan
  const nextFree = new Array(keys.length).fill(0); // a marker never matches inside its own previous match (as indexOf + length did)
  const file = doc.fileName;
  let lastLine = -1, lastPreview = '';
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    const index = match.index;
    regex.lastIndex = index + 1; // continue inside the match so markers that overlap each other are still found
    const id = keyIndex.get(caseSensitive ? match[0] : match[0].toLowerCase());
    if (id === undefined) continue;
    const shorter = keys[id].shorter;
    let pos = null;
    for (let n = -1; n < shorter.length; n++) {
      const kid = n < 0 ? id : shorter[n];
      if (index < nextFree[kid]) continue;
      nextFree[kid] = index + keys[kid].length;
      if (pos === null) {
        pos = doc.positionAt(index);
        if (pos.line !== lastLine) { // several hits on one line share one preview string
          lastLine = pos.line;
          lastPreview = doc.lineAt(pos.line).text.trim().substring(0, PREVIEW_MAX_LENGTH);
        }
      }
      for (const label of keys[kid].labels) groupByLabel.get(label).hits.push({ marker: label, file, line: pos.line, character: pos.character, preview: lastPreview });
    }
  }
  return labels.map(label => groupByLabel.get(label)).filter(group => group.hits.length);
}

function scanDocument(doc){
  const key = cacheKey(doc);
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  let result = [];
  if (!exceedsSizeLimit(doc)) {
    const c = config();
    const caseSensitive = c.get('caseSensitive', true);
    const matcher = getMatcher(getBookmarks().markers, caseSensitive); // markers = ACTIVE entries only
    if (matcher) result = runScan(doc, matcher, caseSensitive);
  }
  cacheSet(key, result);
  return result;
}

// What a scan result depends on. Colors, URLs, file types and inactive entries are not part of it, so changing them never rescans.
let scanKey = null;
const currentScanKey = () => JSON.stringify([getBookmarks().markers, config().get('caseSensitive', true), maxFileSizeMB()]);

function groups(){
 const ed=vscode.window.activeTextEditor;if(!ed||!allowed(ed.document))return [];
 return scanDocument(ed.document);
}
// ---------------------------------------------------------------------------
// Documentation links: "Open <text> Documentation" Quick Fix (lightbulb) on an exact match at the cursor.
// It never reads the whole document, only a few characters of the cursor's line.
// ---------------------------------------------------------------------------
const DOC_SELECTOR = '*';                         // every document (any scheme / language)
const DOC_COMMAND = 'autoBookmarks.openDocumentation';
const DOC_TITLE_PREFIX = '📖 ';
const DOC_URL = /^https?:\/\//i;                  // only web links are ever opened
const WORD_CHAR = /[\p{L}\p{N}_$]/u;
const DEFAULT_COLOR = '#3b82f6';
let bookmarkCache = null;                         // parsed autoBookmarks.documentationLinks; rebuilt when it changes

function charBefore(s, i){                        // code point that ends at index i
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xDC00 && lo <= 0xDFFF && i >= 2) { const hi = s.charCodeAt(i - 2); if (hi >= 0xD800 && hi <= 0xDBFF) return s.slice(i - 2, i); }
  return s[i - 1];
}
function charAfter(s, i){ return String.fromCodePoint(s.codePointAt(i)); }
const isWordChar = ch => WORD_CHAR.test(ch);

// autoBookmarks.documentationLinks is the one list behind everything: [{ text, active?, color?, url? }].
//   active -> false switches the entry off for scanning (no bookmarks, badge or highlight) but keeps it stored. A missing/non-boolean
//             value counts as true, so lists saved by 2.2.x/2.3.x keep working. The documentation lightbulb does not depend on it.
//   text  -> searched for in the active file (bookmarks, tree, badge, line-number highlight)
//   color -> highlight color (default blue)
//   url   -> optional; when it is an http(s) link the cursor on an exact match offers "Open <text> Documentation"
function getBookmarks(){
  if (bookmarkCache) return bookmarkCache;
  const raw = config().get('documentationLinks', []);
  const entries = [], seen = new Set();
  if (Array.isArray(raw)) for (const item of raw) {
    if (!item || typeof item.text !== 'string' || !item.text.trim() || seen.has(item.text)) continue; // first entry wins for duplicate texts
    seen.add(item.text);
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    entries.push({
      text: item.text,
      active: typeof item.active === 'boolean' ? item.active : true,
      color: typeof item.color === 'string' && item.color.trim() ? item.color.trim() : DEFAULT_COLOR,
      url: DOC_URL.test(url) ? url : undefined,            // anything that is not an http(s) link is ignored
      leadWord: isWordChar(charAfter(item.text, 0)), trailWord: isWordChar(charBefore(item.text, item.text.length)),
    });
  }
  const links = entries.filter(e => e.url);
  bookmarkCache = {
    markers: entries.filter(e => e.active).map(e => e.text), // only active entries take part in scanning
    colors: new Map(entries.map(e => [e.text, e.color])),
    links, maxLinkLength: links.reduce((m, e) => Math.max(m, e.text.length), 0),
  };
  return bookmarkCache;
}

// Cleans the list sent by the settings page before it is written to the user settings.
function sanitizeBookmarks(list){
  const out = [], seen = new Set();
  for (const x of list) {
    if (!x || typeof x.text !== 'string') continue;
    const text = x.text.trim(); if (!text || seen.has(text)) continue; seen.add(text);
    const entry = { text, active: x.active !== false };
    if (typeof x.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.color.trim())) entry.color = x.color.trim().toLowerCase();
    const url = typeof x.url === 'string' ? x.url.trim() : ''; if (DOC_URL.test(url)) entry.url = url;
    out.push(entry);
  }
  return out;
}

// 2.3.0 merged "searchTexts" + "colors" into documentationLinks. Runs once per VS Code profile and keeps what the user had.
const LEGACY_DEFAULT_TEXTS = ['TODO', 'FIXME', 'GlideRecord'];
const LEGACY_DEFAULT_COLORS = { TODO: '#fbbf24', FIXME: '#f87171', GlideRecord: '#38bdf8' };
const MIGRATION_FLAG = 'autoBookmarks.bookmarksUnified';
// Puts "active" right after "text"; a missing or non-boolean flag becomes true.
function withActive(entry){ const { text, active, ...rest } = entry; return { text, active: typeof active === 'boolean' ? active : true, ...rest }; }
async function migrateLegacySettings(context){
  if (context.globalState.get(MIGRATION_FLAG)) return;
  const c = config();
  const userValue = key => { const i = c.inspect(key); return i ? i.globalValue : undefined; };
  const legacyTexts = userValue('searchTexts'), legacyColors = userValue('colors'), userLinks = userValue('documentationLinks');
  // Safe to run again (the flag is per extension ID and starts empty if the ID changes): after a migration the legacy keys are gone
  // and the list written by 2.3.0 always carries colors, so neither condition below matches a second time.
  const hasLegacy = legacyTexts !== undefined || legacyColors !== undefined;
  const looksLikeV22 = Array.isArray(userLinks) && userLinks.length > 0 && userLinks.every(x => !x || typeof x !== 'object' || !x.color);
  if (hasLegacy || looksLikeV22) {
    const texts = Array.isArray(legacyTexts) ? legacyTexts : LEGACY_DEFAULT_TEXTS;                      // what the old defaults searched for
    const colors = { ...LEGACY_DEFAULT_COLORS, ...(legacyColors && typeof legacyColors === 'object' ? legacyColors : {}) };
    const merged = [], seen = new Set();
    for (const item of Array.isArray(userLinks) ? userLinks : []) {                                       // 2.2.0 documentation links first
      if (!item || typeof item.text !== 'string' || seen.has(item.text)) continue;
      seen.add(item.text);
      merged.push(withActive(item.color || !colors[item.text] ? { ...item } : { ...item, color: colors[item.text] }));
    }
    for (const text of texts) {                                                                           // then every old search text
      if (typeof text !== 'string' || !text.trim() || seen.has(text)) continue;
      seen.add(text);
      merged.push(withActive(colors[text] ? { text, color: colors[text] } : { text }));
    }
    await c.update('documentationLinks', merged, vscode.ConfigurationTarget.Global);
    if (legacyTexts !== undefined) await c.update('searchTexts', undefined, vscode.ConfigurationTarget.Global);
    if (legacyColors !== undefined) await c.update('colors', undefined, vscode.ConfigurationTarget.Global);
  }
  await context.globalState.update(MIGRATION_FLAG, true);
}

// 2.4.0: every bookmark entry carries "active". Entries saved by 2.2.x/2.3.x have no such key and stay active.
// getBookmarks() already treats a missing flag as true, so this write-back only makes the setting explicit. Idempotent:
// once every entry has a boolean there is nothing left to write.
const needsActive = x => x && typeof x === 'object' && typeof x.text === 'string' && typeof x.active !== 'boolean';
async function migrateActiveFlags(){
  const c = config(), i = c.inspect('documentationLinks');
  if (!i) return;
  for (const [target, value] of [[vscode.ConfigurationTarget.Global, i.globalValue], [vscode.ConfigurationTarget.Workspace, i.workspaceValue]]) {
    if (!Array.isArray(value) || !value.some(needsActive)) continue;
    try { await c.update('documentationLinks', value.map(x => (needsActive(x) ? withActive(x) : x)), target); } catch { /* read-only settings: the in-memory default still applies */ }
  }
}

// True when `entry.text` occurs in `s` around the selection [selStart, selEnd] as a whole word:
// the character before/after it must not continue an identifier (checked only where the text itself ends in a word character).
function matchesAt(s, entry, selStart, selEnd){
  const text = entry.text, length = text.length;
  for (let i = s.indexOf(text, Math.max(0, selEnd - length)); i !== -1 && i <= selStart; i = s.indexOf(text, i + 1)) {
    if (entry.leadWord && i > 0 && isWordChar(charBefore(s, i))) continue;
    const end = i + length;
    if (entry.trailWord && end < s.length && isWordChar(charAfter(s, end))) continue;
    return true;
  }
  return false;
}

// Link entries whose text sits exactly under `range` (the cursor or a selection). Shared by the lightbulb provider and by the
// decoration code, so both always agree on which line is going to show the documentation lightbulb.
function linkEntriesAt(document, range){
  if (range.start.line !== range.end.line) return [];
  const { links, maxLinkLength } = getBookmarks();
  if (!links.length || range.end.character - range.start.character > maxLinkLength) return [];
  const line = range.start.line, margin = maxLinkLength + 2;            // +2: room for a surrogate pair at either edge
  const from = Math.max(0, range.start.character - margin);
  const text = document.getText(new vscode.Range(line, from, line, range.end.character + margin)); // a few characters, never the file
  const selStart = range.start.character - from, selEnd = range.end.character - from;
  return links.filter(entry => matchesAt(text, entry, selStart, selEnd));
}

class DocumentationLinkProvider {
  provideCodeActions(document, range, context){
    if (context.only && !context.only.contains(vscode.CodeActionKind.QuickFix)) return undefined;
    const actions = linkEntriesAt(document, range).map(entry => {
      const action = new vscode.CodeAction(`${DOC_TITLE_PREFIX}Open ${entry.text} Documentation`, vscode.CodeActionKind.QuickFix);
      action.command = { command: DOC_COMMAND, title: action.title, arguments: [entry.url] };
      return action;
    });
    return actions.length ? actions : undefined;
  }
}
DocumentationLinkProvider.providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

async function openDocumentation(url){
  if (typeof url !== 'string' || !DOC_URL.test(url.trim())) return false;
  try { return await vscode.env.openExternal(vscode.Uri.parse(url.trim())); } catch { return false; } // no error popups
}

// ---------------------------------------------------------------------------
// Decorations. VS Code has no API for the background of the line-number text itself (the old `lineNumberStyle` option does not
// exist and was ignored). The supported way to color the gutter is a glyph-margin icon: a solid square stretched over the
// whole gutter cell (`gutterIconSize: 'cover'`) gives each matching line a colored strip next to its line number. The line
// text is never touched. Needs `editor.glyphMargin` (default true). The overview ruler uses the same color.
//
// Lightbulb: VS Code (editor/contrib/codeAction/browser/lightBulbWidget.ts) draws its lightbulb in the gutter only when the
// line has no glyph-margin decoration of any kind; with one it falls back to an inline widget that sits ON the code when the
// neighbouring lines are not indented. A gutter strip and the gutter lightbulb can therefore never share a line. Hence two styles
// (setting `autoBookmarks.highlightStyle`):
//   'edge'   (default) a 3px bar on the left edge of the line, right next to the gutter. It is a normal whole-line decoration,
//            not a glyph-margin one, so the gutter stays free for VS Code's lightbulb: both are visible together.
//   'gutter' the strip in the gutter itself. On the line where the documentation lightbulb is about to show (cursor on a link
//            text) the strip steps aside and comes back when the cursor leaves. See `skipLine` in activate().
// ---------------------------------------------------------------------------
const CSS_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([0-9.,%\s]+\))$/i; // the value ends up inside a generated SVG
const safeColor = c => (typeof c === 'string' && CSS_COLOR.test(c.trim()) ? c.trim() : DEFAULT_COLOR);
function gutterIconUri(color){
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" preserveAspectRatio="none">' +
    `<rect width="16" height="16" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

class DecorationManager {
  constructor(){ this.types = new Map(); this.skipped = new WeakMap(); } // types: marker -> { color, type }, reused between refreshes. skipped: editor -> line left undecorated
  typeFor(marker, color, style){
    const known = this.types.get(marker);
    if (known && known.color === color && known.style === style) return known.type;
    if (known) known.type.dispose();
    const look = style === 'gutter'
      ? { gutterIconPath: gutterIconUri(color), gutterIconSize: 'cover' }
      : { borderStyle: 'solid', borderWidth: '0 0 0 3px', borderColor: color }; // left edge of the line only; the text is not moved
    const type = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      ...look,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.types.set(marker, { color, style, type });
    return type;
  }
  apply(editors, bookmarks, scanFor, skipLine = () => -1, style = 'edge'){
    const live = new Set(bookmarks.markers); // active entries only: disabled or removed ones lose their decoration
    for (const [marker, entry] of this.types) if (!live.has(marker)) { entry.type.dispose(); this.types.delete(marker); }
    for (const ed of editors) {
      const skip = skipLine(ed); this.skipped.set(ed, skip);
      const byMarker = new Map(scanFor(ed.document).map(g => [g.marker, g]));
      for (const marker of bookmarks.markers) {
        const group = byMarker.get(marker);
        if (group) {
          const ranges = []; let prevLine = -1; // one range per line is enough: several hits on a line look identical
          for (const hit of group.hits) if (hit.line !== prevLine) { prevLine = hit.line; if (hit.line !== skip) ranges.push(new vscode.Range(hit.line, 0, hit.line, 0)); }
          ed.setDecorations(this.typeFor(marker, safeColor(bookmarks.colors.get(marker)), style), ranges);
        } else if (this.types.has(marker)) ed.setDecorations(this.types.get(marker).type, []);
      }
    }
  }
  dispose(){ for (const { type } of this.types.values()) type.dispose(); this.types.clear(); }
}

class TreeProvider { constructor(){this.e=new vscode.EventEmitter();this.onDidChangeTreeData=this.e.event;} refresh(){this.e.fire();} getChildren(x){return x?.hits||groups();} getTreeItem(x){if(x.hits)return new vscode.TreeItem(`${x.marker} (${x.hits.length})`,vscode.TreeItemCollapsibleState.Expanded);const t=new vscode.TreeItem(`${path.basename(x.file)}:${x.line+1}`);t.description=x.preview;t.tooltip=x.preview;t.command={command:'autoBookmarks.reveal',title:'Reveal',arguments:[x]};return t;} }

function settingsHtml(webview){
 const c=config(), types=c.get('fileTypes',[]), cs=c.get('caseSensitive',true), maxMb=maxFileSizeMB();
 const rawBookmarks=c.get('documentationLinks',[]);
 const bookmarks=(Array.isArray(rawBookmarks)?rawBookmarks:[]).filter(x=>x&&typeof x==='object').map(x=>({text:typeof x.text==='string'?x.text:'',color:typeof x.color==='string'?x.color:'',url:typeof x.url==='string'?x.url:'',active:typeof x.active==='boolean'?x.active:true}));
 const model=JSON.stringify({types,cs,maxMb,bookmarks}).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;max-width:850px;margin:auto}h1{font-size:22px}section{border:1px solid var(--vscode-panel-border);padding:16px;margin:14px 0;border-radius:8px}label{display:block;font-weight:600;margin:8px 0}textarea,input[type=text],input[type=number]{box-sizing:border-box;width:100%;padding:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border)}.actions{display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:8px;background:var(--vscode-editor-background);padding:10px}button{padding:8px 14px;border:0;border-radius:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}small{color:var(--vscode-descriptionForeground)}#status{margin-right:auto;color:var(--vscode-testing-iconPassed)}
 .bmrow{display:grid;grid-template-columns:56px minmax(0,1.2fr) 44px 92px minmax(0,2fr) 80px;gap:10px;align-items:center;margin:8px 0}.bmhead{font-weight:600;margin-bottom:0}.bmhead .colorhead{grid-column:span 2}input[type=color]{width:44px;height:32px;padding:0;border:1px solid var(--vscode-input-border);background:transparent}#bmErr{color:var(--vscode-errorForeground);margin:6px 0}.bmrow label.act{display:flex;align-items:center;gap:4px;font-weight:400;margin:0}.bmrow.off .bm-text{opacity:.55;text-decoration:line-through}
 </style></head><body><h1>Auto Bookmarks Settings</h1><section><label>Bookmarks</label><small>Text to find in the active file, its highlight color, and an optional documentation link. Untick the Active box to stop searching for a text without deleting it. With a link, the lightbulb offers "Open Documentation" when the cursor is on an exact match.</small><div class="bmrow bmhead"><span>Active</span><span>Search Text</span><span class="colorhead">Color</span><span>Documentation URL (optional)</span><span></span></div><div id="bookmarks"></div><div id="bmErr"></div><button id="addBm" type="button">+ Add Bookmark</button></section><section><label for="types">File types</label><small>Comma separated. Empty means all file types.</small><input id="types" type="text"></section><section><label><input id="cs" type="checkbox"> Case sensitive</label></section><section><label for="maxMb">Maximum file size (MB)</label><small>Larger files are not scanned. 0 disables the limit.</small><input id="maxMb" type="number" min="0" step="any"></section><div class="actions"><span id="status"></span><button id="reload">Discard</button><button id="save">Save settings</button></div><script>
 const vscode=acquireVsCodeApi();let model=${model};
 const DEFAULT_COLOR='#3b82f6',HEX=/^#[0-9a-fA-F]{6}$/;
 function row(b){const r=document.createElement('div');r.className='bmrow';const al=document.createElement('label');al.className='act';const a=document.createElement('input');a.type='checkbox';a.className='bm-active';a.checked=b.active!==false;a.onchange=()=>r.classList.toggle('off',!a.checked);r.classList.toggle('off',!a.checked);a.title='Active';a.setAttribute('aria-label','Active');al.append(a);const t=document.createElement('input');t.type='text';t.className='bm-text';t.placeholder='GlideRecord';t.value=b.text||'';const p=document.createElement('input');p.type='color';p.className='bm-color';p.value=HEX.test(b.color||'')?b.color:DEFAULT_COLOR;const h=document.createElement('input');h.type='text';h.className='bm-hex';h.value=p.value;const u=document.createElement('input');u.type='text';u.className='bm-url';u.placeholder='https://... (optional)';u.value=b.url||'';const d=document.createElement('button');d.type='button';d.textContent='Delete';d.onclick=()=>r.remove();p.oninput=()=>{h.value=p.value};h.oninput=()=>{if(HEX.test(h.value))p.value=h.value};r.append(al,t,p,h,u,d);return r;}
 function render(m){model=m;document.getElementById('types').value=m.types.join(', ');document.getElementById('cs').checked=m.cs;document.getElementById('maxMb').value=m.maxMb;const box=document.getElementById('bookmarks');box.innerHTML='';m.bookmarks.forEach(b=>box.append(row(b)));}
 function collect(){const out=[],seen=new Set();let bad='';document.querySelectorAll('#bookmarks .bmrow').forEach(r=>{const text=r.querySelector('.bm-text').value.trim(),url=r.querySelector('.bm-url').value.trim(),color=r.querySelector('.bm-color').value;if(!text&&!url)return;if(!text){bad=bad||'Each row needs a search text.';return;}if(seen.has(text)){bad=bad||'Duplicate search text: '+text;return;}seen.add(text);if(url&&!/^https?:[/][/]/i.test(url)){bad=bad||'Documentation URLs must start with http:// or https:// ('+text+')';return;}const e={text,active:r.querySelector('.bm-active').checked,color};if(url)e.url=url;out.push(e);});document.getElementById('bmErr').textContent=bad;return bad?null:out;}
 document.getElementById('addBm').onclick=()=>{const r=row({});document.getElementById('bookmarks').append(r);r.querySelector('.bm-text').focus();};
 render(model);
 document.getElementById('save').onclick=()=>{const bookmarks=collect();if(!bookmarks)return;const fileTypes=document.getElementById('types').value.split(',').map(x=>x.trim()).filter(Boolean).map(x=>x.startsWith('.')?x.toLowerCase():'.'+x.toLowerCase());const mb=parseFloat(document.getElementById('maxMb').value);vscode.postMessage({type:'save',fileTypes,caseSensitive:document.getElementById('cs').checked,maxFileSizeMB:Number.isFinite(mb)&&mb>=0?mb:20,documentationLinks:bookmarks});};
 document.getElementById('reload').onclick=()=>vscode.postMessage({type:'reload'});
 window.addEventListener('message',e=>{if(e.data.type==='model')render(e.data.model);if(e.data.type==='saved'){document.getElementById('status').textContent='Saved';setTimeout(()=>document.getElementById('status').textContent='',1200)}});
 </script></body></html>`;
}
function activate(context){
 const tree=new TreeProvider();
 const decorations=new DecorationManager();
 context.subscriptions.push({dispose(){ decorations.dispose(); }});

 // Debounced refresh: bursts of events (typing, tab switches, settings saves) collapse into one rebuild.
 let refreshTimer;
 function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{
   tree.refresh();
   updateDecorations();
  },REFRESH_DELAY_MS);
 }
 function refreshNow(){ clearTimeout(refreshTimer); tree.refresh(); updateDecorations(); }
 context.subscriptions.push({dispose(){ clearTimeout(refreshTimer); }});
 const scanFor=doc=>allowed(doc)?scanDocument(doc):[];
 // The line whose strip steps aside so VS Code can put its documentation lightbulb in the gutter instead of over the code.
 const highlightStyle=()=>config().get('highlightStyle','edge')==='gutter'?'gutter':'edge';
 const skipLine=ed=>highlightStyle()==='gutter'&&ed===vscode.window.activeTextEditor&&ed.selection&&linkEntriesAt(ed.document,ed.selection).length?ed.selection.active.line:-1;
 function updateDecorations(){
  const data=groups(); // cached per document version: the tree, the badge and the decorations share one scan
  const count=data.reduce((total,group)=>total+group.hits.length,0);
  treeView.badge=count>0?{value:count,tooltip:`${count} bookmark match${count===1?'':'es'}`}:undefined;
  decorations.apply(vscode.window.visibleTextEditors,getBookmarks(),scanFor,skipLine,highlightStyle());
 }
 const treeView=vscode.window.createTreeView('autoBookmarksView',{treeDataProvider:tree}); context.subscriptions.push(treeView);
 let panel;
 const openSettings=()=>{if(panel){panel.reveal();panel.webview.html=settingsHtml(panel.webview);return;}panel=vscode.window.createWebviewPanel('autoBookmarksSettings','Auto Bookmarks Settings',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true});panel.webview.html=settingsHtml(panel.webview);panel.webview.onDidReceiveMessage(async m=>{if(m.type==='save'){const c=config();const put=async(k,v)=>{if(JSON.stringify(c.get(k))!==JSON.stringify(v))await c.update(k,v,vscode.ConfigurationTarget.Global);};await put('fileTypes',m.fileTypes);await put('caseSensitive',m.caseSensitive);if(typeof m.maxFileSizeMB==='number'&&Number.isFinite(m.maxFileSizeMB)&&m.maxFileSizeMB>=0)await put('maxFileSizeMB',m.maxFileSizeMB);if(Array.isArray(m.documentationLinks))await put('documentationLinks',sanitizeBookmarks(m.documentationLinks));scheduleRefresh();panel.webview.postMessage({type:'saved'});vscode.window.showInformationMessage('Auto Bookmarks settings saved globally for your VS Code user profile.');}else if(m.type==='reload'){panel.webview.html=settingsHtml(panel.webview);}},undefined,context.subscriptions);panel.onDidDispose(()=>panel=undefined,undefined,context.subscriptions);};
 context.subscriptions.push(
  vscode.commands.registerCommand('autoBookmarks.openSettings',openSettings),
  vscode.commands.registerCommand('autoBookmarks.refresh',()=>{scanCache.clear();refreshNow();}),
  vscode.commands.registerCommand('autoBookmarks.addSelectedText',async()=>{const ed=vscode.window.activeTextEditor;if(!ed||ed.selection.isEmpty){vscode.window.showWarningMessage('Select text in the editor first.');return;}const value=ed.document.getText(ed.selection).trim();if(!value)return;const c=config(), raw=c.get('documentationLinks',[]), arr=Array.isArray(raw)?raw:[];const found=arr.find(x=>x&&x.text===value);if(found&&found.active!==false){vscode.window.showInformationMessage(`Auto Bookmarks already contains: ${value}`);return;}if(found){await c.update('documentationLinks',arr.map(x=>x===found?withActive({...x,active:true}):x),vscode.ConfigurationTarget.Global);vscode.window.showInformationMessage(`Re-enabled Auto Bookmark search text: ${value}`);return;}await c.update('documentationLinks',[...arr,{text:value,active:true,color:DEFAULT_COLOR}],vscode.ConfigurationTarget.Global);scheduleRefresh();vscode.window.showInformationMessage(`Added Auto Bookmark search text: ${value}`);}),
  vscode.commands.registerCommand('autoBookmarks.reveal',async x=>{const d=await vscode.workspace.openTextDocument(x.file),ed=await vscode.window.showTextDocument(d);const p=new vscode.Position(x.line,x.character);ed.selection=new vscode.Selection(p,p);ed.revealRange(new vscode.Range(p,p),vscode.TextEditorRevealType.InCenter);}),
  vscode.commands.registerCommand(DOC_COMMAND,openDocumentation),
  vscode.languages.registerCodeActionsProvider(DOC_SELECTOR,new DocumentationLinkProvider(),{providedCodeActionKinds:DocumentationLinkProvider.providedCodeActionKinds}),
  vscode.window.onDidChangeActiveTextEditor(scheduleRefresh),
  vscode.window.onDidChangeVisibleTextEditors(scheduleRefresh),
  // Immediate (not debounced) and limited to the one editor, so the strip is gone before VS Code decides where the lightbulb goes.
  vscode.window.onDidChangeTextEditorSelection(e=>{const ed=e.textEditor,next=skipLine(ed);if(decorations.skipped.get(ed)!==next)decorations.apply([ed],getBookmarks(),scanFor,skipLine,highlightStyle());}),
  vscode.workspace.onDidChangeTextDocument(e=>{
   if(!e.contentChanges.length) return; // dirty-flag changes etc.: same text, same cache entry, nothing to redo
   invalidateDocument(e.document.uri);
   if(vscode.window.visibleTextEditors.some(ed=>ed.document===e.document)) scheduleRefresh();
  }),
  vscode.workspace.onDidCloseTextDocument(doc=>{ invalidateDocument(doc.uri); oversizedNotified.delete(doc.uri.toString()); }),
  vscode.workspace.onDidChangeConfiguration(e=>{
   if(!e.affectsConfiguration('autoBookmarks')) return;
   if(e.affectsConfiguration('autoBookmarks.documentationLinks')) bookmarkCache=null;
   // the bookmark list (texts, colors, links) and the scan options decide what is found and how it is drawn
   if(['documentationLinks','fileTypes','caseSensitive','maxFileSizeMB','highlightStyle'].some(k=>e.affectsConfiguration('autoBookmarks.'+k))){
    const key=currentScanKey();
    if(key!==scanKey){ scanKey=key; scanCache.clear(); } // active markers / case mode / size limit changed: results are stale
    if(e.affectsConfiguration('autoBookmarks.maxFileSizeMB')) oversizedNotified.clear();
    scheduleRefresh(); // otherwise cached results are reused and only the view and decorations are redrawn
   }
   if(panel)panel.webview.html=settingsHtml(panel.webview);
  })
 );
 scanKey=currentScanKey();
 scheduleRefresh();
 migrateLegacySettings(context).catch(()=>{}).then(migrateActiveFlags).catch(()=>{});
 // Open custom settings from the title action available via Command Palette.
}
module.exports={activate,deactivate(){scanCache.clear();oversizedNotified.clear();bookmarkCache=null;matcherCache=null;}};
