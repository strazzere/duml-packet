import {
  AckType,
  CommandType,
  DeviceType,
  EncryptionType,
  GeneralTypes,
  Packet,
  SetType,
} from "./packet";

describe("packet tests", () => {
  test("throws an error for invalid packet buffer", () => {
    const invalidBuffer = Buffer.from(
      "0b2a854d80003200000000000000000000000000000000000000000000000000003c7e",
      "hex",
    );

    expect(() => Packet.fromBuffer(invalidBuffer)).toThrow(
      "Unexpected magic identifier",
    );

    expect(() => new Packet(invalidBuffer)).toThrow(
      "Unexpected magic identifier",
    );
  });

  test("can parse heartbeat packets correctly", () => {
    const expected = Buffer.from(
      "552c0436030a2b3f00000ec320203139303530205b442d4f53445d646973706c61795f6d6f646520360073e85528040d030a2c3f00000ea320203139303530205b442d52435d3120312028307c30297c30008128",
      "hex",
    );
    const packet = Packet.fromBuffer(expected);
    packet.toShortString();
  });

  test("should not nerf destinationRaw", () => {
    const expected = Buffer.from("550e04662a2d123440003211e1ad", "hex");
    const packet = new Packet({
      sourceRaw: 0x2a,
      destinationRaw: 0x2d,
      sequenceID: 0x1234,
      commandTypeRaw: 0x40,
      commandSet: 0x00,
      command: 0x32,
      commandPayload: Buffer.from("11", "hex"),
    });
    expect(packet.toBuffer()).toEqual(expected);
  });

  test("should allow empty payload", () => {
    const packet = new Packet({
      sourceRaw: 0x2a,
      destinationRaw: 0x2d,
      sequenceID: 0x1234,
      commandTypeRaw: 0x40,
      commandSet: 0x00,
      command: 0x32,
    });
    packet.toShortString();
    packet.toLongString();
  });

  test("can utilize specialty to string methods", () => {
    const expected = Buffer.from("550E04662A28DE2F40004F0154c8", "hex");
    const packet = Packet.fromBuffer(expected);
    packet.toShortString();
    packet.toLongString();
  });

  test("can parse a packet from hex string", () => {
    const packetHex = "550E04662A28DE2F40004F0154c8";
    const expected = Buffer.from(packetHex, "hex");
    const packet = Packet.fromHexString(packetHex);

    expect(packet.toBuffer()).toEqual(expected);
  });

  test("can allow different constructor usages", () => {
    const expected = Buffer.from("550E04662A28DE2F40004F0154c8", "hex");
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
      commandPayload: Buffer.from("01", "hex"),
      crc: 0xc854,
    });

    expect(packet.toBuffer()).toEqual(expected);

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
        commandPayload: Buffer.from("01", "hex"),
        crc: 0xc854,
      },
      false,
    );

    expect(packet.toBuffer()).toEqual(expected);
  });

  test("checking a small known good packet", () => {
    const expected = Buffer.from("550E04662A28DE2F40005B01A53A", "hex");
    const packet = Packet.fromBuffer(expected);

    expect(packet.version).toBe(0x1);
    expect(packet.length).toBe(0x0e);
    expect(packet.crcHead).toBe(0x66);
    expect(packet.sourceRaw).toBe(0x2a);
    expect(packet.sourceType).toBe(DeviceType.PC);
    expect(packet.sourceIndex).toBe(0x1);
    expect(packet.destinationRaw).toBe(0x28);
    expect(packet.destinationType).toBe(DeviceType.LB_DM3XX_SKY);
    expect(packet.destinationIndex).toBe(0x1);
    expect(packet.sequenceID).toBe(0xde2f);
    expect(packet.commandTypeRaw).toBe(0x40);
    expect(packet.commandType).toBe(CommandType.REQUEST);
    expect(packet.ackType).toBe(AckType.ACK);
    expect(packet.encryptionType).toBe(EncryptionType.NONE);
    expect(packet.commandSet).toBe(0x00);
    expect(packet.command).toBe(0x5b);
    expect(packet.commandPayload?.buffer).toEqual(
      Buffer.from("01", "hex").buffer,
    );
    expect(packet.crc).toBe(0x3aa5);
    expect(packet.isValid()).toBe(true);

    expect(packet.toBuffer()).toEqual(expected);
    expect(packet.toHexString()).toBe(expected.toString("hex"));

    expect(packet.changed).toBe(false);

    packet.sourceIndex = 2;
    expect(packet.sourceRaw).toBe(0x4a);
    expect(packet.sourceType).toBe(DeviceType.PC);
    expect(packet.sourceIndex).toBe(0x2);

    const changed = Buffer.from("550e04664a28de2f40005b01a4e9", "hex");
    expect(packet.toBuffer()).toEqual(changed);
  });

  test("will not recalculate packets if disabled", () => {
    const expected = Buffer.from("550E04662A28DE2F40005B01A53A", "hex");
    const packet = Packet.fromBuffer(expected, false);

    packet.sourceRaw = 0x2b;

    expect(packet.sourceRaw).toBe(0x2b);
    expect(packet.toBuffer()).toEqual(expected);
  });

  test("correctly recalculates the packet when a deep member has changes", () => {
    const test = Buffer.from("550E04662A28DE2F40005B01A53A", "hex");
    const packet = Packet.fromBuffer(test);

    packet.commandPayload = undefined;
    const expectedChange = Buffer.from("550D04332A28DE2F40005B0BA3", "hex");
    expect(packet.toBuffer()).toEqual(expectedChange);

    packet.commandPayload = Buffer.from("010203", "hex");
    const newChange = Buffer.from("551004562A28DE2F40005B0102032CB7", "hex");
    expect(packet.toBuffer()).toEqual(newChange);

    packet.commandPayload[0] = 0x02;
    const finalChange = Buffer.from("551004562A28DE2F40005B0202034858", "hex");
    expect(packet.toBuffer()).toEqual(finalChange);

    expect(() => {
      packet.raw = test;
    }).toThrow(
      "Cannot directly modify the raw buffer, either modify members or create new packet from a buffer",
    );
  });

  test("correctly throws when packet is bad", () => {
    expect(() => {
      Packet.fromBuffer(Buffer.from("56D1FFBEEFD1FFBEEFD1FFBEEF", "hex"));
    }).toThrow("Unexpected magic identifier");

    expect(() => {
      Packet.fromBuffer(Buffer.from("55D1FF", "hex"));
    }).toThrow(
      "Buffer length smaller than minimum size allowed for valid packet",
    );

    expect(() => {
      Packet.fromBuffer(Buffer.alloc(0));
    }).toThrow(
      "Buffer length smaller than minimum size allowed for valid packet",
    );

    expect(() => {
      Packet.fromBuffer(Buffer.from("55D1FFBEEFD1FFBEEFD1FFBEEF", "hex"));
    }).toThrow("Packet length larger than provided buffer");
  });

  test("generates a sequence ID if one is not given for a new packet", () => {
    const unexpected = 0x00;
    const packet = new Packet({
      version: 0x1,
      length: 0x0e,
      crcHead: 0x66,
      sourceRaw: 0x2a,
      destinationRaw: 0x28,
      commandTypeRaw: 0x40,
      commandSet: 0x00,
      command: GeneralTypes.GET_CFG_FILE,
      commandPayload: Buffer.from("01", "hex"),
      crc: 0xc854,
    });

    expect(packet.sequenceID).not.toBe(unexpected);
  });

  test("keeps a sequence ID if one is given for a new packet", () => {
    let expected = 0x00;
    let packet = new Packet({
      version: 0x1,
      length: 0x0e,
      crcHead: 0x66,
      sourceRaw: 0x2a,
      destinationRaw: 0x28,
      sequenceID: 0x0000,
      commandTypeRaw: 0x40,
      commandSet: 0x00,
      command: GeneralTypes.GET_CFG_FILE,
      commandPayload: Buffer.from("01", "hex"),
      crc: 0xc854,
    });

    expect(packet.sequenceID).toBe(expected);

    expected = 0x01;
    packet = new Packet({
      version: 0x1,
      length: 0x0e,
      crcHead: 0x66,
      sourceRaw: 0x2a,
      destinationRaw: 0x28,
      sequenceID: 0x0001,
      commandTypeRaw: 0x40,
      commandSet: 0x00,
      command: GeneralTypes.GET_CFG_FILE,
      commandPayload: Buffer.from("01", "hex"),
      crc: 0xc854,
    });

    expect(packet.sequenceID).toBe(expected);
  });
});
