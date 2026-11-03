# Auto Bookmarks

**Auto Bookmarks** is a Visual Studio Code extension that automatically finds configured text markers in the active file and presents them as navigable bookmarks in a dedicated Activity Bar view.

It is useful for quickly navigating recurring code patterns such as `TODO`, `FIXME`, `GlideRecord`, `gs.addErrorMessage`, or any other text you want to track.

## Features

- Automatically scans the active editor for configured search texts.
- Displays the total number of detected matches as a badge on the **Auto Bookmarks Activity Bar icon**.
- Groups detected occurrences by search text.
- Shows the number of matches for each bookmark group.
- Click an occurrence to navigate directly to its source line.
- Highlights every matching line with the bookmark's color: a bar on the left edge of the line, right next to the gutter (default), or a strip in the gutter itself (`autoBookmarks.highlightStyle`). The same color is shown in the editor **overview ruler** for quick navigation through larger files. The text of the line is not changed.
- **Active** checkbox per bookmark: temporarily switch a search text off without deleting it.
- Supports configurable file extensions.
- Supports case-sensitive or case-insensitive matching.
- Provides a dedicated **Auto Bookmarks Settings** page with one **Bookmarks** table for search texts, colors and documentation links.
- Add new search text directly from the editor context menu.
- Optional documentation link per bookmark: put the cursor on the text and the lightbulb (Quick Fix) opens its documentation page.
- Skips files above a configurable size limit and caches scan results, so large files stay responsive.
- Stores all configuration at the VS Code **User/Global** level so the same settings work across workspaces and when individual files are opened.

## Version

Current version: **2.6.0**

### What's new in 2.6.0

- **Export and import of the settings.** Share your bookmarks and options between machines or colleagues, or keep a backup. Use **Auto Bookmarks: Export Settings** / **Auto Bookmarks: Import Settings** from the Command Palette, or the **Export...** / **Import...** buttons on the settings page. See *Export and Import Settings* below.

### What's new in 2.5.0

- **Color and lightbulb are visible together.** VS Code draws its lightbulb in the gutter only on lines that have no gutter icon, so a colored gutter strip and the gutter lightbulb can never share a line (with a strip, VS Code draws the lightbulb over your code instead). The color is therefore now drawn as a bar on the left edge of the line, right next to the gutter (new setting `autoBookmarks.highlightStyle`, default `edge`). Set it to `gutter` for the previous gutter strip; in that style the strip hides on the cursor line while the cursor is on a link text, so the lightbulb can take its place.

### What's new in 2.4.1

- The Bookmarks table on the settings page now has **Active** as a column header (like **Search Text**); the row checkboxes no longer repeat the word.

### What's new in 2.4.0

- **Active checkbox** for every bookmark. Each entry of `autoBookmarks.documentationLinks` can carry `"active": true|false`. Inactive entries are not searched, create no bookmarks, badge count or highlights, and stay stored so you can switch them on again. Entries saved by 2.2.x/2.3.x have no `active` key; they stay active and are written back as `"active": true` automatically, so nothing needs to be reconfigured. The documentation lightbulb of an entry keeps working while the entry is inactive.
- **Fixed bookmark colors.** The old highlight used a `lineNumberStyle` option that VS Code does not have, so only the overview ruler was colored. The configured color now fills the gutter next to the line number of each matching line (and the overview ruler). VS Code offers no way to color the line-number text itself, so this strip is the closest supported option; it needs `editor.glyphMargin` (on by default).
- **Marketplace icon.** `media/bookmark.svg` is rendered to `media/icon.png` (256 x 256) during packaging, because the Marketplace does not accept SVG for the extension icon. The SVG stays the source and the Activity Bar icon.
- Performance: the search expression is compiled once per set of active texts instead of once per scan, decoration types are reused instead of recreated on every refresh, all visible editors are decorated, and changing colors, URLs, file types, the settings page layout or an inactive entry no longer rescans files.

### What's new in 2.3.0

- One list for everything: the **Bookmarks** section of the settings page replaces the *Search texts*, *Bookmark colors* and *Documentation Links* sections. Each row has a search text, a color and an optional documentation link.
- The list is stored in `autoBookmarks.documentationLinks`. Existing `autoBookmarks.searchTexts` and `autoBookmarks.colors` values are merged into it automatically the first time 2.3.0 starts, and both settings are deprecated.
- **Add Selected Text** in the editor context menu adds a row to the same list.

### What's new in 2.2.0

- Documentation quick links: map text to a URL with `autoBookmarks.documentationLinks` (or the **Documentation Links** section of the settings page). With the cursor on an exact match, the lightbulb offers `Open <text> Documentation`. The separate Documentation Links section was merged into **Bookmarks** in 2.3.0.

