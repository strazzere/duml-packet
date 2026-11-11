import { crc8Wire, crc16KermitJam } from "./crc";
import { DumlParseError, type DumlParseErrorCode } from "./errors";

import {
  AckType,
  CommandType,
  DeviceType,
  EncryptionType,
  GeneralTypes,
  type PacketOptions,
  SetType,
} from "./types";

export interface DumlPacket {
  raw: Buffer;

  version: number;
  length: number;
  crcHead: number;

  sourceRaw: number;
  sourceType: DeviceType;
  sourceIndex: number;

  destinationRaw: number;
  destinationType: DeviceType;
  destinationIndex: number;

  sequenceID: number;

  commandTypeRaw: number;
  commandType: CommandType;
  ackType: AckType;
  encryptionType: EncryptionType;

  commandSet: number;
  command: number;
  commandPayload: Buffer | undefined;

  crc: number;

  /** The bytes that came after this packet in the buffer it was parsed from, empty if there were none. */
  remainder: Buffer;

  isValid(): boolean;
  toBuffer(): Buffer;
}

/** Every packet starts with this byte */
const MAGIC = 0x55;
/** The fields of a packet (the header, command, crc, but no payload) are this many bytes */
const MIN_PACKET_LENGTH = 13;
/** The length is stored in ten bits */
const MAX_PACKET_LENGTH = 0x3ff;
/** So this is the most a payload can be */
const MAX_PAYLOAD_LENGTH = MAX_PACKET_LENGTH - MIN_PACKET_LENGTH;

/**
 * What each field can hold, which is what fits in the bytes (or bits) of the packet it is written to. Anything else
 * would overflow into its neighbours, or make Node throw an error about writing out of range halfway through
 * rebuilding the packet.
 */
const fieldRanges: Record<string, [min: number, max: number]> = {
  version: [0, 0x3f],
  length: [MIN_PACKET_LENGTH, MAX_PACKET_LENGTH],
  crcHead: [0, 0xff],
  sourceRaw: [0, 0xff],
  sourceType: [0, 0x1f],
  sourceIndex: [0, 0x7],
  destinationRaw: [0, 0xff],
  destinationType: [0, 0x1f],
  destinationIndex: [0, 0x7],
  sequenceID: [0, 0xffff],
  commandTypeRaw: [0, 0xff],
  commandType: [0, 0x1],
  ackType: [0, 0x3],
  encryptionType: [0, 0xf],
  commandSet: [0, 0xff],
  command: [0, 0xff],
  crc: [0, 0xffff],
};

/**
 * @throws {RangeError} if the value does not fit in the field
 * @throws {TypeError} if the payload is not a Buffer
 */
const validateField = (name: string, value: unknown) => {
  if (name === "commandPayload") {
    if (value != null && !(value instanceof Buffer)) {
      throw new TypeError("commandPayload must be a Buffer or undefined");
    }
    return;
  }

  const range = fieldRanges[name];
  if (
    range &&
    (typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < range[0] ||
      value > range[1])
  ) {
    throw new RangeError(
      `${name} must be an integer between ${range[0]} and ${range[1]}, got ${String(value)}`,
    );
  }
};

/**
 * The length of a packet is the length of its payload plus the rest of the packet, and has to fit in the ten bits it is
 * stored in, as anything more would spill into the version.
 */
const validatePayloadSize = (payload: Buffer | undefined | null) => {
  if (payload && payload.length > MAX_PAYLOAD_LENGTH) {
    throw new RangeError(
      `commandPayload is ${payload.length} bytes, but a packet can hold at most ${MAX_PAYLOAD_LENGTH}`,
    );
  }
};

const messages: Record<DumlParseErrorCode, string> = {
  INVALID_HEX: "Invalid hex string, expected only hexadecimal characters",
  BUFFER_TOO_SMALL:
    "Buffer length smaller than minimum size allowed for valid packet",
  BAD_MAGIC: "Unexpected magic identifier",
  LENGTH_TOO_SMALL:
    "Packet length smaller than minimum size allowed for valid packet",
  LENGTH_EXCEEDS_BUFFER: "Packet length larger than provided buffer",
};

