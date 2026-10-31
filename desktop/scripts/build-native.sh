#!/usr/bin/env bash
set -e

echo "=== Compiling native macOS Vision OCR helper for Apple Silicon ==="
mkdir -p bin
mkdir -p /tmp/swift-cache

swiftc -module-cache-path /tmp/swift-cache -O native/macos-capture/main.swift -o bin/mac-vision-helper
chmod +x bin/mac-vision-helper
echo "Native helper built successfully: bin/mac-vision-helper"

