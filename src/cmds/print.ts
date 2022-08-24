import { Packet } from '../packet';
import { Arguments } from 'yargs';

exports.command = 'print <buffer>';
exports.desc = 'Print a DUML packet buffer in short form';
exports.builder = {};
exports.handler = function (argv: Arguments) {
  console.log(Packet.fromBuffer(Buffer.from(argv.buffer as string, 'hex')).toShortString());
};
