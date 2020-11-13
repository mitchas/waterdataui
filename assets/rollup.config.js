/**
 * Rollup configuration.
 * NOTE: This is a CommonJS module so it can be imported by Karma.
 */

const path = require('path');

const alias = require('@rollup/plugin-alias');
const buble = require('@rollup/plugin-buble');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const resolve = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');
const {terser} = require('rollup-plugin-terser');


const env = process.env.NODE_ENV || 'development';

const getBundleConfig = function(src, dest) {
    const entries = [
        {find: 'ui', replacement: path.resolve(__dirname, 'src/scripts/')},
        {find: 'ml', replacement: path.resolve(__dirname, 'src/scripts/monitoring-location')},
        {find:'d3render', replacement: path.resolve(__dirname, 'src/scripts/d3-rendering')},
        {find: 'map', replacement: path.resolve(__dirname, 'src/scripts/monitoring-location/components/map')},
        {find: 'dvhydrograph', replacement: path.resolve(__dirname, 'src/scripts/monitoring-location/components/daily-value-hydrograph')},
        {find: 'ivhydrograph', replacement: path.resolve(__dirname, 'src/scripts/monitoring-location/components/hydrograph')},
        {find: 'network', replacement: path.resolve(__dirname, 'src/scripts/network')}
    ];

    return {
        input: src,
        plugins: [
            alias({
                entries,
                customResolver: resolve.nodeResolve({
                    extensions: ['.js', '.json']
                })
            }),
            resolve.nodeResolve({
                mainFields: ['module', 'jsnext', 'main']
            }),
            json(),
            commonjs({
                exclude: [
                    'node_modules/symbol-observable/es/index.js'
                ]
            }),
            buble({
                objectAssign: 'Object.assign',
                transforms: {
                    forOf: false,
                    generator: false
                }
            }),
            replace({
                'process.env.NODE_ENV': JSON.stringify(env)
            }),
            env === 'production' && terser({
                compress: {
                    drop_console: true
                }
            })
        ],
        watch: {
            chokidar: false
        },
        output: {
            name: 'wdfn',
            file:  dest,
            format: 'iife',
            sourcemap: env !== 'production'
        },
        treeshake: env === 'production'
    };
};

module.exports = [
    getBundleConfig('src/scripts/monitoring-location/index.js', 'dist/bundle.js'),
    getBundleConfig('src/scripts/network/index.js', 'dist/network-bundle.js')
];