### What's new in 2.1.0

- Large-file performance: files larger than `autoBookmarks.maxFileSizeMB` (default 20 MB) are skipped, with a status bar message shown once per file. The limit can also be edited on the settings page; set it to `0` to disable it.
- Scan results are cached per document version (up to 20 documents) and shared by the tree, badge and line-number highlights.
- The view and highlights refresh 300 ms after the last change instead of on every keystroke.
- All markers are found in a single pass, and each match stores at most the first 200 characters of its line as preview text.

### What's new in 2.0.3

- Added a match-count badge to the Auto Bookmarks Activity Bar icon.
- The badge shows the total number of configured bookmark matches in the active file.
- The badge updates as bookmark results change.
- The badge is hidden when there are no matches.
- Preserves the custom settings page and functionality from version 2.0.2.

## Installation

### Download the extension

Download the VSIX package:

```text
auto-bookmarks-2.6.0.vsix
```

### Install in Visual Studio Code

1. Open **Visual Studio Code**.
2. Open the Extensions view using:

   ```text
   Ctrl + Shift + X
   ```

3. Click the **...** menu at the top of the Extensions panel.
4. Select **Install from VSIX...**.
5. Select:

   ```text
   auto-bookmarks-2.6.0.vsix
   ```

6. Wait for the installation to complete.
7. Open the Command Palette:

   ```text
   Ctrl + Shift + P
   ```

8. Run:

   ```text
   Developer: Reload Window
   ```

### Install from the command line

You can also install the VSIX from a terminal:

```bash
code --install-extension auto-bookmarks-2.6.0.vsix
```

## Using Auto Bookmarks

After reloading Visual Studio Code, look for the **Auto Bookmarks bookmark icon** in the Activity Bar on the left side.

Click the icon to open the Auto Bookmarks sidebar.

The Activity Bar icon displays a badge containing the total number of bookmark matches found in the active file. When no matches are found, the badge is hidden.

Inside the sidebar, occurrences are grouped by configured search text. Each group displays its number of matches.

Click an occurrence to open and center the corresponding line in the editor.

## Configure Auto Bookmarks

Open the dedicated Auto Bookmarks settings page using either:

- The **Settings/gear** action in the Auto Bookmarks view.
- The Command Palette (`Ctrl + Shift + P`) and run:

  ```text
  Auto Bookmarks: Open Settings
  ```

The settings page allows you to configure:

- Bookmarks: one row per search text, with an **Active** checkbox, its color and an optional documentation link
- Allowed file types
- Case-sensitive matching
- Maximum file size to scan

Edit the **Bookmarks** table (tick or untick **Active**, edit a text, color or link in place, add rows with **+ Add Bookmark**, remove them with **Delete**), then click:

> **Save settings**

Use **Discard** to reload the saved values.

All Auto Bookmarks settings are stored at the VS Code **User/Global** level. Your configuration therefore applies across workspaces and also works when you open an individual file without opening a workspace.

## Export and Import Settings

Export writes your saved settings (bookmarks including inactive ones, colors, links, file types, case sensitivity, maximum file size, highlight style) to a JSON file; import reads such a file back.

- **Export:** run **Auto Bookmarks: Export Settings** (Command Palette) or click **Export...** on the settings page, then choose where to save `auto-bookmarks-settings.json`. Unsaved edits on the settings page are not included: click **Save settings** first.
- **Import:** run **Auto Bookmarks: Import Settings** or click **Import...**, then pick the file. Auto Bookmarks shows what the file contains and asks before changing anything:
  - **Replace** - the imported values replace your current ones.
  - **Merge** - bookmarks whose text you do not have yet are added; your existing bookmarks and all other settings stay as they are.
- Everything in the file is validated: invalid colors, non-http(s) links, duplicates and unknown keys are dropped, and files larger than 1 MB are refused. Nothing is changed when the file is invalid or you cancel.
- Imported values are stored at the **User/Global** level, like all other settings.
- A block copied from your `settings.json` (`"autoBookmarks.documentationLinks": [...]`, `"autoBookmarks.caseSensitive": false`, ...) can be imported as well.

Example file:

```json
{
  "format": "auto-bookmarks-settings",
  "version": 1,
  "exportedWith": "2.6.0",
  "settings": {
    "documentationLinks": [
      { "text": "TODO", "active": true, "color": "#fbbf24" },
      { "text": "GlideRecord", "active": false, "color": "#38bdf8", "url": "https://developer.servicenow.com/dev.do#!/reference/api/latest/server/no-namespace/c_GlideRecordScopedAPI" }
    ],
    "fileTypes": [".js", ".ts"],
    "caseSensitive": true,
    "maxFileSizeMB": 20,
    "highlightStyle": "edge"
  }
}
```

