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

wait_for_service_health() {
  service_port="$1"
  service_pid="$2"
  health_url="http://127.0.0.1:${service_port}/health"

  attempt=0
  while [ "$attempt" -lt 80 ]; do
    if ! kill -0 "$service_pid" 2>/dev/null; then
      return 1
    fi
    if wget --no-verbose --tries=1 --spider "$health_url" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.1
  done
  return 1
}

stop_background_pid() {
  target_pid="$1"
  if [ -z "$target_pid" ]; then
    return 0
  fi
  if kill -0 "$target_pid" 2>/dev/null; then
    kill "$target_pid" 2>/dev/null || true
    wait "$target_pid" 2>/dev/null || true
  fi
}

if [ "$(id -u)" = "0" ]; then
  ensure_owned_parent_dir "${CODEXMANAGER_DB_PATH:-/data/codexmanager.db}"
  ensure_owned_parent_dir "${CODEXMANAGER_RPC_TOKEN_FILE:-/data/codexmanager.rpc-token}"
  chown "${APP_UID}:${APP_UID}" /app
  exec gosu "${APP_UID}:${APP_UID}" "$0" "$@"
fi

if [ "${CODEXMANAGER_SINGLE_CONTAINER:-}" = "1" ] && [ "${1:-}" = "codexmanager-web" ]; then
  export CODEXMANAGER_SERVICE_ADDR="${CODEXMANAGER_SERVICE_ADDR:-127.0.0.1:48760}"
  export CODEXMANAGER_WEB_NO_SPAWN_SERVICE=1

  service_port="${CODEXMANAGER_SERVICE_ADDR##*:}"

  codexmanager-service &
  service_pid=$!

  if ! wait_for_service_health "$service_port" "$service_pid"; then
    echo "codexmanager-service failed to become healthy in single-container mode" >&2
    stop_background_pid "$service_pid"
    exit 1
  fi

  "$@" &
  web_pid=$!

  trap 'stop_background_pid "$web_pid"; stop_background_pid "$service_pid"; exit 143' TERM INT HUP

  wait "$web_pid"
  web_status=$?
  stop_background_pid "$service_pid"
  exit "$web_status"
fi

exec "$@"
