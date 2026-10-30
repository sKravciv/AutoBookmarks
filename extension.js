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
  const groupByLabel = new Map(labels.map(label => [label, { marker: label, hits: [] }]));
  const keys = [], keyIndex = new Map();
  for (const label of labels) {
    const n = norm(label);
    let i = keyIndex.get(n);
    if (i === undefined) { i = keys.length; keyIndex.set(n, i); keys.push({ norm: n, text: label, length: label.length, groups: [], shorter: [] }); }
    keys[i].groups.push(groupByLabel.get(label));
  }
  // "shorter" = other markers that are a prefix of this one. The regex only reports the longest marker at a
  // position, so these are credited as well, which keeps "TODO" and "TODO:" both matching like before.
  keys.forEach((k, i) => keys.forEach((o, j) => { if (i !== j && o.norm.length < k.norm.length && k.norm.startsWith(o.norm)) k.shorter.push(j); }));
  const source = keys.map(k => k.text).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
  return { regex: new RegExp(source, caseSensitive ? 'g' : 'gi'), keys, keyIndex, labels, groupByLabel };
}

function runScan(doc, matcher, caseSensitive){
  const text = doc.getText();
  const { regex, keys, keyIndex, labels, groupByLabel } = matcher;
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
      for (const group of keys[kid].groups) group.hits.push({ marker: group.marker, file, line: pos.line, character: pos.character, preview: lastPreview });
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
    const matcher = buildMatcher(getBookmarks().markers, caseSensitive);
    if (matcher) result = runScan(doc, matcher, caseSensitive);
  }
  cacheSet(key, result);
  return result;
}

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

// autoBookmarks.documentationLinks is the one list behind everything: [{ text, color?, url? }].
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
      color: typeof item.color === 'string' && item.color.trim() ? item.color.trim() : DEFAULT_COLOR,
      url: DOC_URL.test(url) ? url : undefined,            // anything that is not an http(s) link is ignored
      leadWord: isWordChar(charAfter(item.text, 0)), trailWord: isWordChar(charBefore(item.text, item.text.length)),
    });
  }
  const links = entries.filter(e => e.url);
  bookmarkCache = {
    markers: entries.map(e => e.text),
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
    const entry = { text };
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
      merged.push(item.color || !colors[item.text] ? { ...item } : { ...item, color: colors[item.text] });
    }
    for (const text of texts) {                                                                           // then every old search text
      if (typeof text !== 'string' || !text.trim() || seen.has(text)) continue;
      seen.add(text);
      merged.push(colors[text] ? { text, color: colors[text] } : { text });
    }
    await c.update('documentationLinks', merged, vscode.ConfigurationTarget.Global);
    if (legacyTexts !== undefined) await c.update('searchTexts', undefined, vscode.ConfigurationTarget.Global);
    if (legacyColors !== undefined) await c.update('colors', undefined, vscode.ConfigurationTarget.Global);
  }
  await context.globalState.update(MIGRATION_FLAG, true);
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

class DocumentationLinkProvider {
  provideCodeActions(document, range, context){
    if (context.only && !context.only.contains(vscode.CodeActionKind.QuickFix)) return undefined;
    if (range.start.line !== range.end.line) return undefined;
    const { links, maxLinkLength } = getBookmarks();
    if (!links.length || range.end.character - range.start.character > maxLinkLength) return undefined;
    const line = range.start.line, margin = maxLinkLength + 2;            // +2: room for a surrogate pair at either edge
    const from = Math.max(0, range.start.character - margin);
    const text = document.getText(new vscode.Range(line, from, line, range.end.character + margin)); // a few characters, never the file
    const selStart = range.start.character - from, selEnd = range.end.character - from;
    const actions = [];
    for (const entry of links) {
      if (!matchesAt(text, entry, selStart, selEnd)) continue;
      const action = new vscode.CodeAction(`${DOC_TITLE_PREFIX}Open ${entry.text} Documentation`, vscode.CodeActionKind.QuickFix);
      action.command = { command: DOC_COMMAND, title: action.title, arguments: [entry.url] };
      actions.push(action);
    }
    return actions.length ? actions : undefined;
  }
}
DocumentationLinkProvider.providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

