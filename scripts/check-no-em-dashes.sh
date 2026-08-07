#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  set -- .
fi

if rg -n --hidden --glob '!node_modules/**' --glob '!.next/**' $'\xE2\x80\x94' "$@"; then
  echo "U+2014 em dashes are not allowed. Use clearer punctuation instead." >&2
  exit 1
fi
