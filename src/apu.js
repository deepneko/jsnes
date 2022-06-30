import * as util from './util.js'

export class APU {
  constructor(nes) {
    this.nes = nes;
    this.debug = false;
    this.cpuClock = this.nes.cpu.frequency;
    this.clockPerFrame = this.cpuClock / 60;

    this.preClock = 0;

    this.lengthCounterTable = [
      10,254, 20,  2, 40,  4, 80,  6, 160,  8, 60, 10, 14, 12, 26, 14,
      12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30
    ];

    this.dutyTable = [
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    ];

    this.triangleTable = [
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ];

    this.noiseTable = [
      4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068
    ];

    this.dmcTable = [
      428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106,  84,  72,  54,
    ];
  }

  reset() {
    this.sampleQueue = new util.Queue();

    this.pulse1 = new Pulse();
    this.pulse2 = new Pulse();
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.dmc = new DMC();
    this.channels = [this.pulse1, this.pulse2, this.triangle, this.noise, this.dmc];

    this.syncPulse1 = new Pulse();
    this.syncPulse2 = new Pulse();
    this.syncTriangle = new Triangle();
    this.syncNoise = new Noise();
    this.syncDmc = new DMC();
    this.syncChannels = [this.syncPulse1, this.syncPulse2, this.syncTriangle, this.syncNoise, this.syncDmc];

    this.noise.shiftReg = 1;
    this.preClock = 0;
    this.frameIrq = 0xff;
  }

  read(addr) {
    // ToDo: no use sync channel
    if(addr == 0x4015) {
      var ret = this.syncPulse1.lengthCounter |
        (this.syncPulse2.lengthCounter << 1) |
        (this.syncTriangle.lengthCounter << 2) |
        (this.syncNoise.lengthCounter << 3) |
        (this.syncDmc.enable << 4) |
        (this.syncDmc.irq << 7);
      return util.u8(ret);
    }

    return 0xA0;
  }

  write(addr, data) {
    var s = new Sample(this.nes.cpu.masterClock(), addr, data);
    this.sampleQueue.push(s);
  }

