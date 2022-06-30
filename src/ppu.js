import * as util from './util.js'

export class PPU {
  constructor(nes) {
    this.nes = nes;
    this.rom = nes.rom;
    this.mmc = nes.mmc;
    this.debug = false;

    this.oamRam = new Uint8Array(0x100);
    this.nameTables = new Uint8Array(0x1000);
    this.nameTable = new Array(4);
    for(var i=0; i<4; i++)
      this.nameTable[i] = (new Uint8Array(0x400)).fill(0);
    this.palette = new Uint8Array(0x20);
    this.lineBuf = new Uint8Array(0x100);
    this.bgRendered = new Array(0x100);
    this.spriteRendered = new Array(0x100);

    this.MIRROR_TYPE = { HORIZONTAL:0, VERTICAL:1, fourScreen:2, SINGLE_SCREEN0:3, SINGLE_SCREEN1:4 };

    /* Chris Covell */
    this.paletteData = [
      [0x80,0x80,0x80], [0x00,0x3D,0xA6], [0x00,0x12,0xB0], [0x44,0x00,0x96], 
      [0xA1,0x00,0x5E], [0xC7,0x00,0x28], [0xBA,0x06,0x00], [0x8C,0x17,0x00], 
      [0x5C,0x2F,0x00], [0x10,0x45,0x00], [0x05,0x4A,0x00], [0x00,0x47,0x2E], 
      [0x00,0x41,0x66], [0x00,0x00,0x00], [0x05,0x05,0x05], [0x05,0x05,0x05], 
      [0xC7,0xC7,0xC7], [0x00,0x77,0xFF], [0x21,0x55,0xFF], [0x82,0x37,0xFA], 
      [0xEB,0x2F,0xB5], [0xFF,0x29,0x50], [0xFF,0x22,0x00], [0xD6,0x32,0x00], 
      [0xC4,0x62,0x00], [0x35,0x80,0x00], [0x05,0x8F,0x00], [0x00,0x8A,0x55], 
      [0x00,0x99,0xCC], [0x21,0x21,0x21], [0x09,0x09,0x09], [0x09,0x09,0x09], 
      [0xFF,0xFF,0xFF], [0x0F,0xD7,0xFF], [0x69,0xA2,0xFF], [0xD4,0x80,0xFF], 
      [0xFF,0x45,0xF3], [0xFF,0x61,0x8B], [0xFF,0x88,0x33], [0xFF,0x9C,0x12], 
      [0xFA,0xBC,0x20], [0x9F,0xE3,0x0E], [0x2B,0xF0,0x35], [0x0C,0xF0,0xA4], 
      [0x05,0xFB,0xFF], [0x5E,0x5E,0x5E], [0x0D,0x0D,0x0D], [0x0D,0x0D,0x0D], 
      [0xFF,0xFF,0xFF], [0xA6,0xFC,0xFF], [0xB3,0xEC,0xFF], [0xDA,0xAB,0xEB], 
      [0xFF,0xA8,0xF9], [0xFF,0xAB,0xB3], [0xFF,0xD2,0xB0], [0xFF,0xEF,0xA6], 
      [0xFF,0xF7,0x9C], [0xD7,0xE8,0x95], [0xA6,0xED,0xAF], [0xA2,0xF2,0xDA], 
      [0x99,0xFF,0xFC], [0xDD,0xDD,0xDD], [0x11,0x11,0x11], [0x11,0x11,0x11], 
    ];

    /* AspiringSquire */
    /*
    this.paletteData = [
      [0x6c,0x6c,0x6c], [0x00,0x26,0x8e], [0x00,0x00,0xa8], [0x40,0x00,0x94],
      [0x70,0x00,0x70], [0x78,0x00,0x40], [0x70,0x00,0x00], [0x62,0x16,0x00],
      [0xba,0xba,0xba], [0x20,0x5c,0xdc], [0x38,0x38,0xff], [0x80,0x20,0xf0],
      [0xc0,0x00,0xc0], [0xd0,0x14,0x74], [0xd0,0x20,0x20], [0xac,0x40,0x14],
      [0x44,0x24,0x00], [0x34,0x34,0x00], [0x00,0x50,0x00], [0x00,0x44,0x44],
      [0x00,0x40,0x60], [0x00,0x00,0x00], [0x10,0x10,0x10], [0x10,0x10,0x10],
      [0x7c,0x54,0x00], [0x58,0x64,0x00], [0x00,0x88,0x00], [0x00,0x74,0x68],
      [0x00,0x74,0x9c], [0x20,0x20,0x20], [0x10,0x10,0x10], [0x10,0x10,0x10],
      [0xff,0xff,0xff], [0x4c,0xa0,0xff], [0x88,0x88,0xff], [0xc0,0x6c,0xff],
      [0xff,0x50,0xff], [0xff,0x64,0xb8], [0xff,0x78,0x78], [0xff,0x96,0x38],
      [0xff,0xff,0xff], [0xb0,0xd4,0xff], [0xc4,0xc4,0xff], [0xe8,0xb8,0xff],
      [0xff,0xb0,0xff], [0xff,0xb8,0xe8], [0xff,0xc4,0xc4], [0xff,0xd4,0xa8],
      [0xdb,0xab,0x00], [0xa2,0xca,0x20], [0x4a,0xdc,0x4a], [0x2c,0xcc,0xa4],
      [0x1c,0xc2,0xea], [0x58,0x58,0x58], [0x10,0x10,0x10], [0x10,0x10,0x10],
      [0xff,0xe8,0x90], [0xf0,0xf4,0xa4], [0xc0,0xff,0xc0], [0xac,0xf4,0xf0],
      [0xa0,0xe8,0xff], [0xc2,0xc2,0xc2], [0x20,0x20,0x20], [0x10,0x10,0x10] 
    ];
    */

    /* Loopy */
    /*
    this.paletteData = [
      [0x75,0x75,0x75], [0x27,0x1B,0x8F], [0x00,0x00,0xAB], [0x47,0x00,0x9F],
      [0x8F,0x00,0x77], [0xAB,0x00,0x13], [0xA7,0x00,0x00], [0x7F,0x0B,0x00],
      [0x43,0x2F,0x00], [0x00,0x47,0x00], [0x00,0x51,0x00], [0x00,0x3F,0x17],
      [0x1B,0x3F,0x5F], [0x00,0x00,0x00], [0x05,0x05,0x05], [0x05,0x05,0x05],
      [0xBC,0xBC,0xBC], [0x00,0x73,0xEF], [0x23,0x3B,0xEF], [0x83,0x00,0xF3],
      [0xBF,0x00,0xBF], [0xE7,0x00,0x5B], [0xDB,0x2B,0x00], [0xCB,0x4F,0x0F],
      [0x8B,0x73,0x00], [0x00,0x97,0x00], [0x00,0xAB,0x00], [0x00,0x93,0x3B],
      [0x00,0x83,0x8B], [0x11,0x11,0x11], [0x09,0x09,0x09], [0x09,0x09,0x09],
      [0xFF,0xFF,0xFF], [0x3F,0xBF,0xFF], [0x5F,0x97,0xFF], [0xA7,0x8B,0xFD],
      [0xF7,0x7B,0xFF], [0xFF,0x77,0xB7], [0xFF,0x77,0x63], [0xFF,0x9B,0x3B],
      [0xF3,0xBF,0x3F], [0x83,0xD3,0x13], [0x4F,0xDF,0x4B], [0x58,0xF8,0x98],
      [0x00,0xEB,0xDB], [0x66,0x66,0x66], [0x0D,0x0D,0x0D], [0x0D,0x0D,0x0D],
      [0xFF,0xFF,0xFF], [0xAB,0xE7,0xFF], [0xC7,0xD7,0xFF], [0xD7,0xCB,0xFF],
      [0xFF,0xC7,0xFF], [0xFF,0xC7,0xDB], [0xFF,0xBF,0xB3], [0xFF,0xDB,0xAB],
      [0xFF,0xE7,0xA3], [0xE3,0xFF,0xA3], [0xAB,0xF3,0xBF], [0xB3,0xFF,0xCF],
      [0x9F,0xFF,0xF3], [0xDD,0xDD,0xDD], [0x11,0x11,0x11], [0x11,0x11,0x11],
    ];
    */

    for(var i=0; i<0x40; i++) {
      this.paletteData[i].push(0xFF);
    }

    console.log("constructor PPU", this);
  }

