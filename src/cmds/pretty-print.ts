import type { Arguments, CommandModule } from "yargs";
import { Packet } from "../packet";
import { run } from "./run";

const prettyPrintCommand: CommandModule = {
  command: "pretty-print <buffer>",
  describe: "Print a DUML packet buffer in long form",
  builder: {},
  handler: (argv: Arguments) => {
    run(() => {
      console.log(Packet.fromHexString(argv.buffer as string).toLongString());
    });
  },
};

export default prettyPrintCommand;
