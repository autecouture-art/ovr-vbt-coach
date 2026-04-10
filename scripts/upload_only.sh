#!/bin/bash

set -euo pipefail

CANONICAL_PROJECT_ROOT="/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo"
if [[ -n "${PROJECT_ROOT:-}" ]]; then
  PROJECT_ROOT="$PROJECT_ROOT"
elif [[ -f "$(pwd)/fastlane/Appfile" && -f "$(pwd)/ios/RepVeloCoach.xcworkspace/contents.xcworkspacedata" ]]; then
  PROJECT_ROOT="$(pwd)"
else
  PROJECT_ROOT="$CANONICAL_PROJECT_ROOT"
fi

EXPECTED_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
EXPECTED_XCODE_APP="/Applications/Xcode.app"
FASTLANE_KEY_PATH="$PROJECT_ROOT/fastlane/api_key.p8"
OUTPUT_IPA="$PROJECT_ROOT/ios/fastlane_export/RepVeloCoach.ipa"

log() {
  printf '%s
' "$1"
}

fail() {
  printf 'ERROR: %s
' "$1" >&2
  exit 1
}

ensure_xcode() {
  local active_dir
  active_dir="$(xcode-select -p 2>/dev/null || true)"

  if [[ "$active_dir" == "$EXPECTED_DEVELOPER_DIR" ]]; then
    export DEVELOPER_DIR="$EXPECTED_DEVELOPER_DIR"
    return
  fi

  [[ -d "$EXPECTED_XCODE_APP" ]] || fail "Xcode not found at $EXPECTED_XCODE_APP"

  log "Switching developer directory to $EXPECTED_DEVELOPER_DIR"
  if xcode-select -s "$EXPECTED_DEVELOPER_DIR" >/dev/null 2>&1; then
    log "xcode-select switched successfully"
  else
    log "xcode-select switch failed; using DEVELOPER_DIR for this run"
  fi

  export DEVELOPER_DIR="$EXPECTED_DEVELOPER_DIR"
}

check_prerequisites() {
  [[ -d "$PROJECT_ROOT" ]] || fail "Project root not found: $PROJECT_ROOT"
  [[ -f "$FASTLANE_KEY_PATH" ]] || fail "Missing App Store Connect key: $FASTLANE_KEY_PATH"
  [[ -f "$OUTPUT_IPA" ]] || fail "IPA not found for upload_only: $OUTPUT_IPA"
  [[ -n "${ASC_KEY_ID:-}" ]] || fail "ASC_KEY_ID is not set"
  [[ -n "${ASC_ISSUER_ID:-}" ]] || fail "ASC_ISSUER_ID is not set"
  command -v bundle >/dev/null 2>&1 || fail "bundle command not found"

  cd "$PROJECT_ROOT"
  if ! bundle check >/dev/null 2>&1; then
    log "bundle check failed; running bundle install"
    bundle install
  fi
}

main() {
  log "Starting TestFlight upload via fastlane upload_only"
  log "Project root: $PROJECT_ROOT"
  log "IPA: $OUTPUT_IPA"

  ensure_xcode
  check_prerequisites

  bundle exec fastlane upload_only

  log "Lane upload_only finished successfully"
  log "Uploaded existing IPA: $OUTPUT_IPA"
  log "TestFlight processing in App Store Connect usually takes 15-30 minutes"
}

main "$@"