  reset() {
    this.oamRam.fill(0);
    this.palette.fill(0);

    if(this.rom.fourScreen)
      this.changeMirroring(this.MIRROR_TYPE.fourScreen);
    else if(this.rom.mirroring == this.MIRROR_TYPE.HORIZONTAL)
      this.changeMirroring(this.MIRROR_TYPE.HORIZONTAL);
    else if(this.rom.mirroring == this.MIRROR_TYPE.VERTICAL)
      this.changeMirroring(this.MIRROR_TYPE.VERTICAL);
  }

  changeMirroring(type) {
    this.nameTables = [].concat.apply([], [this.nameTable[0], this.nameTable[1], this.nameTable[2], this.nameTable[3]]);

    switch(type) {
    case this.MIRROR_TYPE.HORIZONTAL:
      this.nameTable[0] = this.nameTables.slice(0, 0x400);
      this.nameTable[1] = this.nameTable[0];
      this.nameTable[2] = this.nameTables.slice(0x400, 0x800);
      this.nameTable[3] = this.nameTable[2];
      break;
    case this.MIRROR_TYPE.VERTICAL:
      this.nameTable[0] = this.nameTables.slice(0, 0x400);
      this.nameTable[1] = this.nameTables.slice(0x400, 0x800);
      this.nameTable[2] = this.nameTable[0];
      this.nameTable[3] = this.nameTable[1];
      break;
    case this.MIRROR_TYPE.fourScreen:
      this.nameTable[0] = this.nameTables.slice(0, 0x400);
      this.nameTable[1] = this.nameTables.slice(0x400, 0x800);
      this.nameTable[2] = this.nameTables.slice(0x800, 0xC00);
      this.nameTable[3] = this.nameTables.slice(0xC00, 0x1000);
      break;
    case this.MIRROR_TYPE.SINGLE_SCREEN0:
      this.nameTable[0] = this.nameTables.slice(0, 0x400);
      this.nameTable[1] = this.nameTable[0];
      this.nameTable[2] = this.nameTable[0];
      this.nameTable[3] = this.nameTable[0];
      break;
    }
  }

