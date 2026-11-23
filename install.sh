#!/usr/bin/env bash
# Idempotent: submodules -> build bin/{ai-bridge,ma} (then cargo clean) ->
# fetch the latest photocraft-cli (macOS only; skipped elsewhere) -> create var/
# and dsh-home/ -> report PATH status.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
cd "$ROOT"
say() { printf '==> %s\n' "$*"; }
die() { printf 'install: %s\n' "$*" >&2; exit 1; }

# One EXIT trap for the temp download directory. `tmp` is deliberately NOT
# function-local: the trap runs after the frame that created it is gone, and
# under `set -u` a `local` here aborts the trap with "tmp: unbound variable",
# which also turns a successful install into exit status 1.
tmp=""
cleanup() {
    if [ -n "$tmp" ] && [ -d "$tmp" ]; then
        trash "$tmp" 2>/dev/null || rm -rf "$tmp" || true
    fi
    return 0
}
trap cleanup EXIT

PHOTOCRAFT_VERSION="${PHOTOCRAFT_CLI_VERSION:-}"   # empty => the latest release
# Optional local binary, installed as-is instead of downloading the release.
# This is the escape hatch for platforms upstream ships no CLI build for.
PHOTOCRAFT_BIN="${PHOTOCRAFT_CLI:-}"

# Version selection: an explicit PHOTOCRAFT_CLI_VERSION always wins; otherwise
# follow the latest release tag. Resolving through the /releases/latest redirect
# keeps the unauthenticated GitHub API (60 requests/h) out of the install path.
resolve_photocraft_version() {
    local final
    final=$(curl -fsSIL --max-time 25 \
                --retry 3 --retry-delay 2 --retry-all-errors \
                -o /dev/null -w '%{url_effective}' \
                "https://github.com/storytold/photocraft/releases/latest" 2>/dev/null) || return 1
    case "$final" in
        */releases/tag/v[0-9]*) printf '%s\n' "${final##*/releases/tag/v}" ;;
        *) return 1 ;;
    esac
}

if [ -f .gitmodules ]; then
    say "initializing submodules"
    git submodule update --init --recursive
fi

build_rust() { # <subdir> <bin>
    local dir="third-party/$1" name="$2"
    [ -f "$dir/Cargo.toml" ] || die "missing $dir/Cargo.toml — submodule not checked out?"
    command -v cargo >/dev/null || die "cargo not found (rustup.rs) — needed to build $name"
    say "building $name"
    cargo build --release --manifest-path "$dir/Cargo.toml"
    install -m 0755 "$dir/target/release/$name" "bin/$name"
    say "cleaning $dir/target"
    cargo clean --manifest-path "$dir/Cargo.toml"
}
build_rust ai-bridge ai-bridge
build_rust micro-agent ma

