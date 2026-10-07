const vscode = require('vscode');
const path = require('path');

const config = () => vscode.workspace.getConfiguration('autoBookmarks');
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allowed(doc){ const xs=config().get('fileTypes',[]); return !xs.length || xs.includes(path.extname(doc.fileName).toLowerCase()); }
function groups(){
 const ed=vscode.window.activeTextEditor;if(!ed||!allowed(ed.document))return [];
 const c=config(), markers=c.get('searchTexts',[]), cs=c.get('caseSensitive',true), src=ed.document.getText(), hay=cs?src:src.toLowerCase();
 return markers.map(marker=>{const needle=cs?marker:marker.toLowerCase();let i=0,hits=[];if(!needle)return {marker,hits};while((i=hay.indexOf(needle,i))>=0){const p=ed.document.positionAt(i);hits.push({marker,file:ed.document.fileName,line:p.line,character:p.character,preview:ed.document.lineAt(p.line).text.trim()});i+=needle.length;}return {marker,hits};}).filter(g=>g.hits.length);
}
class TreeProvider { constructor(){this.e=new vscode.EventEmitter();this.onDidChangeTreeData=this.e.event;} refresh(){this.e.fire();} getChildren(x){return x?.hits||groups();} getTreeItem(x){if(x.hits)return new vscode.TreeItem(`${x.marker} (${x.hits.length})`,vscode.TreeItemCollapsibleState.Expanded);const t=new vscode.TreeItem(`${path.basename(x.file)}:${x.line+1}`);t.description=x.preview;t.tooltip=x.preview;t.command={command:'autoBookmarks.reveal',title:'Reveal',arguments:[x]};return t;} }

