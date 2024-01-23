import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const bundle = [
  {
    input: './dist/packet.js',
    output: [
      {
        file: './dist/bundle.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [typescript()],
  },
  {
    input: './dist/packet.js',
    output: [
      {
        file: './dist/bundle.cjs',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [typescript()],
  },
  {
    input: './dist/types.d.ts',
    output: {
      file: './dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];

export default bundle;
