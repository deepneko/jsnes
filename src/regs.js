import * as inst from './instruction.js'

export class Regs {
  constructor(nes) {
    this._nes = nes;
    this.nmi_enable = false;
    this.sprite_size = false;
    this.bg_pat_adr = false;
    this.sprite_pat_adr = false;
    this.ppu_adr_incr = false;
    this.name_tbl_adr = 0;
    this.bg_color = 0;
    this.bg_visible = false;
    this.sprite_visible = false;
    this.bg_clip = false;
    this.sprite_clip = false;
    this.color_display = false;
    this.is_vblank = false;
    this.sprite0_occur = false;
    this.sprite_over = false;
    this.vram_write_flag = false;
    this.sprram_adr = 0;
    this.ppu_adr_t = 0;
    this.ppu_adr_v = 0;
    this.ppu_adr_x = 0;
    this.ppu_adr_toggle = false;
    this.ppu_read_buf = 0;
    this.joypad_strobe = false;
    this.joypad_read_pos = [0, 0];
    this.joypad_sign = [0x1, 0x2];
    this.frame_irq = 0xFF;
  }

  reset() {
    this.nmi_enable = false;
    this.sprite_size = false;
    this.bg_pat_adr = false;
    this.sprite_pat_adr = false;
    this.ppu_adr_incr = false;
    this.name_tbl_adr = 0;
    this.bg_color = 0;
    this.bg_visible = false;
    this.sprite_visible = false;
    this.bg_clip = false;
    this.sprite_clip = false;
    this.color_display = false;
    this.is_vblank = false;
    this.sprite0_occur = false;
    this.sprite_over = false;
    this.vram_write_flag = false;
    this.sprram_adr = 0;
    this.ppu_adr_t = 0;
    this.ppu_adr_v = 0;
    this.ppu_adr_x = 0;
    this.ppu_adr_toggle = false;
    this.ppu_read_buf = 0;
    this.joypad_strobe = false;
    this.joypad_read_pos = [0, 0];
    this.joypad_sign = [0x1, 0x2];
    this.frame_irq = 0xFF;
  }

  set_vblank(b, nmi) {
    this.is_vblank = b;
    if(nmi && (!this.is_vblank || this.nmi_enable))
      this._nes._cpu.set_nmi(this.is_vblank);
    if(this.is_vblank)
      this.sprite0_occur = false;
  }

  start_frame() {
    if(this.bg_visible || this.sprite_visible)
      this.ppu_addr_v = this.ppu_addr_t;
  }

  start_scanline() {
    if(this.bg_visible || this.sprite_visible)
      this.ppu_adr_v = (this.ppu_adr_v&0xfbe0) | (this.ppu_adr_t&0x041f);
  }

  end_scanline() {
    if(this.bg_visible || this.sprite_visible) {
      if(((this.ppu_adr_v >> 12) & 7) == 7) {
        this.ppu_adr_v &= ~0x7000;
        if(((this.ppu_adr_v >> 5) & 0x1f) == 31)
          this.ppu_adr_v &= ~0x3e0;
        else
          this.ppu_adr_v += 0x20;
      } else
        this.ppu_adr_v += 0x1000;
    }
  }

  draw_enabled() {
    return this.sprite_visible | this.bg_visible;
  }

  set_input(dat) {
  }

  read(addr) {
    if(addr >= 0x4000) {
      switch(addr) {
      case 0x4016: // SPECIO1  (RW)
        // ToDo: Joypad
        return 0;
      case 0x4017: // SPECIO2  (RW)
        // ToDo: Joypad
        return 0;
      case 0x4015:
        // ToDo: APU
        return 0;
      default:
        // ToDo: APU
        return 0;
      }
    }

    switch(addr&7) {
    case 0: // PPUCNT0 (W)
    case 1: // PPUCNT1 (W)
      return 0;

    case 2: // PPUSTAT (R)
      var ret = ((this.is_vblank?1:0) << 7) | ((this.sprite0_occur?1:0) << 6) | ((this.sprite_over?1:0) << 5) | ((this.vram_write_flag?1:0) << 4);
      this.set_vblank(false, true);
      this.ppu_adr_toggle = false;
      return ret;

    case 3: // SPRADDR (W)
    case 4: // SPRIO   (W)
    case 5: // BGSCROL (W)
    case 6: // PPUADDR (W)
      return 0;

    case 7: // PPUIO   (R/W)
      var ret = this.ppu_read_buf;
      this.ppu_read_buf = this.read_2007();
      return ret;
    }

    return 0;
  }

