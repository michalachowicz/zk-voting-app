#!/bin/bash

set -e

NETWORK=${1:-localhost}

if [ ! -f "contracts/verifier.sol" ]; then
    echo "File 'contracts/cerifier.sol' not found."
    echo "Run the build script first (npm run build-circuit)"
    exit 1
fi

npx hardhat run scripts/deploy.js --network "$NETWORK"

set +e

echo "Waiting 10s for blockexplorer to index contracts"
sleep 10

CONFIG_FILE="website/config.json"

VOTING_ADDR=$(jq -r '.votingAddress' $CONFIG_FILE)
VERIFIER_ADDR=$(jq -r '.verifierAddress' $CONFIG_FILE)

echo "Submitting verifier contract..."
npx hardhat verify --network "$NETWORK" --force "$VERIFIER_ADDR" --contract "contracts/verifier.sol:Groth16Verifier"

echo "Submitting voting contract..."
npx hardhat verify --network "$NETWORK" --force "$VOTING_ADDR" "$VERIFIER_ADDR" --contract "contracts/voting.sol:Voting"
