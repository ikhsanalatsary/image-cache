var base64Img = require('base64-img')
var async = require('async')
var path = require('path')
var pako = require('pako')
var md5 = require('md5')
var fs = require('fs')

/**
 * image-cache - Image Cache Async with Base64
 * @author Ryan Aunur Rassyid <Indonesia><ryandevstudio@gmail.com>
 */

var ImageCache = function () {
  this.options = {
    dir: path.join(__dirname, 'cache/'),
    compressed: false,
    extname: '.cache',
    googleCache: true
  }
}

/**
 * @description
 * setOptions
 * @param {object} [required]
 * @example
 * setOptions({compressed: false});
 */
ImageCache.prototype.setOptions = function (options) {
  var self = this

  for (var option in options) {
    if (typeof self.options[option] === 'undefined') {
      throw Error("option '" + option + "' is not available")
    }

    self.options[option] = options[option]
  }
}

/**
 * @description
 * isCached
 * @param {string} [required]
 * @param {function} [callback]
 * @example
 * isCached('http://foo.bar/foo.png', function(exist) { });
 * @return {boolean}
 */
ImageCache.prototype.isCached = function (image, callback) {
  var self = this

  /*
   *'fs.exists' was deprecated since v4.
   * Use 'fs.stat()' or 'fs.access()'
   */
  fs.exists(Core.getFilePath(image, self.options), function (exists) {
    callback(exists)
  })
}
ImageCache.prototype.isCachedSync = function (image) {
  var self = this

  return fs.existsSync(Core.getFilePath(image, self.options))
}

/**
 * @description
 * getCache
 * @param {string} [required]
 * @param {function} [callback]
 * @example
 * getCache('http://foo.bar/foo.png', function(error, results) { });
 * @return undefined
 */
ImageCache.prototype.getCache = function (image, callback) {
  var self = this

  Core.readFile(image, self.options, (error, results) => {
    if (!error) {
      var output = Core.inflate(results, self.options)

      callback(null, output)
    } else {
      callback(error)
    }
  })
}
ImageCache.prototype.Get = function (image) {
  var self = this

  return new Promise((resolve, reject) => {
    Core.readFile(image, self.options, (error, results) => {
      if (!error) {
        var output = Core.inflate(results, self.options)

        resolve(output)
      } else {
        reject(error)
      }
    })
  })
}
ImageCache.prototype.getCacheSync = function (image) {
  var self = this

  return JSON.parse(Core.readFileSync(image, self.options))
}

/**
 * @description
 * setCache
 * @param {array|string} [required]
 * @param {function} [callback]
 * @example
 * setCache(['http://foo.bar/foo.png'], function(error) { });
 * @return {boolean}
 */
ImageCache.prototype.setCache = function (images, callback) {
  var self = this

  images = Core.check(images, self.options)

  Core.getImages(images, self.options, (error, results) => {
    if (error) {
      callback(error)
    } else {
      results.forEach(result => {
        if (!result.error) {
          let output = Core.deflate(result, self.options)

          Core.writeFile(
            {
              fileName: result.hashFile,
              data: output,
              options: self.options
            },
            error => {
              callback(error)
            }
          )
        } else {
          console.log(result)
        }
      })
    }
  })
}
ImageCache.prototype.Set = function (images) {
  var self = this

  return new Promise((resolve, reject) => {
    images = Core.check(images, self.options)

    Core.getImages(images, self.options, (error, results) => {
      if (error) {
        reject(error.message)
      } else {
        results.forEach(result => {
          if (!result.error) {
            let output = Core.deflate(result, self.options)

            Core.writeFile(
              {
                fileName: result.hashFile,
                data: output,
                options: self.options
              },
              error => {
                if (error) {
                  reject(
                    new Error('Error while write files ' + result.hashFile)
                  )
                }
              }
            )
          } else {
            console.log(result)
          }
        })
      }
    })
  })
}

