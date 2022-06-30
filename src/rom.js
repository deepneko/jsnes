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

  load(file) {
    var req = new XMLHttpRequest();
    req.open("GET", file, false);
    req.overrideMimeType('text/plain; charset=x-user-defined'); // It's necessary for reading binary as it is
    req.send(null);

    if(req.status == 200) {
      console.log("Loading ROM: ", file);

      var buf = this.str2buf(req.response);
      var offset = 4;

      var head = buf.slice(0, offset);
      if(!(this.buf2str(head) == "NES\x1A")) {
        console.log("This ROM is not for NES: ", file);
        return false;
      }

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

      this.sram = new Array(0x2000);
      this.vram = new Array(0x2000);
      return true;
    }

    console.log("Failed to load ROM: ", file);
    return false;
  }
}
