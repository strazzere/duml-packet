import { crc8Wire, crc16KermitJam } from "./crc";

// Splits a buffer of back to back DUML packets into the individual packets. The length is the low ten bits of the
// two bytes after the magic 0x55.
const splitPackets = (hex: string): Buffer[] => {
  const buffer = Buffer.from(hex, "hex");
  const packets: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; ) {
    const length = buffer[offset + 1] | ((buffer[offset + 2] & 0x03) << 8);
    packets.push(buffer.subarray(offset, offset + length));
    offset += length;
  }
  return packets;
};

// Real packets (see packet.spec.ts), so their checksums are known to be right. The last two bytes are the crc16 of
// everything before them, stored little endian, and the fourth byte is the crc8 of the first three.
const packets = [
  "550e04662a28de2f40004f0154c8",
  "550e04662a2d123440003211e1ad",
  "550e04662a28de2f40005b01a53a",
  "550e04664a28de2f40005b01a4e9",
  // Two packets in one buffer, both much longer than the others
  "552c0436030a2b3f00000ec320203139303530205b442d4f53445d646973706c61795f6d6f646520360073e85528040d030a2c3f00000ea320203139303530205b442d52435d3120312028307c30297c30008128",
].flatMap(splitPackets);

describe("crc tests", () => {
  test("splits the multi packet buffer the way the test data expects", () => {
    expect(packets).toHaveLength(6);
    expect(packets[4]).toHaveLength(0x2c);
    expect(packets[5]).toHaveLength(0x28);
  });

  test.each(packets.map((packet) => [packet.toString("hex"), packet]))(
    "crc8 of the header matches for %s",
    (_hex, packet) => {
      expect(crc8Wire(packet.subarray(0, 3))).toBe(packet[3]);
    },
  );

  test.each(packets.map((packet) => [packet.toString("hex"), packet]))(
    "crc16 of the body matches for %s",
    (_hex, packet) => {
      const body = packet.subarray(0, packet.length - 2);

      expect(crc16KermitJam(body)).toBe(packet.readUInt16LE(packet.length - 2));
    },
  );

  test("an empty buffer gives the initial values", () => {
    expect(crc8Wire(Buffer.alloc(0))).toBe(0x77);
    expect(crc16KermitJam(Buffer.alloc(0))).toBe(0x3692);
  });

  test("results are always unsigned and in range", () => {
    // The crc8 table is an Int8Array, so negative values would be easy to leak out of it
    for (let value = 0; value <= 0xff; value++) {
      const buffer = Buffer.from([value, 0xff - value, value ^ 0x5a]);

      const crc8 = crc8Wire(buffer);
      const crc16 = crc16KermitJam(buffer);
      expect(crc8).toBeGreaterThanOrEqual(0);
      expect(crc8).toBeLessThanOrEqual(0xff);
      expect(crc16).toBeGreaterThanOrEqual(0);
      expect(crc16).toBeLessThanOrEqual(0xffff);
    }
  });

  test("flipping any single bit changes the checksum", () => {
    const original = Buffer.from("550e04662a28de2f40004f01", "hex");
    const expected8 = crc8Wire(original);
    const expected16 = crc16KermitJam(original);

    for (let byte = 0; byte < original.length; byte++) {
      for (let bit = 0; bit < 8; bit++) {
        const changed = Buffer.from(original);
        changed[byte] ^= 1 << bit;

        expect(crc16KermitJam(changed)).not.toBe(expected16);
        // The crc8 has far fewer values, but it must still catch any single bit error
        expect(crc8Wire(changed)).not.toBe(expected8);
      }
    }
  });
});
