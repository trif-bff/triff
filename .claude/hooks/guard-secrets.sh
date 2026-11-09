#!/usr/bin/env bash
# PreToolUse hook: blocks writing obvious secrets into tracked files.
input=$(cat)
if echo "$input" | grep -Eq '(sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}|sk_live_[0-9A-Za-z]{20,})'; then
  echo "Bloqueado: el contenido parece incluir una clave de API. Usa variables de entorno (.env.local)." >&2
  exit 2
fi
exit 0
