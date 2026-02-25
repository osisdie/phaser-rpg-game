#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# slack_notify.sh — Bidirectional Slack communication
#
# Usage:
#   source scripts/slack_notify.sh
#   slack_send  "Task completed: built frontend"
#   slack_ask   "Deploy to production?"
#   reply=$(slack_wait_reply 300)
#
# Requires: curl, jq (optional but recommended)
#
# Fallback chain:
#   1. SLACK_BOT_TOKEN → full bidirectional (chat.postMessage + conversations.replies)
#   2. SLACK_WEBHOOK_URL → send-only (incoming webhook)
#   3. Neither → silent skip
# ─────────────────────────────────────────────────

# ── Load .env if present ──────────────────────────
_slack_load_env() {
  local env_file
  # Walk up from script dir to find .env
  if [[ -n "${BASH_SOURCE[0]}" ]]; then
    env_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"
  else
    env_file="${PWD}/.env"
  fi

  if [[ -f "$env_file" ]]; then
    # Source only SLACK_* and relevant vars, skip comments/blanks
    while IFS='=' read -r key value; do
      key="${key#export }"
      key="${key// /}"
      case "$key" in
        SLACK_BOT_TOKEN|SLACK_CHANNEL_ID|SLACK_WEBHOOK_URL)
          value="${value#\"}"
          value="${value%\"}"
          value="${value#\'}"
          value="${value%\'}"
          if [[ -n "$value" ]]; then
            export "$key=$value"
          fi
          ;;
      esac
    done < <(grep -E '^(export\s+)?SLACK_' "$env_file" 2>/dev/null)
  fi
}

# ── Detect mode ───────────────────────────────────
_slack_init() {
  _slack_load_env

  if [[ -n "${SLACK_BOT_TOKEN:-}" && -n "${SLACK_CHANNEL_ID:-}" ]]; then
    _SLACK_MODE="bot"
  elif [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    _SLACK_MODE="webhook"
  else
    # No SLACK_WEBHOOK_URL in .env → bypass notify (silent skip)
    _SLACK_MODE=""
  fi
}

# ── Internal: extract JSON value without jq ───────
_json_val() {
  # Usage: _json_val '{"ok":true,"ts":"123"}' "ts"
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$key // empty" 2>/dev/null
  else
    # Fallback: simple grep/sed extraction (handles flat JSON)
    echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
      | head -1 | sed "s/\"${key}\"[[:space:]]*:[[:space:]]*\"//" | sed 's/"$//'
  fi
}

# ── Internal: get bot's own user ID ───────────────
_slack_get_bot_id() {
  if [[ -z "${_SLACK_BOT_USER_ID:-}" && "$_SLACK_MODE" == "bot" ]]; then
    local resp
    resp=$(curl -s -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
      "https://slack.com/api/auth.test" 2>/dev/null)
    _SLACK_BOT_USER_ID=$(_json_val "$resp" "user_id")
  fi
  echo "${_SLACK_BOT_USER_ID:-}"
}

# ── Last thread timestamp (set by slack_ask) ──────
_SLACK_LAST_THREAD_TS=""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PUBLIC API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── slack_send ────────────────────────────────────
# Send a simple notification message.
# Usage: slack_send "message text"
# Returns: 0 on success, 1 on failure
slack_send() {
  local msg="${1:?Usage: slack_send \"message\"}"

  case "${_SLACK_MODE:-}" in
    bot)
      local payload resp ok
      payload=$(printf '{"channel":"%s","text":"%s"}' \
        "$SLACK_CHANNEL_ID" \
        "$(echo "$msg" | sed 's/"/\\"/g')")

      resp=$(curl -s -X POST \
        -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "https://slack.com/api/chat.postMessage" 2>/dev/null)

      ok=$(_json_val "$resp" "ok")
      if [[ "$ok" == "true" ]]; then
        return 0
      else
        echo "[slack] send failed: $(_json_val "$resp" "error")" >&2
        return 1
      fi
      ;;

    webhook)
      local payload
      payload=$(printf '{"text":"%s"}' "$(echo "$msg" | sed 's/"/\\"/g')")
      curl -s -X POST \
        -H 'Content-type: application/json' \
        -d "$payload" \
        "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1
      return $?
      ;;

    *)
      # Silent skip
      return 0
      ;;
  esac
}

