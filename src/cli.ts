import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { commands } from "./cmds/index.js";

const cli = yargs(hideBin(process.argv));

cli.command(commands).demandCommand().strict().alias({ h: "help" }).help().argv;
