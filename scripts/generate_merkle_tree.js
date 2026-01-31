import fs from "fs";
import { buildPoseidon } from "circomlibjs";

const toHex32 = x => "0x" + BigInt(x).toString(16).padStart(64, "0");
const nextPowerOf2 = n => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

async function buildMerkleRootFirst(inputPath, outputPath) {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    let leaves = fs.readFileSync(inputPath, "utf8")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(s => BigInt(s));
    
    const leavesCount = nextPowerOf2(leaves.length);
    
    while (leaves.length < leavesCount) leaves.push(0n);

    const totalNodes = leavesCount * 2 - 1;
    const tree = new Array(totalNodes);

    const firstLeafIndex = Math.floor(totalNodes / 2);

    for (let i = 0; i < leavesCount; i++) {
        tree[firstLeafIndex + i] = leaves[i];
    }

    for (let i = firstLeafIndex - 1; i >= 0; i--) {
        const left = tree[2 * i + 1];
        const right = tree[2 * i + 2];
        tree[i] = F.toObject(poseidon([left, right]));
    }

    const lines = tree.map(toHex32);
    fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");

    console.log("Root =", toHex32(tree[0]));
}

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Usage: node generate_tree.js <input_path> <output_path>");
    process.exit(1);
}

buildMerkleRootFirst(args[0], args[1]);

