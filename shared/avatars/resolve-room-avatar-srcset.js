'use strict';

var BASE_URL = "https://avatars1.githubusercontent.com/";
var DEFAULT_URL = BASE_URL + "u/0";

// make sure to pass the size for non-retina screens
module.exports = function (url, size) {
  if (!size) size = 48;
  if (!url) {
    /* Best we can do */
    return {
      src: DEFAULT_URL,
      size: size
    };
  }


  var leadingSlash = url[0] === '/';
  var base = url.split('/')[leadingSlash ? 1 : 0];
  if (!base) {
    return {
      src: DEFAULT_URL,
      size: size
    };
  }

  return {
    src: BASE_URL + base + '?s=' + size,
    srcset: BASE_URL + base + '?s=' + (size * 2) + ' 2x',
    size: size
  };
};
