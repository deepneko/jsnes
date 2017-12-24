export class CNRom {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;

    this.prg_bank = new Array(2);
    this.prg_bank[0] = this.rom.prg_rom.slice(0, 0x4000);
    this.prg_bank[1] = this.rom.prg_rom.slice(0x4000, 0x8000);

    this.chr_bank = this.rom.chr_rom;
    this.bank_select = 0;

    console.log("CNRom", this);
  }

  read(addr) {
    switch(true) {
    case addr >= 0xC000: // PRG-ROM: 0xC000 - 0xFFFF
      return this.prg_bank[1][addr-0xC000];

    case addr >= 0x8000: // PRG-ROM: 0x8000 - 0xBFFF
      return this.prg_bank[0][addr-0x8000];
    }

    return 0;
  }

  write(addr, data) {
    this.bank_select = data & 3;
  }

  read_chr(addr) {
    return this.chr_bank[(this.bank_select*0x2000) + addr];
  }

  write_chr(addr, data) {
    this.chr_bank[(this.bank_select*0x2000) + addr] = data;
  }
}

