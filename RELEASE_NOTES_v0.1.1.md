# v0.1.1

Release date: 2026-03-08

## Highlights

- Binder folder toggle behavior stabilized in mixed folder/root layouts
- Folder drag-and-drop reorder enabled and improved
- Root-level drag targets added to move items out of folders more reliably
- Binder filter now includes folder names (not just chapters/notes)
- Folder row toggle alignment and interaction polish
- Data safety improvements with atomic JSON writes and recovery flow
- Automated tests and CI added

## Binder UX fixes

- Folder row click and folder toggle behavior were separated for clearer interaction
- Collapsing and expanding folders now behaves consistently even in nested and legacy-like tree states
- Drag/drop placement detection around folders was tuned to reduce accidental “inside folder” drops
- Added explicit top/bottom root drop zones while dragging

## Search improvements

- Binder filter search now traverses the binder tree and returns:
  - Folder matches
  - Chapter matches
  - Note matches

## Stability and quality

- Added atomic write strategy (`temp -> rename`) for project JSON files
- Added repair flow for corrupted store files with backup preservation (`*.corrupt-<timestamp>`)
- Added Node test suite for normalize/text/io behavior
- Added GitHub Actions CI workflow to run tests on push/PR

## Internal notes

- Existing project data is preserved; rendering behavior was adjusted to better handle edge layouts
- No migration step is required from previous versions
