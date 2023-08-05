require('dotenv').config()

module.exports = {
  s3: {
    key: process.env.S3_KEY,
    secret: process.env.S3_SECRET,
    bucket: process.env.S3_BUCKET,
    endpoint: process.env.S3_ENDPOINT
  },
  redis: {
    url: process.env.REDIS_URL
  }
}
