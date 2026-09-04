import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function git(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

test("v1.2.0 parent directory exactly matches the anchored parent commit", () => {
  assert.equal(git(["rev-parse", "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0:designs/prototype-work/v1.2.0"]), "e57caf36b4a815b4d363ca93ee69305c12228938");
  assert.equal(git(["diff", "--name-only", "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0", "--", "designs/prototype-work/v1.2.0"]), "");
});

test("v1.1.0 frozen release still matches its source commit", () => {
  assert.equal(git(["rev-parse", "a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716:designs/prototype-releases/v1.1.0"]), "45ed88ea692016e674bfebc49c22456ca7a01ad1");
  assert.equal(git(["diff", "--name-only", "a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716", "--", "designs/prototype-releases/v1.1.0"]), "");
});
