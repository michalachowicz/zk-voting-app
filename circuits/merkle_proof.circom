pragma circom 2.0.0;

include "poseidon.circom";

template OneLevelHasher() {

    signal input currentHash;
    signal input pathElement;
    signal input pathIndicator;

    signal output result;

    component hasher = Poseidon(2);

    pathIndicator * (pathIndicator-1) === 0;

    hasher.inputs[0] <== currentHash + pathIndicator * (pathElement - currentHash);
    hasher.inputs[1] <== pathElement + pathIndicator * (currentHash - pathElement);

    result <== hasher.out;
}

template VerifyMerkleTree(levels) {
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndicators[levels];
    signal input commitment;
    signal input votingId;
    signal input nonce;

    signal output root;
    signal output nullifier;

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== votingId;
    nullifier <== nullifierHasher.out;

    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== secret;

    component hashers[levels];
    signal currentHash[levels+1];

    currentHash[0] <== leafHasher.out;

    for (var i = 0; i < levels; i++){
        hashers[i] = OneLevelHasher();
        hashers[i].currentHash <== currentHash[i];
        hashers[i].pathElement <== pathElements[i];
        hashers[i].pathIndicator <== pathIndicators[i];
        currentHash[i+1] <== hashers[i].result;
    }
    root <== currentHash[levels];
}

component main { public [commitment, votingId, nonce] } = VerifyMerkleTree(3);