ImageCache.prototype.fetchImages = function (images) {
  var self = this

  return new Promise((resolve, reject) => {
    images = Core.check(images, self.options)

    var imagesMore = []
    images.forEach(function (image) {
      var fileName = self.options.compressed ? md5(image) + '_min' : md5(image)
      var exists = fs.existsSync(
        self.options.dir + fileName + self.options.extname
      )
      var url = image

      imagesMore.push({
        fileName: image,
        exists: exists,
        url: url,
        options: self.options
      })
    })

    async.map(imagesMore, Core.fetchImageFunc, (error, results) => {
      if (error) {
        reject(error)
      } else {
        if (results.length === 1 && Array.isArray(results)) {
          results = results[0]
        }

        resolve(results)
      }
    })
  })
}

/**
 * @description
 * delCache
 * @param {string|array} [images url]
 * @example
 * .delCache(images).then((error) => {});
 * @return Promise
 */
ImageCache.prototype.delCache = function (images) {
  var self = this

  return new Promise((resolve, reject) => {
    images = Core.check(images, self.options)

    images.forEach(image => {
      fs.unlinkSync(Core.getFilePath(image, self.options))
    })

    resolve(null)
  })
}

/**
 * @description
 * flushCache (delete all cache)
 * @param {function} [callback]
 * @example
 * flushCache(function(error) { });
 * @return undefined
 */
ImageCache.prototype.flushCache = function (callback) {
  var self = this

  fs.readdir(self.options.dir, (error, files) => {
    if (error) {
      return callback(error)
    }
    var targetFiles = []

    if (files.length === 0) {
      callback(new Error('this folder is empty'))
    } else {
      files.forEach(file => {
        if (path.extname(file) === self.options.extname) {
          targetFiles.push(self.options.dir + '/' + file)
        }
      })

      var unlinkCache = function (callback) {
        fs.unlinkSync(path)

        callback(null, 'deleted')
      }

      async.map(targetFiles, unlinkCache, function (error, results) {
        if (error) {
          callback(error)
        } else {
          // callback when no error
          callback(null, {
            deleted: targetFiles.length,
            totalFiles: files.length,
            dir: self.options.dir
          })
        }
      })
    }
  })
}
ImageCache.prototype.flushCacheSync = function () {
  var self = this

  var files = fs.readdirSync(self.options.dir)
  var deletedFiles = 0

  if (files.length === 0) {
    return { error: true, message: 'this folder is empty' }
  } else {
    files.forEach(function (file) {
      if (path.extname(file) === self.options.extname) {
        try {
          fs.unlinkSync(path.join(self.options.dir, file))
        } catch (e) {
          return { error: true, message: e }
        } finally {
          deletedFiles++
        }
      }
    })

    return {
      error: false,
      deleted: deletedFiles,
      totalFiles: files.length,
      dir: self.options.dir
    }
  }
}