  realWrite(channels, addr, data) {
    var pulse1 = channels[0];
    var pulse2 = channels[1];
    var triangle = channels[2];
    var noise = channels[3];
    var dmc = channels[4];

    switch(addr) {
    /* Pulse 1 */
    case 0x4000:
      pulse1.envelopeEnable = Number(((data>>4) & 1) == 0);
      if(pulse1.envelopeEnable) {
        pulse1.envelopeVolume = 0xf;
        pulse1.envelopePeriod = data & 0xf;
      } else
        pulse1.envelopeVolume = data & 0xf;
      pulse1.lengthCounterEnable = Number(((data>>5) & 1) == 0);
      pulse1.dutyCycle = data >> 6;
      pulse1.envelopeClock = 0;
      break;

    case 0x4001:
      pulse1.sweepShift = data & 7;
      pulse1.sweepNegate = (data>>3) & 1;
      pulse1.sweepPeriod = (data>>4) & 7;
      pulse1.sweepEnable = (data>>7) & 1;
      pulse1.sweepClock = 0;
      pulse1.sweepPausing = 0;
      break;

    case 0x4002:
      pulse1.timerPeriod = (pulse1.timerPeriod&~0xff) | data;
      break;

    case 0x4003:
      pulse1.timerPeriod = (pulse1.timerPeriod&0xff) | ((data&0x7) << 8);

      if(data & 0x8)
        pulse1.lengthCounter = (data>>4)==0 ? 0x7f:(data>>4);
      else
        pulse1.lengthCounter = this.lengthCounterTable[data>>4];

      if(pulse1.envelopeEnable) {
        pulse1.envelopeVolume = 0xf;
        pulse1.envelopeClock = 0;
      }
      break;

    /* Pulse 2 */
    case 0x4004:
      pulse2.envelopeEnable = Number(((data>>4) & 1) == 0);
      if(pulse2.envelopeEnable) {
        pulse2.envelopeVolume = 0xf;
        pulse2.envelopePeriod = data & 0xf;
      } else
        pulse2.envelopeVolume = data & 0xf;
      pulse2.lengthCounterEnable = Number(((data>>5) & 1) == 0);
      pulse2.dutyCycle = data >> 6;
      pulse2.envelopeClock = 0;
      break;

    case 0x4005:
      pulse2.sweepShift = data & 7;
      pulse2.sweepNegate = (data>>3) & 1;
      pulse2.sweepPeriod = (data>>4) & 7;
      pulse2.sweepEnable = (data>>7) & 1;
      pulse2.sweepClock = 0;
      pulse2.sweepPausing = 0;
      break;

    case 0x4006:
      pulse2.timerPeriod = (pulse2.timerPeriod&~0xff) | data;
      break;

    case 0x4007:
      pulse2.timerPeriod = (pulse2.timerPeriod&0xff) | ((data&0x7) << 8);

      if(data & 0x8)
        pulse2.lengthCounter = (data>>4)==0 ? 0x7f:(data>>4);
      else
        pulse2.lengthCounter = this.lengthCounterTable[data>>4];

      if(pulse2.envelopeEnable) {
        pulse2.envelopeVolume = 0xf;
        pulse2.envelopeClock = 0;
      }
      break;

    /* Triangle */
    case 0x4008:
      triangle.linearCounterCtl = (data>>7) & 1;
      triangle.counterReloadValue = data & 0x7f;
      break;

    case 0x4009:
      break;

    case 0x400A:
      triangle.timerPeriod = (triangle.timerPeriod&~0xff) | data;
      break;

    case 0x400B:
      triangle.timerPeriod = (triangle.timerPeriod&0xff) | ((data&0x7) << 8);

      if(data & 0x8)
        triangle.lengthCounter = (data>>4)==0 ? 0x7f:(data>>4);
      else
        triangle.lengthCounter = this.lengthCounterTable[data>>4];

      triangle.counterReloadFlag = 1;
      break;

    /* Noise */
    case 0x400C:
      noise.envelopeEnable = Number(((data>>4) & 1) == 0);
      if(noise.envelopeEnable) {
        noise.envelopeVolume = 0xf;
        noise.envelopePeriod = data & 0xf;
      } else
        noise.envelopeVolume = data & 0xf;
      noise.lengthCounterEnable = Number(((data>>5) & 1) == 0);
      noise.envelopeClock = 0;
      break;

    case 0x400D:
      break;

    case 0x400E:
      noise.timerPeriod = this.noiseTable[data&0xf] - 1;
      noise.mode = (data>>7) & 1;
      break;

    case 0x400F:
      if(data & 0x8)
        noise.lengthCounter = (data>>4)==0 ? 0x7f:(data>>4);
      else
        noise.lengthCounter = this.lengthCounterTable[data>>4];

      if(noise.envelopeEnable) {
        noise.envelopeVolume = 0xf;
        noise.envelopeClock = 0;
      }
      break;

    /* DMC */
    case 0x4010:
      dmc.loop = (data>>6) & 1;
      dmc.timerPeriod = util.u32(this.dmcTable[data&0xf] / 8);
      if(!((data>>7) & 1))
        dmc.irq = 0;
      break;

    case 0x4011:
      dmc.dacLsb = data & 1;
      dmc.deltaCounter = (data>>1) & 0x3f;
      break;

    case 0x4012:
      dmc.sampleAddr = (data<<6) | 0xc000;
      break;

    case 0x4013:
      dmc.sampleLength = (data<<4) + 1;
      break;

    /* Enable channels */
    case 0x4015:
      pulse1.enable = data&1;
      if(!pulse1.enable)
        pulse1.lengthCounter = 0;

      pulse2.enable = (data>>1) & 1;
      if(!pulse2.enable)
        pulse2.lengthCounter = 0;

      triangle.enable = (data>>2) & 1;
      if(!triangle.enable)
        triangle.lengthCounter = 0;

      noise.enable = (data>>3) & 1;
      if(!noise.enable)
        noise.lengthCounter = 0;

      if(data&0x10) {
        if(!dmc.enable) {
          dmc.addr = dmc.sampleAddr;
          dmc.lengthCounter = dmc.sampleLength;
          dmc.shiftCounter = 0;
        }
        dmc.enable = 1;
      } else {
        dmc.enable = 0;
      }
      dmc.irq = 0;
      break;
    }
  }

