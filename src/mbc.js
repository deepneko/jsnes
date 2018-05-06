export class Mbc {
  constructor(nes) {
    this._nes = nes;
    this.rom = null;
    this.vrom = null;
    this.sram = null;
    this.vram = null;

    this.rom_page = new Array(4);
    this.chr_page = new Array(8);
    this.is_vram = false;
    this.ram = new Array(0x800);
    console.log("constructor Mbc", this._nes);
  }

  reset() {
    this.ram.fill(0);
    this.rom = this._nes._rom.rom_dat;
    this.vrom = this._nes._rom.chr_dat;
    this.sram = this._nes._rom.sram;
    this.vram = this._nes._rom.vram;

    // ToDo: prg_page_cnt
    for(var i=0; i<4; i++)
      this.rom_page[i] = this.rom.slice(0x2000*i, 0x2000*(i+1));

    // ToDo: chr_page_cnt
    if(this.vrom) {
      for(i=0; i<8; i++)
        this.chr_page[i] = this.rom.slice(0x400*i, 0x400*(i+1));
      this.is_vram = false;
    } else {
      for(i=0; i<8; i++)
        this.chr_page[i] = this.vram.slice(0x400*i, 0x400*(i+1));
      this.is_vram = true;
    }
  }

  read(addr) {
    // console.log("mbc read addr", addr, (addr>>11).toString(16));

    switch(addr >> 11) {
    case 0x00:
    case 0x01:
    case 0x02:
    case 0x03:
      return this.ram[addr&0x7FF]; // CPU RAM: 0x0000 - 0x1FFFF

    case 0x04:
    case 0x05:
    case 0x06:
    case 0x07:
      return this._nes._regs.read(addr); // CPU Registers: 0x2000 - 0x3FFF

    case 0x08:
    case 0x09:
    case 0x0A:
    case 0x0B:
      if(addr < 0x4020)
        return this._nes._regs.read(addr); // CPU Registers: 0x4000 - 0x401F
      return 0; // CPU Expansion ROM: 0x4020 - 0x5FFF

    case 0x0C:
    case 0x0D:
    case 0x0E:
    case 0x0F:
      if(this.sram_enable)
        return this.sram[addr&0x1fff]; // CPU SRAM: 0x6000 - 0x7FFF 
      return 0;

    case 0x10:
    case 0x11:
    case 0x12:
    case 0x13:
      return this.rom_page[0][addr&0x1FFF]; // CPU PRG-ROM: 0x8000 - 0x9FFF

    case 0x14:
    case 0x15:
    case 0x16:
    case 0x17:
      return this.rom_page[1][addr&0x1FFF]; // CPU PRG-ROM: 0xA000 - 0xBFFF

    case 0x18:
    case 0x19:
    case 0x1A:
    case 0x1B:
      return this.rom_page[2][addr&0x1FFF]; // CPU PRG-ROM: 0xC000 - 0xDFFF

    case 0x1C:
    case 0x1D:
    case 0x1E:
    case 0x1F:
      return this.rom_page[3][addr&0x1FFF]; // CPU PRG-ROM: 0xE000 - 0xFFFF
    }
  }

  write(addr, dat) {
    switch(addr >> 11) {
    case 0x00:
    case 0x01:
    case 0x02:
    case 0x03:
      this.ram[addr&0x7FF] = dat; // CPU RAM: 0x0000 - 0x1FFFF
      break;

    case 0x04:
    case 0x05:
    case 0x06:
    case 0x07:
      this._nes._regs.write(addr, dat); // CPU Registers: 0x2000 - 0x3FFF
      break;

    case 0x08:
    case 0x09:
    case 0x0A:
    case 0x0B:
      if(addr < 0x4020)
        this._nes._regs.write(addr, dat); // CPU Registers: 0x4000 - 0x401F
      else if(this._nes._mapper)
        this._nes._mapper.write(addr, dat); // CPU Expansion ROM: 0x4020 - 0x5FFF
      break;

    case 0x0C:
    case 0x0D:
    case 0x0E:
    case 0x0F:
      if(this.sram_enable)
        this.sram[addr&0x1fff] = dat; // CPU SRAM: 0x6000 - 0x7FFF 
      else if(this._nes._mapper)
        this._nes._mapper.write(addr, dat);
      break;

    case 0x10:
    case 0x11:
    case 0x12:
    case 0x13:
    case 0x14:
    case 0x15:
    case 0x16:
    case 0x17:
    case 0x18:
    case 0x19:
    case 0x1A:
    case 0x1B:
    case 0x1C:
    case 0x1D:
    case 0x1E:
    case 0x1F:
      if(this._nes._mapper)
        this._nes._mapper.write(addr, dat); // 0x8000 - 0xFFFF
      break;
    }
  }

  read_chr_rom(addr) {
    return this.chr_rom_page[(addr>>10)&7][addr&0x3ff];
  }

  write_chr_rom(addr, dat) {
    this.chr_rom_page[(addr>>10)&7][addr&0x3ff] = dat;
  }
}