var Core = {
  check: function (images, options) {
    /* Check params images to actualiy be Array data type */
    if (!Array.isArray(images)) {
      let temp = images
      images = [temp]
    }
    /* Check is cache directory available */
    if (!Core.isDirExists(options)) {
      fs.mkdirSync(options.dir)
    }

    return images
  },
  isDirExists: function (options) {
    return fs.existsSync(options.dir)
  },
  getFilePath: function (image, options) {
    var fileName = options.compressed ? md5(image) + '_min' : md5(image)

    return options.dir + fileName + options.extname
  },
  getImages: function (images, options, callback) {
    var fetch = function (url, cb) {
      var untouchUrl = url
      if (options.googleCache) {
        url = Core.getGoogleUrl(url)
      }

      base64Img.requestBase64(url, function (error, res, body) {
        if (error) {
          cb(error)
        } else {
          if (res.statusCode.toString() === '200') {
            cb(null, {
              error: false,
              url: untouchUrl,
              timestamp: new Date().getTime(),
              hashFile: md5(untouchUrl),
              compressed: options.compressed,
              data: body
            })
          } else {
            cb(null, {
              error: true,
              url: untouchUrl,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage
            })
          }
        }
      })
    }
    async.map(images, fetch, function (error, results) {
      if (error) {
        console.error(error)
      } else {
        callback(null, results)
      }
    })
  },
  getGoogleUrl: function (url) {
    return (
      'https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy' +
      '?container=focus' +
      '&url=' +
      url
    )
  },
  isFolderExists: function (options) {
    return fs.existsSync(options.dir)
  },
  backToString: function (content) {
    if (Buffer.isBuffer(content)) content = content.toString('utf8')
    content = content.replace(/^\uFEFF/, '')

    return content
  },
  setSize: function (path, image) {
    var type = typeof image
    return new Promise((resolve, reject) => {
      fs.stat(path, (error, stats) => {
        if (error) {
          reject(error)
        }
        if (stats.isFile()) {
          if (type === 'string') {
            image = JSON.parse(image)
          }
          image.size = Core.util.toSize(stats['size'], true)
          if (type === 'string') {
            image = JSON.stringify(image)
          }

          resolve(image)
        } else {
          reject(new Error(path.basename(path) + ' is not a file'))
        }
      })
    })
  },
  readFileFetch: function (params, callback) {
    fs.readFile(params.path, (err, cachedImage) => {
      if (!err) {
        cachedImage = Core.inflate(
          Core.backToString(cachedImage, params.options),
          params.options
        )
        // Hit Cache
        cachedImage.cache = 'HIT'

        Core.setSize(params.path, cachedImage)
          .then(result => {
            callback(null, result)
          })
          .catch(error => {
            callback(error)
          })
      } else {
        callback(err)
      }
    })
  },
  writeFileFetch: function (params, callback) {
    Core.writeFile(
      {
        options: params.options,
        data: params.data,
        fileName: params.source.hashFile
      },
      error => {
        if (error) {
          callback(error)
        } else {
          // miss cache
          params.source.cache = 'MISS'
          callback(null, params.source)
        }
      }
    )
  },
  deflate: function (data, options) {
    var result = JSON.stringify(data)
    if (options.compressed) {
      result = pako.deflate(JSON.stringify(data), { to: 'string' })
    }

    return result
  },
  inflate: function (cachedImage, options) {
    if (options.compressed) {
      cachedImage = pako.inflate(cachedImage, { to: 'string' })
    }

    return JSON.parse(cachedImage)
  },
  readFile: function (image, options, callback) {
    var path = Core.getFilePath(image, options)
    fs.readFile(path, (error, results) => {
      if (error) {
        callback(error)
      } else {
        results = Core.backToString(results)

        Core.setSize(path, results)
          .then(result => {
            callback(null, result)
          })
          .catch(error => {
            callback(error)
          })
      }
    })
  },
  readFileSync: function (image, options) {
    var path = Core.getFilePath(image, options)
    var results = Core.backToString(fs.readFileSync(path))

    var stats = fs.statSync(path)
    if (stats.isFile()) {
      results = JSON.parse(results)

      results.size = Core.util.toSize(stats['size'], true)
      results = JSON.stringify(results)

      return results
    } else {
      throw Error('is not a files')
    }
  },
  writeFile: function (params, callback) {
    fs.writeFile(
      path.join(params.options.dir, params.fileName + params.options.extname),
      params.data,
      error => {
        callback(error)
      }
    )
  },
  fetchImageFunc: function (image, callback) {
    var self = this
    self.options = image.options

    if (image.exists) {
      Core.readFileFetch(
        {
          path: Core.getFilePath(image.fileName, self.options),
          options: self.options
        },
        (error, result) => {
          if (error) {
            callback(error)
          } else {
            callback(null, result)
          }
        }
      )
    } else {
      Core.getImages([image.url], self.options, function (error, results) {
        if (error) {
          callback(error)
        } else {
          results.forEach(result => {
            if (!result.error) {
              Core.writeFileFetch(
                {
                  source: result,
                  data: Core.deflate(result, self.options),
                  options: self.options
                },
                error => {
                  if (error) {
                    callback(error)
                  } else {
                    callback(null, result)
                  }
                }
              )
            }
          })
        }
      })
    }
  },
  util: {
    toSize: function (size, read) {
      var thresh = read ? 1000 : 1024
      if (Math.abs(size) < thresh) {
        return size + ' B'
      }
      var units = read
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
      var u = -1
      do {
        size /= thresh
        ++u
      } while (Math.abs(size) >= thresh && u < units.length - 1)

      return size.toFixed(1) + ' ' + units[u]
    }
  }
}

module.exports = new ImageCache()
