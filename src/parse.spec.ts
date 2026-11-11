import { DumlParseError, Packet } from "./packet";

const GOOD = "550e04662a28de2f40004f0154c8";
// Same as GOOD, but the last byte of the checksum is wrong
const BAD_CRC = "550e04662a28de2f40004f0154c9";
// Both packets of a real heartbeat, one after the other (44 and 40 bytes long)
const HEARTBEAT =
  "552c0436030a2b3f00000ec320203139303530205b442d4f53445d646973706c61795f6d6f646520360073e85528040d030a2c3f00000ea320203139303530205b442d52435d3120312028307c30297c30008128";

const parseError = (fn: () => unknown): DumlParseError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DumlParseError);
    return error as DumlParseError;
  }
  throw new Error("expected a DumlParseError, but nothing was thrown");
};

describe("parse errors", () => {
  test("a buffer that is too small", () => {
    const error = parseError(() => Packet.fromBuffer(Buffer.alloc(5)));

    expect(error.code).toBe("BUFFER_TOO_SMALL");
    expect(error.message).toBe(
      "Buffer length smaller than minimum size allowed for valid packet",
    );
    expect(error.name).toBe("DumlParseError");
    expect(error).toBeInstanceOf(Error);
  });

  test("a wrong magic byte", () => {
    const error = parseError(() => Packet.fromHexString(`56${GOOD.slice(2)}`));

    expect(error.code).toBe("BAD_MAGIC");
    expect(error.message).toBe("Unexpected magic identifier");
  });

  test("a length that is larger than the buffer", () => {
    const error = parseError(() =>
      Packet.fromHexString("550f04662a28de2f40004f0154c8"),
    );

    expect(error.code).toBe("LENGTH_EXCEEDS_BUFFER");
    expect(error.message).toBe("Packet length larger than provided buffer");
  });

  test("a length that is smaller than a packet can be", () => {
    // 0x0a is 10 bytes, but the fields of a packet alone are 13
    const error = parseError(() =>
      Packet.fromHexString("550a04662a28de2f40004f0154c8"),
    );

    expect(error.code).toBe("LENGTH_TOO_SMALL");
    expect(error.message).toBe(
      "Packet length smaller than minimum size allowed for valid packet",
    );
  });
});

describe("fromHexString", () => {
  test("parses upper and lower case hex", () => {
    expect(Packet.fromHexString(GOOD.toUpperCase()).toHexString()).toBe(GOOD);
    expect(Packet.fromHexString(GOOD).toHexString()).toBe(GOOD);
  });

  test("ignores half a byte at the end, as it always has", () => {
    // Captures and hex dumps are cut anywhere, and this is accepted by older versions, which
    // duml-beagle-parse depends on for most of the packets in a real capture
    const packet = Packet.fromHexString(`${GOOD}5`);

    expect(packet.toHexString()).toBe(GOOD);
    expect(packet.isValid()).toBe(true);
    expect(packet.remainder).toHaveLength(0);
  });

  test.each([
    ["characters that are not hex", "zz"],
    ["characters that are not hex after a packet", `${GOOD}zz`],
    [
      "a non hex character in the middle",
      `${GOOD.slice(0, 10)}g${GOOD.slice(11)}`,
    ],
    ["a 0x prefix", `0x${GOOD}`],
    ["whitespace", `${GOOD.slice(0, 10)} ${GOOD.slice(10)}`],
  ])("rejects %s", (_name, hex) => {
    const error = parseError(() => Packet.fromHexString(hex));

    expect(error.code).toBe("INVALID_HEX");
  });

  test("an empty string is valid hex, but not a packet", () => {
    expect(parseError(() => Packet.fromHexString("")).code).toBe(
      "BUFFER_TOO_SMALL",
    );
  });
});

