// Require the necessary discord.js classes
const {
  createAudioResource,
  joinVoiceChannel,
  VoiceConnectionStatus,
  createAudioPlayer
} = require('@discordjs/voice')
const { Client, Events, GatewayIntentBits } = require('discord.js')
const hyperquest = require('hyperquest')
const { EventEmitter } = require('events')

const emitter = new EventEmitter()

const config = require('./config').discord

module.exports = play

function play (url) {
  emitter.emit('play', url)
}

// Create a new client instance
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
})

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, onReady)

// Log in to Discord with your client's token
client.login(config.token)

function onReady (c) {
  console.log(`Ready! Logged in as ${c.user.tag}`)
  const channel = client.channels.cache.get(config.channel)

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  })

  const audioPlayer = createAudioPlayer()
  const subscription = connection.subscribe(audioPlayer)
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log('Voice connection ready')
    // const resource = createAudioResource(
    //   hyperquest(
    //     'https://dmg-share.s3.wasabisys.com/misc/soundboard/i%27m-the-party-pooper.mp3'
    //   )
    // )
    // audioPlayer.play(resource)

    emitter.on('play', url => {
      const resource = createAudioResource(hyperquest(url))
      audioPlayer.play(resource)
    })
  })
}