async function openDocumentation(url){
  if (typeof url !== 'string' || !DOC_URL.test(url.trim())) return false;
  try { return await vscode.env.openExternal(vscode.Uri.parse(url.trim())); } catch { return false; } // no error popups
}

class TreeProvider { constructor(){this.e=new vscode.EventEmitter();this.onDidChangeTreeData=this.e.event;} refresh(){this.e.fire();} getChildren(x){return x?.hits||groups();} getTreeItem(x){if(x.hits)return new vscode.TreeItem(`${x.marker} (${x.hits.length})`,vscode.TreeItemCollapsibleState.Expanded);const t=new vscode.TreeItem(`${path.basename(x.file)}:${x.line+1}`);t.description=x.preview;t.tooltip=x.preview;t.command={command:'autoBookmarks.reveal',title:'Reveal',arguments:[x]};return t;} }

function settingsHtml(webview){
 const c=config(), types=c.get('fileTypes',[]), cs=c.get('caseSensitive',true), maxMb=maxFileSizeMB();
 const rawBookmarks=c.get('documentationLinks',[]);
 const bookmarks=(Array.isArray(rawBookmarks)?rawBookmarks:[]).filter(x=>x&&typeof x==='object').map(x=>({text:typeof x.text==='string'?x.text:'',color:typeof x.color==='string'?x.color:'',url:typeof x.url==='string'?x.url:''}));
 const model=JSON.stringify({types,cs,maxMb,bookmarks}).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;max-width:850px;margin:auto}h1{font-size:22px}section{border:1px solid var(--vscode-panel-border);padding:16px;margin:14px 0;border-radius:8px}label{display:block;font-weight:600;margin:8px 0}textarea,input[type=text],input[type=number]{box-sizing:border-box;width:100%;padding:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border)}.actions{display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:8px;background:var(--vscode-editor-background);padding:10px}button{padding:8px 14px;border:0;border-radius:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}small{color:var(--vscode-descriptionForeground)}#status{margin-right:auto;color:var(--vscode-testing-iconPassed)}
 .bmrow{display:grid;grid-template-columns:minmax(0,1.2fr) 44px 92px minmax(0,2fr) 80px;gap:10px;align-items:center;margin:8px 0}.bmhead{font-weight:600;margin-bottom:0}.bmhead .colorhead{grid-column:span 2}input[type=color]{width:44px;height:32px;padding:0;border:1px solid var(--vscode-input-border);background:transparent}#bmErr{color:var(--vscode-errorForeground);margin:6px 0}
 </style></head><body><h1>Auto Bookmarks Settings</h1><section><label>Bookmarks</label><small>Text to find in the active file, its highlight color, and an optional documentation link. With a link, the lightbulb offers "Open Documentation" when the cursor is on an exact match.</small><div class="bmrow bmhead"><span>Search Text</span><span class="colorhead">Color</span><span>Documentation URL (optional)</span><span></span></div><div id="bookmarks"></div><div id="bmErr"></div><button id="addBm" type="button">+ Add Bookmark</button></section><section><label for="types">File types</label><small>Comma separated. Empty means all file types.</small><input id="types" type="text"></section><section><label><input id="cs" type="checkbox"> Case sensitive</label></section><section><label for="maxMb">Maximum file size (MB)</label><small>Larger files are not scanned. 0 disables the limit.</small><input id="maxMb" type="number" min="0" step="any"></section><div class="actions"><span id="status"></span><button id="reload">Discard</button><button id="save">Save settings</button></div><script>
 const vscode=acquireVsCodeApi();let model=${model};
 const DEFAULT_COLOR='#3b82f6',HEX=/^#[0-9a-fA-F]{6}$/;
 function row(b){const r=document.createElement('div');r.className='bmrow';const t=document.createElement('input');t.type='text';t.className='bm-text';t.placeholder='GlideRecord';t.value=b.text||'';const p=document.createElement('input');p.type='color';p.className='bm-color';p.value=HEX.test(b.color||'')?b.color:DEFAULT_COLOR;const h=document.createElement('input');h.type='text';h.className='bm-hex';h.value=p.value;const u=document.createElement('input');u.type='text';u.className='bm-url';u.placeholder='https://... (optional)';u.value=b.url||'';const d=document.createElement('button');d.type='button';d.textContent='Delete';d.onclick=()=>r.remove();p.oninput=()=>{h.value=p.value};h.oninput=()=>{if(HEX.test(h.value))p.value=h.value};r.append(t,p,h,u,d);return r;}
 function render(m){model=m;document.getElementById('types').value=m.types.join(', ');document.getElementById('cs').checked=m.cs;document.getElementById('maxMb').value=m.maxMb;const box=document.getElementById('bookmarks');box.innerHTML='';m.bookmarks.forEach(b=>box.append(row(b)));}
 function collect(){const out=[],seen=new Set();let bad='';document.querySelectorAll('#bookmarks .bmrow').forEach(r=>{const text=r.querySelector('.bm-text').value.trim(),url=r.querySelector('.bm-url').value.trim(),color=r.querySelector('.bm-color').value;if(!text&&!url)return;if(!text){bad=bad||'Each row needs a search text.';return;}if(seen.has(text)){bad=bad||'Duplicate search text: '+text;return;}seen.add(text);if(url&&!/^https?:[/][/]/i.test(url)){bad=bad||'Documentation URLs must start with http:// or https:// ('+text+')';return;}const e={text,color};if(url)e.url=url;out.push(e);});document.getElementById('bmErr').textContent=bad;return bad?null:out;}
 document.getElementById('addBm').onclick=()=>{const r=row({});document.getElementById('bookmarks').append(r);r.querySelector('input').focus();};
 render(model);
 document.getElementById('save').onclick=()=>{const bookmarks=collect();if(!bookmarks)return;const fileTypes=document.getElementById('types').value.split(',').map(x=>x.trim()).filter(Boolean).map(x=>x.startsWith('.')?x.toLowerCase():'.'+x.toLowerCase());const mb=parseFloat(document.getElementById('maxMb').value);vscode.postMessage({type:'save',fileTypes,caseSensitive:document.getElementById('cs').checked,maxFileSizeMB:Number.isFinite(mb)&&mb>=0?mb:20,documentationLinks:bookmarks});};
 document.getElementById('reload').onclick=()=>vscode.postMessage({type:'reload'});
 window.addEventListener('message',e=>{if(e.data.type==='model')render(e.data.model);if(e.data.type==='saved'){document.getElementById('status').textContent='Saved';setTimeout(()=>document.getElementById('status').textContent='',1200)}});
 </script></body></html>`;
}
function activate(context){
 const tree=new TreeProvider();
 let decorations=[];
 function clearDecorations(){ for(const d of decorations){ try{ d.dispose(); }catch{} } decorations=[]; }

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
 function updateDecorations(){
  clearDecorations();
  const data=groups(); // cached per document version: the tree, the badge and the decorations share one scan
  const count=data.reduce((total,group)=>total+group.hits.length,0);
  treeView.badge=count>0?{value:count,tooltip:`${count} bookmark match${count===1?'':'es'}`}:undefined;
  const ed=vscode.window.activeTextEditor; if(!ed || !allowed(ed.document)) return;
  const colors=getBookmarks().colors;
  for(const group of data){
   const color=colors.get(group.marker) || DEFAULT_COLOR;
   const decoration=vscode.window.createTextEditorDecorationType({
    isWholeLine:false,
    overviewRulerColor:color,
    overviewRulerLane:vscode.OverviewRulerLane.Left,
    light:{lineNumberStyle:{color}},
    dark:{lineNumberStyle:{color}}
   });
   decorations.push(decoration);
   const ranges=[]; let prevLine=-1; // one range per line is enough: several hits on a line look identical
   for(const hit of group.hits){ if(hit.line!==prevLine){ prevLine=hit.line; ranges.push(new vscode.Range(hit.line,0,hit.line,0)); } }
   ed.setDecorations(decoration, ranges);
  }
 }
 const treeView=vscode.window.createTreeView('autoBookmarksView',{treeDataProvider:tree}); context.subscriptions.push(treeView);
 let panel;
 const openSettings=()=>{if(panel){panel.reveal();panel.webview.html=settingsHtml(panel.webview);return;}panel=vscode.window.createWebviewPanel('autoBookmarksSettings','Auto Bookmarks Settings',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true});panel.webview.html=settingsHtml(panel.webview);panel.webview.onDidReceiveMessage(async m=>{if(m.type==='save'){const c=config();await c.update('fileTypes',m.fileTypes,vscode.ConfigurationTarget.Global);await c.update('caseSensitive',m.caseSensitive,vscode.ConfigurationTarget.Global);if(typeof m.maxFileSizeMB==='number'&&Number.isFinite(m.maxFileSizeMB)&&m.maxFileSizeMB>=0)await c.update('maxFileSizeMB',m.maxFileSizeMB,vscode.ConfigurationTarget.Global);if(Array.isArray(m.documentationLinks))await c.update('documentationLinks',sanitizeBookmarks(m.documentationLinks),vscode.ConfigurationTarget.Global);scheduleRefresh();panel.webview.postMessage({type:'saved'});vscode.window.showInformationMessage('Auto Bookmarks settings saved globally for your VS Code user profile.');}else if(m.type==='reload'){panel.webview.html=settingsHtml(panel.webview);}},undefined,context.subscriptions);panel.onDidDispose(()=>panel=undefined,undefined,context.subscriptions);};
 context.subscriptions.push(
  vscode.commands.registerCommand('autoBookmarks.openSettings',openSettings),
  vscode.commands.registerCommand('autoBookmarks.refresh',()=>{scanCache.clear();refreshNow();}),
  vscode.commands.registerCommand('autoBookmarks.addSelectedText',async()=>{const ed=vscode.window.activeTextEditor;if(!ed||ed.selection.isEmpty){vscode.window.showWarningMessage('Select text in the editor first.');return;}const value=ed.document.getText(ed.selection).trim();if(!value)return;const c=config(), raw=c.get('documentationLinks',[]), arr=Array.isArray(raw)?raw:[];if(arr.some(x=>x&&x.text===value)){vscode.window.showInformationMessage(`Auto Bookmarks already contains: ${value}`);return;}await c.update('documentationLinks',[...arr,{text:value,color:DEFAULT_COLOR}],vscode.ConfigurationTarget.Global);scheduleRefresh();vscode.window.showInformationMessage(`Added Auto Bookmark search text: ${value}`);}),
  vscode.commands.registerCommand('autoBookmarks.reveal',async x=>{const d=await vscode.workspace.openTextDocument(x.file),ed=await vscode.window.showTextDocument(d);const p=new vscode.Position(x.line,x.character);ed.selection=new vscode.Selection(p,p);ed.revealRange(new vscode.Range(p,p),vscode.TextEditorRevealType.InCenter);}),
  vscode.commands.registerCommand(DOC_COMMAND,openDocumentation),
  vscode.languages.registerCodeActionsProvider(DOC_SELECTOR,new DocumentationLinkProvider(),{providedCodeActionKinds:DocumentationLinkProvider.providedCodeActionKinds}),
  vscode.window.onDidChangeActiveTextEditor(scheduleRefresh),
  vscode.workspace.onDidChangeTextDocument(e=>{
   if(!e.contentChanges.length) return; // dirty-flag changes etc.: same text, same cache entry, nothing to redo
   invalidateDocument(e.document.uri);
   const ed=vscode.window.activeTextEditor;
   if(ed && e.document===ed.document) scheduleRefresh();
  }),
  vscode.workspace.onDidCloseTextDocument(doc=>{ invalidateDocument(doc.uri); oversizedNotified.delete(doc.uri.toString()); }),
  vscode.workspace.onDidChangeConfiguration(e=>{
   if(!e.affectsConfiguration('autoBookmarks')) return;
   if(e.affectsConfiguration('autoBookmarks.documentationLinks')) bookmarkCache=null;
   // the bookmark list (texts, colors, links) and the scan options decide what is found and how it is drawn
   if(['documentationLinks','fileTypes','caseSensitive','maxFileSizeMB'].some(k=>e.affectsConfiguration('autoBookmarks.'+k))){
    scanCache.clear();
    if(e.affectsConfiguration('autoBookmarks.maxFileSizeMB')) oversizedNotified.clear();
    scheduleRefresh();
   }
   if(panel)panel.webview.html=settingsHtml(panel.webview);
  })
 );
 scheduleRefresh();
 migrateLegacySettings(context).catch(()=>{});
 // Open custom settings from the title action available via Command Palette.
}
module.exports={activate,deactivate(){scanCache.clear();oversizedNotified.clear();bookmarkCache=null;}};
