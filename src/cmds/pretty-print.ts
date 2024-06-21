import type { Arguments } from "yargs";
import { Packet } from "../packet.js";

exports.command = "pretty-print <buffer>";
exports.desc = "Print a DUML packet buffer in long form";
exports.builder = {};
exports.handler = (argv: Arguments) => {
  console.log(
    Packet.fromBuffer(Buffer.from(argv.buffer as string, "hex")).toLongString(),
  );
};
