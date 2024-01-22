import { Packet } from '../packet.js';
import { Arguments } from 'yargs';

exports.command = 'pretty-print <buffer>';
exports.desc = 'Print a DUML packet buffer in long form';
exports.builder = {};
exports.handler = function (argv: Arguments) {
  console.log(Packet.fromBuffer(Buffer.from(argv.buffer as string, 'hex')).toLongString());
};
