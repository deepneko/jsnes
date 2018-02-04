import * as util from './util.js'

export class APU {
  constructor(nes) {
    this.nes = nes;

    this.pulse1 = new Pulse();
    this.pulse2 = new Pulse();
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.dmc = new DMC();

    this.CH_TYPE = { SQ1:0, SQ2:1, TRI:2, NOI:3, DMC:4 };
    this.ch = new Array(4);
    this.ch[this.CH_TYPE.SQ1] = this.pulse1;
    this.ch[this.CH_TYPE.SQ2] = this.pulse2;
    this.ch[this.CH_TYPE.TRI] = this.triangle;
    this.ch[this.CH_TYPE.NOI] = this.noise;

    this.write_queue = new util.Queue();
    this.bef_clock = 0;
    this.bef_sync = 0;

    this.conv_table = new Int32Array([
        0x002, 0x004, 0x008, 0x010,
        0x020, 0x030, 0x040, 0x050,
        0x065, 0x07F, 0x0BE, 0x0FE,
        0x17D, 0x1FC, 0x3F9, 0x7F2,
      ]);

    this.length_table = new Int32Array([
        0x05, 0x06, 0x0A, 0x0C,
        0x14, 0x18, 0x28, 0x30,
        0x50, 0x60, 0x1E, 0x24,
        0x07, 0x08, 0x0E, 0x10,
      ]);

    this.dac_table = new Int32Array([
        0xD60, 0xBE0, 0xAA0, 0xA00,
        0x8F0, 0x7F0, 0x710, 0x6B0,
        0x5F0, 0x500, 0x470, 0x400,
        0x350, 0x2A0, 0x240, 0x1B0,
      ]);

    this.frame_period = 0;
    this.frame_irq = 0xff;
  }

  reset() {
    this.noise.shift_register = 1;

    this.bef_clock = 0;
    this.bef_sync = 0;
  }

  sync() {
    var cpu_clock = this.nes.cpu.frequency;
    var cur = this.nes.cpu.master_clock();
    var adv_clock = util.to_s32(cur) - this.bef_sync;

    for(var i=0; i<4; i++) {
      var ch = this.ch[i];
      if(ch.enable && ch.length_enable) {
        var length_clk = cpu_clock / 60.0;
        ch.length_clk += adv_clock;
        var dec = util.to_s32(ch.length_clk / length_clk);
        ch.length_clk -= length_clk * dec;
        ch.length = util.get_max(0, ch.length-dec);
      }
    }

    if(this.dmc.enable) {
      this.dmc.clk += adv_clock;
      var dec = util.to_s32(this.dmc.clk / this.dmc.wave_length);
      this.dmc.clk -= dec * this.dmc.wave_length;

      var rest = util.to_s32(this.dmc.shift_count + (this.dmc.length*8) - dec);
      if(rest <= 0) {
        if(this.dmc.playback_mode & 1) {
          this.dmc.length = rest / 8;
          while(this.dmc.length < 0)
            this.dmc.length += this.dmc.length_latch;
          this.dmc.shift_count = 0;
        } else {
          this.dmc.enable = false;
          if(this.dmc.playback_mode == 2) {
            this.dmc.irq = true;
            this.nes.reg.invoke_irq(true);
          }
        }
      } else {
        this.dmc.length = rest / 8;
        this.dmc.shift_count = rest % 8;
      }
    }

    this.bef_sync = cur;
  }

  read(addr) {
    if(addr == 0x4015) {
      this.sync();
      var ret = (this.pulse1.length == 0 ? 0:1) |
        ((this.pulse2.length == 0 ? 0:1) << 1) |
        ((this.triangle.length == 0 ? 0:1) << 2) |
        ((this.noise.length == 0 ? 0:1) << 3) |
        ((this.dmc.enable? 1:0) << 4) |
        ((this.dmc.irq? 1:0) << 7);
      return util.to_u8(ret);
    }

    return 0xA0;
  }

