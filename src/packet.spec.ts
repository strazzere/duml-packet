import { Packet } from './packet';
import { AckType, CommandType, DeviceType, EncryptionType } from './types';
import { expect } from 'chai';

describe('packet tests', () => {
  it('can utilize specialty to string methods', () => {
    const expected = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = new Packet(expected);
    packet.toShortString()
    packet.toLongString()
  });

  it('checking a small known good packet', () => {
    const expected = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = new Packet(expected);

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
    expect(packet.commandPayload.buffer, 'command payload bad').to.deep.equal(
      Buffer.from('5b01', 'hex').buffer,
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
    expect(packet.commandPayload.buffer, 'command payload changed bad').to.deep.equal(
      Buffer.from('5b01', 'hex').buffer,
    );
    expect(packet.crc, 'crc did not change').to.not.equal(0x3aa5);

    expect(packet.changed, 'changed tracker changed').to.equal(true);

    expect(packet.isValid(), 'crc change check bad').to.be.true;

    const changed = Buffer.from('550e04664a28de2f40005b01a4e9', 'hex');
    expect(packet.toBuffer(), 'buffer was properly not changed').to.deep.equal(changed);
  });

  it('will not recalculate packets if disabled', () => {
    const expected = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = new Packet(expected, false);

    packet.sourceRaw = 0x2b;

    expect(packet.sourceRaw, 'source id did not change').to.equal(0x2b);
    expect(packet.toBuffer(), 'buffer changed').to.deep.equal(expected);
  });

  it('correctly recalculates the packet when a deep member has changes', () => {
    const test = Buffer.from('550E04662A28DE2F40005B01A53A', 'hex');
    const packet = new Packet(test);

    packet.commandPayload = undefined;
    expect(packet.commandPayload.buffer, 'payload did not change to empty set').to.deep.equal(
      Buffer.alloc(0).buffer,
    );

    let expectedChange = Buffer.from('550D04332A28DE2F4000005D4F', 'hex');
    expect(packet.toBuffer(), 'buffer did not change to no array').to.deep.equal(expectedChange);

    packet.commandPayload = Buffer.from('010203', 'hex');
    expect(packet.commandPayload.buffer, 'payload did not change').to.deep.equal(
      Buffer.from('010203', 'hex').buffer,
    );

    expectedChange = Buffer.from('550F04A22A28DE2F4000010203B3DC', 'hex');
    expect(packet.toBuffer(), 'buffer does not has full array change').to.deep.equal(
      expectedChange,
    );

    packet.commandPayload[0] = 0x02;
    expect(packet.commandPayload.buffer, 'payload did not change').to.deep.equal(
      Buffer.from('020203', 'hex').buffer,
    );

    expectedChange = Buffer.from('550F04A22A28DE2F4000020203D733', 'hex');
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
      new Packet(Buffer.from('56D1FFBEEFD1FFBEEFD1FFBEEF', 'hex'));
    };
    expect(badConstructor).to.throw('Unexpected magic identifier');

    const badLengthSmallConstructor = () => {
      new Packet(Buffer.from('55D1FF', 'hex'));
    };
    expect(badLengthSmallConstructor).to.throw(
      'Buffer length smaller than minimum size allowed for valid packet',
    );

    const badBufferConstructor = () => {
      new Packet(Buffer.from('', 'hex'));
    };
    expect(badBufferConstructor).to.throw(
      'Buffer length smaller than minimum size allowed for valid packet',
    );

    const badLengthLargeConstructor = () => {
      new Packet(Buffer.from('55D1FFBEEFD1FFBEEFD1FFBEEF', 'hex'));
    };
    expect(badLengthLargeConstructor).to.throw('Packet length larger than provided buffer');
  });
});
