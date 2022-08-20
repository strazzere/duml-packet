import { EventEmitter } from 'events';
import { crc8Wire, crc16KermitJam } from './crc';

import { DeviceType, CommandType, AckType, EncryptionType } from './types';

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
  commandPayload: Buffer;
  crc: number;

  changed: boolean;

  emitter: EventEmitter;

  constructor(buffer: Buffer, autoCalculate = true) {
    if (!buffer || buffer.length < 13) {
      throw new Error(`Buffer length smaller than minimum size allowed for valid packet`);
    }

    if (buffer[0] !== 0x55) {
      throw new Error(`Unexpected magic identifier`);
    }

    this.version = (buffer.readUInt16LE(1) & 0xfc00) >> 0xa;
    this.length = buffer.readUInt16LE(1) & 0x03ff;
    this.crcHead = buffer.readUInt8(3);

    if (this.length > buffer.length) {
      throw new Error('Packet length larger than provided buffer');
    }

    this.raw = buffer;
    this.sourceRaw = buffer.readUInt8(4);
    this.sourceType = this.sourceRaw & 0xe;
    this.sourceIndex = (this.sourceRaw & 0xe0) >> 0x5;

    this.destinationRaw = buffer.readUInt8(5);
    this.destinationType = this.destinationRaw & 0xe;
    this.destinationIndex = (this.destinationRaw & 0xe0) >> 0x5;

    this.sequenceID = buffer.readUInt16BE(6);
    this.commandTypeRaw = buffer.readUInt8(8);
    this.commandType = this.commandTypeRaw >> 7;
    this.ackType = this.commandTypeRaw >> 5;
    this.encryptionType = this.commandTypeRaw & 0x0f;
    this.commandSet = buffer.readUInt8(9);
    this.commandPayload = buffer.subarray(10, buffer.length - 2);
    this.crc = buffer.readUInt16LE(buffer.length - 2);

    this.changed = false;

    if (autoCalculate) {
      return this.createPacketProxy(this);
    }

    return this;
  }

  createPacketProxy(packet: Packet) {
    const handler = {
      get: (target: any, propertyName: any, receiver: unknown): unknown => {
        // Handle buffer differently since Chai has an odd time with it
        if (['buffer', 'length'].includes(propertyName)) {
          return target[propertyName];
        }

        // We want to proxy these special properties
        const property = Reflect.get(target, propertyName, receiver);
        if (
          ['commandPayload', 'raw'].includes(propertyName) &&
          typeof target[propertyName] === 'object' &&
          target[propertyName] !== null
        ) {
          return new Proxy(target[propertyName], handler);
        }

        // Properly bind functions as needed
        return typeof property === 'function' ? property.bind(target) : property;
      },

      set: (target: Packet, propertyName: keyof Packet, value: unknown) => {
        // Never let a command payload be set to undefined
        if (['commandPayload'].includes(propertyName) && value === undefined) {
          value = Buffer.alloc(0);
        }

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

    return new Proxy(packet, handler);
  }

  calculatePacket() {
    this.length = 12 + (this.commandPayload.length === 0 ? 1 : this.commandPayload.length);
    const buffer = Buffer.alloc(this.length);

    // Write magic byte
    buffer.writeUInt8(0x55, 0);

    // Version and Length
    buffer.writeUInt16LE(((this.version & 0x3f) << 0xa) | this.length, 1);

    // Header crc
    this.crcHead = crc8Wire(buffer.subarray(0, 3));
    buffer.writeUInt8(this.crcHead, 3);

    this.sourceRaw = this.sourceType | (this.sourceIndex << 0x5);
    buffer.writeUInt8(this.sourceRaw, 4);

    this.destinationRaw = this.destinationType | (this.destinationIndex << 0x5);
    buffer.writeUInt8(this.destinationRaw, 5);
    buffer.writeUInt16BE(this.sequenceID, 6);

    this.commandTypeRaw = (this.commandType << 7) | (this.ackType << 5) | this.encryptionType;
    buffer.writeUInt8(this.commandTypeRaw, 8);
    buffer.writeUInt8(this.commandSet, 9);

    if (this.commandPayload.length > 0) {
      for (let i = 0; i < this.commandPayload.length; i++) {
        buffer.writeUInt8(this.commandPayload.at(i), 10 + i);
      }
    } else {
      buffer.writeUInt8(0x00, 10);
    }

    this.crc = crc16KermitJam(buffer.subarray(0, buffer.length - 2));
    buffer.writeUInt16LE(this.crc, buffer.length - 2);

    this.raw = buffer;
  }

  isValid(): boolean {
    return (
      this.crcHead === crc8Wire(this.raw.subarray(0, 3)) &&
      this.crc === crc16KermitJam(this.raw.subarray(0, this.raw.length - 2))
    );
  }

  toShortString(): string {
    return (
      `Source (0x${this.sourceRaw.toString(16)}), ` +
      `Ver (0x${this.version.toString(16)}), ` +
      `Dest (0x${this.destinationRaw.toString(16)}), ` +
      `Sequence (0x${this.sequenceID.toString(16)}), ` +
      `Cmd Type (0x${this.commandTypeRaw.toString(16)}), ` +
      `Cmd Payload (0x${this.commandPayload.toString('hex')})`
      // `Cmd Payload (0x${[...new Uint8Array(this.commandPayload)]
      //   .map((x) => x.toString(16).padStart(2, '0'))
      //   .join('')})`
    );
  }

  toLongString(): string {
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
      `Cmd Set:\t0x${this.commandSet.toString(16)}\n` +
      `Cmd Payload (0x${this.commandPayload.toString('hex')})` +
      // `Cmd Payload:\t0x${[...new Uint8Array(this.commandPayload)]
      //   .map((x) => x.toString(16).padStart(2, '0'))
      //   .join('')}\n` +
      `CRC16:\t\t0x${this.crc.toString(16)}`
    );
  }

  toHexString(): string {
    return this.toBuffer().toString('hex');
  }

  toBuffer(): Buffer {
    return this.raw;
  }
}
