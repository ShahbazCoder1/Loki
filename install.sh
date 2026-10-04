#!/usr/bin/env bash

set -e

REPO_URL="${LOKI_REPO_URL:-https://github.com/<OWNER>/<REPO>.git}"
INSTALL_DIR="${LOKI_INSTALL_DIR:-$HOME/loki}"

printf '\n'
printf '╔══════════════════════════════════════╗\n'
printf '║           LOKI INSTALLER             ║\n'
printf '║   No Log Left Behind.                ║\n'
printf '║   No Threat Left Hidden.             ║\n'
printf '╚══════════════════════════════════════╝\n'
printf '\n'

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "[1/3] Checking Git..."

if ! command_exists git; then
    echo "  ✗ Git not found."
    echo "  → Git is required to download Loki."
    echo
    echo "Please install Git and run the Loki installer again."
    exit 1
fi

echo "  ✓ Git $(git --version | awk '{print $3}')"

echo
echo "[2/3] Downloading Loki..."

if [ -d "$INSTALL_DIR" ]; then
    echo "  → Loki directory already exists: $INSTALL_DIR"

    if [ -d "$INSTALL_DIR/.git" ]; then
        echo "  → Updating existing repository..."
        git -C "$INSTALL_DIR" pull --ff-only
    else
        echo "  ✗ $INSTALL_DIR exists but is not a Loki repository."
        echo "  → Choose another location with:"
        echo
        echo "    LOKI_INSTALL_DIR=\$HOME/loki-new curl -fsSL <installer-url> | bash"
        exit 1
    fi
else
    echo "  → Cloning Loki..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

echo "  ✓ Loki downloaded to $INSTALL_DIR"

echo
echo "[3/3] Setting up Loki..."

cd "$INSTALL_DIR"

chmod +x loki

./loki setup

printf '\n'
printf '╔══════════════════════════════════════╗\n'
printf '║          LOKI IS READY 🚀            ║\n'
printf '╚══════════════════════════════════════╝\n'
printf '\n'

echo "Loki installed at:"
echo "  $INSTALL_DIR"
echo
echo "To start Loki:"
echo "  cd $INSTALL_DIR"
echo "  npm start"
