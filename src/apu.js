import * as util from './util.js'

export class APU {
  constructor(nes) {
    this.nes = nes;
    this.cpu_clock = this.nes.cpu.frequency;
    this.clock_per_frame = this.cpu_clock / 60;

    this.pulse1 = new Pulse();
    this.pulse2 = new Pulse();
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.dmc = new DMC();

    this.write_queue = new util.Queue();
    this.pre_clock = 0;
    this.bef_sync = 0;

    this.length_counter_table = [
      10,254, 20,  2, 40,  4, 80,  6, 160,  8, 60, 10, 14, 12, 26, 14,
      12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
    ];

    this.duty_table = [
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      ];

    /*
    this.duty_table = [
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 0, 0, 0],
      [1, 0, 0, 1, 1, 1, 1, 1],
    ];
    */

    this.triangle_table = [
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ];

    this.noise_table = [
      4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
    ];

    this.dmc_table = [
      428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106,  84,  72,  54,
    ];

    this.frame_period = 0;
    this.frame_irq = 0xff;
  }

  reset() {
    this.noise.shift_register = 1;

    this.pre_clock = 0;
    this.bef_sync = 0;
  }

  sync() {
    var cur = this.nes.cpu.master_clock();
    var adv_clock = util.to_s32(cur) - this.bef_sync;

    if(this.pulse1.enable && this.pulse1.length_counter_enable) {
      this.pulse1.length_clock += adv_clock;
      var dec = util.to_s32(this.pulse1.length_clock / this.clock_per_frame);
      this.pulse1.length_clock -= this.clock_per_frame * dec;
      this.pulse1.length_counter = util.get_max(0, this.pulse1.length_counter-dec);
    }

    if(this.pulse2.enable && this.pulse2.length_counter_enable) {
      this.pulse2.length_clock += adv_clock;
      var dec = util.to_s32(this.pulse2.length_clock / this.clock_per_frame);
      this.pulse2.length_clock -= this.clock_per_frame * dec;
      this.pulse2.length_counter = util.get_max(0, this.pulse2.length_counter-dec);
    }

    if(this.triangle.enable && this.triangle.length_counter_enable) {
      this.triangle.length_clock += adv_clock;
      var dec = util.to_s32(this.triangle.length_clock / this.clock_per_frame);
      this.triangle.length_clock -= this.clock_per_frame * dec;
      this.triangle.length_counter = util.get_max(0, this.triangle.length_counter-dec);
    }

    if(this.noise.enable && this.noise.length_counter_enable) {
      this.noise.length_clock += adv_clock;
      var dec = util.to_s32(this.noise.length_clock / this.clock_per_frame);
      this.noise.length_clock -= this.clock_per_frame * dec;
      this.noise.length_counter = util.get_max(0, this.noise.length_counter-dec);
    }

    if(this.dmc.enable) {
      this.dmc.clock += adv_clock;
      var dec = util.to_s32(this.dmc.clock / this.dmc.timer_period);
      this.dmc.clock -= dec * this.dmc.timer_period;

      var rest = util.to_s32(this.dmc.shift_count + (this.dmc.length_counter*8) - dec);
      if(rest <= 0) {
        if(this.dmc.loop) {
          this.dmc.length_counter = rest / 8;
          while(this.dmc.length_counter < 0)
            this.dmc.length_counter += this.dmc.sample_length;
          this.dmc.shift_count = 0;
        } else {
          this.dmc.enable = 0;
        }
      } else {
        this.dmc.length_counter = rest / 8;
        this.dmc.shift_count = rest % 8;
      }
    }

    this.bef_sync = cur;
  }

  read(addr) {
    if(addr == 0x4015) {
      this.sync();
      var ret = this.pulse1.length_counter |
        (this.pulse2.length_counter << 1) |
        (this.triangle.length_counter << 2) |
        (this.noise.length_counter << 3) |
        (this.dmc.enable << 4) |
        (this.dmc.irq << 7);
      return util.to_u8(ret);
    }

    return 0xA0;
  }

  write(addr, dat) {
    //util.log(this.nes, "apu write addr:" + util.to_hex(addr));

    var wd = new Write_dat(this.nes.cpu.master_clock(), addr, dat);
    this.write_queue.push(wd);
    this._write(this.dmc, addr, dat);
  }