# ── slack_ask ─────────────────────────────────────
# Send an approval/question message with a unique request ID.
# Creates a thread that slack_wait_reply will monitor.
# Usage: slack_ask "Do you approve deployment?"
# Returns: 0 on success (sets _SLACK_LAST_THREAD_TS), 1 on failure
slack_ask() {
  local question="${1:?Usage: slack_ask \"question\"}"
  local req_id="REQ-$(date +%s)"
  local project_name
  project_name=$(basename "$(pwd)")

  case "${_SLACK_MODE:-}" in
    bot)
      local msg payload resp ok ts
      msg=$(printf ':question: *[%s] Approval Request*\n`[%s]`\n\n%s\n\n_Reply in this thread to respond._' \
        "$project_name" "$req_id" "$question")

      payload=$(printf '{"channel":"%s","text":"%s","unfurl_links":false}' \
        "$SLACK_CHANNEL_ID" \
        "$(echo "$msg" | sed 's/"/\\"/g')")

      resp=$(curl -s -X POST \
        -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "https://slack.com/api/chat.postMessage" 2>/dev/null)

      ok=$(_json_val "$resp" "ok")
      if [[ "$ok" == "true" ]]; then
        _SLACK_LAST_THREAD_TS=$(_json_val "$resp" "ts")
        echo "[slack] Sent approval request $req_id (thread: ${_SLACK_LAST_THREAD_TS})" >&2
        return 0
      else
        echo "[slack] ask failed: $(_json_val "$resp" "error")" >&2
        return 1
      fi
      ;;

    webhook)
      # Webhook can send but can't read replies
      local msg payload
      msg=$(printf '[%s] Approval Request [%s]: %s (webhook mode — reply not monitored)' \
        "$project_name" "$req_id" "$question")
      payload=$(printf '{"text":"%s"}' "$(echo "$msg" | sed 's/"/\\"/g')")
      curl -s -X POST \
        -H 'Content-type: application/json' \
        -d "$payload" \
        "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1
      echo "[slack] Sent via webhook (no reply monitoring available)" >&2
      return 0
      ;;

    *)
      echo "[slack] No Slack configuration found, skipping" >&2
      return 0
      ;;
  esac
}

# ── slack_wait_reply ──────────────────────────────
# Poll a thread for a human reply (non-bot message).
# Usage: reply=$(slack_wait_reply [timeout_seconds])
# Default timeout: 300 seconds (5 minutes), poll interval: 15 seconds
# Outputs: the reply text to stdout
# Returns: 0 if reply received, 1 on timeout/error/unavailable
slack_wait_reply() {
  local timeout="${1:-300}"
  local interval=15
  local elapsed=0

  # Only works in bot mode
  if [[ "${_SLACK_MODE:-}" != "bot" ]]; then
    echo "[slack] wait_reply requires Bot Token mode (skipping)" >&2
    return 1
  fi

  if [[ -z "${_SLACK_LAST_THREAD_TS:-}" ]]; then
    echo "[slack] No thread to monitor (call slack_ask first)" >&2
    return 1
  fi

  local bot_id
  bot_id=$(_slack_get_bot_id)

  echo "[slack] Waiting for reply (timeout: ${timeout}s, polling every ${interval}s)..." >&2

  while (( elapsed < timeout )); do
    local resp replies reply_text reply_user
    resp=$(curl -s -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
      "https://slack.com/api/conversations.replies?channel=${SLACK_CHANNEL_ID}&ts=${_SLACK_LAST_THREAD_TS}" \
      2>/dev/null)

    if command -v jq &>/dev/null; then
      # Use jq: find first reply that isn't from the bot
      reply_text=$(echo "$resp" | jq -r \
        --arg bot_id "$bot_id" \
        '[.messages[]? | select(.ts != "'"${_SLACK_LAST_THREAD_TS}"'" and .user != $bot_id)] | last | .text // empty' \
        2>/dev/null)
    else
      # Without jq: count messages — if > 1, a reply exists
      local msg_count
      msg_count=$(echo "$resp" | grep -o '"ts"' | wc -l)
      if (( msg_count > 1 )); then
        # Extract last message text (crude but functional)
        reply_text=$(echo "$resp" | grep -o '"text":"[^"]*"' | tail -1 | sed 's/"text":"//' | sed 's/"$//')
      fi
    fi

    if [[ -n "${reply_text:-}" ]]; then
      echo "[slack] Reply received!" >&2
      echo "$reply_text"
      return 0
    fi

    sleep "$interval"
    elapsed=$((elapsed + interval))
    echo "[slack] ...polling (${elapsed}/${timeout}s)" >&2
  done

  echo "[slack] Timed out waiting for reply after ${timeout}s" >&2
  return 1
}

# ── Initialize on source ─────────────────────────
_slack_init