## Add Search Text Directly from the Editor

You do not need to open the settings page every time you want to add a bookmark search.

For example, select:

```javascript
GlideRecord
```

Then:

1. Right-click the selected text.
2. Choose **Auto Bookmarks: Add Selected Text**.
3. The selected value is added to your **Bookmarks** list as an active entry with the default color. If it is already there but inactive, it is switched on again.
4. Auto Bookmarks refreshes the detected occurrences.

The context-menu command is available when text is selected in the editor.

## Bookmarks

Everything Auto Bookmarks looks for lives in one list, `autoBookmarks.documentationLinks`. Each entry is one row of the **Bookmarks** table on the settings page:

- `text` - the text to find in the active file (required).
- `active` - `true` (default when missing) or `false`. Only active entries are searched; inactive ones stay in the list but create no bookmarks or highlights.
- `color` - the highlight color (default blue): a bar on the left edge of matching lines next to the gutter (see `autoBookmarks.highlightStyle`) and the editor **overview ruler**. The line text is not colored.
- `url` - an optional `http` or `https` documentation link.

For example:

```json
"autoBookmarks.documentationLinks": [
    { "text": "TODO", "active": true, "color": "#fbbf24" },
    { "text": "FIXME", "active": false, "color": "#f87171" },
    {
        "text": "GlideRecord",
        "active": true,
        "color": "#38bdf8",
        "url": "https://developer.servicenow.com/dev.do#!/reference/api"
    }
]
```

Entries with a `url` also offer a lightbulb: put the cursor on an exact, case-sensitive match (`GlideRecord`, not `GlideRecordSecure` or `MyGlideRecord`) and the Quick Fix menu (`Ctrl + .`, or `Cmd + .` on macOS) shows **Open GlideRecord Documentation**. Only `http` and `https` URLs are opened. The lightbulb looks only at the text around the cursor, works in any document regardless of `autoBookmarks.fileTypes`, and has no cost on large files.

Upgrading from 2.2.0 or earlier: your existing `autoBookmarks.searchTexts` and `autoBookmarks.colors` values are merged into this list automatically the first time 2.3.0 or later starts, then removed from your user settings. A plain list such as `["TODO", "FIXME", "HACK"]` becomes:

```json
"autoBookmarks.documentationLinks": [
    { "text": "TODO", "active": true },
    { "text": "FIXME", "active": true },
    { "text": "HACK", "active": true }
]
```

Upgrading from 2.3.x: entries without an `active` key are written back with `"active": true` on the first start; nothing else changes.

## Manual Configuration

Auto Bookmarks can also be configured directly through your VS Code User `settings.json`.

Example:

```json
{
    "autoBookmarks.documentationLinks": [
        { "text": "TODO", "active": true, "color": "#fbbf24" },
        { "text": "FIXME", "active": true, "color": "#f87171" },
        { "text": "GlideRecord", "active": true, "color": "#38bdf8", "url": "https://developer.servicenow.com/dev.do#!/reference/api" }
    ],
    "autoBookmarks.fileTypes": [
        ".js",
        ".ts"
    ],
    "autoBookmarks.caseSensitive": true
}
```

### Allow all file types

To allow Auto Bookmarks to scan files regardless of extension, use an empty file-type array:

```json
"autoBookmarks.fileTypes": []
```

## Available Settings

- `autoBookmarks.highlightStyle` - `edge` (default): colored bar on the left edge of the line, next to the gutter, so the lightbulb can use the gutter; `gutter`: colored strip in the gutter (hides on the cursor line while the cursor is on a link text).
- `autoBookmarks.documentationLinks` - The bookmark list: `text` to find, `active` (default `true`), optional `color` and optional `url` (shows an *Open Documentation* lightbulb).
- `autoBookmarks.fileTypes` - File extensions that Auto Bookmarks is allowed to scan.
- `autoBookmarks.caseSensitive` - Controls whether matching is case-sensitive.
- `autoBookmarks.maxFileSizeMB` - Largest file size in MB that Auto Bookmarks will scan (default `20`, `0` disables the limit).
- `autoBookmarks.searchTexts` and `autoBookmarks.colors` - Deprecated; merged into `autoBookmarks.documentationLinks` automatically.

## Large Files

Files larger than `autoBookmarks.maxFileSizeMB` are not scanned, and the status bar shows *Auto Bookmarks: file exceeds configured X MB limit* once per file. Raise the limit or set it to `0` if you want larger files scanned; scanning is a single pass and cached, but very large files with many matches still take time and memory.