const parseError = (code: DumlParseErrorCode): DumlParseError =>
  new DumlParseError(code, messages[code]);

export class Packet implements DumlPacket {
  raw: Buffer;

  version: number;
  length: number;
  crcHead: number;

  sourceRaw: number;
  sourceType: DeviceType;
  sourceIndex: number;

  destinationRaw: number;
  destinationType: DeviceType;
  destinationIndex: number;

  sequenceID: number;

  commandTypeRaw: number;
  commandType: CommandType;
  ackType: AckType;
  encryptionType: EncryptionType;

  commandSet: number;
  command: number;
  commandPayload: Buffer | undefined;

  crc: number;

  /** The bytes that came after this packet in the buffer it was parsed from, empty if there were none. */
  remainder: Buffer = Buffer.alloc(0);

  changed: boolean;

  /**
   *
   * @param {PacketOptions} packetOptions
   * @param {boolean} [autoCalculate=true] if the underlying packet should be auto generated based on the data (fix any broken crcs, lengths, etc)
   * @returns {Packet}
   */
  constructor(packetOptions: PacketOptions, autoCalculate = true) {
    let packet: PacketOptions;
    // Catch mistakes where a buffer is directly passed in
    if (packetOptions instanceof Buffer) {
      packet = {
        raw: packetOptions,
      };
    } else {
      packet = packetOptions;
    }

    // If any raw types have been passed, then they will take presidence
    // over other parameters passed in
    if (!packet.raw) {
      // Check everything before using any of it
      for (const field of Object.keys(fieldRanges)) {
        const value = packet[field as keyof PacketOptions];
        if (value !== undefined) {
          validateField(field, value);
        }
      }
      validateField("commandPayload", packet.commandPayload);
      // With autoCalculate the length always comes from the payload. Without it a length that was given is used as
      // is (a payload that doesn't fit is cut off), but one that is not given still comes from the payload
      if (autoCalculate || packet.length === undefined) {
        validatePayloadSize(packet.commandPayload);
      }

      this.version = packet.version ?? 0x1;

      // We need to calculate this for the length
      this.commandPayload = packet.commandPayload;

      this.length = packet.length ?? 13 + ~~this.commandPayload?.length;

      this.crcHead = packet.crcHead ?? 0x00;

      this.sourceRaw = packet.sourceRaw ?? 0x00;
      if (packet.sourceRaw != null) {
        this.sourceType = this.sourceRaw & 0x1f;
        this.sourceIndex = (this.sourceRaw & 0xe0) >> 0x5;
      } else {
        this.sourceType = packet.sourceType ?? DeviceType.ANY;
        this.sourceIndex = packet.sourceIndex ?? 0;
        this.sourceRaw = this.sourceType | (this.sourceIndex << 0x5);
      }

      this.destinationRaw = packet.destinationRaw ?? 0x00;
      if (packet.destinationRaw != null) {
        this.destinationType = this.destinationRaw & 0x1f;
        this.destinationIndex = (this.destinationRaw & 0xe0) >> 0x5;
      } else {
        this.destinationType = packet.destinationType ?? DeviceType.ANY;
        this.destinationIndex = packet.destinationIndex ?? 0;
        this.destinationRaw =
          this.destinationType | (this.destinationIndex << 0x5);
      }

      if (packet.sequenceID !== undefined) {
        this.sequenceID = packet.sequenceID;
      } else {
        this.randomSequenceID();
      }

      this.commandTypeRaw = packet.commandTypeRaw ?? 0x00;
      if (packet.commandTypeRaw != null) {
        this.commandType = this.commandTypeRaw >> 7;
        this.ackType = (this.commandTypeRaw >> 5) & 0x03;
        this.encryptionType = this.commandTypeRaw & 0x0f;
      } else {
        this.commandType = packet.commandType ?? CommandType.REQUEST;
        this.ackType = packet.ackType ?? AckType.NO_ACK;
        this.encryptionType = packet.encryptionType ?? EncryptionType.NONE;
        this.commandTypeRaw =
          (this.commandType << 7) | (this.ackType << 5) | this.encryptionType;
      }

      this.commandSet = packet.commandSet ?? SetType.GENERAL;

      // Command payload done first for length
      this.command = packet.command ?? 0x00;

      this.crc = packet.crc ?? 0x0000;

      this.changed = false;

      // Generate raw at this point, which will change the crcs given above, if at all
      this.calculatePacket(autoCalculate);

      // biome-ignore lint/correctness/noConstructorReturn: Needed for proxy objects
      return this.createPacketProxy(this, autoCalculate);
    }

    if (!packet.raw || packet.raw.length < MIN_PACKET_LENGTH) {
      throw parseError("BUFFER_TOO_SMALL");
    }

    if (packet.raw[0] !== MAGIC) {
      throw parseError("BAD_MAGIC");
    }

    this.version = (packet.raw.readUInt16LE(1) & 0xfc00) >> 0xa;
    this.length = packet.raw.readUInt16LE(1) & 0x03ff;
    this.crcHead = packet.raw.readUInt8(3);

    if (this.length < MIN_PACKET_LENGTH) {
      throw parseError("LENGTH_TOO_SMALL");
    }

    if (this.length > packet.raw.length) {
      throw parseError("LENGTH_EXCEEDS_BUFFER");
    }

    // The packet is what its length says, anything after it belongs to whatever comes next. This is copied, so the
    // packet doesn't share memory with the buffer it came from (editing the payload would change the caller's data)
    this.raw = Buffer.from(packet.raw.subarray(0, this.length));
    this.remainder = Buffer.from(packet.raw.subarray(this.length));
    this.sourceRaw = this.raw.readUInt8(4);
    this.sourceType = this.sourceRaw & 0x1f;
    this.sourceIndex = (this.sourceRaw & 0xe0) >> 0x5;

    this.destinationRaw = this.raw.readUInt8(5);
    this.destinationType = this.destinationRaw & 0x1f;
    this.destinationIndex = (this.destinationRaw & 0xe0) >> 0x5;

    this.sequenceID = this.raw.readUInt16BE(6);
    this.commandTypeRaw = this.raw.readUInt8(8);
    this.commandType = this.commandTypeRaw >> 7;
    this.ackType = (this.commandTypeRaw >> 5) & 0x03;
    this.encryptionType = this.commandTypeRaw & 0x0f;
    this.commandSet = this.raw.readUInt8(9);
    this.command = this.raw.readUint8(10);
    this.commandPayload = this.raw.subarray(11, this.raw.length - 2);
    this.crc = this.raw.readUInt16LE(this.raw.length - 2);

    this.changed = false;

    // biome-ignore lint/correctness/noConstructorReturn: Needed for proxy objects
    return this.createPacketProxy(this, autoCalculate);
  }

