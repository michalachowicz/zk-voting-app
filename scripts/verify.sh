#!/bin/bash

export PATH="$PATH:$(pwd)/node_modules/.bin"

snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json