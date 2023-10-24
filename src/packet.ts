import { EventEmitter } from 'events';
import { crc8Wire, crc16KermitJam } from './crc';

import {
  PacketOptions,
  GeneralTypes,
  DeviceType,
  CommandType,
  AckType,
  EncryptionType,
  SetType,
} from './types';

export interface DumlPacket {
  raw: Buffer;

  version: number;
  length: number;
  crcHead: number;

  sourceRaw: number;
  sourceType: DeviceType;
  sourceIndex: number;

  destinationRaw: number;
  destinationType: number;
  destinationIndex: number;

  sequenceID: number;

  commandTypeRaw: number;
  commandType: CommandType;
  ackType: AckType;
  encryptionType: EncryptionType;

  commandSet: number;
  command: number;
  commandPayload: Buffer;

  crc: number;

  isValid(): boolean;
  toBuffer(): Buffer;
}

export class Packet implements DumlPacket {
  raw: Buffer;

  version: number;
  length: number;
  crcHead: number;

  sourceRaw: number;
  sourceType: DeviceType;
  sourceIndex: number;

  destinationRaw: number;
  destinationType: number;
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

  changed: boolean;
  emitter: EventEmitter;

  /**
   *
   * @param {PacketOptions} packet
   * @param {boolean} [autoCalculate=true] if the underlying packet should be auto generated based on the data (fix any broken crcs, lengths, etc)
   * @returns {Packet}
   */
  constructor(packet: PacketOptions, autoCalculate = true) {
    // If any raw types have been passed, then they will take presidence
    // over other parameters passed in
    if (!packet.raw) {
      this.version = packet.version ? packet.version : 0x1;

      // We need to calculate this for the length
      this.commandPayload = packet.commandPayload ? packet.commandPayload : undefined;

      this.length = packet.length ? packet.length : 13 + ~~this.commandPayload?.length;

      this.crcHead = packet.crcHead ? packet.crcHead : 0x00;

      this.sourceRaw = packet.sourceRaw ? packet.sourceRaw : 0x00;
      if (packet.sourceRaw) {
        this.sourceType = this.sourceRaw & 0x1f;
        this.sourceIndex = (this.sourceRaw & 0xe0) >> 0x5;
      } else {
        this.sourceType = packet.sourceType ? packet.sourceType : DeviceType.ANY;
        this.sourceIndex = packet.sourceIndex ? packet.sourceIndex : DeviceType.ANY;
        this.sourceRaw = this.sourceType | (this.sourceIndex << 0x5);
      }

      this.destinationRaw = packet.destinationRaw ? packet.destinationRaw : 0x00;
      if (packet.destinationRaw) {
        this.destinationType = this.destinationRaw & 0x1f;
        this.destinationIndex = (this.destinationRaw & 0xe0) >> 0x5;
      } else {
        this.destinationType = packet.destinationType ? packet.destinationType : DeviceType.ANY;
        this.destinationIndex = packet.destinationIndex ? packet.destinationIndex : DeviceType.ANY;
        this.destinationRaw = this.destinationType | (this.destinationIndex << 0x5);
      }

      if (packet.sequenceID !== undefined) {
        this.sequenceID = packet.sequenceID;
      } else {
        this.randomSequenceID();
      }

      this.commandTypeRaw = packet.commandTypeRaw ? packet.commandTypeRaw : 0x00;
      if (packet.commandTypeRaw) {
        this.commandType = this.commandTypeRaw >> 7;
        this.ackType = this.commandTypeRaw >> 5;
        this.encryptionType = this.commandTypeRaw & 0x0f;
      } else {
        this.commandType = packet.commandType ? packet.commandType : CommandType.REQUEST;
        this.ackType = packet.ackType ? packet.ackType : AckType.NO_ACK;
        this.encryptionType = packet.encryptionType ? packet.encryptionType : EncryptionType.NONE;
        this.commandTypeRaw = (this.commandType << 7) | (this.ackType << 5) | this.encryptionType;
      }

      this.commandSet = packet.commandSet ? packet.commandSet : SetType.GENERAL;

      // Command payload done first for length
      this.command = packet.command ? packet.command : 0x00;

      this.crc = packet.crc ? packet.crc : 0x0000;

      this.changed = false;

      // Generate raw at this point, which will change the crcs given above, if at all
      this.calculatePacket(autoCalculate);

      if (autoCalculate) {
        return this.createPacketProxy(this);
      }

      return this;
    }

    if (!packet.raw || packet.raw.length < 13) {
      throw new Error(`Buffer length smaller than minimum size allowed for valid packet`);
    }

    if (packet.raw[0] !== 0x55) {
      throw new Error(`Unexpected magic identifier`);
    }

    this.version = (packet.raw.readUInt16LE(1) & 0xfc00) >> 0xa;
    this.length = packet.raw.readUInt16LE(1) & 0x03ff;
    this.crcHead = packet.raw.readUInt8(3);

    if (this.length > packet.raw.length) {
      throw new Error('Packet length larger than provided buffer');
    }

    this.raw = packet.raw;
    this.sourceRaw = this.raw.readUInt8(4);
    this.sourceType = this.sourceRaw & 0x1f;
    this.sourceIndex = (this.sourceRaw & 0xe0) >> 0x5;

    this.destinationRaw = this.raw.readUInt8(5);
    this.destinationType = this.destinationRaw & 0x1f;
    this.destinationIndex = (this.destinationRaw & 0xe0) >> 0x5;

    this.sequenceID = this.raw.readUInt16BE(6);
    this.commandTypeRaw = this.raw.readUInt8(8);
    this.commandType = this.commandTypeRaw >> 7;
    this.ackType = this.commandTypeRaw >> 5;
    this.encryptionType = this.commandTypeRaw & 0x0f;
    this.commandSet = this.raw.readUInt8(9);
    this.command = this.raw.readUint8(10);
    this.commandPayload = this.raw.subarray(11, this.raw.length - 2);
    this.crc = this.raw.readUInt16LE(this.raw.length - 2);

    this.changed = false;

    if (autoCalculate) {
      return this.createPacketProxy(this);
    }

    return this;
  }

