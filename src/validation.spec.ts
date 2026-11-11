import { crc16KermitJam } from "./crc";
import { DeviceType, Packet } from "./packet";

const GOOD = "550e04662a28de2f40004f0154c8";

const withPayload = (size: number, autoCalculate = true): Packet =>
  new Packet(
    {
      sourceType: DeviceType.PC,
      destinationType: DeviceType.LB_DM3XX_SKY,
      sequenceID: 1,
      commandSet: 0,
      command: 1,
      commandPayload: Buffer.alloc(size, 0xab),
    },
    autoCalculate,
  );

describe("payload size", () => {
  test("the largest payload that fits (1010 bytes) round trips", () => {
    const packet = withPayload(1010);

    expect(packet.length).toBe(1023);
    expect(packet.toBuffer()).toHaveLength(1023);

    const again = Packet.fromBuffer(packet.toBuffer());
    expect(again.length).toBe(1023);
    expect(again.commandPayload).toHaveLength(1010);
    expect(again.isValid()).toBe(true);
    expect(again.version).toBe(packet.version);
  });

  test.each([1011, 1100, 5000])(
    "a payload of %i bytes is rejected instead of corrupting the header",
    (size) => {
      // The length is 10 bits wide, a bigger length used to overflow into the version and come back as a
      // different length, while isValid() said true
      expect(() => withPayload(size)).toThrow(RangeError);
      expect(() => withPayload(size)).toThrow(
        `commandPayload is ${size} bytes, but a packet can hold at most 1010`,
      );
    },
  );

  test("setting a payload that is too large is rejected and changes nothing", () => {
    const packet = Packet.fromHexString(GOOD);

    expect(() => {
      packet.commandPayload = Buffer.alloc(1011);
    }).toThrow(RangeError);

    expect(packet.toHexString()).toBe(GOOD);
    expect(packet.commandPayload?.toString("hex")).toBe("01");
    expect(packet.isValid()).toBe(true);
  });

  test("setting a payload that fits updates the packet", () => {
    const packet = Packet.fromHexString(GOOD);

    packet.commandPayload = Buffer.alloc(1010, 0x07);

    expect(packet.length).toBe(1023);
    expect(packet.isValid()).toBe(true);
    expect(Packet.fromBuffer(packet.toBuffer()).commandPayload).toHaveLength(
      1010,
    );
  });

  test("a payload can be removed", () => {
    const packet = Packet.fromHexString(GOOD);

    packet.commandPayload = undefined;

    expect(packet.length).toBe(13);
    expect(packet.isValid()).toBe(true);
    expect(packet.toBuffer()).toHaveLength(13);
  });

  test("the length is derived from the payload, so a payload that is too large is rejected without autoCalculate too", () => {
    expect(() => withPayload(1011, false)).toThrow(RangeError);
  });
});

// [field, values that are not allowed]
const invalidValues: [string, unknown[]][] = [
  ["version", [-1, 0x40]],
  ["length", [0, 12, 0x400]],
  ["crcHead", [-1, 0x100]],
  ["sourceRaw", [-1, 0x100]],
  ["sourceType", [-1, 0x20]],
  ["sourceIndex", [-1, 8]],
  ["destinationRaw", [-1, 0x100]],
  ["destinationType", [-1, 0x20]],
  ["destinationIndex", [-1, 8]],
  ["sequenceID", [-1, 0x10000, 0x1ffff, 1.5, Number.NaN, "5", null]],
  ["commandTypeRaw", [-1, 0x100]],
  ["commandType", [-1, 2]],
  ["ackType", [-1, 4]],
  ["encryptionType", [-1, 0x10]],
  ["commandSet", [-1, 0x100]],
  ["command", [-1, 0x100]],
  ["crc", [-1, 0x10000]],
];

describe("field validation", () => {
  const cases = invalidValues.flatMap(([field, values]) =>
    values.map((value): [string, unknown] => [field, value]),
  );

  test.each(cases)("%s can not be set to %p", (field, value) => {
    const packet = Packet.fromHexString(GOOD);
    const before = (packet as unknown as Record<string, unknown>)[field];

    expect(() => {
      (packet as unknown as Record<string, unknown>)[field] = value;
    }).toThrow(RangeError);
    expect(() => {
      (packet as unknown as Record<string, unknown>)[field] = value;
    }).toThrow(new RegExp(`^${field} must be an integer between `));

    // The packet is exactly as it was, not half changed
    expect((packet as unknown as Record<string, unknown>)[field]).toBe(before);
    expect(packet.toHexString()).toBe(GOOD);
    expect(packet.isValid()).toBe(true);
  });

  test.each(cases)(
    "%s can not be given as %p to the constructor",
    (field, value) => {
      expect(
        () =>
          new Packet({ [field]: value } as ConstructorParameters<
            typeof Packet
          >[0]),
      ).toThrow(RangeError);
    },
  );

  test("the limits themselves are fine", () => {
    const packet = Packet.fromHexString(GOOD);

    packet.sequenceID = 0;
    packet.sequenceID = 0xffff;
    packet.version = 0;
    packet.version = 0x3f;
    packet.command = 0xff;
    packet.commandSet = 0xff;
    packet.sourceIndex = 7;
    packet.destinationType = 0x1f;

    expect(packet.sequenceID).toBe(0xffff);
    expect(packet.isValid()).toBe(true);
    const again = Packet.fromBuffer(packet.toBuffer());
    expect(again.version).toBe(0x3f);
    expect(again.command).toBe(0xff);
    expect(again.commandSet).toBe(0xff);
    expect(again.sourceIndex).toBe(7);
    expect(again.destinationType).toBe(0x1f);
  });

  test("a rejected value does not stop later edits from working", () => {
    const packet = Packet.fromHexString(GOOD);

    expect(() => {
      packet.sequenceID = 0x1ffff;
    }).toThrow(RangeError);
    packet.sequenceID = 0x1234;

    expect(packet.toHexString()).toBe("550e04662a28123440004f017f0d");
    expect(packet.isValid()).toBe(true);
  });

  test("a payload has to be a Buffer", () => {
    const packet = Packet.fromHexString(GOOD);

    expect(() => {
      packet.commandPayload = "abc" as unknown as Buffer;
    }).toThrow(TypeError);
    expect(packet.toHexString()).toBe(GOOD);
  });

  test("the raw buffer still can't be set", () => {
    const packet = Packet.fromHexString(GOOD);

    expect(() => {
      packet.raw = Buffer.alloc(13);
    }).toThrow("Cannot directly modify the raw buffer");
  });
});

