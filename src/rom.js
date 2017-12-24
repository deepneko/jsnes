export class Rom {
  constructor(nes) {
    this.nes = nes;
    this.prg_rom = null;
    this.chr_rom = null;
    this.sram = null;
    this.vram = null;
    this.prg_rom_page_cnt = 0;
    this.chr_rom_page_cnt = 0;
    this.mirroring = 0;
    this.sram_enable = false;
    this.trainer_present = false;
    this.four_screen = false;
    this.mapper_num = 0;

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

    console.log(req.status);
    if(req.status == 200) {
      console.log("Loading ROM: ", file);

      var buf = this.str2buf(req.response);
      var offset = 4;

      // ROM header
      var head = buf.slice(0, offset);
      if(!(this.buf2str(head) == "NES\x1A")) {
        console.log("This ROM is not for NES: ", file);
        return false;
      }

      this.prg_rom_page_cnt = buf[offset++];
      this.chr_rom_page_cnt = buf[offset++];

      var rom_ctl = buf[offset++];
      var mapper_upper = (buf[offset++] & 0xf0);
      this.mirroring = rom_ctl & 1;
      this.sram_enable = (rom_ctl>>1) & 1;
      this.trainer_present = (rom_ctl>>2) & 1;
      this.four_screen = (rom_ctl>>3) & 1;
      this.mapper_num = (rom_ctl>>4) | mapper_upper;

      var prg_size = 0x4000 * this.prg_rom_page_cnt;
      var chr_size = 0x2000 * this.chr_rom_page_cnt;

      offset += 8; // padding
      this.prg_rom = buf.slice(offset, offset + prg_size);
      offset += prg_size;
      if(chr_size)
        this.chr_rom = buf.slice(offset, offset + chr_size);
      else
        this.chr_rom = new Array(0x2000);

      this.sram = new Array(0x2000);
      this.vram = new Array(0x2000);

      console.log("chr_rom_page_cnt:", this.chr_rom_page_cnt);
      console.log("prg_rom_page_cnt:", this.prg_rom_page_cnt);
      console.log(this.mirroring, this.sram_enable, this.trainer_present, this.four_screen, this.mapper_num);
      return true;
    }

    console.log("Failed to load ROM: ", fname);
    return false;
  }
}

