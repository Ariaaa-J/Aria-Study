#!/bin/bash
# Aria Study — Export Markdown Note as Card Image
# Usage: ./export-note.sh <note-id>
# The script reads from localStorage export or a .md file

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
RENDER="$SKILL_DIR/.venv/bin/python $SKILL_DIR/render.py"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <markdown-file.md> [--theme theme] [--font font]"
  echo ""
  echo "Themes: light (default), dark, warm, forest"
  echo "Fonts:  sans (default), serif"
  echo ""
  echo "Tip: First export a note from the app (📥 button), then run:"
  echo "  $0 exported-note.md --theme dark"
  exit 1
fi

FILE="$1"
shift
eval "$RENDER" "$FILE" "$@"