  write(addr, dat) {
    //util.log(this.nes, "apu write addr:" + util.to_hex(addr));

    var wd = new Write_dat(this.nes.cpu.master_clock(), addr, dat);
    this.write_queue.push(wd);
    this._write(this.ch, this.dmc, addr, dat);
  }

  _write(ch, dmc, addr, dat) {
    switch(addr) {
    /* Pulse 1 */
    case 0x4000:
      this.pulse1.envelope_enable = (dat&0x10) == 0;
      if(this.pulse1.envelope_enable) {
        this.pulse1.volume = 0xf;
        this.pulse1.envelope_rate = dat & 0xf;
      } else {
        this.pulse1.volume = dat & 0xf;
      }
      this.pulse1.length_enable = (dat&0x20) == 0;
      this.pulse1.duty = dat >> 6;
      this.pulse1.envelope_clk = 0;
      break;

    case 0x4001:
      this.pulse1.sweep_shift = dat & 7;
      this.pulse1.sweep_mode = (dat&0x8) != 0;
      this.pulse1.sweep_rate = (dat>>4) & 7;
      this.pulse1.sweep_enable = (dat&0x80) != 0;
      this.pulse1.sweep_clk = 0;
      this.pulse1.sweep_pausing = false;
      break;

    case 0x4002:
      this.pulse1.wave_length = (this.pulse1.wave_length&~0xff) | dat;
      break;

    case 0x4003:
      this.pulse1.wave_length = (this.pulse1.waev_length&0xff) | ((dat&0x7) << 8);

      if((dat&0x8) == 0)
        this.pulse1.length = this.length_table[dat>>4];
      else
        this.pulse1.length = (dat>>4) == 0? 0x7f:(dat>>4);

      if(this.pulse1.envelope_enable) {
        this.pulse1.volume = 0xf;
        this.pulse1.envelope_clk = 0;
      }
      break;

    /* Pulse 2 */
    case 0x4004:
      this.pulse2.envelope_enable = (dat&0x10) == 0;
      if(this.pulse2.envelope_enable) {
        this.pulse2.volume = 0xf;
        this.pulse2.envelope_rate = dat & 0xf;
      } else {
        this.pulse2.volume = dat & 0xf;
      }
      this.pulse2.length_enable = (dat&0x20) == 0;
      this.pulse2.duty = dat >> 6;
      this.pulse2.envelope_clk = 0;
      break;

    case 0x4005:
      this.pulse2.sweep_shift = dat & 7;
      this.pulse2.sweep_mode = (dat&0x8) != 0;
      this.pulse2.sweep_rate = (dat>>4) & 7;
      this.pulse2.sweep_enable = (dat&0x80) != 0;
      this.pulse2.sweep_clk = 0;
      this.pulse2.sweep_pausing = false;
      break;

    case 0x4006:
      this.pulse2.wave_length = (this.pulse2.wave_length&~0xff) | dat;
      break;

    case 0x4007:
      this.pulse2.wave_length = (this.pulse2.waev_length&0xff) | ((dat&0x7) << 8);

      if((dat&0x8) == 0)
        this.pulse2.length = this.length_table[dat>>4];
      else
        this.pulse2.length = (dat>>4) == 0? 0x7f:(dat>>4);

      if(this.pulse2.envelope_enable) {
        this.pulse2.volume = 0xf;
        this.pulse2.envelope_clk = 0;
      }
      break;

    /* Triangle */
    case 0x4008:
      this.triangle.linear_latch = dat & 0x7f;
      this.triangle.holdnote = (dat&0x80) != 0;
      break;

    case 0x4009:
      break;

    case 0x400A:
      this.triangle.wave_length = (this.triangle.wave_length&~0xff) | dat;
      break;

    case 0x400B:
      this.triangle.wave_length = (this.triangle.waev_length&0xff) | ((dat&0x7) << 8);

      if((dat&0x8) == 0)
        this.triangle.length = this.length_table[dat>>4];
      else
        this.triangle.length = (dat>>4) == 0? 0x7f:(dat>>4);

      this.triangle.counter_start = true;

      if(this.triangle.envelope_enable) {
        this.triangle.volume = 0xf;
        this.triangle.envelope_clk = 0;
      }
      break;

    /* Noise */
    case 0x400C:
      this.noise.envelope_enable = (dat&0x10) == 0;
      if(this.noise.envelope_enable) {
        this.noise.volume = 0xf;
        this.noise.envelope_rate = dat & 0xf;
      } else {
        this.noise.volume = dat & 0xf;
      }
      this.noise.length_enable = (dat&0x20) == 0;
      this.noise.duty = dat >> 6;
      this.noise.envelope_clk = 0;
      break;

    case 0x400D:
      break;

    case 0x400E:
      this.noise.wave_length = this.conv_table[dat&0xf] - 1;
      this.noise.random_type = (dat&0x80) != 0;
      break;

    case 0x400F:
      if((dat&0x8) == 0)
        this.noise.length = this.length_table[dat>>4];
      else
        this.noise.length = (dat>>4) == 0? 0x7f:(dat>>4);

      if(this.noise.envelope_enable) {
        this.noise.volume = 0xf;
        this.noise.envelope_clk = 0;
      }
      break;

    /* DMC */
    case 0x4010:
      dmc.playback_mode = dat >> 6;
      dmc.wave_length = util.to_u32(this.dac_table[dat&0xf] / 8);
      if((dat>>7) == 0)
        dmc.irq = false;
      break;

    case 0x4011:
      dmc.dac_lsb = dat & 1;
      dmc.counter = (dat>>1) & 0x3f;
      break;

    case 0x4012:
      dmc.addr_latch = (dat<<6) | 0xc000;
      break;

    case 0x4013:
      dmc.length_latch = (dat<<4) + 1;
      break;

    case 0x4015:
      this.pulse1.enable = (dat&1) != 0;
      if(!this.pulse1.enable)
        this.pulse1.length = 0;

      this.pulse2.enable = (dat&2) != 0;
      if(!this.pulse2.enable)
        this.pulse2.length = 0;

      this.triangle.enable = (dat&4) != 0;
      if(!this.triangle.enable)
        this.triangle.length = 0;

      this.noise.enable = (dat&8) != 0;
      if(!this.noise.enable)
        this.noise.length = 0;

      if(dat&0x10) {
        if(!dmc.enable) {
          dmc.addr = dmc.addr_latch;
          dmc.length = dmc.length_latch;
          dmc.shift_count = 0;
        }
        dmc.enable = true;
      } else {
        dmc.enable = false;
      }

      dmc.irq = false;
      break;
    }
  }

