export class Output {
  constructor(canvas) {
    this.bef_width = 0;
    this.bef_height = 0;
    this.skip = false;

    this.screen_ctx = canvas.getContext('2d');
    this.img = this.screen_ctx.createImageData(256, 240);
    
    this.sound_ctx = new AudioContext();
    this.dat = 0;
    this.play = 0;

    console.log("constructor Render", this);
  }

  rendering(screen) {
    for(var i=0; i<screen.pixels.length; i++)
      this.img.data[i] = screen.pixels[i];
    this.screen_ctx.putImageData(this.img, 0, 0);
  }

  generate_sound(sound) {
    for(var i=0; i<sound.sample; i++)
      this.buf[(this.dat+i)%4096] = sound.buf[i];
    this.dat = (this.dat + sound.sample) % 4096;

    var src = this.sound_ctx.createBufferSource();

    var audio_buf = this.sound_ctx.createBuffer(sound.ch, sound.sample, sound.freq);
    var data = audio_buf.getChannelData(sound.ch - 1);
    for(i = 0; i<sound.sample; i++)
      data[i] = this.buf[i];
    src.buffer = audio_buf;

    var audio_gain = this.sound_ctx.createGain();
    src.connect(audio_gain);
    audio_gain.connect(this.sound_ctx.destination);
    audio_gain.gain.value = 0.1;

    src.start();
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
  constructor(dat, play) {
    this.buf = new Int16Array(4096);
    this.freq = 44100;
    this.bps = 16;
    this.ch = 1;
    var sample = (dat + 4096 - play) % 4096;
    this.sample = sample == 0? 4096:sample;
  }
}

export class Joypad {
  constructor(keys) {
    this.key_status = {};
    this.key_count = 8;
    this.key_define = keys;
    this.data = new Array(this.key_count);
    this.index = 0;
    this.strobe = 0;

    for(var i=0; i<this.key_count; i++)
      this.key_status[keys[i]] = 0;
  }

  input() {
    for(var i=0; i<this.key_count; i++)
      this.data[i] = this.key_status[this.key_define[i]]? 1:0;
  }
}

