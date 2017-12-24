export class UNRom {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;

    this.prg_bank = this.rom.prg_rom;
    this.bank_num = Math.floor(this.prg_bank.length / 0x4000);
    this.prg_bank1 = 0;
    this.prg_bank2 = this.bank_num - 1;

    this.chr_bank = this.rom.chr_rom;

    console.log("UNRom", this);
  }

  read(addr) {
    switch(true) {
    case addr >= 0xC000: // PRG-ROM: 0xC000 - 0xFFFF
      return this.prg_bank[(this.prg_bank2*0x4000) + (addr-0xC000)];

    case addr >= 0x8000: // PRG-ROM: 0x8000 - 0xBFFF
      return this.prg_bank[(this.prg_bank1*0x4000) + (addr-0x8000)];
    }

    return 0;
  }

  write(addr, data) {
    this.prg_bank1 = data % this.bank_num;
  }

  read_chr(addr) {
    return this.chr_bank[addr];
  }

  write_chr(addr, data) {
    this.chr_bank[addr] = data;
  }
}

