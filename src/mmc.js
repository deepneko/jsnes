import * as util from './util.js'

export class MMC {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;
    this.sram = null;

    this.prg_bank = new Array(4);
    this.chr_bank = new Array(8);
    this.sram_enable = false;
    this.ram = new Array(0x800);

    console.log("constructor MMC", this.nes);
  }

  reset() {
    this.ram.fill(0);
    this.sram = this.nes.rom.sram;
    this.sram_enable = true;
  }

  read_chr(addr) {
    return this.nes.mapper.read_chr(addr);
  }

  write_chr(addr, data) {
    this.nes.mapper.write_chr(addr, data);
  }

  read(addr) {
    switch(true) {
    case addr < 0x2000: // CPU RAM: 0x0000 - 0x1FFF
      return this.ram[addr&0x7FF];

    case addr < 0x4020: // CPU Registers: 0x4000 - 0x401F
      return this.nes.reg.read(addr);

    case addr < 0x6000: // CPU Expansion ROM: 0x4020 - 0x5FFF
      return 0;

    case addr < 0x8000: // SRAM: 0x6000 - 0x7FFF
      if(this.sram_enable)
        return this.sram[addr&0x1fff];
      return 0;

    case addr <= 0xFFFF:
      return this.nes.mapper.read(addr);
    }

    return 0;
  }

  write(addr, data) {
    switch(true) {
    case addr < 0x2000: // CPU RAM: 0x0000 - 0x1FFF
      this.ram[addr&0x7FF] = data;
      break;

    case addr < 0x4020: // CPU Registers: 0x2000 - 0x401F
      this.nes.reg.write(addr, data);
      break;

    case addr < 0x6000:
      this.nes.mapper.write(addr, data);
      break;

    case addr < 0x8000: // SRAM: 0x6000 - 0x7FFF
      if(this.sram_enable)
        this.sram[addr&0x1fff] = data;
      else
        this.nes.mapper.write(addr, data);
      break;

    case addr <= 0xFFFF:
      this.nes.mapper.write(addr, data);
      break;
    }
  }
}

