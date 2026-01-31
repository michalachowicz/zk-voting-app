#!/bin/bash

set -e

node scripts/generate_merkle_tree.js inputs/leafs.txt website/merkle_tree.txt

echo "Merkle tree generated"