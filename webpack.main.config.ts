import path from 'path';
import type { Configuration } from 'webpack';
import { builtinModules } from 'module';

// 主进程 + preload 两个 entry 一起打包到 dist/main/
const config: Configuration = {
  entry: {
    index: './src/main/index.ts',
    preload: './src/main/preload.ts',
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.main.json',
            transpileOnly: true,
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist', 'main'),
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  // electron-builder 会自动处理 node_modules 外部化
  externals: {
    'electron': 'commonjs electron',
    // 将这些库作为外部依赖，不打包进 bundle
    // 应用运行时直接从 node_modules 加载
    'sql.js': 'commonjs sql.js',
    'buffer': 'commonjs buffer',
    'events': 'commonjs events',
    'util': 'commonjs util',
    'stream-browserify': 'commonjs stream-browserify',
  },
};

export default config;
