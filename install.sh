#!/bin/sh
set -e
mise install
cargo build --release
cp target/release/scli ~/.local/bin/scli
echo "Installed scli to ~/.local/bin/scli"
