import type { UserConfigExport } from '@tarojs/cli'
import path from 'path'

export default {
  projectName: 'yujian-mp',
  date: '2026-7-7',
  designWidth: 375,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-react'],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  compile: {
    include: [
      path.resolve(__dirname, '../src'),
      path.resolve(__dirname, '../../packages/contracts/src'),
    ],
  },
  cache: {
    enable: false
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      }
    },
    webpackChain(chain) {
      const contractsRoot = path.resolve(__dirname, '../../packages/contracts/src')
      chain.resolve.alias
        .set('@', path.resolve(__dirname, '../src'))
        .set('@yujian/contracts', contractsRoot)
      chain.module.rule('script').include.add(contractsRoot)
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static'
  }
} satisfies UserConfigExport<'webpack5'>