  _write(dmc, addr, dat) {
    switch(addr) {
    /* Pulse 1 */
    case 0x4000:
      this.pulse1.envelope_enable = (dat>>4) & 1;
      this.pulse1.envelope_volume = dat & 0xf;
      this.pulse1.envelope_period = dat & 0xf;
      this.pulse1.length_counter_enable = (dat>>5) & 1;
      this.pulse1.duty_cycle = dat >> 6;
      this.pulse1.envelope_clock = 0;
      break;

    case 0x4001:
      this.pulse1.sweep_shift = dat & 7;
      this.pulse1.sweep_negate = (dat>>3) & 1;
      this.pulse1.sweep_period = (dat>>4) & 7;
      this.pulse1.sweep_enable = (dat>>7) & 1;
      this.pulse1.sweep_clock = 0;
      this.pulse1.sweep_pausing = 0;
      break;

    case 0x4002:
      this.pulse1.timer_period = (this.pulse1.timer_period&0xff00) | dat;
      break;

    case 0x4003:
      this.pulse1.timer_period = (this.pulse1.timer_period&0x00ff) | ((dat&7) << 8);
      this.pulse1.length_counter = this.length_counter_table[dat>>3];

      if(this.pulse1.envelope_enable) {
        this.pulse1.envelope_volume = 0xf;
        this.pulse1.envelope_clock = 0;
      }
      break;

    /* Pulse 2 */
    case 0x4004:
      this.pulse2.envelope_enable = (dat>>4) & 1;
      this.pulse2.envelope_period = dat & 0xf;
      this.pulse2.envelope_volume = dat & 0xf;
      this.pulse2.length_counter_enable = (dat>>5) & 1;
      this.pulse2.duty_cycle = dat >> 6;
      this.pulse2.envelope_clock = 0;
      break;

    case 0x4005:
      this.pulse2.sweep_shift = dat & 7;
      this.pulse2.sweep_negate = (dat>>3) & 1;
      this.pulse2.sweep_period = (dat>>4) & 7;
      this.pulse2.sweep_enable = (dat>>7) & 1;
      this.pulse2.sweep_clock = 0;
      this.pulse2.sweep_pausing = 0;
      break;

    case 0x4006:
      this.pulse2.timer_period = (this.pulse2.timer_period&~0xff) | dat;
      break;

    case 0x4007:
      this.pulse2.timer_period = (this.pulse2.timer_period&0xff) | ((dat&0x7) << 8);
      this.pulse2.length_counter = this.length_counter_table[dat>>3];

      if(this.pulse2.envelope_enable) {
        this.pulse2.envelope_volume = 0xf;
        this.pulse2.envelope_clock = 0;
      }
      break;

    /* Triangle */
    case 0x4008:
      this.triangle.length_counter_enable = (dat>>7) & 1;
      this.triangle.counter_reload_value = dat & 0x7f;
      break;

    case 0x4009:
      break;

    case 0x400A:
      this.triangle.timer_period = (this.triangle.timer_period&~0xff) | dat;
      break;

    case 0x400B:
      this.triangle.timer_period = (this.triangle.timer_period&0xff) | ((dat&0x7) << 8);
      this.triangle.length_counter = this.length_counter_table[dat>>3];
      this.triangle.counter_reload_flag = 1;
      break;

    /* Noise */
    case 0x400C:
      this.noise.envelope_enable = (dat>>4) & 1;
      this.noise.envelope_period = dat & 0xf;
      this.noise.envelope_volume = dat & 0xf;
      this.noise.length_counter_enable = (dat>>5) & 1;
      this.noise.envelope_clock = 0;
      break;

    case 0x400D:
      break;

    case 0x400E:
      this.noise.timer_period = this.noise_table[dat&0xf] - 1;
      this.noise.mode = (dat>>7) & 1;
      break;

    case 0x400F:
      this.noise.length_counter = this.length_counter_table[dat>>3];

      if(this.noise.envelope_enable) {
        this.noise.envelope_volume = 0xf;
        this.noise.envelope_clock = 0;
      }
      break;

    /* DMC */
    case 0x4010:
      dmc.irq = !((dat>>7) & 1);
      dmc.loop = (dat>>6) & 1;
      dmc.timer_period = util.to_u32(this.dmc_table[dat&0xf] / 8);
      break;

    case 0x4011:
      dmc.dac_lsb = dat & 1;
      dmc.counter = (dat>>1) & 0x3f;
      break;

    case 0x4012:
      dmc.sample_addr = (dat<<6) + 0xc000;
      break;

    case 0x4013:
      dmc.sample_length = (dat<<4) + 1;
      break;

    /* Enable channels */
    case 0x4015:
      this.pulse1.enable = dat&1;
      if(!this.pulse1.enable)
        this.pulse1.length_counter = 0;

      this.pulse2.enable = (dat&2) >> 1;
      if(!this.pulse2.enable)
        this.pulse2.length_counter = 0;

      this.triangle.enable = (dat&4) >> 2;
      if(!this.triangle.enable)
        this.triangle.length_counter = 0;

      this.noise.enable = (dat&8) >> 3;
      if(!this.noise.enable)
        this.noise.length_counter = 0;

      if(dat&0x10) {
        if(!dmc.enable) {
          dmc.addr = dmc.sample_addr;
          dmc.length_counter = dmc.sample_length;
          dmc.shift_count = 0;
        }
        dmc.enable = 1;
      } else {
        dmc.enable = 0;
      }

      dmc.irq = 0;
      break;
    }
  }

