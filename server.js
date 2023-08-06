require('isomorphic-fetch')
const path = require('path')
const multer = require('multer')
const express = require('express')
const cookieParser = require('cookie-parser')
const { EventEmitter } = require('events')

const s3 = require('./s3')
const config = require('./config')
const discord = require('./discord')

const PORT = process.env.PORT || 3000
const SOUNDBOARD_S3_PREFIX = 'misc/soundboard/'

const upload = multer({ storage: multer.memoryStorage() })
const emitter = new EventEmitter()
const app = express()

emitter.on('play', discord)

app.set('view engine', 'ejs')
app.use(cookieParser())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/send', protect, handleSend)
app.post('/play', protect, handlePlay)
app.post('/upload', protect, upload.single('file'), handleUpload)
// app.get('/receive', handleReceive)
// app.get('/listen', handleListen)

function handlePlay (req, res) {
  const sound = req.body.sound
  console.log('play', sound)
  if (!sound) return res.status(400).send('Missing sound query parameter')

  emitter.emit('play', sound)
  res.status(201).end()
}

function handleSend (req, res) {
  const directory = SOUNDBOARD_S3_PREFIX + req.user.id + '/'
  s3.list(directory, (err, files) => {
    if (err) return res.status(500).send(err)

    console.log(files)

    const sounds = files
      .filter(file => file.Key)
      .filter(file => file.Key.endsWith('.mp3'))
      .map(file => {
        return {
          name: file.Key.replace(directory, '').replace('.mp3', ''),
          url: file.url
        }
      })

    res.render('send.html.ejs', { sounds })
  })
}

function handleUpload (req, res) {
  if (!req.file) {
    return res.status(400).send('No file uploaded')
  }

  const directory = SOUNDBOARD_S3_PREFIX + req.user.id + '/'

  console.log(req.file)

  const key = directory + req.file.originalname
  console.log('Uploading file to S3:', key)

  s3.put(req.file, key, err => {
    if (err) {
      console.log('Error uploading file:', err)
      return res.status(500).send(err)
    }

    res.redirect('/send')
  })
}

async function protect (req, res, next) {
  const accessToken = req.query.accessToken || req.cookies.accessToken
  const tokenType = req.query.tokenType || req.cookies.tokenType

  if (!accessToken || !tokenType) {
    return res.redirect(
      `/?message=${encodeURIComponent('Missing access token')}`
    )
  }

  const { user, guilds } = await getUserInfo(accessToken, tokenType)
  console.log(user)

  if (!user || !guilds) {
    return res.redirect(
      `/?message=${encodeURIComponent('Invalid access token')}`
    )
  }

  const targetGuild = guilds.find(guild => guild.id === config.discord.guild)
  console.log(targetGuild)

  if (!targetGuild) {
    return res.redirect(
      `/?message=${encodeURIComponent('Unauthorized')}`
    )
  }

  res.cookie('accessToken', accessToken, { maxAge: 1000 * 60 * 60 * 24 * 7 })
  res.cookie('tokenType', tokenType, { maxAge: 1000 * 60 * 60 * 24 * 7 })

  req.user = user

  next()
}

app.listen(PORT, () => {
  console.log('App is listening on port ' + PORT)
})

async function getUserInfo (accessToken, tokenType) {
  const urlUser = 'https://discord.com/api/users/@me'
  const urlGuilds = 'https://discord.com/api/users/@me/guilds'

  const opts = {
    headers: {
      authorization: `${tokenType} ${accessToken}`
    }
  }

  const [user, guilds] = await Promise.all([
    fetch(urlUser, opts).then(result => result.json()),
    fetch(urlGuilds, opts).then(result => result.json())
  ])

  if (!user.id) return {}

  return { user, guilds }
}
