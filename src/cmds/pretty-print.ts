import type { Arguments, CommandModule } from "yargs";
import { Packet } from "../packet";

const prettyPrintCommand: CommandModule = {
  command: "pretty-print <buffer>",
  describe: "Print a DUML packet buffer in long form",
  builder: {},
  handler: (argv: Arguments) => {
    console.log(
      Packet.fromBuffer(
        Buffer.from(argv.buffer as string, "hex"),
      ).toLongString(),
    );
  },
};

export default prettyPrintCommand;
