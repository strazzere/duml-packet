import { DumlParseError } from "../packet";

/**
 * Runs a command, and reports input that isn't a packet as a one line error and a failing exit status, rather than
 * the stack trace of an exception. Anything else is a bug, and is left to blow up.
 */
export const run = (action: () => void) => {
  try {
    action();
  } catch (error) {
    if (error instanceof DumlParseError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
};