  private static readonly packetFields = new Set([
    "version",
    "length",
    "crcHead",
    "sourceRaw",
    "sourceType",
    "sourceIndex",
    "destinationRaw",
    "destinationType",
    "destinationIndex",
    "sequenceID",
    "commandTypeRaw",
    "commandType",
    "ackType",
    "encryptionType",
    "commandSet",
    "command",
    "commandPayload",
    "crc",
  ]);

  /**
   * Wraps the packet so that editing it rebuilds the bytes. With `autoCalculate` that also fixes the length and
   * checksums, without it the length and checksums are written as they are set (or were), which is how a packet that
   * is wrong on purpose is made.
   */
  private createPacketProxy(packet: Packet, autoCalculate: boolean): Packet {
    const handler = {
      get: (
        target: Packet,
        propertyName: string,
        receiver: unknown,
      ): unknown => {
        // Handle buffer differently since Chai has an odd time with it
        if (["buffer", "length"].includes(propertyName)) {
          return target[propertyName as keyof Packet];
        }

        // We want to proxy these special properties
        const property = Reflect.get(target, propertyName, receiver);
        if (
          ["commandPayload", "raw"].includes(propertyName) &&
          typeof target[propertyName as keyof Packet] === "object" &&
          target[propertyName as keyof Packet] !== null
        ) {
          return new Proxy<object>(
            target[propertyName as keyof Packet] as Buffer,
            handler,
          );
        }

        // Properly bind functions as needed
        return typeof property === "function"
          ? property.bind(target)
          : property;
      },

      set: (target: Packet, propertyName: keyof Packet, value: unknown) => {
        // If someone wants to change raw, just create a new object for them
        if (["raw"].includes(propertyName)) {
          throw new Error(
            "Cannot directly modify the raw buffer, either modify members or create new packet from a buffer",
          );
        }

        // Check before changing anything, so a value that is rejected leaves the packet as it was
        if (target === packet) {
          validateField(propertyName as string, value);
          if (propertyName === "commandPayload" && autoCalculate) {
            validatePayloadSize(value as Buffer | undefined);
          }
        }

        const ret = Reflect.set(target, propertyName, value);

        // The raw fields are made of the fields below them, and are worked out from those when the packet is rebuilt,
        // so setting one has to set what it is made of, or the change would be lost
        if (target === packet) {
          const raw = value as number;
          if (propertyName === "sourceRaw") {
            packet.sourceType = raw & 0x1f;
            packet.sourceIndex = (raw & 0xe0) >> 0x5;
          } else if (propertyName === "destinationRaw") {
            packet.destinationType = raw & 0x1f;
            packet.destinationIndex = (raw & 0xe0) >> 0x5;
          } else if (propertyName === "commandTypeRaw") {
            packet.commandType = raw >> 7;
            packet.ackType = (raw >> 5) & 0x03;
            packet.encryptionType = raw & 0x0f;
          }
        }

        if (
          target !== packet ||
          Packet.packetFields.has(propertyName as string)
        ) {
          packet.changed = true;
          packet.calculatePacket(autoCalculate);
        }

        return ret;
      },
    };

    return new Proxy<Packet>(packet, handler);
  }