  gen_pulse(pulse, clock_per_sample, clock_per_freq) {
    var pause = 0;
    var vol = 16;

    if(!pulse.enable)
      return 0;
    if(pulse.length_counter == 0)
      pause = 1;

    // Length Counter
    if(pulse.length_counter_enable) {
      pulse.length_clock += clock_per_sample;
      while(pulse.length_clock > this.clock_per_frame) {
        pulse.length_clock -= this.clock_per_frame;
        if(pulse.length_counter > 0)
          pulse.length_counter--;
      }
    }

    // Envelope
    if(pulse.envelope_enable) {
      var decay_clk = (this.clock_per_frame / 4.0) * (pulse.envelope_period + 1);
      pulse.envelope_clock += clock_per_sample;
      while(pulse.envelope_clock > decay_clk) {
        pulse.envelope_clock -= decay_clk;

        if(pulse.envelope_volume > 0) {
          pulse.envelope_volume--;
        } else if(!pulse.length_counter_enable) {
          pulse.envelope_volume = 0xf;
        } else {
          pulse.envelope_volume = 0;
        }
      }
    }
    vol = pulse.envelope_volume;

    // Sweep
    if(pulse.sweep_enable && !pulse.sweep_pausing) {
      var sweep_clock = (this.clock_per_frame / 2.0) * (pulse.sweep_period + 1);
      pulse.sweep_clock += clock_per_sample;
      while(pulse.sweep_clock > sweep_clock) {
        pulse.sweep_clock -= sweep_clock;
        if(pulse.sweep_shift && pulse.length_counter) {
          if(!pulse.sweep_negate)
            pulse.timer_period += pulse.timer_period >> pulse.sweep_shift;
          else
            pulse.timer_period += ~(pulse.timer_period >> pulse.sweep_shift);

          if(pulse.timer_period < 0x008)
            pulse.sweep_pausing = 1;
          if(pulse.timer_period & ~0x7FF)
            pulse.sweep_pausing = 1;

          pulse.timer_period &= 0x7FF;
        }
      }
    }

    pause |= pulse.sweep_pausing;
    pause |= pulse.timer_period == 0;

    var t = 0;
    var v = 0;
    if(!pause) {
      t = this.pulse_produce(pulse, clock_per_freq);
      v = t * vol / 16;
    }

    return v;
  }

  pulse_produce(pulse, clock_per_freq) {
    pulse.step_clock += clock_per_freq;
    var ret = 0.5 - this.duty_table[pulse.duty_cycle][pulse.step];
    var term = pulse.timer_period + 1;

    if(pulse.step_clock >= term) {
      var t = util.to_s32(pulse.step_clock / term);
      pulse.step_clock -= term * t;
      pulse.step = (pulse.step + t) % 16;
      // util.log(this.nes, "step:" + pulse.step + ", step_clock:" + pulse.step_clock + ", term:" + term + ", t:" + t);
    }

    return ret;
  }

  gen_triangle(clock_per_sample, clock_per_freq) {
    var pause = 0;
    var vol = 16;

    if(!this.triangle.enable)
      return 0;
    if(this.triangle.length_counter == 0)
      pause = 1;

    // Length Counter
    if(this.triangle.length_counter_enable) {
      this.triangle.length_clock += clock_per_sample;
      while(this.triangle.length_clock > this.clock_per_frame) {
        this.triangle.length_clock -= this.clock_per_frame;
        if(this.triangle.length_counter > 0)
          this.triangle.length_counter--;
      }
    }

    // Linear Counter
    if(this.triangle.counter_reload_flag) {
      this.triangle.linear_counter = this.triangle.counter_reload_value;
    } else {
      var linear_clock = this.clock_per_frame / 4.0;
      this.triangle.linear_clock += clock_per_sample;
      while(this.triangle.linear_clock > linear_clock) {
        this.triangle.linear_clock -= linear_clock;
        if(this.triangle.linear_counter > 0)
          this.triangle.linear_counter--;
      }
    }

    //if(!this.triangle.length_counter_enable && this.triangle.linear_counter)
    if(!this.triangle.length_counter_enable)
      this.triangle.counter_reload_flag = 0;

    if(!this.triangle.linear_counter)
      pause = 1;

    pause |= this.triangle.timer_period == 0;

    var t = 0;
    var v = 0;
    if(!pause) {
      t = this.tri_produce(clock_per_freq);
      v = t * vol / 16;
    }

    return v;
  }

