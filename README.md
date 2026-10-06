# Auto Bookmarks

Auto Bookmarks is a Visual Studio Code extension that scans the active editor for configured text markers and displays matching occurrences in a dedicated **Auto Bookmarks** view.

<br aria-hidden="true">

## Features

- Group occurrences by configured search text.
- Click an occurrence to reveal and center its source line.
- Configure search texts, permitted file extensions, case sensitivity, and colors.
- Colors highlight matching line numbers and the editor overview ruler.
- Select text in the editor, right-click, and choose **Auto Bookmarks: Add Selected Text**.
- All settings are stored in VS Code **User/Global configuration** and apply across workspaces.

<br aria-hidden="true">

## Commands

The extension provides the following commands:

- `Auto Bookmarks: Refresh`
- `Auto Bookmarks: Open Settings`
- `Auto Bookmarks: Add Selected Text`

<br aria-hidden="true">

## Settings

The following VS Code settings are available:

- `autoBookmarks.searchTexts`
- `autoBookmarks.fileTypes`
- `autoBookmarks.caseSensitive`
- `autoBookmarks.colors`

<br aria-hidden="true">

# Installation

## 1. Download the Extension

Download the latest VSIX package:

```text
auto-bookmarks-2.0.2.vsix
```

<br aria-hidden="true">

## 2. Install in Visual Studio Code

1. Open Visual Studio Code.

2. Open the **Extensions** view:

   ```text
   Ctrl + Shift + X
   ```

3. Click the **⋯** menu at the top of the Extensions panel.

4. Select **Install from VSIX...**

5. Select:

   ```text
   auto-bookmarks-2.0.2.vsix
   ```

6. Wait for the installation to finish.

7. Open the Command Palette:

   ```text
   Ctrl + Shift + P
   ```

8. Run:

   ```text
   Developer: Reload Window
   ```

<br aria-hidden="true">

## 3. Open Auto Bookmarks

Open the standard **Explorer** sidebar:

```text
Ctrl + Shift + E
```

You should see a new section named:

> **Auto Bookmarks**

The extension uses a native Tree View inside the Explorer sidebar.

<br aria-hidden="true">

# Configuration

## Open the Settings Page

In the **Auto Bookmarks** section, click the **⚙ Settings** button.

Alternatively, open the Command Palette:

```text
Ctrl + Shift + P
```

Then run:

```text
Auto Bookmarks: Open Settings
```

You can configure:

- Search texts
- Bookmark colors
- Allowed file types
- Case-sensitive matching

<br aria-hidden="true">

## Saving Search Texts

When adding or removing search texts, use:

> **Save search texts & refresh colors**

This refreshes the available color configuration based on the current search texts.

After changing other options, use:

> **Save all settings**

<br aria-hidden="true">

# Adding Search Text Directly from Code

You don't have to open the Settings page every time you want to add a new search text.

For example, highlight:

```javascript
gs.addErrorMessage
```

Then:

1. Right-click the selected text.
2. Select:

   > **Auto Bookmarks: Add Selected Text**

The selected text is added to the extension configuration.

All matching occurrences can then appear under that group in the **Auto Bookmarks** view.

The command is available in