  gen_pulse(pulse, cpu_clock, inc_clk, sample_clk) {
    var pause = false;
    var vol = 16;

    if(!pulse.enable)
      return 0;
    if(pulse.length == 0)
      pause = true;

    if(pulse.length_enable) {
      var length_clk = cpu_clock / 60.0;
      pulse.length_clk += inc_clk;
      while(pulse.length_clk > length_clk) {
        pulse.length_clk -= length_clk;
        if(pulse.length>0)
          pulse.length--;
      }
    }

    if(pulse.envelope_enable) {
      var decay_clk = cpu_clock / (240.0 / (pulse.envelope_rate+1));
      pulse.envelope_clk += inc_clk;
      while(pulse.envelope_clk > decay_clk) {
        pulse.envelope_clk -= decay_clk;

        if(pulse.volume > 0) {
          pulse.volume--;
        } else if(!pulse.length_enable) {
          pulse.volume = 0xf;
        } else {
          pulse.volume = 0;
        }
      }
    }
    vol = pulse.volume;

    if(pulse.sweep_enable && !pulse.sweep_pausing) {
      var sweep_clk = cpu_clock / (120.0 / (pulse.sweep_rate+1));
      pulse.sweep_clk += inc_clk;
      while(pulse.sweep_clk > sweep_clk) {
        pulse.sweep_clk -= sweep_clk;
        if(pulse.sweep_shift && pulse.length) {
          if(!pulse.sweep_mode)
            pulse.wave_length += pulse.wave_length >> pulse.sweep_shift;
          else
            pulse.wave_length += ~(pulse.wave_length >> pulse.sweep_shift);

          if(pulse.wave_length < 0x008)
            pulse.sweep_pausing = true;
          if(pulse.wave_length & ~0x7FF)
            pulse.sweep_pausing = true;

          pulse.wave_length &= 0x7FF;
        }
      }
    }

    pause |= pulse.sweep_pausing;
    pause |= pulse.wave_length == 0;

    var t = 0;
    var v = 0;
    if(!pause) {
      t = this.pulse_produce(pulse, sample_clk);
      v = t * vol / 16;
    }

    return v;
  }