  /**
   * Randomize the Sequence ID for this packet
   */
  public randomSequenceID() {
    this.sequenceID = Math.floor(Math.random() * 65534) + 1;
  }

  /**
   * (Re)Calculate the packet based on field changes.
   *
   * @param {boolean} [generate=true] if the packet should use the provided values (length, crc, etc)
   * or generate based on the length of command payload and generate a new crc. The default
   * action is to generate, this is likely only something to turn off if you know what you are
   * doing and need to fuzz something.
   */
  private calculatePacket(generate = true) {
    if (generate) {
      validatePayloadSize(this.commandPayload);
      this.length = MIN_PACKET_LENGTH + ~~this.commandPayload?.length;
    }
    const buffer = Buffer.alloc(this.length);

    // Write magic byte
    buffer.writeUInt8(0x55, 0);

    // Version and Length
    buffer.writeUInt16LE(((this.version & 0x3f) << 0xa) | this.length, 1);

    // Header crc
    if (generate) {
      this.crcHead = crc8Wire(buffer.subarray(0, 3));
    }

    buffer.writeUInt8(this.crcHead, 3);

    this.sourceRaw = this.sourceType | (this.sourceIndex << 0x5);
    buffer.writeUInt8(this.sourceRaw, 4);

    this.destinationRaw = this.destinationType | (this.destinationIndex << 0x5);
    buffer.writeUInt8(this.destinationRaw, 5);

    buffer.writeUInt16BE(this.sequenceID, 6);

    this.commandTypeRaw =
      (this.commandType << 7) | (this.ackType << 5) | this.encryptionType;
    buffer.writeUInt8(this.commandTypeRaw, 8);
    buffer.writeUInt8(this.commandSet, 9);

    buffer.writeUint8(this.command, 10);

    if (this.commandPayload?.length > 0) {
      this.commandPayload.copy(buffer, 11);
    }

    if (generate) {
      this.crc = crc16KermitJam(buffer.subarray(0, buffer.length - 2));
    }
    buffer.writeUInt16LE(this.crc, buffer.length - 2);

    this.raw = buffer;
  }

