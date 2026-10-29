# Auto Bookmarks

**Auto Bookmarks** is a Visual Studio Code extension that automatically finds configured text markers in the active file and presents them as navigable bookmarks in a dedicated Activity Bar view.

It is useful for quickly navigating recurring code patterns such as `TODO`, `FIXME`, `GlideRecord`, `gs.addErrorMessage`, or any other text you want to track.

## Features

- Automatically scans the active editor for configured search texts.
- Displays the total number of detected matches as a badge on the **Auto Bookmarks Activity Bar icon**.
- Groups detected occurrences by search text.
- Shows the number of matches for each bookmark group.
- Click an occurrence to navigate directly to its source line.
- Highlights matching **line numbers** using configurable colors.
- Displays matching colors in the editor **overview ruler** for quick navigation through larger files.
- Supports configurable file extensions.
- Supports case-sensitive or case-insensitive matching.
- Provides a dedicated **Auto Bookmarks Settings** page with one **Bookmarks** table for search texts, colors and documentation links.
- Add new search text directly from the editor context menu.
- Optional documentation link per bookmark: put the cursor on the text and the lightbulb (Quick Fix) opens its documentation page.
- Skips files above a configurable size limit and caches scan results, so large files stay responsive.
- Stores all configuration at the VS Code **User/Global** level so the same settings work across workspaces and when individual files are opened.

## Version

Current version: **2.3.0**

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
auto-bookmarks-2.3.0.vsix
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
   auto-bookmarks-2.3.0.vsix
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
code --install-extension auto-bookmarks-2.3.0.vsix
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

- Bookmarks: one row per search text, with its color and an optional documentation link
- Allowed file types
- Case-sensitive matching
- Maximum file size to scan

Edit the **Bookmarks** table (add rows with **+ Add Bookmark**, remove them with **Delete**), then click:

> **Save settings**

Use **Discard** to reload the saved values.

All Auto Bookmarks settings are stored at the VS Code **User/Global** level. Your configuration therefore applies across workspaces and also works when you open an individual file without opening a workspace.

## Add Search Text Directly from the Editor

You do not need to open the settings page every time you want to add a bookmark search.

For example, select:

```javascript
GlideRecord
```

Then:

1. Right-click the selected text.
2. Choose **Auto Bookmarks: Add Selected Text**.
3. The selected value is added to your **Bookmarks** list with the default color.
4. Auto Bookmarks refreshes the detected occurrences.

The context-menu command is available when text is selected in the editor.

## Bookmarks

Everything Auto Bookmarks looks for lives in one list, `autoBookmarks.documentationLinks`. Each entry is one row of the **Bookmarks** table on the settings page:

- `text` - the text to find in the active file (required).
- `color` - the highlight color used for the matching **line number** in the editor and in the editor **overview ruler** (default blue).
- `url` - an optional `http` or `https` documentation link.

For example:

```json
"autoBookmarks.documentationLinks": [
    { "text": "TODO", "color": "#fbbf24" },
    { "text": "FIXME", "color": "#f87171" },
    {
        "text": "GlideRecord",
        "color": "#38bdf8",
        "url": "https://developer.servicenow.com/dev.do#!/reference/api"
    }
]
```

Entries with a `url` also offer a lightbulb: put the cursor on an exact, case-sensitive match (`GlideRecord`, not `GlideRecordSecure` or `MyGlideRecord`) and the Quick Fix menu (`Ctrl + .`, or `Cmd + .` on macOS) shows **Open GlideRecord Documentation**. Only `http` and `https` URLs are opened. The lightbulb looks only at the text around the cursor, works in any document regardless of `autoBookmarks.fileTypes`, and has no cost on large files.

Upgrading from 2.2.0 or earlier: your existing `autoBookmarks.searchTexts` and `autoBookmarks.colors` values are merged into this list automatically the first time 2.3.0 starts, then removed from your user settings.

## Manual Configuration

Auto Bookmarks can also be configured directly through your VS Code User `settings.json`.

Example:

```json
{
    "autoBookmarks.documentationLinks": [
        { "text": "TODO", "color": "#fbbf24" },
        { "text": "FIXME", "color": "#f87171" },
        { "text": "GlideRecord", "color": "#38bdf8", "url": "https://developer.servicenow.com/dev.do#!/reference/api" }
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

- `autoBookmarks.documentationLinks` - The bookmark list: `text` to find, optional `color` and optional `url` (shows an *Open Documentation* lightbulb).
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

## Updating the Extension

To install a newer version:

1. Download the new VSIX package.
2. Open **Extensions** in Visual Studio Code.
3. Click the **...** menu.
4. Select **Install from VSIX...**.
5. Select the newer VSIX package.
6. Run **Developer: Reload Window** after installation.

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

- The text is present in the Bookmarks list (`autoBookmarks.documentationLinks`).
- The current file extension is allowed by `autoBookmarks.fileTypes`.
- `autoBookmarks.caseSensitive` matches the capitalization you expect.
- Run **Auto Bookmarks: Refresh** from the Command Palette.

### Nothing is found in a large file

Files larger than `autoBookmarks.maxFileSizeMB` (default 20 MB) are skipped, and the status bar shows *Auto Bookmarks: file exceeds configured X MB limit*. Raise the limit on the settings page, or set it to `0` to scan every file.

### The documentation lightbulb does not appear

- The bookmark has a `url` that starts with `http://` or `https://`.
- The cursor is on the complete text, with the same capitalization (`GlideRecord`, not `GlideRecordSecure`, `MyGlideRecord` or `glideRecord`).
- Press `Ctrl + .` (`Cmd + .` on macOS) to open the Quick Fix menu directly.
- `editor.lightbulb.enabled` is not turned off in your VS Code settings.

### Activity Bar badge does not show a number

The badge only appears when the active supported file contains at least one configured bookmark match. If there are no matches, the badge is intentionally hidden.

## Development

The extension has no dependencies and no build step, so there is nothing to install. Package it with `vsce`:

```bash
npx @vscode/vsce package --allow-missing-repository
```

The package should produce:

```text
auto-bookmarks-2.3.0.vsix
```

`--allow-missing-repository` skips the prompt about the missing `repository` field in `package.json`; add that field if you prefer to drop the flag.

## Repository Structure

```text
AutoBookmarks/
├── media/
│   └── bookmark.svg
├── CHANGELOG.md
├── LICENSE
├── README.md
├── auto-bookmarks-2.3.0.vsix
├── extension.js
└── package.json
```

The `media/bookmark.svg` file is used for the Auto Bookmarks Activity Bar icon, and `auto-bookmarks-2.3.0.vsix` is the ready-to-install package of the current version.

## License

MIT