  pulse_produce(pulse, clk) {
    //util.log(this.nes, "pulse_produce");

    var sq_wav = [
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      ];

    pulse.step_clk += clk;
    var ret = 0.5-sq_wav[pulse.duty][pulse.step];
    var term = pulse.wave_length + 1;

    if(pulse.step_clk >= term) {
      var t = util.to_s32(pulse.step_clk / term);
      pulse.step_clk -= term * t;
      pulse.step = (pulse.step + t) % 16;
    }

    return ret;
  }

  gen_triangle(cpu_clock, inc_clk, sample_clk) {
    var pause = false;
    var vol = 16;

    if(!this.triangle.enable)
      return 0;
    if(this.triangle.length == 0)
      pause = true;

    if(this.triangle.length_enable) {
      var length_clk = cpu_clock / 60.0;
      this.triangle.length_clk += inc_clk;
      while(this.triangle.length_clk > length_clk) {
        this.triangle.length_clk -= length_clk;
        if(this.triangle.length>0)
          this.triangle.length--;
      }
    }

    if(this.triangle.counter_start) {
      this.triangle.linear_counter = this.triangle.linear_latch;
    } else {
      var linear_clk = cpu_clock / 240.0;
      this.triangle.linear_clk += inc_clk;
      while(this.triangle.linear_clk > linear_clk) {
        this.triangle.linear_clk -= linear_clk;
        if(this.triangle.linear_counter > 0)
          this.triangle.linear_counter--;
      }
    }

    if(!this.triangle.holdnote && this.triangle.linear_counter)
      this.triangle.counter_start = false;

    if(this.triangle.linear_counter == 0)
      pause = true;

    pause |= this.triangle.sweep_pausing;
    pause |= this.triangle.wave_length == 0;

    var t = 0;
    var v = 0;
    if(!pause) {
      t = this.tri_produce(sample_clk);
      v = t * vol / 16;
    }

    return v;
  }

  tri_produce(clk) {
    //util.log(this.nes, "tri_produce");

    var tri_wav = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ];

    this.triangle.step_clk += clk;
    var ret = (tri_wav[this.triangle.step] / 16.0) - 0.5;
    var term = this.triangle.wave_length + 1;

    if(this.triangle.step_clk >= term) {
      var t = util.to_s32(this.triangle.step_clk / term);
      this.triangle.step_clk -= term * t;
      this.triangle.step = (this.triangle.step + t) % 32;
    }

