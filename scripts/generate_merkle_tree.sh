#!/bin/bash

set -e

if [ -z "$1" ]; then
    echo "no votingId given!"
    echo "Usage: ./scripts/generate_merkle_tree.sh <votingId>"
    echo "or"
    echo "npm run gen-tree <votingId>"
    exit 1
fi

ID=$1

node scripts/generate_merkle_tree.js inputs/leafs.txt website/merkle_tree_${ID}.txt

echo "Merkle tree generated for voting no.${ID}"