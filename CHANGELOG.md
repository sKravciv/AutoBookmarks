# Changelog

## 2.6.0
- Added **export and import of the settings**: new commands `Auto Bookmarks: Export Settings` and `Auto Bookmarks: Import Settings`, plus **Export...** / **Import...** buttons on the settings page. The export is a versioned JSON file (`format: auto-bookmarks-settings`) with the bookmarks (including inactive ones), file types, case sensitivity, maximum file size and highlight style.
- Import validates every value and drops what is invalid (bad colors, non-http(s) links, duplicates, unknown keys), refuses files over 1 MB, a different format or a newer file version, and asks before changing anything: **Replace** or **Merge** (add only bookmarks you do not have yet). Imported values are saved at the User/Global level. A block copied from `settings.json` is accepted too.

## 2.5.0
- New setting `autoBookmarks.highlightStyle` (`edge` default, or `gutter`). **Default change:** the bookmark color is now a 3 px bar on the left edge of the line, right next to the gutter, instead of a gutter strip. A gutter strip makes VS Code (`lightBulbWidget.ts`) skip its gutter lightbulb and draw the lightbulb over the code; with the edge bar the gutter stays free, so color and documentation lightbulb are visible together. `gutter` keeps the 2.4.x strip (hides on the cursor line while the cursor is on a link text).
- Changing the style swaps the decoration types without rescanning any file.

## 2.4.2
- Fixed the documentation lightbulb being drawn over the code on lines with a colored gutter strip. VS Code (`lightBulbWidget.ts`) shows its lightbulb in the gutter only on lines without a glyph-margin decoration. The strip of the cursor line now hides while the cursor is on a text that has a documentation link, so the lightbulb takes its place in the gutter, and returns when the cursor moves. The update is immediate and limited to the one editor; decoration types are not recreated.

## 2.4.1
- Settings page: **Active** is now a column header next to **Search Text**; the per-row checkboxes no longer carry an "Active" label.

## 2.4.0
- Added an **Active** checkbox per bookmark. Entries of `autoBookmarks.documentationLinks` now have an `active` flag (`{ "text": "TODO", "active": true }`). Inactive entries are not searched, create no bookmarks, badge count or highlights, and stay saved. The documentation lightbulb of an entry does not depend on `active`.
- Migration: entries without `active` (lists from 2.2.x/2.3.x) count as active and are written back as `"active": true` once; the 2.3.0 merge of the legacy `searchTexts`/`colors` settings now writes `active: true` as well. Nothing has to be reconfigured.
- Fixed bookmark colors: the non-existent `lineNumberStyle` option was removed. The configured color now fills the gutter next to the line number of matching lines (glyph-margin decoration) and the overview ruler; the line text is never colored. Needs `editor.glyphMargin` (default on). Colors that are not valid CSS colors fall back to the default blue.
- The settings page shows an **Active** checkbox in every row (inactive rows are dimmed) and writes only the settings that actually changed.
- **Add Selected Text** adds an active entry, or switches an existing inactive entry back on.
- Marketplace icon: `media/icon.png` (256 x 256) is generated from `media/bookmark.svg` during packaging (`npm run icon`, run automatically by `vsce package`). Added `icon`, `galleryBanner` and `repository` to `package.json`.
- Performance: the search RegExp is compiled once per set of active texts and case mode (not once per scanned document version); decoration types are reused between refreshes instead of being recreated; all visible editors are decorated; changing colors, URLs, file types or an inactive entry no longer clears the scan cache or rescans.
- Added tests (`npm test`) and a `.vscodeignore` so tests, scripts and dev dependencies stay out of the VSIX.

## 2.3.0
- One list for everything: the settings page now has a single **Bookmarks** section (search text, color and optional documentation link per row) instead of separate *Search texts*, *Bookmark colors* and *Documentation Links* sections.
- Bookmark scanning, line-number colors and the documentation lightbulb all read `autoBookmarks.documentationLinks`. Each entry has a `text`, an optional `color` and an optional `url`.
- `autoBookmarks.searchTexts` and `autoBookmarks.colors` are deprecated. Their values are merged into the new list once on first start and then removed from your user settings.
- **Add Selected Text** adds an entry to the same list.
- The settings page checks rows before saving (search text required, no duplicates, `http(s)` URLs only) and shows problems inline.
- Changing the list rescans the active file and refreshes the view and highlights.
- Changed the publisher ID from `local` to `skravciv` (extension ID `skravciv.auto-bookmarks`). Uninstall the previous build before installing this one; settings are kept.

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
