import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const bundle = [
  {
    input: "./dist/packet.js",
    output: [
      {
        file: "./dist/bundle.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [typescript()],
  },
  {
    input: "./dist/packet.js",
    output: [
      {
        file: "./dist/bundle.cjs",
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [typescript()],
  },
  {
    // The command line tool, which is what the "dumlpacket" bin runs. yargs is an optional dependency, so it is
    // left to be resolved when the tool runs rather than bundled
    input: "./dist/cli.js",
    external: [/^yargs/],
    output: [
      {
        file: "./dist/cli.bundle.js",
        format: "esm",
        sourcemap: true,
        banner: "#!/usr/bin/env node",
      },
    ],
    plugins: [typescript()],
  },
  {
    input: "./dist/types.d.ts",
    output: {
      file: "./dist/index.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
];

export default bundle;
