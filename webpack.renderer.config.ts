import path from 'path';
import type { Configuration } from 'webpack';
import 'webpack-dev-server';
import webpack from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';

const config: Configuration = {
  entry: './src/renderer/index.tsx',
  target: 'web',
  plugins: [
    new webpack.DefinePlugin({
      'global': 'window',
    }),
    // 复制 HTML 入口文件到 dist/renderer
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src', 'renderer', 'index.html'),
          to: path.resolve(__dirname, 'dist', 'renderer', 'index.html'),
        },
        {
          from: path.resolve(__dirname, 'src', 'renderer', 'quick-input.html'),
          to: path.resolve(__dirname, 'dist', 'renderer', 'quick-input.html'),
        },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/, /src\/main/],
        use: 'ts-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      'events': require.resolve('events'),
      'stream': require.resolve('stream-browserify'),
      'util': require.resolve('util'),
      'buffer': require.resolve('buffer'),
    },
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist', 'renderer'),
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'src', 'renderer'),
    },
    hot: true,
    compress: true,
    port: 3000,
    historyApiFallback: true,
  },
};

export default config;