  /**
   * @returns {boolean} whether the packet has valid crcs (header and whole packet)
   */
  public isValid(): boolean {
    return (
      this.crcHead === crc8Wire(this.raw.subarray(0, 3)) &&
      this.crc === crc16KermitJam(this.raw.subarray(0, this.raw.length - 2))
    );
  }

  /**
   * @returns {string} an easy to parse (longish) one line string to represent the packet
   */
  public toShortString(): string {
    let commandSubType = "UNKNOWN";
    if (this.commandSet === SetType.GENERAL && GeneralTypes[this.command]) {
      commandSubType = GeneralTypes[this.command];
    }

    return (
      `Source (0x${this.sourceRaw.toString(16)}), ` +
      `Ver (0x${this.version.toString(16)}), ` +
      `Dest (0x${this.destinationRaw.toString(16)}), ` +
      `Sequence (0x${this.sequenceID.toString(16)}), ` +
      `Cmd Type (0x${this.commandTypeRaw.toString(16)}), ` +
      `Cmd SubType ${commandSubType} (0x${this.command.toString(16)}), ` +
      `Cmd Payload ${this.commandPayload ? `(0x${this.commandPayload.toString("hex")})` : "NULL"}`
    );
  }

  /**
   * @returns {string} a multi-line string to represent all the values of the packet in a readable format
   */
  public toLongString(): string {
    let commandSubType = "UNKNOWN";
    if (this.commandSet === SetType.GENERAL && GeneralTypes[this.command]) {
      commandSubType = GeneralTypes[this.command];
    }

    return (
      `Packet HEX(${this.toHexString()})\n` +
      `Valid CRC:\t${this.isValid()}\n` +
      `Version:\t0x${this.version.toString(16)}\n` +
      `Length:\t\t${this.length}\t(0x${this.length.toString(16)})\n` +
      `CRC Head:\t0x${this.crcHead.toString(16)}\n` +
      `Source ID:\t${DeviceType[this.sourceType]}, 0x${this.sourceIndex.toString(
        16,
      )} (0x${this.sourceRaw.toString(16)})\n` +
      `Dest ID:\t${DeviceType[this.destinationType]}, 0x${this.destinationIndex.toString(
        16,
      )} (0x${this.destinationRaw.toString(16)})\n` +
      `Sequence ID:\t0x${this.sequenceID.toString(16)}\n` +
      `Cmd Type (raw):\t0x${this.commandTypeRaw.toString(16)}\n` +
      `Cmd Type:\t${CommandType[this.commandType]}\t(0x${this.commandType.toString(16)})\n` +
      `Ack Type:\t${AckType[this.ackType]}\t(0x${this.ackType.toString(16)})\n` +
      `Encryption:\t${EncryptionType[this.encryptionType]}\t(0x${this.encryptionType.toString(
        16,
      )})\n` +
      `Cmd Set:\t${SetType[this.commandSet]}\t(0x${this.commandSet.toString(16)})\n` +
      `Cmd SubType:\t${commandSubType} (0x${this.command.toString(16)})\n` +
      `Cmd Payload:\t${
        this.commandPayload
          ? `(0x${this.commandPayload.toString("hex")})`
          : "NULL"
      }\n` +
      `CRC16:\t\t0x${this.crc.toString(16)}`
    );
  }