  createPulse(pulse, clockPerSample, clockPerFreq) {
    var pause = 0;
    var vol = 16;

    if(!pulse.enable)
      return 0;
    if(pulse.lengthCounter == 0)
      pause = 1;

    // Length Counter
    if(pulse.lengthCounterEnable) {
      pulse.lengthClock = pulse.lengthClock + clockPerSample;
      while(pulse.lengthClock > this.clockPerFrame) {
        pulse.lengthClock = pulse.lengthClock - this.clockPerFrame;
        if(pulse.lengthCounter > 0)
          pulse.lengthCounter--;
      }
    }

    // Envelope
    if(pulse.envelopeEnable) {
      var decayClock = (this.clockPerFrame / 4.0) * (pulse.envelopePeriod + 1);
      pulse.envelopeClock += clockPerSample;
      while(pulse.envelopeClock > decayClock) {
        pulse.envelopeClock -= decayClock;

        if(pulse.envelopeVolume > 0) {
          pulse.envelopeVolume--;
        } else if(!pulse.lengthCounterEnable) {
          pulse.envelopeVolume = 0xf;
        } else {
          pulse.envelopeVolume = 0;
        }
      }
    }
    vol = pulse.envelopeVolume;

    // Sweep
    if(pulse.sweepEnable && !pulse.sweepPausing) {
      var sweepClock = (this.clockPerFrame / 2.0) * (pulse.sweepPeriod + 1);
      pulse.sweepClock += clockPerSample;
      while(pulse.sweepClock > sweepClock) {
        pulse.sweepClock -= sweepClock;
        if(pulse.sweepShift && pulse.lengthCounter) {
          if(!pulse.sweepNegate)
            pulse.timerPeriod += pulse.timerPeriod >> pulse.sweepShift;
          else
            pulse.timerPeriod += ~(pulse.timerPeriod >> pulse.sweepShift);

          if(pulse.timerPeriod < 0x008)
            pulse.sweepPausing = 1;
          if(pulse.timerPeriod & ~0x7FF)
            pulse.sweepPausing = 1;

          pulse.timerPeriod &= 0x7FF;
        }
      }
    }

    pause |= pulse.sweepPausing;
    pause |= Number(pulse.timerPeriod == 0);
    if(pause)
      return 0;

    pulse.stepClock += clockPerFreq;
    var v = 0.5 - this.dutyTable[pulse.dutyCycle][pulse.step];
    v *= vol / 16;

    var term = pulse.timerPeriod + 1;
    if(pulse.stepClock >= term) {
      var t = util.s32(pulse.stepClock / term);
      pulse.stepClock -= term * t;
      pulse.stepClock = pulse.stepClock;
      pulse.step = (pulse.step + t) % 16;
    }

    return v;
  }

