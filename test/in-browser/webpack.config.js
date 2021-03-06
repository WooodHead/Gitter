'use strict';

var path = require('path');
var ProgressBarPlugin = require('progress-bar-webpack-plugin');

var getPostcssStack = require('@gitterhq/styleguide/postcss-stack');

var opts = require('yargs')
  .option('nocoverage', {
    type: 'boolean',
    description: 'Age in minutes of the unread items'
  })
  .help('help')
  .alias('help', 'h')
  .argv;


var preLoaders = [];
if(!opts['nocoverage']) {
  preLoaders.push({
    test: /\.js$/,
    exclude: /(test|node_modules|repo)/,
    loader: 'istanbul-instrumenter',
  });
}

module.exports = {
  entry: path.resolve(__dirname, './fixtures/entry.js'),
  output: {
    path: path.join(__dirname, './fixtures/build'),
    filename: 'test.js',
    publicPath: '/fixtures/build/',
  },

  devtool: 'inline-source-map',
  module: {
    preLoaders: preLoaders,
    loaders: [
      {
        test: /\.js?$/,
        loader: 'babel',
        exclude: [ /node_modules/ ],
        query: {
          presets: [
            // https://github.com/babel/babel-loader/issues/149
            require.resolve("babel-preset-es2015")
          ]
        }
      },
      {
        test: /\.hbs$/,
        loader: '@gitterhq/handlebars-loader', // disable minify for now + path.resolve(path.join(__dirname, "../../build-scripts/html-min-loader"))
        query: {
          helperDirs: [
            path.dirname(require.resolve('gitter-web-templates/shared/helpers/pluralize'))
          ],
          knownHelpers: [
            'cdn',
            'avatarSrcSet'
          ],
          partialsRootRelative: path.resolve(__dirname, '../../public/templates/partials') + path.sep
        }
      },
      {
        test:    /.css$/,
        loader:  'style-loader!css-loader!postcss-loader',
      }
    ],
  },
  plugins: [
     new ProgressBarPlugin(),
  ],
  resolve: {
    modulesDirectories: [
      'node_modules',
      path.resolve(__dirname, '../../public/js'),
    ],
    alias: {
      jquery: require.resolve('jquery'),
      'bootstrap_tooltip': path.resolve(__dirname, '../../public/js/utils/tooltip.js'),
      'public': path.resolve(__dirname, '../../public'),
      'fixtures': path.resolve(__dirname, './fixtures'),
      'views/menu/room/search-results/search-results-view': path.resolve(__dirname, './fixtures/helpers/search-results-view.js'),
      'views/menu/room/search-input/search-input-view': path.resolve(__dirname, './fixtures/helpers/search-input-view.js'),
      'components/api-client': path.resolve(__dirname, './fixtures/helpers/apiclient.js'),
      'utils/appevents': path.resolve(__dirname, './fixtures/helpers/appevents.js'),
      'filtered-collection': path.resolve(__dirname, '../../public/repo/filtered-collection/filtered-collection.js'),
      'gitter-client-env': path.resolve(__dirname, './fixtures/helpers/gitter-client-env.js'),
    },
  },
  postcss: function(webpack) {
    return getPostcssStack(webpack);
  },
  node: {
    fs: 'empty',
  },
};
