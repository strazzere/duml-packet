import type { Arguments } from "yargs";
import { Packet } from "../packet";
import { commands } from "./index";

const GOOD = "550E04662A28DE2F40004F0154c8";

const command = (name: string) => {
  const found = commands.find((candidate) =>
    String(candidate.command).startsWith(name),
  );
  if (!found?.handler) {
    throw new Error(`no ${name} command`);
  }
  return (hex: string) =>
    found.handler({ _: [], $0: "dumlpacket", buffer: hex } as Arguments);
};

describe("commands", () => {
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.exitCode = undefined;
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
    process.exitCode = undefined;
  });

  test("print shows the short form", () => {
    command("print")(GOOD);

    expect(log).toHaveBeenCalledWith(
      "Source (0x2a), Ver (0x1), Dest (0x28), Sequence (0xde2f), Cmd Type (0x40), Cmd SubType GET_CFG_FILE (0x4f), Cmd Payload (0x01)",
    );
    expect(process.exitCode).toBeUndefined();
  });

  test("pretty-print shows the long form", () => {
    command("pretty-print")(GOOD.toLowerCase());

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("Valid CRC:\ttrue");
    expect(log.mock.calls[0][0]).toContain("Cmd SubType:\tGET_CFG_FILE (0x4f)");
    expect(process.exitCode).toBeUndefined();
  });

  test("only the first packet is shown when there is more than one", () => {
    command("print")(GOOD + GOOD);

    expect(log).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
  });

  test.each([
    ["print", "zz", "Invalid hex string"],
    ["pretty-print", "zz", "Invalid hex string"],
    ["print", "", "Buffer length smaller than minimum"],
    ["print", "55", "Buffer length smaller than minimum"],
    [
      "print",
      "550E04662A28DE2F40004F0154",
      "Packet length larger than provided buffer",
    ],
    [
      "pretty-print",
      "560E04662A28DE2F40004F0154c8",
      "Unexpected magic identifier",
    ],
  ])(
    "%s %p is a one line error and a failing exit status",
    (name, hex, message) => {
      command(name)(hex);

      expect(log).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toMatch(new RegExp(`^Error: ${message}`));
      expect(process.exitCode).toBe(1);
    },
  );

  test("anything that is not a parse error is a bug and is not hidden", () => {
    const broken = jest
      .spyOn(Packet, "fromHexString")
      .mockImplementation(() => {
        throw new TypeError("a bug");
      });

    try {
      expect(() => command("print")(GOOD)).toThrow("a bug");
      expect(error).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      broken.mockRestore();
    }
  });
});
