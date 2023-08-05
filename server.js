const path = require('path')
const multer = require('multer')
const express = require('express')
const { EventEmitter } = require('events')

const s3 = require('./s3')

const PORT = process.env.PORT || 3000
const SOUNDBOARD_S3_PREFIX = 'misc/soundboard/'

const upload = multer({ storage: multer.memoryStorage() })
const emitter = new EventEmitter()
const app = express()

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/send', handleSend)
app.get('/receive', handleReceive)
app.post('/play', handlePlay)
app.get('/listen', handleListen)
app.post('/upload', upload.single('file'), handleUpload)

function handlePlay (req, res) {
  const sound = req.body.sound
  console.log('play', sound)
  if (!sound) return res.status(400).send('Missing sound query parameter')

  emitter.emit('play', sound)
}

function handleListen (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive'
  })

  const onPlay = sound => res.write(`data: ${JSON.stringify(sound)}\n\n`)
  emitter.on('play', onPlay)

  res.on('close', function () {
    emitter.off('play', onPlay)
  })
}

function handleSend (req, res) {
  handleRequest('send.html.ejs', req, res)
}

function handleReceive (req, res) {
  handleRequest('receive.html.ejs', req, res)
}

function handleRequest (viewName, req, res) {
  s3.list('misc/soundboard', (err, files) => {
    if (err) return res.status(500).send(err)

    const sounds = files
      .filter(file => file.Key.endsWith('.mp3'))
      .map(file => {
        return {
          name: file.Key.replace(SOUNDBOARD_S3_PREFIX, '').replace('.mp3', ''),
          url: file.url
        }
      })

    const nSounds = sounds.length
    const columns = 4
    const rows = Math.ceil(nSounds / columns)

    res.render(viewName, { sounds, columns, rows })
  })
}

function handleUpload (req, res) {
  if (!req.file) {
    return res.status(400).send('No file uploaded')
  }

  console.log(req.file)

  const key = SOUNDBOARD_S3_PREFIX + req.file.originalname
  console.log('Uploading file to S3:', key)

  s3.put(req.file, key, err => {
    if (err) {
      console.log('Error uploading file:', err)
      return res.status(500).send(err)
    }

    res.redirect('/send')
  })
}

app.listen(PORT, () => {
  console.log('App is listening on port ' + PORT)
})
