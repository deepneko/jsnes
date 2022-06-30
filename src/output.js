import * as util from "./util.js"

export class Output {
  constructor() {
    this.nes = null;

    this.screenContext = document.getElementById('console').getContext('2d');
    this.img = this.screenContext.createImageData(256, 240);

    this.soundContext = null;
    this.playing = 0;
    this.played = 0;
    this.BUF_SIZE = 2048;
    this.RBUF_SIZE = 4096;
    this.buf = new Float32Array(this.RBUF_SIZE);

    console.log("constructor Output", this);
  }

  writeScreen(screen) {
    for(var i=0; i<screen.pixels.length; i++)
      this.img.data[i] = screen.pixels[i];
    this.screenContext.putImageData(this.img, 0, 0);
  }

  newSound() {
    if(this.playing == this.played)
      return null;

    var sound = new Sound();
    sound.sample = (this.RBUF_SIZE + this.playing - this.played) % this.RBUF_SIZE;
    sound.buf = new Float32Array(sound.sample);
    return sound;
  }

  soundStart() {
    this.soundContext = new AudioContext();
    this.scriptNode = this.soundContext.createScriptProcessor(this.BUF_SIZE, 0, 1);
    this.scriptNode.onaudioprocess = this.onaudioprocess;
    this.scriptNode.connect(this.soundContext.destination);
  }

  soundStop() {
    this.scriptNode.disconnect(this.soundContext.destination);
    this.scriptNode.onaudioprocess = null;
    this.scriptNode = null;
    this.soundContext.close();
    this.soundContext = null;
    this.playing = 0;
    this.played = 0;
  }

  writeSound(sound) {
    for(var i=0; i<sound.sample; i++)
      this.buf[(this.playing+i)%this.RBUF_SIZE] = sound.buf[i];
    this.playing = (this.playing + sound.sample) % this.RBUF_SIZE;
  }

  onaudioprocess = e => {
    var buffering = e.outputBuffer.getChannelData(0);
    var size = buffering.length;

    for(var i=0; i<size; i++) {
      buffering[i] = this.buf[(i+this.played)%this.RBUF_SIZE];
    }

    this.played = (this.played + size) % this.RBUF_SIZE;
  }
}

export class Screen {
  constructor(w, h) {
    this.pixels = new Array();
    this.width = w;
    this.height = h;
    this.pitch = 400;
    this.bpp = 32;
  }
}

export class Sound {
  constructor() {
    this.buf = null;
    this.freq = 44100;
    this.bps = 16;
    this.ch = 1;
    this.sample = 0;
  }
}

export class Joypad {
  constructor(keys) {
    this.keyStatus = {};
    this.keyCount = 8;
    this.keyDefine = keys;
    this.data = new Array(this.keyCount);
    this.index = 0;
    this.strobe = 0;

    for(var i=0; i<this.keyCount; i++)
      this.keyStatus[keys[i]] = 0;
  }

  input() {
    for(var i=0; i<this.keyCount; i++)
      this.data[i] = this.keyStatus[this.keyDefine[i]]? 1:0;
  }
}

