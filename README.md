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
- Provides a dedicated **Auto Bookmarks Settings** page.
- Add new search text directly from the editor context menu.
- Stores all configuration at the VS Code **User/Global** level so the same settings work across workspaces and when individual files are opened.

## Version

Current version: **2.0.3**

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
auto-bookmarks-2.0.3.vsix
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
   auto-bookmarks-2.0.3.vsix
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
code --install-extension auto-bookmarks-2.0.3.vsix
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

- Search texts
- Bookmark colors
- Allowed file types
- Case-sensitive matching

When adding or removing search texts, use:

> **Save search texts & refresh colors**

This saves the search-text list and refreshes the available bookmark color configuration.

After changing other options, use:

> **Save all settings**

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
3. The selected value is added to your configured search texts.
4. Auto Bookmarks refreshes the detected occurrences.

The context-menu command is available when text is selected in the editor.

## Bookmark Colors

Each configured search text can have its own color.

The selected color is used in two places:

1. The matching **line number** in the editor.
2. The editor **overview ruler** on the right side.

For example:

```json
"autoBookmarks.colors": {
    "TODO": "#fbbf24",
    "FIXME": "#f87171",
    "GlideRecord": "#38bdf8"
}
```

This makes different bookmark types easier to distinguish when navigating larger source files.

## Manual Configuration

Auto Bookmarks can also be configured directly through your VS Code User `settings.json`.

Example:

```json
{
    "autoBookmarks.searchTexts": [
        "TODO",
        "FIXME",
        "GlideRecord"
    ],
    "autoBookmarks.fileTypes": [
        ".js",
        ".ts"
    ],
    "autoBookmarks.caseSensitive": true,
    "autoBookmarks.colors": {
        "TODO": "#fbbf24",
        "FIXME": "#f87171",
        "GlideRecord": "#38bdf8"
    }
}
```

### Allow all file types

To allow Auto Bookmarks to scan files regardless of extension, use an empty file-type array:

```json
"autoBookmarks.fileTypes": []
```

## Available Settings

- `autoBookmarks.searchTexts` - Text values Auto Bookmarks searches for.
- `autoBookmarks.fileTypes` - File extensions that Auto Bookmarks is allowed to scan.
- `autoBookmarks.caseSensitive` - Controls whether matching is case-sensitive.
- `autoBookmarks.colors` - Defines the highlight color associated with each search text.

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

- The text is present in `autoBookmarks.searchTexts`.
- The current file extension is allowed by `autoBookmarks.fileTypes`.
- `autoBookmarks.caseSensitive` matches the capitalization you expect.
- Run **Auto Bookmarks: Refresh** from the Command Palette.

### Activity Bar badge does not show a number

The badge only appears when the active supported file contains at least one configured bookmark match. If there are no matches, the badge is intentionally hidden.

## Development

Install the project dependencies:

```bash
npm install
```

Package the extension:

```bash
npm run package
```

The package should produce:

```text
auto-bookmarks-2.0.3.vsix
```

## Repository Structure

```text
AutoBookmarks/
├── media/
│   └── bookmark.svg
├── .gitignore
├── .vscodeignore
├── CHANGELOG.md
├── LICENSE
├── README.md
├── extension.js
└── package.json
```

The `media/bookmark.svg` file is used for the Auto Bookmarks Activity Bar icon.

## License

MIT