install_photocraft() {
    local want="$PHOTOCRAFT_VERSION" have=""
    if [ -n "$PHOTOCRAFT_BIN" ]; then
        { [ -f "$PHOTOCRAFT_BIN" ] && [ -x "$PHOTOCRAFT_BIN" ]; } \
            || die "PHOTOCRAFT_CLI=$PHOTOCRAFT_BIN is not an executable file"
        # `install` refuses to copy a file onto itself, and a globally exported
        # PHOTOCRAFT_CLI may well point at an already-installed copy.
        if [ -f bin/photocraft-cli ] && [ "$PHOTOCRAFT_BIN" -ef bin/photocraft-cli ]; then
            say "photocraft-cli already installed from PHOTOCRAFT_CLI"
            return 0
        fi
        say "installing photocraft-cli from PHOTOCRAFT_CLI=$PHOTOCRAFT_BIN"
        install -m 0755 "$PHOTOCRAFT_BIN" bin/photocraft-cli
        say "photocraft-cli -> bin/photocraft-cli ($(bin/photocraft-cli --version 2>/dev/null || echo 'version unknown'))"
        return 0
    fi
    # A binary from another platform cannot be exec'd here: `--version` fails
    # (ENOEXEC) and, under `set -e` + `pipefail`, a bare assignment would abort
    # the whole install silently. Treat an unrunnable binary as "not installed".
    if [ -x bin/photocraft-cli ]; then
        have=$(bin/photocraft-cli --version 2>/dev/null | awk '{print $2}') || have=""
    fi
    # Upstream publishes the CLI as a macOS universal binary only. Everywhere
    # else the rest of the install is still useful, so skipping is a warning,
    # never a failure — and the version lookup is skipped to stay offline-safe.
    if [ "$(uname -s)" != "Darwin" ]; then
        if [ -n "$have" ]; then
            say "photocraft-cli $have present (no upstream $(uname -s) build — leaving it as is)"
        elif [ -e bin/photocraft-cli ]; then
            say "warning: bin/photocraft-cli does not run on $(uname -s) — upstream ships a macOS-only CLI"
            say "         move it aside, or install a native build: PHOTOCRAFT_CLI=/path/to/photocraft-cli ./install.sh"
        else
            say "warning: photocraft-cli has no $(uname -s) build upstream — skipping the download"
            say "         optional: PHOTOCRAFT_CLI=/path/to/photocraft-cli ./install.sh"
        fi
        return 0
    fi
    if [ -z "$want" ]; then
        say "resolving the latest photocraft-cli release"
        want=$(resolve_photocraft_version) \
            || die "could not resolve the latest photocraft release — set PHOTOCRAFT_CLI_VERSION=x.y.z and re-run"
    fi
    if [ "$have" = "$want" ]; then say "photocraft-cli $want already installed"; return 0; fi
    command -v curl >/dev/null || die "curl not found"
    command -v unzip >/dev/null || die "unzip not found"
    local url="https://github.com/storytold/photocraft/releases/download/v${want}/photocraft-cli-${want}-macos-universal.zip"
    say "fetching photocraft-cli $want"
    tmp=$(mktemp -d)
    # Retries because this is a 60+ MB asset behind a GitHub redirect, and a
    # single transient reset (e.g. a proxy dropping the TLS connection) would
    # otherwise fail the whole install after the Rust builds already succeeded.
    # --retry-all-errors needs curl >= 7.71; without it, curl retries only the
    # transient classes it knows.
    curl -fL --progress-bar \
        --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 \
        "$url" -o "$tmp/pc.zip" \
      || die "could not fetch $url — put a photocraft-cli ${want} binary at bin/photocraft-cli and re-run"
    unzip -q "$tmp/pc.zip" -d "$tmp/x"
    local found
    found=$(find "$tmp/x" -type f -name 'photocraft-cli' -perm -u+x | head -1)
    [ -n "$found" ] || found=$(find "$tmp/x" -type f -name 'photocraft-cli' | head -1)
    [ -n "$found" ] || die "photocraft-cli not found inside the release zip"
    install -m 0755 "$found" bin/photocraft-cli
    say "photocraft-cli -> bin/photocraft-cli ($(bin/photocraft-cli --version 2>/dev/null))"
}
install_photocraft

mkdir -p var/logs/ai-bridge var/logs/ma dsh-home
chmod 700 dsh-home
[ -f .env ] || say "warning: .env missing — cp .env.example .env and fill it in"
for s in wrong-cmd wrong-cmd-subcmd; do [ -x "bin/$s" ] || die "bin/$s not executable"; done
[ -n "$(ls -A bin/wrong-cmd.d 2>/dev/null)" ] || die "bin/wrong-cmd.d is empty — guard shims missing"

case ":$PATH:" in
  *":$ROOT/bin:"*) say "$ROOT/bin is on PATH" ;;
  *) say "add this line to ~/.zshrc, ABOVE the /opt/home/Bin entry:"
     printf '\n    export PATH="%s/bin:$PATH"\n\n' "$ROOT" ;;
esac
say "done"