  read(addr) {
    return this.nameTable[(addr>>10)&3][addr&0x3ff];
  }

  write(addr, data) {
    this.nameTable[(addr>>10)&3][addr&0x3ff] = data;
  }

  rendering(line, screen) {
    this.bgRendered.fill(0);
    this.spriteRendered.fill(0);

    for(var i=0; i<256; i++)
      this.lineBuf[i] = this.palette[0];

    if(this.nes.reg.bgVisibility)
      this.bgRendering(line);

    if(this.nes.reg.spriteVisibility)
      this.spriteRendering(line);

    var pos = screen.width * line;
    for(var i=0; i<256; i++) {
      screen.pixels[pos+i] = this.paletteData[this.lineBuf[i]];
    }

    if(this.debug) {
      var str = "ppu lineBuf " + util.hex(line) + ":";
      for(var i=0; i<256; i++) {
        if(i%0x20 == 0)
          str += "\n";
        str += util.hex(this.lineBuf[i]) + ",";
      }
      util.log(this.nes, str);
    }
  }

  bgRendering(line) {
    var fineY = (this.nes.reg.regV >> 12) & 7;
    var patternAddr = this.nes.reg.bgPattern ? 0x1000:0x0000;
    var x = this.nes.reg.regX & 7;
    var inc = -x;

    for(var i=0; i<33; i++, inc+=8) {
      var v = this.nes.reg.regV;
      var tileAddr = 0x2000 | (v&0xfff);
      var tile = this.read(tileAddr);;

      var attrAddr = 0x23c0 | (v&0xc00) | ((v>>4)&0x38) | ((v>>2)&0x07);
      var shift = ((v>>4)&4) | (v&2);
      var attrByte = ((this.read(attrAddr)>>shift)&3)<<2;

      var lowTile = this.mmc.readChr(patternAddr+(tile*16)+fineY);
      var highTile = this.mmc.readChr(patternAddr+(tile*16)+fineY+8);

      for(var j=7; j>=0; j--) {
        var pos = inc + j;
        var tileBit = ((lowTile&1) | (highTile<<1)) & 3;

        if(pos >= 0 && pos < 0x100) {
          if(tileBit) {
            this.lineBuf[pos] = this.palette[tileBit|attrByte];
            this.bgRendered[pos] = 1;
          }
        }

        lowTile >>= 1;
        highTile >>= 1;
      }

      this.nes.reg.incrementX();
    }
  }

