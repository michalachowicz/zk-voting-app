#!/bin/bash

set -e
export PATH="$PATH:$(pwd)/node_modules/.bin"

# if [ -z "$1" ]; then
#     echo "no circut file given!"
#     echo "Usage: ./scripts/build.sh <circuit_name> <ptau_file>"
#     exit 1
# fi

# if [ -z "$2" ]; then
#     echo "no ptau file given!"
#     echo "Usage: ./scripts/build.sh <circuit_name> <ptau_file>"
#     exit 1
# fi

CIRCUIT=$1
CIRCUIT=${1:-merkle_proof}
PTAU=${2:-final}

mkdir -p build

echo "[1/4] Compiling ${CIRCUIT}.circom..."
circom circuits/${CIRCUIT}.circom --r1cs --wasm --sym -l node_modules/circomlib/circuits -o build/

echo "[2/4] Setup..."
snarkjs groth16 setup \
    build/${CIRCUIT}.r1cs \
    circuits/${PTAU}.ptau \
    build/voting.zkey

echo "[3/4] Contribute to the ceremony..."
snarkjs zkey contribute \
    build/voting.zkey \
    build/voting_final.zkey \
    --name="1st Contributor Name" -v

echo "[4/4] Exporting the verification key"
snarkjs zkey export verificationkey \
    build/voting_final.zkey \
    build/verification_key.json

echo "[5/5] Exporting Solidity Verifier..."
snarkjs zkey export solidityverifier \
    build/voting_final.zkey \
    contracts/verifier.sol

echo "[6/6] Copying files..."
cp build/${CIRCUIT}_js/${CIRCUIT}.wasm website/voting.wasm
cp build/voting_final.zkey website/

