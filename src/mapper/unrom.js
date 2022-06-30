export class UNRom {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;

    this.prgBank = this.rom.prgRom;
    this.bankNum = Math.floor(this.prgBank.length / 0x4000);
    this.prgBank1 = 0;
    this.prgBank2 = this.bankNum - 1;

    this.chrBank = this.rom.chrRom;

    console.log("UNRom", this);
  }

  read(addr) {
    switch(true) {
    case addr >= 0xC000: // PRG-ROM: 0xC000 - 0xFFFF
      return this.prgBank[(this.prgBank2*0x4000) + (addr-0xC000)];

    case addr >= 0x8000: // PRG-ROM: 0x8000 - 0xBFFF
      return this.prgBank[(this.prgBank1*0x4000) + (addr-0x8000)];
    }

    return 0;
  }

  write(addr, data) {
    this.prgBank1 = data % this.bankNum;
  }

  readChr(addr) {
    return this.chrBank[addr];
  }

  writeChr(addr, data) {
    this.chrBank[addr] = data;
  }
}