  read_2007() {
    var addr = this.ppu_adr_v & 0x3fff;
    this.ppu_adr_v += this.ppu_adr_incr ? 32:1;

    if(addr < 0x2000)
      return this._nes._mbc.read_chr_rom(addr);
    else if(addr < 0x3f00)
      return this._nes._ppu.get_name_page()[(addr>>10)&3][addr&0x3ff];

    if((addr&3) == 0)
      addr &= ~0x10;
    return this._nes._ppu.get_palette()[addr&0x1f];
  }

  write(addr, dat) {
    if(addr >= 0x4000) {
      switch(addr) {
      case 0x4014: // SPRDMA  (W)
        var sprram = this._nes._ppu.get_sprite_rom();
        for(var i=0; i<0x100; i++)
          sprram[i] = this._nes._mbc.read((dat<<8)|i);
        break;
      case 0x4016: // SPECIO1 (W)
        // ToDo: Joypad
        break;
      case 0x4017: // SPECIO2 (R)
        this.frame_irq = dat;
        break;
      default:
        // ToDo: APU
        break;
      }
    }

    switch(addr&7) {
    case 0: // PPUCNT0 (W)
      this.nmi_enable = inst._bit(this._nes._cpu, dat, 7);
      this.ppu_master = inst._bit(this._nes._cpu, dat, 6);
      this.sprite_size = inst._bit(this._nes._cpu, dat, 5);
      this.bg_pat_adr = inst._bit(this._nes._cpu, dat, 4);
      this.sprite_pat_adr = inst._bit(this._nes._cpu, dat, 3);
      this.ppu_adr_incr = inst._bit(this._nes._cpu, dat, 2);
      this.ppu_adr_t = (this.ppu_adr_t&0xf2ff) | ((dat&3) << 10);
      break;
    case 1: // PPUCNT1 (W)
      this.bg_color = dat >> 5;
      this.sprite_visible = inst._bit(this._nes._cpu, dat, 4);
      this.bg_visible = inst._bit(this._nes._cpu, dat, 3);
      this.sprite_clip = inst._bit(this._nes._cpu, dat, 2);
      this.bg_clip = inst._bit(this._nes._cpu, dat, 1);
      this.color_display = inst._bit(this._nes._cpu, dat, 0);
      break;
    case 2: // PPUSTAT (R)
      break;
    case 3: // SPRADDR (W)
      this.sprram_adr = dat;
      break;
    case 4: // SPRIO   (W)
      this._nes._ppu.get_sprite_ram()[this.sprram_adr++] = dat;
      break;
    case 5: // BGSCROL (W)
      this.ppu_adr_toggle = !this.ppu_adr_toggle;
      if(this.ppu_adr_toggle) {
        this.ppu_adr_t = (this.ppu_adr_t&0xffe0) | (dat>>3);
        this.ppu_adr_x = dat&7;
      } else {
        this.ppu_adr_t = (this.ppu_adr_t&0xfc1f) | ((dat>>3)<<5);
        this.ppu_adr_t = (this.ppu_adr_t&0x8fff) | ((dat&7)<<12);
      }
      break;
    case 6: // PPUADDR (W)
      this.ppu_adr_toggle = !this.ppu_adr_toggle;
      if(this.ppu_adr_toggle) {
        this.ppu_adr_t = (this.ppu_adr_t&0x00ff) | ((dat&0x3f)<<8);
      } else {
        this.ppu_adr_t = (this.ppu_adr_t&0x00ff) | dat;
        this.ppu_adr_v = this.ppu_adr_t;
      }
      break;
    case 7: // PPUIO   (R/W)
      this.write_2007(dat);
      break;
    }
  }

  write_2007(dat) {
    var addr = this.ppu_adr_v & 0x3fff;
    this.ppu_adr_v += this.ppu_adr_incr ? 32:1;
    if(addr < 0x2000)
      this._nes._mbc.write_chr_rom(addr, dat);
    else if(addr < 0x3f00)
      this._nes._ppu.get_name_page()[(addr>>10)&3][addr&0x3ff] = dat;
    else {
      if((addr&3) == 0)
        addr &= ~0x10;
      this._nes._ppu.get_pallete()[addr&0x1f] = dat&0x3f;
    }
  }
}
