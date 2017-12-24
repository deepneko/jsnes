import * as util from './util.js'

export function imm(cpu) {
  return cpu.pc++;
}

export function abs(cpu) {
  cpu.pc += 2;
  return cpu.read16(cpu.op_addr);
}

export function abx(cpu) {
  cpu.pc += 2;
  return cpu.read16(cpu.op_addr) + cpu.x;
}

export function aby(cpu) {
  cpu.pc += 2;
  return cpu.read16(cpu.op_addr) + cpu.y;
}

export function ind(cpu) {
  cpu.pc += 2;
  return cpu.read16(cpu.read16(cpu.op_addr));
}

export function zp(cpu) {
  return cpu.read8(cpu.pc++);
}

export function zpx(cpu) {
  return util.to_u8(cpu.read8(cpu.pc++) + cpu.x);
}

export function zpy(cpu) {
  return util.to_u8(cpu.read8(cpu.pc++) + cpu.y);
}

export function indx(cpu) {
  return cpu.read16(util.to_u8(cpu.read8(cpu.pc++) + cpu.x));
}

export function indy(cpu) {
  return cpu.read16(cpu.read8(cpu.pc++)) + cpu.y;
}

export function push8(cpu, data) {
  cpu.write8(0x100|cpu.sp, data);
  cpu.sp = util.to_u8(cpu.sp - 1);
}

export function push16(cpu, data) {
  cpu.write16(0x100|util.to_u8(cpu.sp-1), data);
  cpu.sp = util.to_u8(cpu.sp - 2);
}

export function pop8(cpu) {
  cpu.sp = util.to_u8(cpu.sp + 1)
  return cpu.read8(0x100|cpu.sp);
}

export function pop16(cpu) {
  cpu.sp = util.to_u8(cpu.sp + 2);
  return cpu.read16(0x100|util.to_u8(cpu.sp-1));
}

export function get_status(cpu) {
  return ((cpu.n<<7)
      | (cpu.v<<6)
      | (1<<5)
      | (cpu.b<<4)
      | (cpu.d<<3)
      | (cpu.i<<2)
      | (cpu.z<<1)
      | cpu.c);
}

export function set_status(cpu, s) {
  cpu.n = s >> 7;
  cpu.v = (s >> 6) & 1;
  cpu.b = (s >> 4) & 1;
  cpu.d = (s >> 3) & 1;
  cpu.i = (s >> 2) & 1;
  cpu.z = (s >> 1) & 1;
  cpu.c = s & 1;
}

export function adc(cpu, cycle, addr) {
  var s = cpu.read8(addr);
  var t = util.to_u16(cpu.a + s + cpu.c);
  cpu.c = (t >> 8)? 1:0;
  cpu.z = (t & 0xff) == 0;
  cpu.n = (t >> 7) & 1;
  cpu.v = !((cpu.a^s)&0x80) && ((cpu.a^t)&0x80);
  cpu.a = util.to_u8(t);
  cpu.cycles -= cycle;
}

export function sbc(cpu, cycle, addr) {
  var s = cpu.read8(addr);
  var t = util.to_u16(cpu.a - s - (1-cpu.c));
  cpu.c = t < 0x100;
  cpu.z = (t&0xff) == 0;
  cpu.n = (t >> 7) & 1;
  cpu.v = ((cpu.a^s)&0x80) && ((cpu.a^t)&0x80);
  cpu.a = util.to_u8(t);
  cpu.cycles -= cycle;
}

export function cpx(cpu, cycle, addr) {
  var s = cpu.read8(addr);
  var t = util.to_u16(cpu.x - s);
  cpu.c = cpu.x >= s;
  cpu.z = (t&0xff) == 0;
  cpu.n = (t >> 7) & 1;
  cpu.cycles -= cycle;
}

export function cpy(cpu, cycle, addr) {
  var s = cpu.read8(addr);
  var t = util.to_u16(cpu.y - s);
  cpu.c = cpu.y >= s;
  cpu.z = (t&0xff) == 0;
  cpu.n = (t >> 7) & 1;
  cpu.cycles -= cycle;
}

