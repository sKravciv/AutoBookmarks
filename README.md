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
