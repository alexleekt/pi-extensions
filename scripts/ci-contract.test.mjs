import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const justfile = readFileSync("justfile", "utf8");
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const worktrunk = readFileSync(".config/wt.toml", "utf8");

test("local, GitHub, and Worktrunk CI stay aligned", () => {
    const packageList = justfile.match(/^ci_packages := "([^"]+)"$/m)?.[1].split(" ");
    const matrixBlock = workflow.match(/matrix:\n[\s\S]*?package:\n((?:\s+- pi-[\w-]+\n)+)/)?.[1] ?? "";
    const matrixPackages = [...matrixBlock.matchAll(/- (pi-[\w-]+)/g)].map((match) => match[1]);

    assert.ok(packageList, "justfile must define ci_packages");
    assert.deepEqual(matrixPackages, packageList);
    assert.match(workflow, /node-version: "22\.22\.3"/);
    assert.match(workflow, /bun-version: "1\.3\.14"/);
    assert.match(workflow, /just-version: "1\.52\.0"/);
    assert.match(workflow, /run: just ci-shared/);
    assert.match(workflow, /check:\n\s+needs: shared\n\s+if: \$\{\{ always\(\) \}\}/);
    assert.match(workflow, /run: just ci-package \$\{\{ matrix\.package \}\}/);
    assert.match(worktrunk, /ci = "just ci"/);
});