describe("trailing data", () => {
  test("only the declared length is the packet, the rest is the remainder", () => {
    const packet = Packet.fromHexString(`${GOOD}deadbeef`);

    expect(packet.toHexString()).toBe(GOOD);
    expect(packet.isValid()).toBe(true);
    expect(packet.length).toBe(14);
    expect(packet.commandPayload?.toString("hex")).toBe("01");
    expect(packet.remainder.toString("hex")).toBe("deadbeef");
  });

  test("the remainder is empty when there is nothing left", () => {
    const packet = Packet.fromHexString(GOOD);

    expect(packet.remainder).toHaveLength(0);
  });

  test("the remainder of a buffer with two packets is the second packet", () => {
    const first = Packet.fromHexString(`${GOOD}${BAD_CRC}`);
    const second = Packet.fromBuffer(first.remainder);

    expect(first.toHexString()).toBe(GOOD);
    expect(first.isValid()).toBe(true);
    expect(second.toHexString()).toBe(BAD_CRC);
    expect(second.isValid()).toBe(false);
  });

  test("a packet does not share memory with the buffer it was parsed from", () => {
    const input = Buffer.from(`${GOOD}deadbeef`, "hex");
    const packet = Packet.fromBuffer(input);

    // Changing the input afterwards does not change the packet
    input[10] = 0xff;
    input[11] = 0xff;
    expect(packet.toHexString()).toBe(GOOD);

    // And editing the packet does not change the input
    const before = Buffer.from(input);
    (packet.commandPayload as Buffer)[0] = 0x09;
    expect(input.equals(before)).toBe(true);
  });
});

describe("parseAll", () => {
  test("splits packets that are back to back", () => {
    const { packets, remainder } = Packet.parseAll(
      Buffer.from(GOOD + GOOD + GOOD, "hex"),
    );

    expect(packets).toHaveLength(3);
    expect(packets.map((packet) => packet.toHexString())).toEqual([
      GOOD,
      GOOD,
      GOOD,
    ]);
    expect(packets.every((packet) => packet.isValid())).toBe(true);
    expect(remainder).toHaveLength(0);
  });

  test("splits a real heartbeat", () => {
    const { packets, remainder } = Packet.parseAll(HEARTBEAT);

    expect(packets.map((packet) => packet.length)).toEqual([44, 40]);
    expect(packets.every((packet) => packet.isValid())).toBe(true);
    expect(remainder).toHaveLength(0);
  });

  test("an incomplete packet at the end is the remainder, not an error", () => {
    const partial = BAD_CRC.slice(0, 10);

    const { packets, remainder } = Packet.parseAll(GOOD + partial);

    expect(packets).toHaveLength(1);
    expect(remainder.toString("hex")).toBe(partial);
  });

  test.each([
    ["only the magic byte", "55"],
    ["the magic byte and half a length", "5500"],
    ["a header without the rest of the packet", "550e0466"],
  ])("%s at the end is the remainder", (_name, tail) => {
    const { packets, remainder } = Packet.parseAll(GOOD + tail);

    expect(packets).toHaveLength(1);
    expect(remainder.toString("hex")).toBe(tail);
  });

  test("a bad checksum is not an error, the packet is just not valid", () => {
    const { packets } = Packet.parseAll(GOOD + BAD_CRC + GOOD);

    expect(packets.map((packet) => packet.isValid())).toEqual([
      true,
      false,
      true,
    ]);
  });

  test("bytes between packets that are not a packet are an error", () => {
    const error = parseError(() => Packet.parseAll(`${GOOD}00${GOOD}`));

    expect(error.code).toBe("BAD_MAGIC");
  });

  test("a packet with an impossible length is an error", () => {
    const error = parseError(() =>
      Packet.parseAll(`${GOOD}550a04662a28de2f40004f0154c8`),
    );

    expect(error.code).toBe("LENGTH_TOO_SMALL");
  });

  test("an empty buffer has no packets", () => {
    expect(Packet.parseAll(Buffer.alloc(0))).toEqual({
      packets: [],
      remainder: Buffer.alloc(0),
    });
    expect(Packet.parseAll("")).toEqual({
      packets: [],
      remainder: Buffer.alloc(0),
    });
  });

  test("hex input is validated", () => {
    expect(parseError(() => Packet.parseAll(`${GOOD}zz`)).code).toBe(
      "INVALID_HEX",
    );
  });

  test("half a byte at the end of hex input is ignored, like fromHexString", () => {
    const { packets, remainder } = Packet.parseAll(`${GOOD}${GOOD}5`);

    expect(packets).toHaveLength(2);
    expect(remainder).toHaveLength(0);
  });

  test("does not modify the buffer it is given", () => {
    const input = Buffer.from(GOOD + GOOD, "hex");
    const before = Buffer.from(input);

    (Packet.parseAll(input).packets[0].commandPayload as Buffer).fill(0x09);

    expect(input.equals(before)).toBe(true);
  });
});
