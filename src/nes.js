import { MMC, } from './mmc.js'
import { CPU, } from './cpu.js'
import { APU, } from './apu.js'
import { PPU, } from './ppu.js'
import { Register, } from './register.js'
import { Rom, } from './rom.js'
import { Screen, Sound, Joypad } from './output.js'
import { NRom, } from './mapper/nrom.js'
import { CNRom, } from './mapper/cnrom.js'
import { UNRom, } from './mapper/unrom.js'
import { MMC1, } from './mapper/mmc1.js'
import * as util from "./util.js"

export class NES {
  constructor(output) {
    this.output = output;
    this.mapper = null;
    this.scanlineCycles = Math.round(1.789773 / 262 / 60 * 1000000);
    this.joypad0 = new Joypad(
        ['KeyL', 'KeyK', 'Space', 'Enter', 
         'KeyW', 'KeyS', 'KeyA', 'KeyD']
         );
    this.joypad1 = new Joypad(
        ['Comma', 'Period', 'ShiftLeft', 'ShiftRight',
         'KeyF', 'KeyV', 'KeyC', 'KeyB']
         );

    this.rom = new Rom(this);
    this.mmc = new MMC(this);
    this.cpu = new CPU(this);
    this.apu = new APU(this);
    this.ppu = new PPU(this);
    this.reg = new Register(this);

    this.log = "";
    this.debug = false; 
    this.quit = false;

    console.log("constructor NES", this);
  }

  reset() {
    this.rom.reset();
    this.mmc.reset();

    switch(this.rom.mapperNum) {
    case 0: this.mapper = new NRom(this); break; //NROM
    case 1: this.mapper = new MMC1(this); break; //MMC1
    case 2: this.mapper = new UNRom(this); break; //UNROM
    case 3: this.mapper = new CNRom(this); break; //CNROM
    }

    this.cpu.reset();
    this.apu.reset();
    this.ppu.reset();
    this.reg.reset();
  }

  load(file) {
    if(!this.rom.load(file))
      return false;
    return true;
  }

  frame() {
    var screen = new Screen(256, 240);
    var sound = this.output.newSound();

    this.joypad0.input();
    this.joypad1.input();

    if(sound) {
      this.apu.createSound(sound);
      this.output.writeSound(sound);
    }

    this.reg.clearVblank();
    this.reg.initFrame();

    // Visible scanlines 0-239
    for(var i=0; i<240; i++) {
      this.reg.copyX();
      this.ppu.rendering(i, screen);
      this.ppu.spriteEvaluation(i);

      this.cpu.run(this.scanlineCycles);
      this.reg.incrementY();
    }

    this.reg.invokeIrq();

    // Post-render scanline 240
    this.cpu.run(this.scanlineCycles);
    i++;

    // VBlank scanlines started 241
    this.reg.setVblank();
    this.cpu.run(0);
    this.reg.setVblank();
    this.reg.invokeNmi();
    this.cpu.run(this.scanlineCycles);
    i++;

    // VBlank scanlines 242-261
    for(i=242; i<262; i++) {
      this.cpu.run(this.scanlineCycles);
    }

    screen.pixels = [].concat.apply([], screen.pixels);
    this.output.writeScreen(screen);
  }
}

