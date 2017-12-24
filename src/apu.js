import * as util from './util.js'

export class APU {
  constructor(nes) {
    this.nes = nes;

    this.frame_period = 0;
    this.frame_irq = 0xff;

    this.pulse1 = new Pulse(1);
    this.pulse2 = new Pulse(2);
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.dmc = new DMC();

    this.length_table = [
      10,254, 20,  2, 40,  4, 80,  6, 160,  8, 60, 10, 14, 12, 26, 14,
      12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
    ];
  }

  reset() {
  }

  read(addr) {
    // Only read from 0x4015
    var ret = 0;
    if(this.pulse1.length_wave > 0)
      ret |= 0x01;
    if(this.pulse2.length_wave > 0)
      ret |= 0x02;
    if(this.triangle.length_wave > 0)
      ret |= 0x04;
    if(this.noise.length_wave > 0)
      ret |= 0x08;
    if(this.dmc.current_length > 0)
      ret |= 0x10;
    return ret;
  }

  write(addr, data) {
    switch(addr) {
    case 0x4000:
      this.pulse1.duty_cycle = (data>>6) & 3;
      this.pulse1.length_counter = (data>>5) & 1;
      this.pulse1.envelope_loop = (data>>5) & 1;
      this.pulse1.envelope_enable = (data>>4) & 1;
      this.pulse1.envelope_period = data & 0xf;
      this.pulse1.constant_volume = data & 0xf;
      this.pulse1.envelope_start = 1;
      break;

    case 0x4001:
      this.pulse1.sweep_enable = (data>>7) & 1;
      this.pulse1.sweep_period = (data>>4) & 7 + 1;
      this.pulse1.sweep_negate = (data>>3) & 1;
      this.pulse1.sweep_shift = data & 7;
      this.pulse1.sweep_reload = 1;
      break;

    case 0x4002:
      this.pulse1.timer_period = (this.pulse1.timer_period & 0xff00) | (data & 0x00ff);
      break;

    case 0x4003:
      this.pulse1.length_wave = this.length_table[data >> 3];
      this.pulse1.timer_period = (this.pulse1.timer_period & 0x00ff) | ((data&7) << 8);
      this.pulse1.envelope_start = 1;
      this.pulse1.duty_wave = 0;
      break;

    case 0x4004:
      this.pulse2.duty_cycle = (data>>6) & 3;
      this.pulse2.length_counter = (data>>5) & 1;
      this.pulse2.envelope_loop = (data>>5) & 1;
      this.pulse2.envelope_enable = (data>>4) & 1;
      this.pulse2.envelope_period = data & 0xf;
      this.pulse2.constant_volume = data & 0xf;
      this.pulse2.envelope_start = 1;
      break;

    case 0x4005:
      this.pulse2.sweep_enable = (data>>7) & 1;
      this.pulse2.sweep_period = (data>>4) & 7 + 1;
      this.pulse2.sweep_negate = (data>>3) & 1;
      this.pulse2.sweep_shift = data & 7;
      this.pulse2.sweep_reload = 1;
      break;

    case 0x4006:
      this.pulse2.timer_period = (this.pulse2.timer_period & 0xff00) | (data & 0x00ff);
      break;

    case 0x4007:
      this.pulse2.length_wave = this.length_table[data >> 3];
      this.pulse2.timer_period = (this.pulse2.timer_period & 0x00ff) | ((data&7) << 8);
      this.pulse2.envelope_start = 1;
      this.pulse2.duty_wave = 0;
      break;

    case 0x4008:
      this.triangle.length_counter = (data>>7) & 1;
      this.triangle.counter_period = data & 0x7f;
      break;

    case 0x400A:
      this.triangle.timer_period = (this.triangle.timer_period & 0xff00) | (data & 0x00ff);
      break;

    case 0x400B:
      this.triangle.length_wave = this.length_table[data >> 3];
      this.triangle.timer_period = (this.triangle.timer_period & 0x00ff) | ((data&7) << 8);
      this.triangle.timer_wave = this.triangle.timer_period;
      this.counter_reload = 1;
      break;

    case 0x400C:
      this.noise.length_counter = (data>>5) & 1;
      this.noise.envelope_loop = (data>>5) & 1;
      this.noise.envelope_enable = (data>>4) & 1;
      this.noise.envelope_period = data & 0xf;
      this.noise.constant_volume = data & 0xf;
      this.noise.envelope_start = 1;
      break;

    case 0x400E:
      this.noise.mode = (data>>7) & 1;
      this.noise.timer_period = this.noise.table[data & 0xf];
      break;

    case 0x400F:
      this.noise.length_wave = this.length_table[data >> 3];
      this.noise.envelope_start = 1;
      break;

    case 0x4010:
      this.dmc.irq_enable = (data>>7) & 1;
      this.dmc.loop = (data>>6) & 1;
      this.dmc.timer_period = this.dmc.table[data & 0xf];
      break;

    case 0x4011:
      this.dmc.wave = data & 0x7f;
      break;

    case 0x4012:
      this.dmc.sample_addr = 0xc000 | util.to_u16(data << 6);
      break;

    case 0x4013:
      this.dmc.sample_length = util.to_u16(data << 4) | 1;
      break;

    case 0x4015:
      this.pulse1.enable = data & 1;
      if(!this.pulse1.enable)
        this.pulse1.length_wave = 0;

      this.pulse2.enable = (data>>1) & 1;
      if(!this.pulse2.enable)
        this.pulse2.length_wave = 0;

      this.triangle.enable = (data>>2) & 1;
      if(!this.triangle.enable)
        this.triangle.length_wave = 0;

      this.noise.enable = (data>>3) & 1;
      if(!this.noise.enable)
        this.noise.length_wave = 0;

      this.dmc.enable = (data>>4) & 1;
      if(!this.dmc.enable)
        this.dmc.current_length = 0;
      else if(!this.dmc.current_length) {
        this.dmc.current_addr = this.dmc.sample_addr;
        this.dmc.current_length = this.dmc.sample_length;
      }
      break;

    case 0x4017:
      this.frame_period = 4 + (data>>7)&1;
      this.frame_irq = (data>>6)&1 == 0;
      break;
    }
  }
}

