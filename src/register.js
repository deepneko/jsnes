import * as inst from './instruction.js'
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
    console.log("constructor Regs", this);
  }

  reset() {
    this.execute_nmi = 0;
    this.sprite_size = 0;
    this.bg_pattern = 0;
    this.sprite_pattern = 0;
    this.ppu_addr_inc = 0;
    this.bg_color = 0;
    this.bg_visibility = 0;
    this.sprite_visibility = 0;
    this.bg_clipping = 0;
    this.sprite_clipping = 0;
    this.display_type = 0;
    this.vblank_occur = 0;
    this.sprite0_hit = 0;
    this.sprite_overflow = 0;
    this.vram_write_flag = 0;
    this.oamram_addr = 0;
    this.ppuio_buf = 0;
    this.ppu_t = 0;
    this.ppu_v = 0;
    this.ppu_x = 0;
    this.ppu_w = 0;
  }

  set_vblank() {
    this.vblank_occur = 1;
    this.sprite0_hit = 0;
  }

  clear_vblank() {
    this.vblank_occur = 0;
    this.cpu.set_intr(null);
  }

  invoke_irq() {
    if((this.apu.frame_irq & 0xC0) == 0)
      this.cpu.set_intr(this.cpu.INTR.IRQ);
  }

  invoke_nmi() {
    if(this.execute_nmi)
      this.cpu.set_intr(this.cpu.INTR.NMI);
  }

  copy_x() {
    if(this.bg_visibility || this.sprite_visibility)
      this.ppu_v = (this.ppu_v&0xfbe0) | (this.ppu_t&0x041f);
  }

  copy_y() {
    if(this.bg_visibility || this.sprite_visibility)
      this.ppu_v = (this.ppu_v&0x841f) | (this.ppu_t&0x7be0)
  }

  increment_x() {
    if((this.ppu_v&0x1f) == 0x1f)
      this.ppu_v = (this.ppu_v&~0x1f) ^ 0x400;
    else
      this.ppu_v++;
  }

  increment_y() {
    if(this.bg_visibility || this.sprite_visibility) {
      if((this.ppu_v & 0x7000) != 0x7000) {
        this.ppu_v += 0x1000;
      } else {
        this.ppu_v &= ~0x7000;
        var y = (this.ppu_v & 0x03E0) >> 5;
        if(y == 29) {
          y = 0;
          this.ppu_v ^= 0x800;
        } else if(y == 31) {
          y = 0;
        } else {
          y++;
        }
        this.ppu_v = (this.ppu_v & ~0x03E0) | (y << 5)
      }
    }
  }

  read(addr) {
    switch(addr) {
    case 0x2000: // PPUCNT0 (W)
    case 0x2001: // PPUCNT1 (W)
      return 0;

    case 0x2002: // PPUSTAT (R)
      var ret = (this.vblank_occur << 7)
        | (this.sprite0_hit << 6)
        | (this.sprite_overflow << 5)
        | (this.vram_write_flag << 4);
      this.set_vblank(0, 1);
      this.ppu_w = 0;
      return ret;

    case 0x2003: // SPRADDR (W)
    case 0x2004: // SPRIO   (W)
    case 0x2005: // BGSCROL (W*2)
    case 0x2006: // PPUADDR (W*2)
      return 0;

    case 0x2007: // PPUIO   (R/W)
      var ret = this.ppuio_buf;
      var v = this.ppu_v;
      switch(true) {
      case v < 0x2000:
        this.ppuio_buf = this.mmc.read_chr(v);
        break;
      case v < 0x3f00:
        this.ppuio_buf = this.ppu.read(v);
        break;
      case v >= 0x3f00:
        // $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C
        if((v%4) == 0)
          v &= ~0x10;
        this.ppuio_buf = this.ppu.palette[v&0x1f];
        break;
      }

      this.ppu_v += this.ppu_addr_inc ? 32:1;
      return ret;

    case 0x4015:
      return this.apu.read(addr) | (((this.frame_irq&0xC0)==0)? 0x40:0);

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
      this.execute_nmi = (data>>7) & 1;
      this.ppu_master = (data>>6) & 1;
      this.sprite_size = (data>>5) & 1;
      this.bg_pattern = (data>>4) & 1;
      this.sprite_pattern = (data>>3) & 1;
      this.ppu_addr_inc = (data>>2) & 1;
      this.ppu_t = (this.ppu_t&0xf3ff) | ((data&3) << 10);
      break;

    case 0x2001: // PPUCNT1 (W)
      this.bg_color = data >> 5;
      this.sprite_visibility = (data>>4) & 1;
      this.bg_visibility = (data>>3) & 1;
      this.sprite_clipping = (data>>2) & 1;
      this.bg_clipping = (data>>1) & 1;
      this.display_type = data & 1;
      break;

    case 0x2002: // PPUSTAT (R)
      break;

    case 0x2003: // SPRADDR (W)
      this.oamram_addr = data;
      break;

    case 0x2004: // SPRIO   (W)
      this.ppu.oamram[this.oamram_addr++] = data;
      break;

    case 0x2005: // BGSCROL (W*2)
      if(!this.ppu_w) {
        this.ppu_t = (this.ppu_t&0xffe0) | (data>>3);
        this.ppu_x = data&7;
        this.ppu_w = 1;
      } else {
        this.ppu_t = (this.ppu_t&0xfc1f) | ((data>>3)<<5);
        this.ppu_t = (this.ppu_t&0x8fff) | ((data&7)<<12);
        this.ppu_w = 0;
      }
      break;

    case 0x2006: // PPUADDR (W*2)
      if(!this.ppu_w) {
        this.ppu_t = (this.ppu_t&0x80ff) | ((data&0x3f)<<8);
        this.ppu_w = 1;
      } else {
        this.ppu_t = (this.ppu_t&0xff00) | data;
        this.ppu_v = this.ppu_t;
        this.ppu_w = 0;
      }
      break;

    case 0x2007: // PPUIO   (R/W)
      var v = this.ppu_v;
      switch(true) {
      case v < 0x2000:
        this.mmc.write_chr(v, data);
        break;
      case v < 0x3f00:
        this.ppu.write(v, data);
        break;
      case v >= 0x3f00:
        // $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C
        if((v%4) == 0)
          v &= ~0x10;
        this.ppu.palette[v&0x1f] = data&0x3f;
        break;
      }
      this.ppu_v += this.ppu_addr_inc ? 32:1;
      break;

    case 0x4014: // SPRDMA  (W)
      for(var i=0; i<0x100; i++)
        this.ppu.oamram[i] = this.mmc.read((data<<8)|i);
      break;

    case 0x4016: // SPECIO1 (W)
      this.joypad0.strobe = data & 1;
      if(this.joypad0.strobe)
        this.joypad0.index = 0;
      break;

    case 0x4017:
      this.apu.frame_irq = data;
      break;

    default:
      if(addr >= 0x4000)
        this.apu.write(addr, data);
      break;
    }
  }
}

