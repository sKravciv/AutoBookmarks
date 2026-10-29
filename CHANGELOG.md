# Changelog

## 2.3.0
- One list for everything: the settings page now has a single **Bookmarks** section (search text, color and optional documentation link per row) instead of separate *Search texts*, *Bookmark colors* and *Documentation Links* sections.
- Bookmark scanning, line-number colors and the documentation lightbulb all read `autoBookmarks.documentationLinks`. Each entry has a `text`, an optional `color` and an optional `url`.
- `autoBookmarks.searchTexts` and `autoBookmarks.colors` are deprecated. Their values are merged into the new list once on first start and then removed from your user settings.
- **Add Selected Text** adds an entry to the same list.
- The settings page checks rows before saving (search text required, no duplicates, `http(s)` URLs only) and shows problems inline.
- Changing the list rescans the active file and refreshes the view and highlights.

## 2.2.0
- Added documentation quick links: an entry with a `url` offers an `Open <text> Documentation` lightbulb Quick Fix when the cursor is on an exact, whole-word, case-sensitive match. Only `http(s)` URLs are opened, it works in any document, and only the text around the cursor is examined.
- Added a **Documentation Links** section to the settings page (merged into **Bookmarks** in 2.3.0).

## 2.1.0
- Added `autoBookmarks.maxFileSizeMB` (default 20, `0` disables): larger files are skipped with a one-time status bar message. It can also be edited on the settings page.
- Scan results are cached per document version (max 20 entries) and are invalidated on edits, when the file closes and when settings change.
- The tree, badge and line-number highlights refresh 300 ms after the last change instead of on every keystroke.
- Replaced the per-marker `indexOf` scans with a single regular-expression pass; overlapping markers still match as before.
- Match previews are limited to 200 characters, and highlights use one range per matching line.
- Fixed: case-insensitive matching no longer shifts match positions after characters whose lowercase form has a different length (for example `İ`).
- Duplicate entries in the search texts list now produce one group instead of repeated groups.

## 2.0.3
- Added a numeric match-count badge to the Auto Bookmarks Activity Bar view.
- Preserved the custom Auto Bookmarks settings page and User/Global configuration behavior from 2.0.2.

## 2.0.2
- Restored the Auto Bookmarks Activity Bar icon.
- Added configurable line-number highlighting for bookmark matches.
- Added overview-ruler colors matching each bookmark group.
- Kept all extension configuration at VS Code User/Global scope.
- Added grouped bookmark navigation, custom settings UI, and Add Selected Text editor context action.
