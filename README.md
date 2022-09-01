# DUML-Packet

Parser for raw `DUML` packets and object for easy usage when manipilating them. Primarily for use when interacting with DJI drones.

## Usage outside of node

You can build this using the `package` script like so;

```
# npm run package

> duml-packet@1.0.0 package
> pkg . --output dumlpacket

> pkg@5.8.0
> Targets not specified. Assuming:
  node16-linux-x64

$ ./dumlpacket pretty-print 550E04662A28DE2F40004F0154c8
Packet HEX(550e04662a28de2f40004f0154c8)
Valid CRC:		true
Version:		0x1
Length:			14	(0xe)
CRC Head:		0x66
Source ID:		PC, 0x1 (0x2a)
Dest ID:		LB_DM3XX_SKY, 0x1 (0x28)
Sequence ID:	0xde2f
Cmd Type (raw):	0x40
Cmd Type:		REQUEST	(0x0)
Ack Type:		ACK	(0x2)
Encryption:		NONE	(0x0)
Cmd Set:		GENERAL	(0x0)
Cmd SubType:	GET_CFG_FILE (0x4f)
Cmd Payload:	(0x01)
CRC16:			0xc854
```

## License

```
Licensed under ISC License

Copyright 2022 Tim 'diff' Strazzere <diff@protonmail.com>
```