export function cmp(cpu, cycle, addr) {
  var s = cpu.read8(addr);
  var t = util.to_u16(cpu.a - s);
  cpu.c = cpu.a >= s;
  cpu.z = (t&0xff) == 0;
  cpu.n = (t >> 7) & 1;
  cpu.cycles -= cycle;
}

export function and(cpu, cycle, addr) {
  cpu.a &= cpu.read8(addr);
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function ora(cpu, cycle, addr) {
  cpu.a |= cpu.read8(addr);
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function eor(cpu, cycle, addr) {
  cpu.a ^= cpu.read8(addr);
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function bit(cpu, cycle, addr) {
  var t = cpu.read8(addr);
  cpu.n = t >> 7;
  cpu.v = (t >> 6) & 1;
  cpu.z = (cpu.a & t) == 0;
  cpu.cycles -= cycle;
}

export function lda(cpu, cycle, addr) {
  cpu.a = cpu.read8(addr);
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function ldx(cpu, cycle, addr) {
  cpu.x = cpu.read8(addr);
  cpu.n = cpu.x >> 7;
  cpu.z = cpu.x == 0;
  cpu.cycles -= cycle;
}

export function ldy(cpu, cycle, addr) {
  cpu.y = cpu.read8(addr);
  cpu.n = cpu.y >> 7;
  cpu.z = cpu.y == 0;
  cpu.cycles -= cycle;
}

export function sta(cpu, cycle, addr) {
  cpu.write8(addr, cpu.a);
  cpu.cycles -= cycle;
}

export function stx(cpu, cycle, addr) {
  cpu.write8(addr, cpu.x);
  cpu.cycles -= cycle;
}

export function sty(cpu, cycle, addr) {
  cpu.write8(addr, cpu.y);
  cpu.cycles -= cycle;
}

export function tax(cpu, cycle) {
  cpu.x = cpu.a;
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function tay(cpu, cycle) {
  cpu.y = cpu.a;
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function txa(cpu, cycle) {
  cpu.a = cpu.x;
  cpu.n = cpu.x >> 7;
  cpu.z = cpu.x == 0;
  cpu.cycles -= cycle;
}

export function tya(cpu, cycle) {
  cpu.a = cpu.y;
  cpu.n = cpu.y >> 7;
  cpu.z = cpu.y == 0;
  cpu.cycles -= cycle;
}

export function txy(cpu, cycle) {
  cpu.y = cpu.x;
  cpu.n = cpu.x >> 7;
  cpu.z = cpu.x == 0;
  cpu.cycles -= cycle;
}

export function tsx(cpu, cycle) {
  cpu.x = cpu.sp;
  cpu.n = cpu.sp >> 7;
  cpu.z = cpu.sp == 0;
  cpu.cycles -= cycle;
}

export function txs(cpu, cycle) {
  cpu.sp = cpu.x;
  cpu.cycles -= cycle;
}

export function asl_a(cpu, cycle) {
  cpu.c = cpu.a >> 7;
  cpu.a = util.to_u8(cpu.a << 1);
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function asl(cpu, cycle, addr) {
  var t = cpu.read8(addr);
  cpu.c = t >> 7;
  t = util.to_u8(t << 1);
  cpu.n = t >> 7;
  cpu.z = t == 0;
  cpu.write8(addr, t);
  cpu.cycles -= cycle;
}

export function lsr_a(cpu, cycle){
  cpu.c = cpu.a & 1;
  cpu.a >>= 1;
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function lsr(cpu, cycle, addr) {
  var t = cpu.read8(addr);
  cpu.c = t & 1;
  t >>= 1;
  cpu.n = t >> 7;
  cpu.z = t == 0;
  cpu.write8(addr, t);
  cpu.cycles -= cycle;
}

export function rol_a(cpu, cycle) {
  var u = cpu.a;
  cpu.a = util.to_u8((cpu.a << 1) | cpu.c);
  cpu.c = u >> 7;
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function rol(cpu, cycle, addr) {
  var t = cpu.read8(addr);
  var u = t;
  t = util.to_u8((t << 1) | cpu.c);
  cpu.c = u >> 7;
  cpu.n = t >> 7;
  cpu.z = t == 0;
  cpu.write8(addr, t);
  cpu.cycles -= cycle;
}

export function ror_a(cpu, cycle) {
  var u = cpu.a;
  cpu.a = util.to_u8((cpu.a >> 1) | (cpu.c << 7));
  cpu.c = u & 1;
  cpu.n = cpu.a >> 7;
  cpu.z = cpu.a == 0;
  cpu.cycles -= cycle;
}

export function ror(cpu, cycle, addr) {
  var t = cpu.read8(addr);
  var u = t;
  t = util.to_u8((t >> 1) | (cpu.c << 7));
  cpu.c = u & 1;
  cpu.n = t >> 7;
  cpu.z = t == 0;
  cpu.write8(addr, t);
  cpu.cycles -= cycle;
}

export function inc(cpu, cycle, addr) {
  var t = util.to_u8(cpu.read8(addr) + 1);
  cpu.n = t >> 7;
  cpu.z = t == 0;
  cpu.write8(addr, t);
  cpu.cycles -= cycle;
}

export function inx(cpu, cycle) {
  cpu.x = util.to_u8(cpu.x + 1);
  cpu.n = cpu.x >> 7;
  cpu.z = cpu.x == 0;
  cpu.cycles -= cycle;
}

export function iny(cpu, cycle) {
  cpu.y = util.to_u8(cpu.y + 1);
  cpu.n = cpu.y >> 7;
  cpu.z = cpu.y == 0;
  cpu.cycles -= cycle;
}

export function dec(cpu, cycle, addr) {
  var t = util.to_u8(cpu.read8(addr) - 1);
  cpu.n = t >> 7;
  cpu.z = t == 0;
  cpu.write8(addr, t);
  cpu.cycles -= cycle;
}

export function dex(cpu, cycle) {
  cpu.x = util.to_u8(cpu.x - 1);
  cpu.n = cpu.x >> 7;
  cpu.z = cpu.x == 0;
  cpu.cycles -= cycle;
}

export function dey(cpu, cycle) {
  cpu.y = util.to_u8(cpu.y - 1);
  cpu.n = cpu.y >> 7;
  cpu.z = cpu.y == 0;
  cpu.cycles -= cycle;
}

export function rel(cpu, cond) {
  var addr = util.to_s8(cpu.read8(this.imm(cpu)));
  if(cond) {
    if(cpu.pc&0xff00 != (cpu.pc+addr)&0xff00)
      cpu.cycles--;
    else
      cpu.cycles -= 2;
    return addr;
  }
  return 0;
}

export function bcc(cpu, cycle) {
  var addr = this.rel(cpu, !cpu.c);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function bcs(cpu, cycle) {
  var addr = this.rel(cpu, cpu.c);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function bne(cpu, cycle) {
  var addr = this.rel(cpu, !cpu.z);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function beq(cpu, cycle) {
  var addr = this.rel(cpu, cpu.z);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function bpl(cpu, cycle) {
  var addr = this.rel(cpu, !cpu.n);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function bmi(cpu, cycle) {
  var addr = this.rel(cpu, cpu.n);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function bvc(cpu, cycle) {
  var addr = this.rel(cpu, !cpu.v);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function bvs(cpu, cycle) {
  var addr = this.rel(cpu, cpu.v);
  cpu.pc += addr;
  cpu.cycles -= cycle;
}

export function brk(cpu, cycle) {
  cpu.b = 1;
  cpu.pc = util.to_u16(cpu.pc + 1);
  cpu.intr(cpu.INTR.IRQ);
}

export function jsr(cpu, cycle) {
  this.push16(cpu, util.to_u16(cpu.pc + 1));
  cpu.pc = this.abs(cpu);
  cpu.cycles -= cycle;
}

export function jmp(cpu, cycle, addr) {
  cpu.pc = addr;
  cpu.cycles -= cycle;
}

export function rti(cpu, cycle) {
  this.set_status(cpu, this.pop8(cpu));
  cpu.pc = this.pop16(cpu);
  cpu.cycles -= cycle;
}

export function rts(cpu, cycle) {
  cpu.pc = util.to_u16(this.pop16(cpu) + 1);
  cpu.cycles -= cycle;
}