  createTriangle(triangle, clockPerSample, clockPerFreq) {
    var pause = 0;

    if(!triangle.enable)
      return 0;
    if(triangle.lengthCounter == 0)
      pause = 1;

    // length Counter
    if(triangle.lengthCounterEnable) {
      triangle.lengthClock = triangle.lengthClock + clockPerSample;
      while(triangle.lengthClock > this.clockPerFrame) {
        triangle.lengthClock = triangle.lengthClock - this.clockPerFrame;
        if(triangle.lengthCounter > 0)
          triangle.lengthCounter--;
      }
    }

    // linear counter
    if(triangle.counterReloadFlag)
      triangle.linearCounter = triangle.counterReloadValue;
    else {
      var linearClock = this.clockPerFrame / 4.0;
      triangle.linearClock = triangle.linearClock + clockPerSample;
      while(triangle.linearClock > linearClock) {
        triangle.linearClock -= linearClock;
        if(triangle.linearCounter > 0)
          triangle.linearCounter--;
      }
    }

    if(!triangle.linearCounterCtl && triangle.linearCounter != 0)
      triangle.counterReloadFlag = 0;

    if(triangle.linearCounter == 0)
      pause = 1;

    pause |= Number(triangle.timerPeriod == 0);
    if(pause)
      return 0;

    triangle.stepClock += clockPerFreq;
    var v = this.triangleTable[triangle.step]/16.0 - 0.5;

    var term = triangle.timerPeriod + 1;
    if(triangle.stepClock >= term) {
      var t = util.s32(triangle.stepClock / term);
      triangle.stepClock -= term * t;
      triangle.stepClock = triangle.stepClock;
      triangle.step = (triangle.step + t) % 32;
    }

    return v;
  }

  createNoise(noise, clockPerSample, clockPerFreq) {
    var pause = 0;
    var vol = 16;

    if(!noise.enable)
      return 0;
    if(noise.lengthCounter == 0)
      pause = 1;

    // Length Counter
    if(noise.lengthCounterEnable) {
      noise.lengthClock = noise.lengthClock + clockPerSample;
      while(noise.lengthClock > this.clockPerFrame) {
        noise.lengthClock = noise.lengthClock - this.clockPerFrame;
        if(noise.lengthCounter > 0)
          noise.lengthCounter--;
      }
    }

    // Envelope
    if(noise.envelopeEnable) {
      var decayClock = (this.clockPerFrame / 4.0) * (noise.envelopePeriod + 1);
      noise.envelopeClock += clockPerSample;
      while(noise.envelopeClock > decayClock) {
        noise.envelopeClock -= decayClock;

        if(noise.envelopeVolume > 0) {
          noise.envelopeVolume--;
        } else if(!noise.lengthCounterEnable) {
          noise.envelopeVolume = 0xf;
        } else {
          noise.envelopeVolume = 0;
        }
      }
    }
    vol = noise.envelopeVolume;

    pause |= Number(noise.timerPeriod == 0);
    if(pause)
      return 0;
    
    noise.stepClock += clockPerFreq;
    var v = 0.5 - (noise.shiftReg >> 14);
    v *= vol / 16;

    var term = noise.timerPeriod + 1;
    while(noise.stepClock >= term) {
      noise.stepClock -= term;
      noise.stepClock = noise.stepClock;
      var t = noise.shiftReg;
      if(noise.mode)
        noise.shiftReg = ((t<<1)|(((t>>14)^(t>>8))&1))&0x7fff;
      else
        noise.shiftReg = ((t<<1)|(((t>>14)^(t>>13))&1))&0x7fff;
    }
    return v;
  }

  createDmc(dmc, clockPerFreq) {
    if(!dmc.enable)
      return ((dmc.deltaCounter<<1) + dmc.dacLsb) / 32;

    dmc.clock += clockPerFreq;
    while(dmc.clock > dmc.timerPeriod) {
      dmc.clock -= dmc.timerPeriod;
      if(!dmc.shiftCounter) {
        if(dmc.lengthCounter == 0) {
          if(dmc.loop&1) {
            dmc.addr = dmc.sampleAddr;
            dmc.lengthCounter = dmc.sampleLength;
          } else {
            dmc.enable = 0;
            if(dmc.loop == 2) {
              dmc.irq = false;
            }
            return ((dmc.deltaCounter<<1) + dmc.dacLsb) / 32;
          }
        }

        dmc.shiftCounter = 8;
        dmc.shiftReg = this.nes.mbc.read(dmc.addr);
        if(dmc.addr = 0xffff)
          dmc.addr = 0x8000;
        else
          dmc.addr++;
        dmc.lengthCounter--;
      }

      if(dmc.shiftReg & 1) {
        if(dmc.deltaCounter < 0x3f)
          dmc.deltaCounter++;
      } else {
        if(dmc.deltaCounter > 0)
          dmc.deltaCounter--;
      }
      dmc.deltaCounter &= 0x3f;
      dmc.shiftCounter--;
      dmc.shiftReg >>= 1;
    }

    return ((dmc.deltaCounter<<1) + dmc.dacLsb) / 32;
  }

