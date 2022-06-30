export class CNRom {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;

    this.prgBank = new Array(2);
    this.prgBank[0] = this.rom.prgRom.slice(0, 0x4000);
    this.prgBank[1] = this.rom.prgRom.slice(0x4000, 0x8000);

    this.chrBank = this.rom.chrRom;
    this.bankSelect = 0;

    console.log("CNRom", this);
  }

  read(addr) {
    switch(true) {
    case addr >= 0xC000: // PRG-ROM: 0xC000 - 0xFFFF
      return this.prgBank[1][addr-0xC000];

    case addr >= 0x8000: // PRG-ROM: 0x8000 - 0xBFFF
      return this.prgBank[0][addr-0x8000];
    }

    return 0;
  }

  write(addr, data) {
    this.bankSelect = data & 3;
  }

  readChr(addr) {
    return this.chrBank[(this.bankSelect*0x2000) + addr];
  }

  writeChr(addr, data) {
    this.chrBank[(this.bankSelect*0x2000) + addr] = data;
  }
}

