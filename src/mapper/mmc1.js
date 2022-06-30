import * as util from "../util.js"

export class MMC1 {
  constructor(nes) {
    this.nes = nes;
    this.ppu = nes.ppu;
    this.rom = nes.rom;

    this.prgBank = this.rom.prgRom;
    this.prgBankSize = this.nes.rom.prgRomPageCnt;
    this.prgBankNum = 0;
    this.prgBankSw = [0, 0x4000 * (16-1)];
    this.prgKb = this.prgBankSize * 16; //256 or 512 or 1024

    this.chrBank = this.rom.chrRom;
    this.chrBankSize = Math.floor(this.chrBank.length / 0x1000);
    this.chrBank0 = 0;
    this.chrBank1 = 0;
    this.chrBankSw = [0x1000, 0x1000];

    this.shiftReg = 0x10;
    this.controlReg = 0x0c;
    this.prgMode = 0;
    this.chrMode = 0;
    this.mirror = 0;
    this.select256kBank = 0;

    this.setControl(this.controlReg);
    this.updatePrgBank(0);

    console.log("MMC1", this);
  }

  updatePrgBank() {
    switch(this.prgMode) {
    case 0: case 1:
      this.prgBankSw[0] = 0x4000 * ((this.prgBankNum & 0x0e) | this.select256kBank);
      this.prgBankSw[1] = 0x4000 * ((this.prgBankNum | 0x01) | this.select256kBank);
      break;
    case 2:
      this.prgBankSw[0] = 0;
      this.prgBankSw[1] = 0x4000 * (this.prgBankNum | this.select256kBank);
      break;
    case 3:
      this.prgBankSw[0] = 0x4000 * (this.prgBankNum | this.select256kBank);
      this.prgBankSw[1] = 0x4000 * ((this.prgBankSize - 1) | this.select256kBank);
      break;
    }
  }

  updateChrBank() {
    switch(this.chrMode) {
    case 0:
      this.chrBankSw[0] = 0x1000 * (this.chrBank0 & 0x0e);
      this.chrBankSw[1] = 0x1000 * (this.chrBank0 | 0x01);
      break;
    case 1:
      this.chrBankSw[0] = 0x1000 * (this.chrBank1);
      this.chrBankSw[1] = 0x1000 * (this.chrBank1);
      break;
    }
  }

  setControl(data) {
    this.controlReg = data;
    this.chrMode = (data>>4) & 1;
    this.prgMode = (data>>2) & 3;
    this.mirror = data & 3;
  }

  setMirroring() {
    switch(this.mirror) {
    case 0:
      this.ppu.changeMirroring(this.ppu.MIRROR_TYPE.SINGLE_SCREEN0);
      break;
    case 1:
      this.ppu.changeMirroring(this.ppu.MIRROR_TYPE.SINGLE_SCREEN1);
      break;
    case 2:
      this.ppu.changeMirroring(this.ppu.MIRROR_TYPE.VERTICAL);
      break;
    case 3:
      this.ppu.changeMirroring(this.ppu.MIRROR_TYPE.HORIZONTAL);
      break;
    }
  }

  read(addr) {
    var bank = Math.floor((addr-0x8000) / 0x4000);
    var offset = (addr-0x8000) % 0x4000;
    return this.prgBank[this.prgBankSw[bank] + offset];
  }

  write(addr, data) {
    if(data & 0x80) {
      this.shiftReg = 0x10;
      return;
    }
    
    var shiftFull = this.shiftReg & 1;
    this.shiftReg >>= 1;
    this.shiftReg |= ((data&1) << 4);

    if(shiftFull) {
      switch(true) {
      case addr <= 0x9FFF:
        this.setControl(this.shiftReg);
        this.setMirroring();
        break;

      case addr <= 0xBFFF:
        if(this.prgKb == 512) {
          this.select256kBank = ((this.shiftReg>>4) & 1)? 16:0;
          if(this.select256kBank)
            this.prgBankSize = 32;
          else
            this.prgBankSize = 16;
          this.updatePrgBank();
        }
        this.chrBank0 = this.shiftReg & 0x0f;
        this.updateChrBank();
        break;

      case addr <= 0xDFFF:
        this.chrBank1 = this.shiftReg & 0x0f;
        this.updateChrBank();
        break;

      case addr <= 0xFFFF:
        this.prgBankNum = this.shiftReg & 0x0f;
        this.updatePrgBank();
        break;
      }

      this.shiftReg = 0x10;
    }
  }

  readChr(addr) {
    var bank = Math.floor(addr / 0x1000);
    var offset = addr & 0xFFF;
    return this.chrBank[this.chrBankSw[bank] + offset];
  }

  writeChr(addr, data) {
    var bank = Math.floor(addr / 0x1000);
    var offset = addr & 0xFFF;
    this.chrBank[this.chrBankSw[bank] + offset] = data;
  }
}

