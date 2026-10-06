# Auto Bookmarks

Auto Bookmarks is a Visual Studio Code extension that scans the active editor for configured text markers and displays matching occurrences in a dedicated Activity Bar view.

## Features

- Group occurrences by configured search text.
- Click an occurrence to reveal and center its source line.
- Configure search texts, permitted file extensions, case sensitivity, and colors.
- Colors highlight matching line numbers and the editor overview ruler.
- Select text in the editor, right-click, and choose **Auto Bookmarks: Add Selected Text**.
- All settings are stored in VS Code User/Global configuration and apply across workspaces.

## Commands

- `Auto Bookmarks: Refresh`
- `Auto Bookmarks: Open Settings`
- `Auto Bookmarks: Add Selected Text`

## Settings

- `autoBookmarks.searchTexts`
- `autoBookmarks.fileTypes`
- `autoBookmarks.caseSensitive`
- `autoBookmarks.colors`

## Development

Install Node.js, then install the VS Code Extension Manager and package the extension:

```bash
npm install
npm run package
```

The package script produces `auto-bookmarks-2.0.2.vsix`.

## License

MIT

## Auto Bookmarks Installation
1. Download the extension
Download the latest VSIX package

2. Install in Visual Studio Code
Open Visual Studio Code.
Open Extensions with:
Ctrl + Shift + X
Click the ⋯ menu at the top of the Extensions panel.
Select Install from VSIX...
Select:
auto-bookmarks-2.1.0.vsix
Wait for the installation to finish.
Press:
Ctrl + Shift + P
Run:
Developer: Reload Window

3. Open Auto Bookmarks
Open the standard Explorer sidebar with:
Ctrl + Shift + E
You should see a new section named
Auto Bookmarks

The extension deliberately uses a native Tree View inside Explorer. VS Code supports extension views in built-in containers such as Explorer.

4. Configure Auto Bookmarks
In the Auto Bookmarks section, use the ⚙ settings button.
Alternatively:
Ctrl + Shift + P
and run:
Auto Bookmarks: Open Settings Page

You can configure:
- Search texts
- Bookmark colors
- Allowed file types
- Case-sensitive matching

When adding or removing search texts, use:
- Save search texts & refresh colors
This refreshes the available color configuration.
After changing other options, use:
- Save all settings

5. Add a bookmark search directly from code
You don't have to open Settings every time.
For example, highlight:

gs.addErrorMessage

Then:
Right-click the selected text.

Select:
Auto Bookmarks: Add Selected Text

The text is added to the extension configuration.
All occurrences can then appear under that group in Auto Bookmarks.
The command is configured to appear in the editor context menu when text is selected.

6. Edit the configuration manually
You can also edit the extension settings directly in your Usersettings.json.
For example:

JSON
{
"autoBookmarks.searchTexts": [
"TODO",
"FIXME",
"GlideRecord",
"gs.addErrorMessage"
],
 
"autoBookmarks.fileTypes": [
".js",
".ts"
],
 
"autoBookmarks.colors": {
"TODO": "#fbbf24",
"FIXME": "#f87171",
"GlideRecord": "#38bdf8",
"gs.addErrorMessage": "#3b82f6"
},
 
"autoBookmarks.caseSensitive": true
}


Version 2.1.0 uses User/Global settings, so these settings work even when you have opened an individual file without opening a VS Code workspace.

7.Updating from an older version

If you previously installed one of the development versions, I recommend a clean upgrade:

Uninstall Auto Bookmarks.
Close VS Code.
Start VS Code again.
Install auto-bookmarks-2.1.0.vsix.
Run Developer: Reload Window.
Open Explorer and find Auto Bookmarks.

This avoids stale view registrations from the earlier builds.
