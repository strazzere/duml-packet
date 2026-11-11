# DUML-Packet
[![Validate linting and build](https://github.com/strazzere/duml-packet/actions/workflows/node.js.yml/badge.svg)](https://github.com/strazzere/duml-packet/actions/workflows/node.js.yml) [![npm](https://img.shields.io/npm/v/duml-packet.svg)](https://www.npmjs.com/package/duml-packet)

Parser for raw `DUML` packets and object for easy usage when manipulating them. Primarily for use when interacting with DJI drones.

## Install
```bash
npm install duml-packet
```

Node.js 22 or newer is what this is tested on. It ships both ES module and CommonJS builds, with types.

## Library usage
Parse a packet from hex (or a `Buffer` with `Packet.fromBuffer`):

```ts
import { Packet } from "duml-packet";

const packet = Packet.fromHexString("550E04662A28DE2F40004F0154c8");

packet.isValid(); // true, the lengths and both checksums are right
packet.sequenceID; // 0xde2f
packet.commandSet; // 0x0, GENERAL
packet.command; // 0x4f
packet.commandPayload; // the payload bytes, 01

packet.toShortString(); // one line summary
packet.toLongString(); // multi line summary, see below
```

Changing a field recalculates the length and checksums for you, so the packet stays valid:

```ts
packet.sequenceID = 0x1234;

packet.toHexString(); // "550e04662a28123440004f017f0d"
packet.isValid(); // true
```

Packets can also be built from scratch, which gives back the packet from the example above:

```ts
import { AckType, DeviceType, Packet, SetType } from "duml-packet";

const built = new Packet({
  sourceType: DeviceType.PC,
  sourceIndex: 1,
  destinationType: DeviceType.LB_DM3XX_SKY,
  destinationIndex: 1,
  sequenceID: 0xde2f,
  ackType: AckType.ACK,
  commandSet: SetType.GENERAL,
  command: 0x4f,
  commandPayload: Buffer.from([0x01]),
});

built.toHexString(); // "550e04662a28de2f40004f0154c8"
```

A packet with a bad checksum still parses, it just isn't valid:

```ts
Packet.fromHexString("550e04662a28de2f40004f0154c9").isValid(); // false, the last byte should be c8
```

### More than one packet
A captured stream or a dump holds packets back to back. `Packet.parseAll` splits it (a `Buffer` or a hex string),
and returns what is left over, so a packet that is cut off at the end of one chunk can be finished by the next:

```ts
let pending = Buffer.alloc(0);

socket.on("data", (chunk) => {
  const { packets, remainder } = Packet.parseAll(Buffer.concat([pending, chunk]));
  pending = remainder; // empty, or the start of a packet that has not fully arrived yet

  for (const packet of packets) {
    console.log(packet.toShortString());
  }
});
```

Bytes that don't start a packet where one should (the first byte isn't `0x55`) are an error, as there is no telling
where the next packet starts. A bad checksum isn't, check `isValid()` on the packets.

`Packet.fromBuffer` and `Packet.fromHexString` parse the one packet at the start. Anything after it isn't part of the
packet, it is `packet.remainder`:

```ts
const packet = Packet.fromHexString("550e04662a28de2f40004f0154c8deadbeef");

packet.toHexString(); // "550e04662a28de2f40004f0154c8", just the packet
packet.remainder.toString("hex"); // "deadbeef"
```

Hex strings have to be hex, apart from a single digit at the very end (half a byte), which is ignored.

### Errors
Something that can't be parsed throws a `DumlParseError`, with a `code` to tell why:

| code | when |
| --- | --- |
| `INVALID_HEX` | a hex string with characters that are not hex |
| `BUFFER_TOO_SMALL` | fewer bytes than the fields of a packet (13) |
| `BAD_MAGIC` | the first byte is not `0x55` |
| `LENGTH_TOO_SMALL` | the packet's length field is less than 13 |
| `LENGTH_EXCEEDS_BUFFER` | the packet's length field is more than the bytes there are |

```ts
import { DumlParseError, Packet } from "duml-packet";

try {
  Packet.fromHexString(input);
} catch (error) {
  if (error instanceof DumlParseError && error.code === "BAD_MAGIC") {
    // not a DUML packet
  }
}
```

A value that doesn't fit its field is a `RangeError` that says which, and the packet is left as it was. For example the
sequence id is two bytes, and a packet holds at most 1010 bytes of payload (its length is ten bits):

```ts
packet.sequenceID = 0x10000; // RangeError: sequenceID must be an integer between 0 and 65535, got 65536
packet.commandPayload = Buffer.alloc(1011); // RangeError: commandPayload is 1011 bytes, but a packet can hold at most 1010
```

### Packets that are wrong on purpose
By default the length and checksums are recalculated whenever something is changed. Pass `false` as the second
argument of the constructor, `fromBuffer` or `fromHexString` to turn that off, for example to build a packet with a bad
checksum or length. The packet and its bytes always agree, so changes still show up in them, but the length and
checksums are what they were (or what you set):

```ts
const packet = Packet.fromHexString("550e04662a28de2f40004f0154c8", false);

packet.sequenceID = 0x1234;

packet.toHexString(); // "550e04662a28123440004f0154c8", the checksum bytes at the end are still the old ones
packet.isValid(); // false
```

## Command line
The package installs a `dumlpacket` command (`npm install -g duml-packet`), or it can be run without installing
anything. Note that the command is not named like the package, so `npx` needs to be told which package it is from:

```
$ npx --package=duml-packet dumlpacket print 550E04662A28DE2F40004F0154c8
Source (0x2a), Ver (0x1), Dest (0x28), Sequence (0xde2f), Cmd Type (0x40), Cmd SubType GET_CFG_FILE (0x4f), Cmd Payload (0x01)
```

Something that isn't a packet is a one line error on stderr and exit status 1.

## Example output
```
$ dumlpacket pretty-print 550E04662A28DE2F40004F0154c8
Packet HEX(550e04662a28de2f40004f0154c8)
Valid CRC:	true
Version:	0x1
Length:		14	(0xe)
CRC Head:	0x66
Source ID:	PC, 0x1 (0x2a)
Dest ID:	LB_DM3XX_SKY, 0x1 (0x28)
Sequence ID:	0xde2f
Cmd Type (raw):	0x40
Cmd Type:	REQUEST	(0x0)
Ack Type:	ACK	(0x2)
Encryption:	NONE	(0x0)
Cmd Set:	GENERAL	(0x0)
Cmd SubType:	GET_CFG_FILE (0x4f)
Cmd Payload:	(0x01)
CRC16:		0xc854
```

## Example usage
Look at the [duml-beagle-parse](https://github.com/strazzere/duml-beagle-parse) project, which specifically parses Beagle USB csv exports, cutting and parsing out duml packets for faster analysis. 

## Development
```bash
npm ci
npm test              # jest
npm run lint          # biome, check only. npm run lint:fix applies the fixes
npm run build         # tsc and rollup, into dist/
npm run test:package  # after a build: packs the package, installs it in an empty project and uses it
```

## License
```
Licensed under ISC License

Copyright 2022-2025 Tim 'diff' Strazzere <diff@protonmail.com>
```