    return ret;
  }

  gen_noise(cpu_clock, inc_clk, sample_clk) {
    var pause = false;
    var vol = 16;

    if(!this.noise.enable)
      return 0;
    if(this.noise.length == 0)
      pause = true;

    if(this.noise.length_enable) {
      var length_clk = cpu_clock / 60.0;
      this.noise.length_clk += inc_clk;
      while(this.noise.length_clk > length_clk) {
        this.noise.length_clk -= length_clk;
        if(this.noise.length>0)
          this.noise.length--;
      }
    }

    if(this.noise.envelope_enable) {
      var decay_clk = cpu_clock / (240.0 / (this.noise.envelope_rate+1));
      this.noise.envelope_clk += inc_clk;
      while(this.noise.envelope_clk > decay_clk) {
        this.noise.envelope_clk -= decay_clk;

        if(this.noise.volume > 0) {
          this.noise.volume--;
        } else if(!this.noise.length_enable) {
          this.noise.volume = 0xf;
        } else {
          this.noise.volume = 0;
        }
      }
    }
    vol = this.noise.volume;

    pause |= this.noise.sweep_pausing;
    pause |= this.noise.wave_length == 0;

    var t = 0;
    var v = 0;
    if(!pause) {
      t = this.noi_produce(sample_clk);
      v = t * vol / 16;
    }

    return v;
  }

  noi_produce(clk) {
    //util.log(this.nes, "noi_produce");

    this.noise.step_clk += clk;
    var ret = 0.5 - (this.noise.shift_register >> 14);
    var term = this.noise.wave_length + 1;

    while(this.noise.step_clk >= term) {
      this.noise.step_clk -= term;
      var t = util.to_s32(this.noise.shift_register);
      if(this.noise.random_type)
        this.noise.shift_register= ((t<<1) | (((t>>14) ^ (t>>8)) & 1)) & 0x7fff;
      else
        this.noise.shift_register= ((t<<1) | (((t>>14) ^ (t>>13)) & 1)) & 0x7fff;
    }

    return ret;
  }

  dmc_produce(clk) {
    //util.log(this.nes, "dmc_produce");

    if(!this.dmc.enable)
      return (((this.dmc.counter<<1) | this.dmc.dac_lsb) / 32.0);
      //return ((((this.dmc.counter<<1) | this.dmc.dac_lsb) - 64) / 32.0);

    this.dmc.clk += clk;
    while(this.dmc.clk > this.dmc.wave_length) {
      this.dmc.clk -= this.dmc.wave_length;
      if(this.dmc.shift_count == 0) {
        if(this.dmc.length == 0) {
          if(this.dmc.playback_mode & 1) {
            this.dmc.addr = this.dmc.addr_latch;
            this.dmc.length = this.dmc.length_latch;
          } else {
            this.dmc.enable = false;
            if(this.dmc.playback_mode == 2)
              this.dmc.irq = true;
            //return ((((this.dmc.counter<<1) | this.dmc.dac_lsb) - 64) / 32.0);
            return (((this.dmc.counter<<1) | this.dmc.dac_lsb) / 32.0);
          }
        }

        this.dmc.shift_count = 8;
        this.dmc.shift_reg = this.nes.mmc.read(this.dmc.addr);

        if(this.dmc.addr == 0xFFFF)
          this.dmc.addr = 0x8000;
        else
          this.dmc.addr += 1;
        this.dmc.length--;
      }

      var b = this.dmc.shift_req & 1;
      if(b == 0 && this.dmc.counter)
        this.dmc.counter--;
      if(b == 1 && this.dmc.counter != 0x3F)
        this.dmc.counter++;

      this.dmc.counter &= 0x3F;
      this.dmc.shift_count--;
      this.dmc.shift_reg >>= 1;
    }

    //return ((((this.dmc.counter<<1) | this.dmc.dac_lsb) - 64) / 32.0);
    return (((this.dmc.counter<<1) | this.dmc.dac_lsb) / 32.0);
  }

  gen_audio(sndi) {
    var cpu_clock = this.nes.cpu.frequency;
    var cur_clock = this.nes.cpu.master_clock();
    var inc_clk = (cur_clock - this.bef_clock) / sndi.sample;
    var sample_clk = cpu_clock / sndi.freq;

    for(var i=0; i<sndi.bps/8*sndi.sample*sndi.ch; i++)
      sndi.buf[i] = 0;

    for(i=0; i<sndi.sample; i++) {
      var pos = ((cur_clock - this.bef_clock) * i / sndi.sample) + this.bef_clock;
      while(!this.write_queue.empty() && this.write_queue.front().clk <= pos) {
        var w = this.write_queue.front();
        this.write_queue.pop();
        this._write(this.ch, this.dmc, w.addr, w.dat);
      }

      var v = 0;
      v += this.gen_pulse(this.pulse1, cpu_clock, inc_clk, sample_clk);
      v += this.gen_pulse(this.pulse2, cpu_clock, inc_clk, sample_clk);
      v += this.gen_triangle(cpu_clock, inc_clk, sample_clk);
      v += this.gen_noise(cpu_clock, inc_clk, sample_clk);
      v += this.dmc_produce(sample_clk);

      if(sndi.bps == 16)
        sndi.buf[i] = util.get_min(32767.0, util.get_max(-32767.0, sndi.buf[i]+(v*8000)));
      else if(sndi.bps == 8)
        sndi.buf[i] += util.to_u8(v * 30);
    }

    this.bef_clock = cur_clock;
  }

  debug_out(sound) {
    var size = sound.bps/8 * sound.sample * sound.ch;
    var str = "sound size:" + size;
    for(var i=0; i<size; i++)
      str += sound.buf[i] + ",";
    str += "\n";
    util.log(this.nes, str);
  }
}

