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

test("v1.3.0 parent directory exactly matches the anchored parent commit", () => {
  assert.equal(git(["rev-parse", "e3990c69e77882062035490ef718fd93549bbf82:designs/prototype-work/v1.3.0"]), "a24109c8be2ffceca73e0fedbb9387f4b85a7176");
  assert.equal(git(["diff", "--name-only", "e3990c69e77882062035490ef718fd93549bbf82", "--", "designs/prototype-work/v1.3.0"]), "");
});

test("v1.2.0 and v1.1.0 baselines remain unchanged", () => {
  assert.equal(git(["diff", "--name-only", "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0", "--", "designs/prototype-work/v1.2.0"]), "");
  assert.equal(git(["diff", "--name-only", "a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716", "--", "designs/prototype-releases/v1.1.0"]), "");
});
