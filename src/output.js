import * as util from "./util.js"

export class Output {
  constructor(canvas) {
    this.screen_ctx = canvas.getContext('2d');
    this.img = this.screen_ctx.createImageData(256, 240);
    
    this.sound_ctx = new AudioContext();
    this.data = 0;
    this.play = 0;
    this.buf = new Uint16Array(0x1000);

    this.hpf1 = this.sound_ctx.createBiquadFilter();
    this.hpf1.type = "highpass";
    this.hpf1.frequency.value = 90;

    this.hpf2 = this.sound_ctx.createBiquadFilter();
    this.hpf2.type = "highpass";
    this.hpf2.frequency.value = 440;

    this.lpf = this.sound_ctx.createBiquadFilter();
    this.lpf.type = "lowpass";
    this.lpf.frequency.value = 14000;

    this.nes = null;
    console.log("constructor Output", this);
  }

  rendering(screen) {
    for(var i=0; i<screen.pixels.length; i++)
      this.img.data[i] = screen.pixels[i];
    this.screen_ctx.putImageData(this.img, 0, 0);
  }

  gen_sound(sound) {
    var audio_buf = this.sound_ctx.createBuffer(1, sound.sample, sound.freq);
    var buffering = audio_buf.getChannelData(0);
    for(var i=0; i<sound.sample; i++) {
      //buffering[i] = util.to_u16(sound.buf[i]) / 65536;
      buffering[i] = sound.buf[i] / 65536;
      //buffering[i] = (sound.buf[i] + 16000) / 65536;
    }

    var sound_src = this.sound_ctx.createBufferSource();
    sound_src.buffer = audio_buf;
    sound_src.connect(this.sound_ctx.destination);
    /*
    sound_src.connect(this.hpf1);
    this.hpf1.connect(this.hpf2);
    this.hpf2.connect(this.lpf);
    this.lpf.connect(this.sound_ctx.destination);
    */
    sound_src.start();

    /*
    var str = "buffering:";
    for(var i=0; i<sound.sample; i++)
      str += buffering[i] + ",";
    util.log(this.nes, str);
    */
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
  constructor(output) {
    this.buf = new Int16Array(4096);
    this.freq = 44100;
    this.bps = 16;
    this.ch = 1;
    /*
    var sample = (output.data + 4096 - output.play) % 4096;
    this.sample = sample == 0? 4096:sample;
    */
    this.sample = 1024;
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

