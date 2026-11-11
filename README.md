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

## Command line
The package installs a `dumlpacket` command (`npm install -g duml-packet`), or it can be run without installing
anything. Note that the command is not named like the package, so `npx` needs to be told which package it is from:

```
$ npx --package=duml-packet dumlpacket print 550E04662A28DE2F40004F0154c8
Source (0x2a), Ver (0x1), Dest (0x28), Sequence (0xde2f), Cmd Type (0x40), Cmd SubType GET_CFG_FILE (0x4f), Cmd Payload (0x01)
```

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
