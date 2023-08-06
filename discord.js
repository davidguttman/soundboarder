// Require the necessary discord.js classes
const {
  createAudioResource,
  joinVoiceChannel,
  VoiceConnectionStatus,
  generateDependencyReport,
  createAudioPlayer
} = require('@discordjs/voice')
const { Client, Events, GatewayIntentBits } = require('discord.js')
const hyperquest = require('hyperquest')
const { EventEmitter } = require('events')

console.log(generateDependencyReport())

const emitter = new EventEmitter()

const config = require('./config').discord

module.exports = play

function play (url) {
  emitter.emit('play', url)
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
})

client.once(Events.ClientReady, onReady)

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
  connection.subscribe(audioPlayer)
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log('Voice connection ready')

    emitter.on('play', url => {
      const resource = createAudioResource(hyperquest(url))
      audioPlayer.play(resource)
    })
  })
}
