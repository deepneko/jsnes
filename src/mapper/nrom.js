export class NRom {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;

    this.prg_bank = this.rom.prg_rom;
    this.chr_bank = this.rom.chr_rom;

    console.log("NRom", this);
  }

  read(addr) {
    return this.prg_bank[addr - 0x8000];
  }

  write(addr, data) {
  }

  read_chr(addr) {
    return this.chr_bank[addr];
  }

  write_chr(addr, data) {
    this.chr_bank[addr] = data;
  }
}