  /**
   * @returns {string} a hex representation of the underlying packet as a string
   */
  public toHexString(): string {
    return this.toBuffer().toString("hex");
  }

  /**
   * @returns {Buffer} the raw buffer representation of the packet
   */
  public toBuffer(): Buffer {
    return this.raw;
  }

  /**
   * Create a new Packet object from a provided Buffer.
   *
   * @param {Buffer} buffer data that represents the packet
   * @param {boolean} [autoCalculate=true] if the underlying packet should be auto generated based on the data (fix any broken crcs, lengths, etc)
   * @returns {Packet}
   */
  public static fromBuffer(buffer: Buffer, autoCalculate = true): Packet {
    return new Packet({ raw: buffer }, autoCalculate);
  }

  /**
   * Create a new Packet object from a provided hex string.
   *
   * @param {string} hexString data that represents the packet
   * @param {boolean} [autoCalculate=true] if the underlying packet should be auto generated based on the data (fix any broken crcs, lengths, etc)
   * @returns {Packet}
   */
  public static fromHexString(hexString: string, autoCalculate = true): Packet {
    return new Packet({ raw: Packet.hexToBuffer(hexString) }, autoCalculate);
  }

  /**
   * Split a buffer (or hex string) of packets that are back to back, like a capture or a stream, into packets.
   *
   * A packet that is cut off at the end is not an error, as the rest of it may just not have arrived yet. It is
   * returned as the remainder instead, so it can be put in front of the next chunk of data. A bad checksum does not
   * stop the parsing either, check `isValid()` on the packets.
   *
   * @param {Buffer | string} data the bytes, or the hex string of them
   * @param {boolean} [autoCalculate=true] passed on to each packet
   * @returns {{ packets: Packet[]; remainder: Buffer }} the packets, and what was left over at the end
   * @throws {DumlParseError} for a hex string that is not hex, for bytes where a packet should start that are not
   * the start of a packet (`BAD_MAGIC`), or for a packet that says it is shorter than a packet can be
   */
  public static parseAll(
    data: Buffer | string,
    autoCalculate = true,
  ): { packets: Packet[]; remainder: Buffer } {
    const buffer = typeof data === "string" ? Packet.hexToBuffer(data) : data;
    const packets: Packet[] = [];

    let offset = 0;
    while (offset < buffer.length) {
      if (buffer[offset] !== MAGIC) {
        throw parseError("BAD_MAGIC");
      }

      // Without the length bytes there is no telling how long it is, so wait for more
      if (buffer.length - offset < 3) {
        break;
      }

      const length = buffer.readUInt16LE(offset + 1) & MAX_PACKET_LENGTH;
      if (length < MIN_PACKET_LENGTH) {
        throw parseError("LENGTH_TOO_SMALL");
      }

      if (length > buffer.length - offset) {
        break;
      }

      packets.push(
        Packet.fromBuffer(
          buffer.subarray(offset, offset + length),
          autoCalculate,
        ),
      );
      offset += length;
    }

    return { packets, remainder: Buffer.from(buffer.subarray(offset)) };
  }

  /**
   * Buffer.from silently stops at anything it can't read, which would give a confusing error (or worse, a shorter
   * packet) further on, so anything that is not hex is rejected.
   *
   * A single digit at the end, half a byte, is ignored though. Hex dumps and captures are often cut anywhere, and
   * this has always been accepted: duml-beagle-parse relies on it for most of the packets in a real capture.
   */
  private static hexToBuffer(hexString: string): Buffer {
    if (
      typeof hexString !== "string" ||
      !/^(?:[0-9a-fA-F]{2})*[0-9a-fA-F]?$/.test(hexString)
    ) {
      throw parseError("INVALID_HEX");
    }

    return Buffer.from(hexString, "hex");
  }
}

export type { DumlParseErrorCode, PacketOptions };
export {
  AckType,
  CommandType,
  DeviceType,
  DumlParseError,
  EncryptionType,
  GeneralTypes,
  SetType,
};
