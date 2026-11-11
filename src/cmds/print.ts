import type { Arguments, CommandModule } from "yargs";
import { Packet } from "../packet";
import { run } from "./run";

const printCommand: CommandModule = {
  command: "print <buffer>",
  describe: "Print a DUML packet buffer in short form",
  builder: {},
  handler: (argv: Arguments) => {
    run(() => {
      console.log(Packet.fromHexString(argv.buffer as string).toShortString());
    });
  },
};

export default printCommand;
