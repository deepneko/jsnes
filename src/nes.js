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
    this.scanline_cycles = Math.round(1.789773 / 262 / 60 * 1000000);
    this.joypad0 = new Joypad(
        ['KeyL', 'KeyK', 'Space', 'Enter', 
         'KeyW', 'KeyS', 'KeyA', 'KeyD']
         );
    this.joypad1 = new Joypad(
        ['Comma', 'Period', 'ShiftLeft', 'ShiftRight',
         'KeyF', 'KeyV', 'KeyC', 'KeyB']
         );
    this.sound_toggle = 1;

    this.rom = new Rom(this);
    this.mmc = new MMC(this);
    this.cpu = new CPU(this);
    this.apu = new APU(this);
    this.ppu = new PPU(this);
    this.reg = new Register(this);

    this.log = "";
    this.debug = false;
    console.log("constructor NES", this);
  }

  reset() {
    this.rom.reset();
    this.mmc.reset();

    switch(this.rom.mapper_num) {
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
    var sound = new Sound(this.output);

    this.joypad0.input();
    this.joypad1.input();
    this.reg.clear_vblank();
    this.reg.copy_y();

    util.log(this, "now_playing:" + this.output.now_playing);
    if(!this.output.now_playing) {
      this.apu.gen_audio(sound);
      //this.apu.debug_out(sound);
      this.output.gen_sound(sound);
    }

    // Visible scanlines 0-239
    for(var i=0; i<240; i++) {
      if(this.debug)
        util.log(this, "frame i:" + util.to_hex(i));

      this.reg.copy_x();
      this.ppu.rendering(i, screen);
      this.ppu.sprite_evaluation(i);
      //if(this.ppu.debug)
      //  this.ppu.debug_oam_out();

      this.apu.sync();
      this.cpu.run(this.scanline_cycles);
      this.reg.increment_y();

      //if(this.ppu.debug)
      //  this.ppu.debug_out();
    }

    this.reg.invoke_irq();

    // Post-render scanline 240
    if(this.debug)
      util.log(this, "frame i:" + util.to_hex(i));
    //this.apu.sync();
    this.cpu.run(this.scanline_cycles);
    i++;

    // VBlank scanlines started 241
    if(this.debug)
      util.log(this, "frame i:" + util.to_hex(i));
    //this.apu.sync();
    this.reg.set_vblank();
    this.cpu.run(0);
    this.reg.invoke_nmi();
    this.cpu.run(this.scanline_cycles);
    i++;

    // VBlank scanlines 242-261
    for(i=242; i<262; i++) {
      if(this.debug)
        util.log(this, "frame i:" + util.to_hex(i));

      this.cpu.run(this.scanline_cycles);
    }

    screen.pixels = [].concat.apply([], screen.pixels);
    this.output.rendering(screen);
  }
}