  tri_produce(clock_per_freq) {
    this.triangle.step_clock += clock_per_freq;
    var ret = (this.triangle_table[this.triangle.step] / 16.0) - 0.5;
    var term = this.triangle.timer_period + 1;

    if(this.triangle.step_clock >= term) {
      var t = util.to_s32(this.triangle.step_clock / term);
      this.triangle.step_clock -= term * t;
      this.triangle.step = (this.triangle.step + t) % 32;
    }

    return ret;
  }

  gen_noise(clock_per_sample, clock_per_freq) {
    var pause = 0;
    var vol = 16;

    if(!this.noise.enable)
      return 0;
    if(this.noise.length_counter == 0)
      pause = 1;

    // Length Counter
    if(this.noise.length_counter_enable) {
      this.noise.length_clock += clock_per_sample;
      while(this.noise.length_clock > this.clock_per_frame) {
        this.noise.length_clock -= this.clock_per_frame;
        if(this.noise.length_counter > 0)
          this.noise.length_counter--;
      }
    }

    // Envelope
    if(this.noise.envelope_enable) {
      var decay_clk = (this.clock_per_frame / 4.0) * (this.noise.envelope_period + 1);
      this.noise.envelope_clock += clock_per_sample;
      while(this.noise.envelope_clock > decay_clk) {
        this.noise.envelope_clock -= decay_clk;

        if(this.noise.envelope_volume > 0) {
          this.noise.envelope_volume--;
        } else if(!this.noise.length_counter_enable) {
          this.noise.envelope_volume = 0xf;
        } else {
          this.noise.envelope_volume = 0;
        }
      }
    }
    vol = this.noise.envelope_volume;

    pause |= this.noise.timer_period == 0;

    var t = 0;
    var v = 0;
    if(!pause) {
      t = this.noi_produce(clock_per_freq);
      v = t * vol / 16;
    }

    return v;
  }

  noi_produce(clock_per_freq) {
    //util.log(this.nes, "noi_produce");

    this.noise.step_clock += clock_per_freq;
    var ret = 0.5 - (this.noise.shift_register >> 14);
    var term = this.noise.timer_period + 1;

    while(this.noise.step_clock >= term) {
      this.noise.step_clock -= term;
      var t = util.to_s32(this.noise.shift_register);
      var shift;
      if(this.noise.mode) {
        this.noise.shift_register= ((t<<1) | (((t>>14) ^ (t>>8)) & 1)) & 0x7fff;
        //shift = 6;
      } else {
        this.noise.shift_register= ((t<<1) | (((t>>14) ^ (t>>13)) & 1)) & 0x7fff;
        //shift = 1;
      }

      //this.noise.shift_register = ((t>>1) | (((t&1) ^ (t>>shift)) & 1)) & 0x7fff;
    }

    return ret;
  }

  dmc_produce(clock_per_freq) {
    //util.log(this.nes, "dmc_produce");

    if(!this.dmc.enable) {
      //return (((this.dmc.counter<<1) | this.dmc.dac_lsb) / 32.0);
      return ((((this.dmc.counter<<1) | this.dmc.dac_lsb) - 64) / 32.0);
    }

    this.dmc.clock += clock_per_freq;
    while(this.dmc.clock > this.dmc.timer_period) {
      this.dmc.clock -= this.dmc.timer_period;
      if(this.dmc.shift_count == 0) {
        if(this.dmc.length_counter == 0) {
          if(this.dmc.loop) {
            this.dmc.addr = this.dmc.sample_addr;
            this.dmc.length_counter = this.dmc.sample_length;
          } else {
            this.dmc.enable = 0;
            return ((((this.dmc.counter<<1) | this.dmc.dac_lsb) - 64) / 32.0);
            //return (((this.dmc.counter<<1) | this.dmc.dac_lsb) / 32.0);
          }
        }

        this.dmc.shift_count = 8;
        this.dmc.shift_reg = this.nes.mmc.read(this.dmc.addr);

        if(this.dmc.addr == 0xFFFF)
          this.dmc.addr = 0x8000;
        else
          this.dmc.addr += 1;
        this.dmc.length_counter--;
      }

      var b = this.dmc.shift_reg & 1;
      if(b == 0 && this.dmc.counter)
        this.dmc.counter--;
      if(b == 1 && this.dmc.counter != 0x3F)
        this.dmc.counter++;

      this.dmc.counter &= 0x3F;
      this.dmc.shift_count--;
      this.dmc.shift_reg >>= 1;
    }

    return ((((this.dmc.counter<<1) | this.dmc.dac_lsb) - 64) / 32.0);
    //return (((this.dmc.counter<<1) | this.dmc.dac_lsb) / 32.0);
  }