  spriteRendering(line) {
    var height = this.nes.reg.spriteSize? 16:8;
    var patternAddr = this.nes.reg.spritePattern? 0x1000:0x0000;

    for(var i=0; i<64; i++) {
      var y = this.oamRam[(i*4)+0] + 1;
      var tileIndex = this.oamRam[(i*4)+1];
      var attrByte = this.oamRam[(i*4)+2];
      var x = this.oamRam[(i*4)+3];

      var offset = line - y;
      if(offset < 0 || offset >= height)
        continue;

      var vFlip = (attrByte>>7) & 1;
      if(vFlip)
        offset = height - 1 - offset;

      var hFlip = (attrByte>>6) & 1;
      var start, end, inc;
      if(hFlip)
        start = 0, end = 8, inc = 1;
      else
        start = 7, end = -1, inc = -1;

      var bgPriority = (attrByte>>5) & 1;
      var upperBit = (attrByte&3) << 2;

      var tileAddr = 0;
      if(height == 16) {
        var index = tileIndex & ~1;
        var bank = tileIndex & 1;
        if(offset > 7) {
          index++;
          offset -= 8;
        }
        tileAddr = (index*16) + (bank*0x1000) + offset;
      } else {
        tileAddr = patternAddr + (tileIndex*16) + offset;
      }

      var lowTile = this.mmc.readChr(tileAddr);
      var highTile = this.mmc.readChr(tileAddr + 8);

      for(var j=start; j!=end; j+=inc) {
        if(!this.spriteRendered[x+j]) {
          var lowerBit = (lowTile&1) | ((highTile&1)<<1);
          if(lowerBit) {
            if(!bgPriority || !this.bgRendered[x+j]) {
              this.lineBuf[x+j] = this.palette[0x10|upperBit|lowerBit];
              this.spriteRendered[x+j] = 1;
            }
          }
        }

        lowTile >>= 1;
        highTile >>= 1;
      }
    }
  }

  spriteEvaluation(line) {
    if(this.nes.reg.spriteVisibility) {
      var y = this.oamRam[0] + 1;
      var tileIndex = this.oamRam[1];
      var attrByte = this.oamRam[2];
      var height = this.nes.reg.spriteSize? 16:8;
      var patternAddr = this.nes.reg.spritePattern? 0x1000:0x0000;

      var offset = line - y;
      if(offset >= 0 && offset < height) {
        if(attrByte&0x80)
          offset = height - 1 - offset;

        var tileAddr = 0;
        if(height == 16) {
          var index = tileIndex & ~1;
          var bank = tileIndex & 1;
          if(offset > 7) {
            index++;
            offset -= 8;
          }
          tileAddr = (index*16) + (bank*0x1000) + offset;
        } else {
          tileAddr = patternAddr + (tileIndex*16) + offset;
        }

        var lowTile = this.mmc.readChr(tileAddr);
        var highTile = this.mmc.readChr(tileAddr + 8);
        if(lowTile | highTile)
          this.nes.reg.spriteZeroHit = true;
      }
    }
  }

  debugNameTable() {
    var str = "nameTable dump:\n";
    for(var i=0; i<4; i++) {
      str += "[" + i + "]:";
      for(var j=0; j<0x400; j++) {
        if(j%0x28 == 0)
          str += "\n";
        str += util.hex(this.nameTable[i][j]).padStart(2, "0") + ",";
      }
      str += "\n";
    }
    util.log(this.nes, str);
    util.log(this.nes, "palette:" + this.palette);
  }

  debugOamRam() {
    var str = "oamRam dump:";
    for(var i=0; i<0x100; i++) {
      if(i%0x20 == 0)
        str += "\n";
      str += util.hex(this.oamRam[i]).padStart(2, "0").toUpperCase() + ",";
    }
    util.log(this.nes, str);
  }
}