describe("autoCalculate=false", () => {
  test("an edit is written to the bytes, but lengths and checksums are not fixed", () => {
    const packet = Packet.fromHexString(GOOD, false);

    packet.sequenceID = 0x1234;

    // The sequence id changed, the checksum bytes (54c8) are what they were
    expect(packet.toHexString()).toBe("550e04662a28123440004f0154c8");
    expect(packet.isValid()).toBe(false);
    expect(Packet.fromHexString(packet.toHexString(), false).sequenceID).toBe(
      0x1234,
    );
  });

  test("the checksum can be set by hand", () => {
    const packet = Packet.fromHexString(GOOD, false);

    packet.sequenceID = 0x1234;
    packet.crc = crc16KermitJam(packet.toBuffer().subarray(0, -2));

    expect(packet.toHexString()).toBe("550e04662a28123440004f017f0d");
    expect(packet.isValid()).toBe(true);
  });

  test("a bad checksum can be crafted on purpose", () => {
    const packet = new Packet(
      {
        sourceType: DeviceType.PC,
        destinationType: DeviceType.LB_DM3XX_SKY,
        sequenceID: 0xde2f,
        commandSet: 0,
        command: 0x4f,
        commandPayload: Buffer.from([0x01]),
        crcHead: 0x12,
        crc: 0xbeef,
      },
      false,
    );

    expect(packet.toBuffer()[3]).toBe(0x12);
    expect(packet.toBuffer().readUInt16LE(packet.toBuffer().length - 2)).toBe(
      0xbeef,
    );
    expect(packet.isValid()).toBe(false);
  });

  test("the length it is given is the length it uses", () => {
    const packet = Packet.fromHexString(GOOD, false);

    packet.length = 20;

    expect(packet.toBuffer()).toHaveLength(20);
    expect(packet.toBuffer().readUInt16LE(1) & 0x3ff).toBe(20);
  });

  test("the values are still checked", () => {
    const packet = Packet.fromHexString(GOOD, false);

    expect(() => {
      packet.sequenceID = 0x1ffff;
    }).toThrow(RangeError);
    expect(() => {
      packet.length = 5;
    }).toThrow(RangeError);
    expect(() => {
      packet.raw = Buffer.alloc(13);
    }).toThrow("Cannot directly modify the raw buffer");
    expect(packet.toHexString()).toBe(GOOD);
  });

  test("with autoCalculate (the default) the same edit keeps the packet valid", () => {
    const packet = Packet.fromHexString(GOOD);

    packet.sequenceID = 0x1234;

    expect(packet.toHexString()).toBe("550e04662a28123440004f017f0d");
    expect(packet.isValid()).toBe(true);
  });
});

describe("the raw fields", () => {
  test.each([
    ["with autoCalculate", true],
    ["without autoCalculate", false],
  ])("can be set, %s", (_name, autoCalculate) => {
    const packet = Packet.fromHexString(GOOD, autoCalculate);

    packet.sourceRaw = 0x4b;
    packet.destinationRaw = 0x21;
    packet.commandTypeRaw = 0xc0;

    // A raw field is made of other fields, which are set from it
    expect(packet.sourceRaw).toBe(0x4b);
    expect(packet.sourceType).toBe(0x0b);
    expect(packet.sourceIndex).toBe(2);
    expect(packet.destinationRaw).toBe(0x21);
    expect(packet.destinationType).toBe(0x01);
    expect(packet.destinationIndex).toBe(1);
    expect(packet.commandTypeRaw).toBe(0xc0);
    expect(packet.commandType).toBe(1);
    expect(packet.ackType).toBe(2);
    expect(packet.encryptionType).toBe(0);

    // And it is in the bytes
    const bytes = packet.toBuffer();
    expect([bytes[4], bytes[5], bytes[8]]).toEqual([0x4b, 0x21, 0xc0]);
    expect(packet.isValid()).toBe(autoCalculate);
  });

  test("and the fields they are made of change them", () => {
    const packet = Packet.fromHexString(GOOD);

    packet.sourceIndex = 3;
    packet.ackType = 1;

    expect(packet.sourceRaw).toBe(0x6a);
    expect(packet.commandTypeRaw).toBe(0x20);
    expect(packet.isValid()).toBe(true);
  });
});