## Commands

Auto Bookmarks provides the following commands:

- `Auto Bookmarks: Refresh`
- `Auto Bookmarks: Open Settings`
- `Auto Bookmarks: Add Selected Text`
- `Auto Bookmarks: Export Settings`
- `Auto Bookmarks: Import Settings`

## Updating the Extension

To install a newer version:

1. Download the new VSIX package.
2. Open **Extensions** in Visual Studio Code.
3. Click the **...** menu.
4. Select **Install from VSIX...**.
5. Select the newer VSIX package.
6. Run **Developer: Reload Window** after installation.

**Upgrading from a build published as `local`:** the publisher ID changed from `local` to `skravciv`, so the extension ID is now `skravciv.auto-bookmarks`. VS Code treats it as a different extension, so uninstall the old **Auto Bookmarks** first; otherwise the two copies conflict because they register the same commands and views. Your `autoBookmarks.*` settings are kept.

If you are upgrading from an older development build and encounter UI problems, perform a clean upgrade:

1. Uninstall Auto Bookmarks.
2. Reload or restart Visual Studio Code.
3. Install the latest VSIX package.
4. Run **Developer: Reload Window**.

## Troubleshooting

### Auto Bookmarks icon or sidebar is missing

1. Open the Command Palette with `Ctrl + Shift + P`.
2. Run **Developer: Reload Window**.
3. Check that **Auto Bookmarks** is enabled in the Extensions view.

### Bookmarks are not detected

Check the following:

- The text is present in the Bookmarks list (`autoBookmarks.documentationLinks`) and its **Active** box is ticked.
- The current file extension is allowed by `autoBookmarks.fileTypes`.
- `autoBookmarks.caseSensitive` matches the capitalization you expect.
- Run **Auto Bookmarks: Refresh** from the Command Palette.

### The color is not shown

Only active bookmarks are drawn, and only in files allowed by `autoBookmarks.fileTypes`. With `autoBookmarks.highlightStyle` set to `gutter`, the color is drawn in the editor's glyph margin, so `editor.glyphMargin` must be `true` (the default).

### The lightbulb is drawn over my code or the color disappears on the cursor line

VS Code puts its lightbulb in the gutter only on lines without another gutter icon. With the default `edge` style the color is not a gutter icon, so both are shown. If you chose `gutter`, the strip hides on the line where the documentation lightbulb shows (and with an icon on the line VS Code would draw the lightbulb over the text instead). Switch back to `edge` to see both.

### The documentation lightbulb does not appear

- The bookmark has a `url` that starts with `http://` or `https://`.
- The cursor is on the complete text, with the same capitalization (`GlideRecord`, not `GlideRecordSecure`, `MyGlideRecord` or `glideRecord`).
- Press `Ctrl + .` (`Cmd + .` on macOS) to open the Quick Fix menu directly.
- `editor.lightbulb.enabled` is not turned off in your VS Code settings.

### Activity Bar badge does not show a number

The badge only appears when the active supported file contains at least one configured bookmark match. If there are no matches, the badge is intentionally hidden.

## Development

Install the development tools (an SVG renderer for the icon and `vsce`), run the tests and package:

```bash
npm install
npm test           # tests against a stub of the vscode module
npm run package    # renders media/icon.png from media/bookmark.svg, then runs vsce package
```

The package should produce:

```text
auto-bookmarks-2.6.0.vsix
```

The extension itself has no runtime dependencies. `media/bookmark.svg` is the source asset and the Activity Bar icon; `scripts/generate-icon.js` renders it to `media/icon.png` (256 x 256, on a dark plate so the light-grey glyph is visible on the Marketplace page) because the Marketplace does not accept SVG for the `icon` field. The PNG is regenerated on every `vsce package` / `vsce publish` through the `vscode:prepublish` script, and the committed copy is kept if the renderer is not installed.

## Repository Structure

```text
AutoBookmarks/
├── media/
│   ├── bookmark.svg
│   └── icon.png
├── scripts/
│   └── generate-icon.js
├── test/
│   └── extension.test.js
├── .gitignore
├── .vscodeignore
├── CHANGELOG.md
├── LICENSE
├── README.md
├── auto-bookmarks-2.6.0.vsix
├── extension.js
├── package-lock.json
└── package.json
```

`media/bookmark.svg` is the Activity Bar icon and the source of the Marketplace icon `media/icon.png`. `auto-bookmarks-2.6.0.vsix` is the ready-to-install package of the current version.

## License

MIT
