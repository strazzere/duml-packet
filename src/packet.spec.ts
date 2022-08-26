import { Packet } from './packet';
import { AckType, CommandType, DeviceType, EncryptionType, GeneralTypes, SetType } from './types';
import { expect } from 'chai';

describe('packet tests', () => {
  it('can utilize specialty to string methods', () => {
    const expected = Buffer.from('550E04662A28DE2F40004F0154c8', 'hex');
    const packet = Packet.fromBuffer(expected);
    packet.toShortString();
    packet.toLongString();
  });

  it('can parse a packet from hex string', () => {
    const packetHex = '550E04662A28DE2F40004F0154c8';
    const expected = Buffer.from(packetHex, 'hex');
    const packet = Packet.fromHexString(packetHex);

    expect(packet.toBuffer(), 'should be identical').to.deep.equal(expected);
  });

  it('can allow different constructor usages', () => {
    const expected = Buffer.from('550E04662A28DE2F40004F0154c8', 'hex');
    let packet = new Packet({
      version: 0x1,
      length: 0x0e,
      crcHead: 0x66,
      sourceRaw: 0x2a,
      destinationRaw: 0x28,
      sequenceID: 0xde2f,
      commandTypeRaw: 0x40,
      commandSet: 0x00,
      command: GeneralTypes.GET_CFG_FILE,
      commandPayload: Buffer.from('01', 'hex'),
      crc: 0xc854,
    });

    expect(packet.toBuffer(), 'created with raw tags did not match').to.deep.equal(expected);

    packet = undefined;
    packet = new Packet(
      {
        version: 0x1,
        length: 0x0e,
        crcHead: 0x66,
        sourceType: DeviceType.PC,
        sourceIndex: 0x1,
        destinationType: DeviceType.LB_DM3XX_SKY,
        destinationIndex: 0x1,
        sequenceID: 0xde2f,
        commandType: CommandType.REQUEST,
        ackType: AckType.ACK,
        encryptionType: EncryptionType.NONE,
        commandSet: SetType.GENERAL,
        command: GeneralTypes.GET_CFG_FILE,
        commandPayload: Buffer.from('01', 'hex'),
        crc: 0xc854,
      },
      false,
    );

    expect(packet.toBuffer(), 'created without raw tags did not match').to.deep.equal(expected);
  });

  it('checking a small known good packet', () => {
    const expected = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = Packet.fromBuffer(expected);

    // 55 0E04 66 2A 28 DE2F 40 00 5B01 A53A
    expect(packet.version, 'version bad').to.equal(0x1);
    expect(packet.length, 'length bad').to.equal(0x0e);
    expect(packet.crcHead, 'crc bad').to.equal(0x66);
    expect(packet.sourceRaw, 'source raw bad').to.equal(0x2a);
    expect(packet.sourceType, 'source type bad').to.equal(DeviceType.PC);
    expect(packet.sourceIndex, 'source index bad').to.equal(0x1);
    expect(packet.destinationRaw, 'destination raw bad').to.equal(0x28);
    expect(packet.destinationType, 'destination type bad').to.equal(DeviceType.LB_DM3XX_SKY);
    expect(packet.destinationIndex, 'destination index bad').to.equal(0x1);
    expect(packet.sequenceID, 'sequence id bad').to.equal(0xde2f);
    expect(packet.commandTypeRaw, 'command type raw bad').to.equal(0x40);
    expect(packet.commandType, 'command type bad').to.equal(CommandType.REQUEST);
    expect(packet.ackType, 'ack type bad').to.equal(AckType.ACK);
    expect(packet.encryptionType, 'encryption type bad').to.equal(EncryptionType.NONE);
    expect(packet.commandSet, 'command set bad').to.equal(0x00);
    expect(packet.command, 'command set bad').to.equal(0x5b);
    expect(packet.commandPayload.buffer, 'command payload bad').to.deep.equal(
      Buffer.from('01', 'hex').buffer,
    );
    expect(packet.crc, 'crc bad').to.equal(0x3aa5);

    expect(packet.isValid(), 'crc check bad').to.be.true;

    expect(packet.toBuffer()).to.deep.equal(expected);
    expect(packet.toHexString()).to.equal(expected.toString('hex'));

    expect(packet.changed, 'changed tracker has not changed').to.equal(false);

    // Change something small and make sure everything recaculates
    packet.sourceIndex = 2;
    expect(packet.sourceRaw, 'source raw did not changed').to.equal(0x4a);
    expect(packet.sourceType, 'source type changed').to.equal(DeviceType.PC);
    expect(packet.sourceIndex, 'source index did not change bad').to.equal(0x2);

    expect(packet.version, 'version bad').to.equal(0x1);
    expect(packet.length, 'length bad').to.equal(0x0e);
    expect(packet.crcHead, 'crc head changed').to.equal(0x66);
    expect(packet.destinationRaw, 'destination raw changed bad').to.equal(0x28);
    expect(packet.destinationType, 'destination type changed bad').to.equal(
      DeviceType.LB_DM3XX_SKY,
    );
    expect(packet.destinationIndex, 'destination index changed bad').to.equal(0x1);
    expect(packet.sequenceID, 'sequence id changed bad').to.equal(0xde2f);
    expect(packet.commandTypeRaw, 'command type raw changed bad').to.equal(0x40);
    expect(packet.commandType, 'command type changed bad').to.equal(CommandType.REQUEST);
    expect(packet.ackType, 'ack type changed bad').to.equal(AckType.ACK);
    expect(packet.encryptionType, 'encryption type changed bad').to.equal(EncryptionType.NONE);
    expect(packet.commandSet, 'command set changed bad').to.equal(0x00);
    expect(packet.command, 'command set changed bad').to.equal(0x5b);
    expect(packet.commandPayload.buffer, 'command payload changed bad').to.deep.equal(
      Buffer.from('01', 'hex').buffer,
    );
    expect(packet.crc, 'crc did not change').to.not.equal(0x3aa5);

    expect(packet.changed, 'changed tracker changed').to.equal(true);

    expect(packet.isValid(), 'crc change check bad').to.be.true;

    const changed = Buffer.from('550e04664a28de2f40005b01a4e9', 'hex');
    expect(packet.toBuffer(), 'buffer was properly not changed').to.deep.equal(changed);
  });

  it('will not recalculate packets if disabled', () => {
    const expected = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = Packet.fromBuffer(expected, false);

    packet.sourceRaw = 0x2b;

    expect(packet.sourceRaw, 'source id did not change').to.equal(0x2b);
    expect(packet.toBuffer(), 'buffer changed').to.deep.equal(expected);
  });

  it('correctly recalculates the packet when a deep member has changes', () => {
    const test = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = Packet.fromBuffer(test);

    packet.commandPayload = undefined;
    expect(packet.commandPayload, 'payload did not change to empty set').to.deep.equal(undefined);

    let expectedChange = Buffer.from('550D04332A28DE2F40005B0BA3', 'hex');
    expect(packet.toBuffer(), 'buffer did not change to no array').to.deep.equal(expectedChange);

    packet.commandPayload = Buffer.from('010203', 'hex');
    expect(packet.commandPayload.buffer, 'payload did not change').to.deep.equal(
      Buffer.from('010203', 'hex').buffer,
    );

    expectedChange = Buffer.from('551004562A28DE2F40005B0102032CB7', 'hex');
    expect(packet.toBuffer(), 'buffer does not has full array change').to.deep.equal(
      expectedChange,
    );

    packet.commandPayload[0] = 0x02;
    expect(packet.commandPayload.buffer, 'payload did not change').to.deep.equal(
      Buffer.from('020203', 'hex').buffer,
    );

    expectedChange = Buffer.from('551004562A28DE2F40005B0202034858', 'hex');
    expect(packet.toBuffer(), 'buffer does not has full array change').to.deep.equal(
      expectedChange,
    );

    expect(() => {
      packet.raw = test;
    }).to.throw(
      'Cannot directly modify the raw buffer, either modify members or create new packet from a buffer',
    );
  });

  it('correctly throws when packet is bad', () => {
    const badConstructor = () => {
      Packet.fromBuffer(Buffer.from('56D1FFBEEFD1FFBEEFD1FFBEEF', 'hex'));
    };
    expect(badConstructor).to.throw('Unexpected magic identifier');

    const badLengthSmallConstructor = () => {
      Packet.fromBuffer(Buffer.from('55D1FF', 'hex'));
    };
    expect(badLengthSmallConstructor).to.throw(
      'Buffer length smaller than minimum size allowed for valid packet',
    );

    const badBufferConstructor = () => {
      Packet.fromBuffer(Buffer.alloc(0));
    };
    expect(badBufferConstructor).to.throw(
      'Buffer length smaller than minimum size allowed for valid packet',
    );

    const badLengthLargeConstructor = () => {
      Packet.fromBuffer(Buffer.from('55D1FFBEEFD1FFBEEFD1FFBEEF', 'hex'));
    };
    expect(badLengthLargeConstructor).to.throw('Packet length larger than provided buffer');
  });
});