  private createPacketProxy(packet: Packet): Packet {
    const handler = {
      get: (target: Packet, propertyName: string, receiver: unknown): unknown => {
        // Handle buffer differently since Chai has an odd time with it
        if (['buffer', 'length'].includes(propertyName)) {
          return target[propertyName as keyof Packet];
        }

        // We want to proxy these special properties
        const property = Reflect.get(target, propertyName, receiver);
        if (
          ['commandPayload', 'raw'].includes(propertyName) &&
          typeof target[propertyName as keyof Packet] === 'object' &&
          target[propertyName as keyof Packet] !== null
        ) {
          return new Proxy<object>(target[propertyName as keyof Packet], handler);
        }

        // Properly bind functions as needed
        return typeof property === 'function' ? property.bind(target) : property;
      },

      set: (target: Packet, propertyName: keyof Packet, value: unknown) => {
        // Never let a command payload be set to undefined
        // if (['commandPayload'].includes(propertyName) && value === undefined) {
        //   value = Buffer.alloc(0);
        // }

        // If someone wants to change raw, just create a new object for them
        if (['raw'].includes(propertyName)) {
          throw new Error(
            'Cannot directly modify the raw buffer, either modify members or create new packet from a buffer',
          );
        }

        const ret = Reflect.set(target, propertyName, value);
        if (Packet.prototype[propertyName] !== null) {
          packet.changed = true;
          packet.calculatePacket();
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
      this.length = 13 + ~~this.commandPayload?.length;
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

    this.commandTypeRaw = (this.commandType << 7) | (this.ackType << 5) | this.encryptionType;
    buffer.writeUInt8(this.commandTypeRaw, 8);
    buffer.writeUInt8(this.commandSet, 9);

    buffer.writeUint8(this.command, 10);

    if (this.commandPayload?.length > 0) {
      for (let i = 0; i < this.commandPayload.length; i++) {
        buffer.writeUInt8(this.commandPayload.at(i), 11 + i);
      }
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
    let commandSubType = 'UNKNOWN';
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
      `Cmd Payload ${this.commandPayload ? `(0x${this.commandPayload.toString('hex')})` : 'NULL'}`
    );
  }

  /**
   * @returns {string} a multi-line string to represent all the values of the packet in a readable format
   */
  public toLongString(): string {
    let commandSubType = 'UNKNOWN';
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
        this.commandPayload ? `(0x${this.commandPayload.toString('hex')})` : 'NULL'
      }\n` +
      `CRC16:\t\t0x${this.crc.toString(16)}`
    );
  }

  /**
   * @returns {string} a hex representation of the underlying packet as a string
   */
  public toHexString(): string {
    return this.toBuffer().toString('hex');
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
    return new Packet({ raw: Buffer.from(hexString, 'hex') }, autoCalculate);
  }
}

module.exports = {
  Packet,

  GeneralTypes,
  DeviceType,
  CommandType,
  AckType,
  EncryptionType,
  SetType,
};

export { GeneralTypes, DeviceType, CommandType, AckType, EncryptionType, SetType };
