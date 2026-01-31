// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

contract MockVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[5] calldata _pubSignals
    ) external pure returns (bool) {
        return true;
    }
}