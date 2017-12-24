import * as util from "../util.js"

export class MMC1 {
  constructor(nes) {
    this.nes = nes;
    this.ppu = nes.ppu;
    this.rom = nes.rom;

    this.prg_bank = this.rom.prg_rom;
    this.prg_bank_size = this.nes.rom.prg_rom_page_cnt;
    this.prg_bank_num = 0;
    this.prg_bank_sw = [0, 0x4000 * (16-1)];
    this.prg_kb = this.prg_bank_size * 16; //256 or 512 or 1024

    this.chr_bank = this.rom.chr_rom;
    this.chr_bank_size = Math.floor(this.chr_bank.length / 0x1000);
    this.chr_bank0 = 0;
    this.chr_bank1 = 0;
    this.chr_bank_sw = [0x1000, 0x1000];

    this.shift_reg = 0x10;
    this.control_reg = 0x0c;
    this.prg_mode = 0;
    this.chr_mode = 0;
    this.mirror = 0;
    this.select_256k_bank = 0;

    this.set_control(this.control_reg);
    this.update_prg_bank(0);

    console.log("MMC1", this);
  }

  update_prg_bank() {
    switch(this.prg_mode) {
    case 0: case 1:
      this.prg_bank_sw[0] = 0x4000 * ((this.prg_bank_num & 0x0e) | this.select_256k_bank);
      this.prg_bank_sw[1] = 0x4000 * ((this.prg_bank_num | 0x01) | this.select_256k_bank);
      break;
    case 2:
      this.prg_bank_sw[0] = 0;
      this.prg_bank_sw[1] = 0x4000 * (this.prg_bank_num | this.select_256k_bank);
      break;
    case 3:
      this.prg_bank_sw[0] = 0x4000 * (this.prg_bank_num | this.select_256k_bank);
      this.prg_bank_sw[1] = 0x4000 * ((this.prg_bank_size - 1) | this.select_256k_bank);
      break;
    }
  }

  update_chr_bank() {
    switch(this.chr_mode) {
    case 0:
      this.chr_bank_sw[0] = 0x1000 * (this.chr_bank0 & 0x0e);
      this.chr_bank_sw[1] = 0x1000 * (this.chr_bank0 | 0x01);
      break;
    case 1:
      this.chr_bank_sw[0] = 0x1000 * (this.chr_bank1);
      this.chr_bank_sw[1] = 0x1000 * (this.chr_bank1);
      break;
    }
  }

  set_control(data) {
    this.control_reg = data;
    this.chr_mode = (data>>4) & 1;
    this.prg_mode = (data>>2) & 3;
    this.mirror = data & 3;
  }

  set_mirroring() {
    switch(this.mirror) {
    case 0:
      this.ppu.change_mirroring(this.ppu.MIRROR_TYPE.SINGLE_SCREEN0);
      break;
    case 1:
      this.ppu.change_mirroring(this.ppu.MIRROR_TYPE.SINGLE_SCREEN1);
      break;
    case 2:
      this.ppu.change_mirroring(this.ppu.MIRROR_TYPE.VERTICAL);
      break;
    case 3:
      this.ppu.change_mirroring(this.ppu.MIRROR_TYPE.HORIZONTAL);
      break;
    }
  }

  read(addr) {
    var bank = Math.floor((addr-0x8000) / 0x4000);
    var offset = (addr-0x8000) % 0x4000;
    return this.prg_bank[this.prg_bank_sw[bank] + offset];
  }

  write(addr, data) {
    if(data & 0x80) {
      this.shift_reg = 0x10;
      return;
    }
    
    var shift_full = this.shift_reg & 1;
    this.shift_reg >>= 1;
    this.shift_reg |= ((data&1) << 4);

    if(shift_full) {
      //if(this.nes.debug)
      //  util.log(this.nes, "mmc1 write:" + util.to_hex(addr) + ":" + util.to_hex(this.shift_reg));

      switch(true) {
      case addr <= 0x9FFF:
        this.set_control(this.shift_reg);
        this.set_mirroring();
        break;

      case addr <= 0xBFFF:
        if(this.prg_kb == 512) {
          this.select_256k_bank = ((this.shift_reg>>4) & 1)? 16:0;
          if(this.select_256k_bank)
            this.prg_bank_size = 32;
          else
            this.prg_bank_size = 16;
          this.update_prg_bank();
        }
        this.chr_bank0 = this.shift_reg & 0x0f;
        this.update_chr_bank();
        break;

      case addr <= 0xDFFF:
        this.chr_bank1 = this.shift_reg & 0x0f;
        this.update_chr_bank();
        break;

      case addr <= 0xFFFF:
        this.prg_bank_num = this.shift_reg & 0x0f;
        this.update_prg_bank();
        break;
      }

      this.shift_reg = 0x10;
    }
  }

  read_chr(addr) {
    var bank = Math.floor(addr / 0x1000);
    var offset = addr & 0xFFF;
    return this.chr_bank[this.chr_bank_sw[bank] + offset];
  }

  write_chr(addr, data) {
    var bank = Math.floor(addr / 0x1000);
    var offset = addr & 0xFFF;
    this.chr_bank[this.chr_bank_sw[bank] + offset] = data;
  }
}

