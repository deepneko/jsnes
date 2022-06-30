import * as util from './util.js'

export class Register {
  constructor(nes) {
    this.nes = nes;
    this.cpu = nes.cpu;
    this.ppu = nes.ppu;
    this.apu = nes.apu;
    this.mmc = nes.mmc;
    this.joypad0 = nes.joypad0;
    this.joypad1 = nes.joypad1;
    console.log("constructor Register", this);
  }

  reset() {
    this.executeNmi = 0;
    this.spriteSize = 0;
    this.bgPattern = 0;
    this.spritePattern = 0;
    this.ppuAddrInc = 0;
    this.bgColor = 0;
    this.bgVisibility = 0;
    this.spriteVisibility = 0;
    this.bgClipping = 0;
    this.spriteClipping = 0;
    this.displayType = 0;
    this.vblankStatus = 0;
    this.spriteZeroHit = 0;
    this.spriteOverflow = 0;
    this.oamAddr = 0;
    this.vram = 0;
    this.regT = 0;
    this.regV = 0;
    this.regX = 0;
    this.regW = 0;
  }

  setVblank() {
    this.vblankStatus = 1;
    this.spriteZeroHit = 0;
  }

  clearVblank() {
    this.vblankStatus = 0;
    this.cpu.setIntr(null);
  }

  initFrame() {
    if(this.bgVisibility || this.spriteVisibility)
      this.regV = this.regT;
  }

  invokeIrq() {
    if((this.apu.frameIrq & 0xC0) == 0)
      this.cpu.setIntr(this.cpu.INTR.IRQ);
  }

  invokeNmi() {
    if(!this.vblankStatus || this.executeNmi) {
      this.cpu.setIntr(this.cpu.INTR.NMI);
    }
  }

  copyX() {
    if(this.bgVisibility || this.spriteVisibility)
      this.regV = (this.regV&0xfbe0) | (this.regT&0x041f);
  }

  copyY() {
    if(this.bgVisibility || this.spriteVisibility)
      this.regV = (this.regV&0x841f) | (this.regT&0x7be0);
  }

  incrementX() {
    if((this.regV&0x1f) == 0x1f)
      this.regV = (this.regV&~0x1f) ^ 0x400;
    else
      this.regV++;
  }

  incrementY() {
    if(this.bgVisibility || this.spriteVisibility) {
      if((this.regV & 0x7000) != 0x7000) {
        this.regV += 0x1000;
      } else {
        this.regV &= ~0x7000;
        var y = (this.regV & 0x03E0) >> 5;
        if(y == 29) {
          y = 0;
          this.regV ^= 0x800;
        } else if(y == 31) {
          y = 0;
        } else {
          y++;
        }
        this.regV = (this.regV & ~0x03E0) | (y << 5)
      }
    }
  }

  read(addr) {
    switch(addr) {
    case 0x2000: // PPUCNT0 (W)
    case 0x2001: // PPUCNT1 (W)
      return 0;

    case 0x2002: // PPUSTAT (R)
      var ret = (this.vblankStatus << 7)
        | (this.spriteZeroHit << 6)
        | (this.spriteOverflow << 5);
      this.clearVblank();
      this.regW = 0;
      return ret;

    case 0x2003: // SPRADDR (W)
    case 0x2004: // SPRIO   (W)
    case 0x2005: // BGSCROL (W*2)
    case 0x2006: // PPUADDR (W*2)
      return 0;

    case 0x2007: // PPUIO   (R/W)
      var ret = this.vram;
      var v = this.regV;
      switch(true) {
      case v < 0x2000:
        this.vram = this.mmc.readChr(v);
        break;
      case v < 0x3f00:
        this.vram = this.ppu.read(v);
        break;
      case v >= 0x3f00:
        if((v%4) == 0)
          v &= ~0x10;
        this.vram = this.ppu.palette[v&0x1f];
        break;
      }

      this.regV += this.ppuAddrInc ? 32:1;
      return ret;

    case 0x4015:
      return this.apu.read(addr) | (((this.apu.frameIrq&0xC0)==0)? 0x40:0);

    case 0x4016: // SPECIO1  (RW)
      var ret = 0;
      if(this.joypad0.index < 8 && this.joypad0.data[this.joypad0.index])
        ret = 1;
      this.joypad0.index++;

      if(this.joypad0.strobe)
        this.joypad0.index = 0;

      return ret;

    case 0x4017: // SPECIO2  (RW)
      var ret = 0;
      if(this.joypad1.index < 8 && this.joypad1.data[this.joypad1.index])
        ret = 1;
      this.joypad1.index++;

      if(this.joypad1.strobe)
        this.joypad1.index = 0;

      return ret;

    default:
      if(addr >= 0x4000)
        return this.apu.read(addr);
      break;
    }

    return 0;
  }

  write(addr, data) {
    switch(addr) {
    case 0x2000: // PPUCNT0 (W)
      this.executeNmi = (data>>7) & 1;
      this.masterSlave = (data>>6) & 1;
      this.spriteSize = (data>>5) & 1;
      this.bgPattern = (data>>4) & 1;
      this.spritePattern = (data>>3) & 1;
      this.ppuAddrInc = (data>>2) & 1;
      this.regT = (this.regT&0xf3ff) | ((data&3) << 10);
      break;

    case 0x2001: // PPUCNT1 (W)
      this.bgColor = data >> 5;
      this.spriteVisibility = (data>>4) & 1;
      this.bgVisibility = (data>>3) & 1;
      this.spriteClipping = (data>>2) & 1;
      this.bgClipping = (data>>1) & 1;
      this.displayType = data & 1;
      break;

    case 0x2002: // PPUSTAT (R)
      break;

    case 0x2003: // SPRADDR (W)
      this.oamAddr = data;
      break;

    case 0x2004: // SPRIO   (W)
      this.ppu.oamRam[this.oamAddr++] = data;
      break;

    case 0x2005: // BGSCROL (W*2)
      if(!this.regW) {
        this.regT = (this.regT&0xffe0) | (data>>3);
        this.regX = data&7;
        this.regW = 1;
      } else {
        this.regT = (this.regT&0xfc1f) | ((data>>3)<<5);
        this.regT = (this.regT&0x8fff) | ((data&7)<<12);
        this.regW = 0;
      }
      break;

    case 0x2006: // PPUADDR (W*2)
      if(!this.regW) {
        this.regT = (this.regT&0x80ff) | ((data&0x3f)<<8);
        this.regW = 1;
      } else {
        this.regT = (this.regT&0xff00) | data;
        this.regV = this.regT;
        this.regW = 0;
      }
      break;

    case 0x2007: // PPUIO   (R/W)
      var v = this.regV;
      switch(true) {
      case v < 0x2000:
        this.mmc.writeChr(v, data);
        break;
      case v < 0x3f00:
        this.ppu.write(v, data);
        break;
      case v >= 0x3f00:
        if((v%4) == 0)
          v &= ~0x10;
        this.ppu.palette[v&0x1f] = data&0x3f;
        break;
      }
      this.regV += this.ppuAddrInc ? 32:1;
      break;

    case 0x4014: // SPRDMA  (W)
      for(var i=0; i<0x100; i++)
        this.ppu.oamRam[i] = this.mmc.read((data<<8)|i);
      break;

    case 0x4016: // SPECIO1 (W)
      this.joypad0.strobe = data & 1;
      if(this.joypad0.strobe)
        this.joypad0.index = 0;
      break;

    case 0x4017:
      this.apu.frameIrq = data;
      break;

    default:
      if(addr >= 0x4000)
        this.apu.write(addr, data);
      break;
    }
  }
}
