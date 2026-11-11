/**
 * Why a buffer or hex string could not be parsed as a packet.
 *
 * - `INVALID_HEX`: the string is not an even number of hexadecimal characters
 * - `BUFFER_TOO_SMALL`: there are fewer bytes than the fields of a packet need
 * - `BAD_MAGIC`: the first byte is not the 0x55 every packet starts with
 * - `LENGTH_TOO_SMALL`: the packet's own length field is smaller than the fields of a packet
 * - `LENGTH_EXCEEDS_BUFFER`: the packet's own length field is larger than the bytes there are
 */
export type DumlParseErrorCode =
  | "INVALID_HEX"
  | "BUFFER_TOO_SMALL"
  | "BAD_MAGIC"
  | "LENGTH_TOO_SMALL"
  | "LENGTH_EXCEEDS_BUFFER";

/**
 * Thrown when something can't be parsed as a DUML packet. Check `code` rather than matching the message.
 */
export class DumlParseError extends Error {
  readonly code: DumlParseErrorCode;

  constructor(code: DumlParseErrorCode, message: string) {
    super(message);
    this.name = "DumlParseError";
    this.code = code;
  }
}
