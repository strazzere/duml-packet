import yargs from "yargs";
import { hideBin } from "yargs/helpers";

yargs(hideBin(process.argv))
  // Use the commands directory to scaffold.
  .commandDir("cmds")
  .demandCommand()
  // Enable strict mode.
  .strict()
  // Useful aliases.
  .alias({ h: "help" })
  .help().argv;
