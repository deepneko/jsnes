export class Rom {
  constructor(nes) {
    this.nes = nes;
    this.prgRom = null;
    this.chrRom = null;
    this.sram = null;
    this.vram = null;
    this.prgRomPageCnt = 0;
    this.chrRomPageCnt = 0;
    this.mirroring = 0;
    this.sramEnable = false;
    this.trainerPresent = false;
    this.fourScreen = false;
    this.mapperNum = 0;
    this.romId = null;

    console.log("constructor Rom", this);
  }

  reset() {
  }

  buf2str(buf) {
    return Reflect.apply(String.fromCharCode, "", new Uint8Array(buf))
  }

  str2buf(str) {
    return [].map.call(str, (c) => c.charCodeAt(0) & 0xff);
  }

  buildRomId(buf) {
    // FNV-1a 32-bit hash for stable ROM identity in browser storage.
    var hash = 0x811c9dc5;
    for (var i = 0; i < buf.length; i++) {
      hash ^= buf[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    var hex = hash.toString(16).padStart(8, '0');
    return 'ines-' + this.mapperNum + '-' + this.prgRomPageCnt + '-' + this.chrRomPageCnt + '-' + hex;
  }

  load(file) {
    if (file instanceof ArrayBuffer) {
      return this.parse(new Uint8Array(file));
    } else if (file instanceof Uint8Array) {
      return this.parse(file);
    }

    var req = new XMLHttpRequest();
    req.open("GET", file, false);
    req.overrideMimeType('text/plain; charset=x-user-defined'); // It's necessary for reading binary as it is
    req.send(null);

    if(req.status == 200) {
      return this.parse(this.str2buf(req.response));
    }

    console.log("Failed to load ROM: ", file);
    return false;
  }

  parse(buf) {
    // Array to plain array conversion if needed, to keep consistency
    // Although Uint8Array might work, let's keep it safe if existing code expects Array
    if (buf instanceof Uint8Array) {
        buf = Array.from(buf);
    }

    var offset = 0;
    var head = buf.slice(0, 4);
    if(!(this.buf2str(head) == "NES\x1A")) {
      console.log("This ROM is not for NES");
      return false;
    }
    offset += 4;

    this.prgRomPageCnt = buf[offset++];
    this.chrRomPageCnt = buf[offset++];

    var romCtl = buf[offset++];
    var mapperUpper = (buf[offset++] & 0xf0);
    this.mirroring = romCtl & 1;
    this.sramEnable = (romCtl>>1) & 1;
    this.trainerPresent = (romCtl>>2) & 1;
    this.fourScreen = (romCtl>>3) & 1;
    this.mapperNum = (romCtl>>4) | mapperUpper;

    var prgSize = 0x4000 * this.prgRomPageCnt;
    var chrSize = 0x2000 * this.chrRomPageCnt;

    offset += 8; // padding
    this.prgRom = buf.slice(offset, offset + prgSize);
    offset += prgSize;
    if(chrSize)
      this.chrRom = buf.slice(offset, offset + chrSize);
    else
      this.chrRom = new Array(0x2000);

    this.sram = new Array(0x2000).fill(0xFF);
    this.vram = new Array(0x2000).fill(0);
    this.romId = this.buildRomId(buf);
    return true;
  }
}
