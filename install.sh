#!/bin/sh
set -e
mise install
cargo build --release
mkdir -p ~/.local/bin
rm -f ~/.local/bin/scli
cp target/release/scli ~/.local/bin/scli
echo "Installed scli to ~/.local/bin/scli"
