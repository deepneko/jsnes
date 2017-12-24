export function to_u8(dat) {
  return dat & 0xff;
}

export function to_u16(dat) {
  return dat & 0xffff;
}

export function to_u32(dat) {
  return dat & 0xffffffff;
}

export function to_s8(dat) {
  var ret = dat&0xff;
  if(ret & 0x80)
    return (ret&0x7f) - 0x80;
  return ret;
}

export function to_s16(dat) {
  var ret = dat&0xffff;
  if(ret & 0x8000)
    return (ret&0x7fff) - 0x8000;
  return ret;
}

export function to_s32(dat) {
  var ret = dat&0xffffffff;
  if(ret & 0x80000000)
    return (ret&0x7fffffff) - 0x80000000;
  return ret;
}

export function log(nes, data) {
  nes.log += data + "\n";
}

export function to_hex(dat) {
  return parseInt(dat).toString(16);
}

export function get_max(a, b) {
  return (a > b) ? a : b;
}

export function get_min(a, b) {
  return (a < b) ? a : b;
}

export class Queue {
  constructor() {
    this.q = new Array();
  }

  pop() {
    return this.q.shift();
  }

  push(e) {
    this.q.push(e);
  }

  front() {
    return this.q[0];
  }

  back() {
    return this.q[this.q.length-1];
  }

  size() {
    return this.q.length;
  }

  empty() {
    return this.q.length == 0;
  }
}
