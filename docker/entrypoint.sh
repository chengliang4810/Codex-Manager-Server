#!/bin/sh
set -eu

APP_UID="${APP_UID:-10001}"
APP_USER="${APP_USER:-codexmanager}"

resolve_managed_path() {
  input_path="$1"
  if [ -z "$input_path" ]; then
    return 1
  fi

  case "$input_path" in
    /*)
      printf '%s\n' "$input_path"
      ;;
    *)
      printf '/app/%s\n' "$input_path"
      ;;
  esac
}

ensure_owned_parent_dir() {
  raw_path="$1"
  resolved_path="$(resolve_managed_path "$raw_path" || true)"
  if [ -z "$resolved_path" ]; then
    return 0
  fi

  parent_dir="$(dirname "$resolved_path")"
  mkdir -p "$parent_dir"
  chown -R "${APP_UID}:${APP_UID}" "$parent_dir"
}

if [ "$(id -u)" = "0" ]; then
  ensure_owned_parent_dir "${CODEXMANAGER_DB_PATH:-/data/codexmanager.db}"
  ensure_owned_parent_dir "${CODEXMANAGER_RPC_TOKEN_FILE:-/data/codexmanager.rpc-token}"
  chown "${APP_UID}:${APP_UID}" /app
  exec gosu "${APP_UID}:${APP_UID}" "$@"
fi

exec "$@"
