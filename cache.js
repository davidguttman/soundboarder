const redis = require('./redis')

module.exports = function redisCache (load) {
  // console.log('Entering redisCache function')
  const inProgress = {}

  return function get (key, cb) {
    // console.log('Entering get function with key:', key)
    redis.get(key, (err, result) => {
      // console.log('Inside redis.get callback')
      if (err) {
        // console.log('Error in redis.get:', err)
        return cb(err)
      }
      if (result) {
        // console.log('Result from redis.get:', result)
        return cb(null, JSON.parse(result))
      }

      if (inProgress[key]) {
        // console.log('Key is in progress:', key)
        return inProgress[key].push(cb)
      }

      // console.log('Key is not in progress, adding to inProgress:', key)
      inProgress[key] = [cb]

      load(key, (err, value) => {
        // console.log('Inside load callback')
        if (err) {
          // console.log('Error in load:', err)
          inProgress[key].forEach(cb => cb(err))
        } else {
          // console.log('No error in load, setting redis key:', key)
          redis.set(key, JSON.stringify(value), err => {
            if (err) {
              // console.log('Error in redis.set:', err)
              inProgress[key].forEach(cb => cb(err))
            } else {
              // console.log('No error in redis.set, key:', key)
              // console.log('Current inProgress:', inProgress)
              inProgress[key].forEach(cb => cb(null, value))
            }
            // console.log('Deleting key from inProgress:', key)
            delete inProgress[key]
          })
        }
      })
    })
  }
}
