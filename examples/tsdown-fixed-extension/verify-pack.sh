#!/usr/bin/env bash
# Build the package, lint what would be published, then install the packed
# tarball into an empty project and import it.
set -e

npm run build
npx publint

TARBALL="$PWD/$(npm pack | tail -n 1)"
CONSUMER="$(mktemp -d)"
trap 'rm -rf "$CONSUMER" "$TARBALL"' EXIT

cd "$CONSUMER"
npm init -y > /dev/null
npm install "$TARBALL"
node -e "import('demo-lib').then(m => console.log(Object.keys(m)))"
