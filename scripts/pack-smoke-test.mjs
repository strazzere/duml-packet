// Packs the package, installs the tarball into an empty project and checks that what a user gets actually works:
// the dumlpacket command, an ESM import, a CJS require, and the types resolving under modern TypeScript.
//
// Run it after a build: npm run test:package
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workDir = mkdtempSync(join(tmpdir(), "duml-packet-smoke-"));
const project = join(workDir, "project");

// The example packet from the README
const hex = "550E04662A28DE2F40004F0154c8";

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
}

try {
  const [{ filename }] = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", workDir], { cwd: root }));

  mkdirSync(project);
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "smoke", private: true, type: "module" }));
  run("npm", ["install", "--no-audit", "--no-fund", join(workDir, filename)], { cwd: project });

  // The command line tool
  const cli = run(join(project, "node_modules", ".bin", "dumlpacket"), ["pretty-print", hex]);
  assert.match(cli, /Valid CRC:\s+true/, `unexpected CLI output:\n${cli}`);
  console.log("ok - dumlpacket pretty-print");

  // As an ES module
  const esm = run(
    process.execPath,
    ["--input-type=module", "-e", `import { Packet, DumlParseError } from "duml-packet"; try { Packet.fromHexString("zz"); } catch (error) { console.log(error instanceof DumlParseError && error.code === "INVALID_HEX"); } console.log(Packet.parseAll("${hex}${hex}").packets.length === 2, Packet.fromHexString("${hex}").isValid());`],
    { cwd: project },
  );
  assert.equal(esm.trim(), "true\ntrue true");
  console.log("ok - import");

  // As CommonJS
  const cjs = run(
    process.execPath,
    ["-e", `const { Packet, DumlParseError } = require("duml-packet"); try { Packet.fromHexString("zz"); } catch (error) { console.log(error instanceof DumlParseError && error.code === "INVALID_HEX"); } console.log(Packet.fromHexString("${hex}").isValid());`],
    { cwd: project },
  );
  assert.equal(cjs.trim(), "true\ntrue");
  console.log("ok - require");

  // The types, resolved the way a modern TypeScript project would
  writeFileSync(
    join(project, "index.ts"),
    `import { DumlParseError, Packet, CommandType, type DumlParseErrorCode } from "duml-packet";\nconst packet: Packet = Packet.fromHexString("${hex}");\nconst type: CommandType = packet.commandType;\nconst rest: typeof packet.remainder = packet.remainder;\nconst { packets, remainder } = Packet.parseAll(packet.toBuffer());\nconst code: DumlParseErrorCode = new DumlParseError("BAD_MAGIC", "x").code;\nexport { type, rest, packets, remainder, code };\n`,
  );
  writeFileSync(
    join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "es2022", strict: true, noEmit: true, skipLibCheck: true },
      files: ["index.ts"],
    }),
  );
  run(join(root, "node_modules", ".bin", "tsc"), ["-p", project]);
  console.log("ok - types");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
