import terser from '@rollup/plugin-terser'

export default {
  input: './lib/esm/index.js',
  output: {
    name: 'workerpool',
    file: 'lib/umd/workerpool.js',
    format: 'umd',
    compact: true,
    sourcemap: true,
    plugins: [terser()]
  }
}
