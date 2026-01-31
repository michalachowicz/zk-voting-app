#!/bin/bash

set -e
export PATH="$PATH:$(pwd)/node_modules/.bin"

if [ -z "$1" ]; then
    echo "no circut file given!"
    echo "Usage: ./build.sh <circuit_name> <ptau_file>"
    exit 1
fi

CIRCUIT=$1

mkdir -p build

echo "[1/2] Computing the witness..."
snarkjs wtns calculate \
    build/${CIRCUIT}_js/${CIRCUIT}.wasm \
    inputs/input.json \
    build/witness.wtns

echo "[2/2] Generating proof..."
snarkjs groth16 prove \
  build/${CIRCUIT}_0001.zkey \
  build/witness.wtns \
  build/proof.json \
  build/public.json
