import * as util from './util.js'

export class APU {
  constructor(nes) {
    this.nes = nes;

    this.pulse1 = new Pulse(1);
    this.pulse2 = new Pulse(2);
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.dmc = new DMC();
  }

  reset() {
  }

  read(addr) {
    if(addr == 0x4015) {
    }

    return 0xA0;
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
      break;

    case 0x4003:
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
      break;

    case 0x4007:
      break;

    case 0x4008:
      break;

    case 0x4009:
      break;
    case 0x400A:

      break;
    case 0x400B:

      break;
    case 0x400C:
      break;

    case 0x400D:
      break;

    case 0x400E:
      break;

    case 0x400F:
      break;

    case 0x4010:
      break;

    case 0x4011:
      break;

    case 0x4012:
      break;

    case 0x4013:
      break;

    case 0x4014:
      break;

    case 0x4015:
      break;
    }
  }
}

class Pulse {
  constructor(channel) {
    this.channel = 0;
    this.enable = 0;
    this.duty_cycle = 0;
    this.length_counter = 0;

    this.constant_volume = 0;
    this.envelope_volume = 0;
    this.envelope_loop = 0;
    this.envelope_enable = 0;
    this.envelope_start = 0;
    this.envelope_period = 0;

    this.timer = 0;
    this.timer_period = 0;

    this.sweep = 0;
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
    this.table = [
      15, 14, 13, 12, 11, 10,  9,  8,  7,  6,  5,  4,  3,  2,  1,  0,
       0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
    ];
  }
}

class Noise {
  constructor() {
    this.table = [
      4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
    ];
  }
}

class DMC {
  constructor(clk, addr, dat) {
    this.table = [
      428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106,  84,  72,  54,
    ];
  }
}