class Pulse {
  constructor(channel) {
    this.channel = channel;
    this.enable = 0;
    this.duty_cycle = 0;
    this.duty_wave = 0;
    this.length_counter = 0;
    this.length_wave = 0;

    this.constant_volume = 0;
    this.envelope_volume = 0;
    this.envelope_loop = 0;
    this.envelope_enable = 0;
    this.envelope_start = 0;
    this.envelope_period = 0;

    this.timer_period = 0;

    this.sweep_enable = 0;
    this.sweep_nagate = 0;
    this.sweep_period = 0;
    this.sweep_shift = 0;
    this.sweep_reload = 0;

    this.duty_table = [
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 0, 0, 0],
      [1, 0, 0, 1, 1, 1, 1, 1],
    ];
  }
}

class Triangle {
  constructor() {
    this.enable = 0;
    this.length_counter = 0;
    this.length_wave = 0;

    this.timer_wave = 0;
    this.timer_period = 0;

    this.duty_wave = 0;
    this.counter_period = 0;
    this.counter_reload = 0;

    this.table = [
      15, 14, 13, 12, 11, 10,  9,  8,  7,  6,  5,  4,  3,  2,  1,  0,
       0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
    ];
  }
}

class Noise {
  constructor() {
    this.enable = 0;
    this.mode = 0;
    this.shift_reg = 0;

    this.length_counter = 0;
    this.length_wave = 0;

    this.timer_period = 0;
    this.timer_wave = 0;

    this.constant_volume = 0;
    this.envelope_volume = 0;
    this.envelope_loop = 0;
    this.envelope_enable = 0;
    this.envelope_start = 0;
    this.envelope_period = 0;

    this.table = [
      4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
    ];
  }
}

class DMC {
  constructor() {
    this.enable = 0;
    this.wave = 0;
    this.irq_enable = 0;
    this.loop = 0;

    this.sample_addr = 0;
    this.sample_length = 0;
    this.current_addr = 0;
    this.current_length = 0;
    this.shift_reg = 0;
    this.bit_counter = 0;

    this.timer_period = 0;
    this.timer_wave = 0;

    this.table = [
      428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54,
    ];
  }
}