  createSound(sound) {
    var curClock = this.nes.cpu.masterClock();
    var clockPerSample = (curClock - this.preClock) / sound.sample;
    var clockPerFreq = this.cpuClock / sound.freq;

    for(var i=0; i<sound.sample; i++) {
      var samplePos = (curClock - this.preClock) * i / sound.sample + this.preClock;

      while(!this.sampleQueue.empty() && this.sampleQueue.front().clock <= samplePos) {
        var s = this.sampleQueue.pop();
        this.realWrite(this.channels, s.addr, s.data);
      }

      var v = 0;
      v += this.createPulse(this.pulse1, clockPerSample, clockPerFreq);
      v += this.createPulse(this.pulse2, clockPerSample, clockPerFreq);
      v += this.createNoise(this.noise, clockPerSample, clockPerFreq);
      v += this.createTriangle(this.triangle, clockPerSample, clockPerFreq);
      v += this.createDmc(this.dmc, clockPerFreq);
      sound.buf[i] = v / 5.0;
    }

    this.preClock = curClock;
  }
}

class Pulse {
  constructor() {
    this.enable = 0;

    this.timerPeriod = 0;
    this.lengthCounterEnable = 0;
    this.lengthCounter = 0;
    this.lengthClock = 0;

    this.envelopeVolume = 0;
    this.envelopePeriod = 0;
    this.envelopeEnable = 0;
    this.envelopeClock = 0;

    this.sweepEnable = 0;
    this.sweepPeriod = 0;
    this.sweepNegate = 0;
    this.sweepShift = 0;
    this.sweepClock = 0;
    this.sweepPausing = 0;

    this.dutyCycle = 0;

    this.step = 0;
    this.stepClock = 0;
  }
}

class Triangle {
  constructor() {
    this.enable = 0;

    this.timerPeriod = 0;
    this.lengthCounterEnable = 0;
    this.lengthCounter = 0;
    this.lengthClock = 0;

    this.dutyCycle = 0;

    this.linearCounter = 0;
    this.linearCounterCtl = 0;
    this.counterReloadValue = 0;
    this.counterReloadFlag = 0;
    this.linearClock = 0;

    this.step = 0;
    this.stepClock = 0;
  }
}

class Noise {
  constructor() {
    this.enable = 0;

    this.timerPeriod = 0;
    this.lengthCounterEnable = 0;
    this.lengthCounter = 0;
    this.lengthClock = 0;

    this.envelopeVolume = 0;
    this.envelopePeriod = 0;
    this.envelopeEnable = 0;
    this.envelopeClock = 0;

    this.mode = 0;
    this.step = 0;
    this.stepClock = 0;
    this.shiftReg = 0;
  }
}

class DMC {
  constructor() {
    this.enable = 0;
    this.irq = 0;

    this.loop = 0;
    this.timerPeriod = 0;
    this.clock = 0;

    this.deltaCounter = 0;
    this.lengthCounter = 0;
    this.sampleLength = 0;
    this.addr = 0;
    this.sampleAddr = 0;
    this.shiftReg = 0;
    this.shiftCounter = 0;
    this.dacLsb = 0;
  }
}

class Sample {
  constructor(clock, addr, data) {
    this.clock = clock;
    this.addr = addr;
    this.data = data;
  }
}