  gen_audio(sndi) {
    var cur_clock = this.nes.cpu.master_clock();
    var clock_per_sample = (cur_clock - this.pre_clock) / sndi.sample;
    var clock_per_freq = this.cpu_clock / sndi.freq;

    // util.log(this.nes, "gen_audio:" + cur_clock.toString(10).padStart(10, " ") + ":" + this.pre_clock.toString(10).padStart(10, " ") + ":" + clock_per_sample.toString(10).padStart(20, " ") + ":" + clock_per_freq.toString(10).padStart(20, " "));

    for(var i=0; i<(sndi.bps/8 * sndi.sample * sndi.ch); i++)
      sndi.buf[i] = 0;

    for(i=0; i<sndi.sample; i++) {
      var pos = (clock_per_sample * i) + this.pre_clock;
      while(!this.write_queue.empty() && this.write_queue.front().clk <= pos) {
        var w = this.write_queue.front();
        this.write_queue.pop();
        this._write(this.dmc, w.addr, w.dat);
      }

      var v = 0;
      v += this.gen_pulse(this.pulse1, clock_per_sample, clock_per_freq);
      v += this.gen_pulse(this.pulse2, clock_per_sample, clock_per_freq);
      v += this.gen_triangle(clock_per_sample, clock_per_freq);
      v += this.gen_noise(clock_per_sample, clock_per_freq);
      v += this.dmc_produce(clock_per_freq);

      if(sndi.bps == 16)
        sndi.buf[i] = util.get_min(32767.0, util.get_max(-32767.0, sndi.buf[i]+(v*8000)));
      else if(sndi.bps == 8)
        sndi.buf[i] += util.to_u8(v * 30);
    }

    this.pre_clock = cur_clock;
  }

  debug_out(sound) {
    var size = sound.bps/8 * sound.sample * sound.ch;
    var str = "sound size:" + size;
    for(var i=0; i<size; i++) {
      str += sound.buf[i] + ",";
    }
    str += "\n";
    util.log(this.nes, str);
  }
}

class Pulse {
  constructor() {
    this.enable = 0;

    this.timer_period = 0;
    this.length_counter_enable = 0;
    this.length_counter = 0;
    this.length_clock = 0;

    this.envelope_volume = 0;
    this.envelop_rate = 0;
    this.envelope_enable = 0;
    this.envelope_clock = 0;

    this.sweep_enable = 0;
    this.sweep_period = 0;
    this.sweep_negate = 0;
    this.sweep_shift = 0;
    this.sweep_clock = 0;

    this.duty_cycle = 0;

    this.linear_counter = 0;
    this.counter_reload_value = 0;
    this.counter_reload_flag = 0;
    this.linear_clock = 0;

    this.step = 0;
    this.step_clock = 0;
  }
}

class Triangle {
  constructor() {
    this.enable = 0;

    this.timer_period = 0;
    this.length_counter_enable = 0;
    this.length_counter = 0;
    this.length_clock = 0;

    this.duty_cycle = 0;

    this.linear_counter = 0;
    this.counter_reload_value = 0;
    this.counter_reload_flag = 0;
    this.linear_clock = 0;

    this.step = 0;
    this.step_clock = 0;
  }
}

class Noise {
  constructor() {
    this.enable = 0;

    this.timer_period = 0;
    this.length_counter_enable = 0;
    this.length_counter = 0;
    this.length_clock = 0;

    this.envelope_volume = 0;
    this.envelop_rate = 0;
    this.envelope_enable = 0;
    this.envelope_clock = 0;

    this.linear_counter = 0;
    this.counter_reload_value = 0;
    this.counter_reload_flag = 0;
    this.linear_clock = 0;

    this.mode = 0;
    this.step = 0;
    this.step_clock = 0;
    this.shift_register = 0;
  }
}

class DMC {
  constructor() {
    this.enable = 0;
    this.irq = 0;

    this.loop = 0;
    this.timer_period = 0;
    this.clock = 0;

    this.counter = 0;
    this.length_counter = 0;
    this.sample_length = 0;
    this.addr = 0;
    this.sample_addr = 0;
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