function settingsHtml(webview){
 const c=config(), texts=c.get('searchTexts',[]), types=c.get('fileTypes',[]), colors=c.get('colors',{}), cs=c.get('caseSensitive',true);
 const model=JSON.stringify({texts,types,colors,cs}).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;max-width:850px;margin:auto}h1{font-size:22px}section{border:1px solid var(--vscode-panel-border);padding:16px;margin:14px 0;border-radius:8px}label{display:block;font-weight:600;margin:8px 0}textarea,input[type=text]{box-sizing:border-box;width:100%;padding:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border)}.row{display:grid;grid-template-columns:160px 50px 1fr;gap:10px;align-items:center;margin:8px 0}.actions{display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:8px;background:var(--vscode-editor-background);padding:10px}button{padding:8px 14px;border:0;border-radius:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}small{color:var(--vscode-descriptionForeground)}#status{margin-right:auto;color:var(--vscode-testing-iconPassed)}
 </style></head><body><h1>Auto Bookmarks Settings</h1><section><label for="texts">Search texts</label><small>One marker per line.</small><textarea id="texts" rows="7"></textarea></section><section><label for="types">File types</label><small>Comma separated. Empty means all file types.</small><input id="types" type="text"></section><section><label>Bookmark colors</label><div id="colors"></div></section><section><label><input id="cs" type="checkbox"> Case sensitive</label></section><div class="actions"><span id="status"></span><button id="reload">Discard</button><button id="save">Save settings</button></div><script>
 const vscode=acquireVsCodeApi();let model=${model};
 function render(m){model=m;document.getElementById('texts').value=m.texts.join('\\n');document.getElementById('types').value=m.types.join(', ');document.getElementById('cs').checked=m.cs;const box=document.getElementById('colors');box.innerHTML='';m.texts.forEach(name=>{const row=document.createElement('div');row.className='row';const n=document.createElement('span');n.textContent=name;const picker=document.createElement('input');picker.type='color';picker.value=m.colors[name]||'#3b82f6';picker.dataset.name=name;const hex=document.createElement('input');hex.type='text';hex.value=picker.value;picker.oninput=()=>hex.value=picker.value;hex.oninput=()=>{if(/^#[0-9a-fA-F]{6}$/.test(hex.value))picker.value=hex.value};row.append(n,picker,hex);box.append(row);});}
 render(model);
 document.getElementById('texts').addEventListener('input',()=>{const names=document.getElementById('texts').value.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);const colors={...model.colors};model={...model,texts:names,colors};renderColors(names,colors)});
 function renderColors(names,colors){const box=document.getElementById('colors');box.innerHTML='';names.forEach(name=>{const row=document.createElement('div');row.className='row';const n=document.createElement('span');n.textContent=name;const picker=document.createElement('input');picker.type='color';picker.value=colors[name]||'#3b82f6';picker.dataset.name=name;const hex=document.createElement('input');hex.type='text';hex.value=picker.value;picker.oninput=()=>hex.value=picker.value;hex.oninput=()=>{if(/^#[0-9a-fA-F]{6}$/.test(hex.value))picker.value=hex.value};row.append(n,picker,hex);box.append(row);});}
 document.getElementById('save').onclick=()=>{const searchTexts=document.getElementById('texts').value.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);const fileTypes=document.getElementById('types').value.split(',').map(x=>x.trim()).filter(Boolean).map(x=>x.startsWith('.')?x.toLowerCase():'.'+x.toLowerCase());const colors={};document.querySelectorAll('#colors input[type=color]').forEach(i=>colors[i.dataset.name]=i.value);vscode.postMessage({type:'save',searchTexts,fileTypes,caseSensitive:document.getElementById('cs').checked,colors});};
 document.getElementById('reload').onclick=()=>vscode.postMessage({type:'reload'});
 window.addEventListener('message',e=>{if(e.data.type==='model')render(e.data.model);if(e.data.type==='saved'){document.getElementById('status').textContent='Saved';setTimeout(()=>document.getElementById('status').textContent='',1200)}});
 </script></body></html>`;
}
function activate(context){
 const tree=new TreeProvider();
 let decorations=[];
 function clearDecorations(){ for(const d of decorations){ try{ d.dispose(); }catch{} } decorations=[]; }
 function updateDecorations(){
  clearDecorations();
  const count=groups().reduce((total,group)=>total+group.hits.length,0);
  treeView.badge=count>0?{value:count,tooltip:`${count} bookmark match${count===1?'':'es'}`}:undefined;
  const ed=vscode.window.activeTextEditor; if(!ed || !allowed(ed.document)) return;
  const c=config(), colors=c.get('colors',{}), data=groups();
  for(const group of data){
   const color=colors[group.marker] || '#3b82f6';
   const decoration=vscode.window.createTextEditorDecorationType({
    isWholeLine:false,
    overviewRulerColor:color,
    overviewRulerLane:vscode.OverviewRulerLane.Left,
    light:{lineNumberStyle:{color}},
    dark:{lineNumberStyle:{color}}
   });
   decorations.push(decoration);
   ed.setDecorations(decoration, group.hits.map(hit=>new vscode.Range(hit.line,0,hit.line,0)));
  }
 }const treeView=vscode.window.createTreeView('autoBookmarksView',{treeDataProvider:tree}); context.subscriptions.push(treeView);
 let panel;
 const openSettings=()=>{if(panel){panel.reveal();panel.webview.html=settingsHtml(panel.webview);return;}panel=vscode.window.createWebviewPanel('autoBookmarksSettings','Auto Bookmarks Settings',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true});panel.webview.html=settingsHtml(panel.webview);panel.webview.onDidReceiveMessage(async m=>{if(m.type==='save'){const c=config();await c.update('searchTexts',m.searchTexts,vscode.ConfigurationTarget.Global);await c.update('fileTypes',m.fileTypes,vscode.ConfigurationTarget.Global);await c.update('caseSensitive',m.caseSensitive,vscode.ConfigurationTarget.Global);await c.update('colors',m.colors,vscode.ConfigurationTarget.Global);tree.refresh();panel.webview.postMessage({type:'saved'});vscode.window.showInformationMessage('Auto Bookmarks settings saved globally for your VS Code user profile.');}else if(m.type==='reload'){panel.webview.html=settingsHtml(panel.webview);}},undefined,context.subscriptions);panel.onDidDispose(()=>panel=undefined,undefined,context.subscriptions);};
 context.subscriptions.push(
  vscode.commands.registerCommand('autoBookmarks.openSettings',openSettings),
  vscode.commands.registerCommand('autoBookmarks.refresh',()=>{tree.refresh();updateDecorations();}),
  vscode.commands.registerCommand('autoBookmarks.addSelectedText',async()=>{const ed=vscode.window.activeTextEditor;if(!ed||ed.selection.isEmpty){vscode.window.showWarningMessage('Select text in the editor first.');return;}const value=ed.document.getText(ed.selection).trim();if(!value)return;const c=config(), arr=c.get('searchTexts',[]);if(arr.includes(value)){vscode.window.showInformationMessage(`Auto Bookmarks already contains: ${value}`);return;}await c.update('searchTexts',[...arr,value],vscode.ConfigurationTarget.Global);tree.refresh();updateDecorations();vscode.window.showInformationMessage(`Added Auto Bookmark search text: ${value}`);}),
  vscode.commands.registerCommand('autoBookmarks.reveal',async x=>{const d=await vscode.workspace.openTextDocument(x.file),ed=await vscode.window.showTextDocument(d);const p=new vscode.Position(x.line,x.character);ed.selection=new vscode.Selection(p,p);ed.revealRange(new vscode.Range(p,p),vscode.TextEditorRevealType.InCenter);}),
  vscode.window.onDidChangeActiveTextEditor(()=>{tree.refresh();updateDecorations();}),vscode.workspace.onDidChangeTextDocument(e=>{if(vscode.window.activeTextEditor && e.document===vscode.window.activeTextEditor.document){tree.refresh();updateDecorations();}}),vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('autoBookmarks')){tree.refresh();updateDecorations();if(panel)panel.webview.html=settingsHtml(panel.webview);}})
 );
 updateDecorations();
 // Open custom settings from the title action available via Command Palette.
}
module.exports={activate,deactivate(){}};
