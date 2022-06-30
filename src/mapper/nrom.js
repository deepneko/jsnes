export class NRom {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;

    this.prgBank = this.rom.prgRom;
    this.chrBank = this.rom.chrRom;

    console.log("NRom", this);
  }

  read(addr) {
    return this.prgBank[addr - 0x8000];
  }

  write(addr, data) {
  }

  readChr(addr) {
    return this.chrBank[addr];
  }

  writeChr(addr, data) {
    this.chrBank[addr] = data;
  }
}

