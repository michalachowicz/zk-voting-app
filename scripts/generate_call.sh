#!/bin/bash

set -e
export PATH="$PATH:$(pwd)/node_modules/.bin"

cd build

snarkjs generatecall

cd ..
