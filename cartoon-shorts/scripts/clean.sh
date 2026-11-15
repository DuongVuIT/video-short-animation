#!/bin/zsh
# Delete everything temporary: out/ (test stills, contact sheets, render temp, caches, stems) and Python caches.
# Finished videos (exports/) and the per-video sources (shorts/, src/) are never touched.
# Files go to the macOS Trash (empty it to free the space).
cd "$(dirname "$0")/.."
items=(out/*(N) out/.[!.]*(N) shorts/**/__pycache__(N/) scripts/**/__pycache__(N/))
items=(${items:#*/.DS_Store})
(( ${#items} )) || { echo "nothing to clean"; exit 0; }
du -shc $items | tail -1
trash $items && echo "moved to Trash: ${#items} items"