class Pulse {
  constructor() {
    this.enable = false;

    this.wave_length = 0;
    this.length_enable = false;
    this.length = 0;
    this.length_clk = 0;

    this.volume = 0;
    this.envelop_rate = 0;
    this.envelope_enable = false;
    this.envelope_clk = 0;

    this.sweep_enable = false;
    this.sweep_rate = 0;
    this.sweep_mode = false;
    this.sweep_shift = 0;
    this.sweep_clk = 0;
    this.sweep_pausing = false;

    this.duty = 0;

    this.linear_latch = 0;
    this.linear_counter = 0;
    this.holdnote = false;
    this.counter_start = 0;
    this.linear_clk = 0;

    this.random_type = false;
    this.step = 0;
    this.step_clk = 0;
  }
}

class Triangle {
  constructor() {
    this.enable = false;

    this.wave_length = 0;
    this.length_enable = false;
    this.length = 0;
    this.length_clk = 0;

    this.volume = 0;
    this.envelop_rate = 0;
    this.envelope_enable = false;
    this.envelope_clk = 0;

    this.sweep_enable = false;
    this.sweep_rate = 0;
    this.sweep_mode = false;
    this.sweep_shift = 0;
    this.sweep_clk = 0;
    this.sweep_pausing = false;

    this.duty = 0;

    this.linear_latch = 0;
    this.linear_counter = 0;
    this.holdnote = false;
    this.counter_start = 0;
    this.linear_clk = 0;

    this.random_type = false;
    this.step = 0;
    this.step_clk = 0;
  }
}

class Noise {
  constructor() {
    this.enable = false;

    this.wave_length = 0;
    this.length_enable = false;
    this.length = 0;
    this.length_clk = 0;

    this.volume = 0;
    this.envelop_rate = 0;
    this.envelope_enable = false;
    this.envelope_clk = 0;

    this.sweep_enable = false;
    this.sweep_rate = 0;
    this.sweep_mode = false;
    this.sweep_shift = 0;
    this.sweep_clk = 0;
    this.sweep_pausing = false;

    this.duty = 0;

    this.linear_latch = 0;
    this.linear_counter = 0;
    this.holdnote = false;
    this.counter_start = 0;
    this.linear_clk = 0;

    this.random_type = false;
    this.step = 0;
    this.step_clk = 0;
    this.shift_register = 0;
  }
}

class DMC {
  constructor() {
    this.enable = false;
    this.irq = false;

    this.playback_mode = 0;
    this.wave_length = 0;
    this.clk = 0;

    this.counter = 0;
    this.length = 0;
    this.length_latch = 0;
    this.addr = 0;
    this.addr_latch = 0;
    this.shift_reg = 0;
    this.shift_count = 0;
    this.dac_lsb = 0;
  }
}

class Write_dat {
  constructor(clk, addr, dat) {
    this.clk = clk;
    this.addr = addr;
    this.dat = dat;
  }
}

