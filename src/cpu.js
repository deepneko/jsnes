import * as inst from './instruction.js'
import * as util from './util.js'

export class CPU {
  constructor(nes) {
    this.nes = nes;
    this.debug = false;
    this.INTR = { NMI:0, IRQ:1, RESET:2 };
    this.INTR_VECTOR = [ 0xFFFA, 0xFFFE, 0xFFFC ];
    console.log("constructor CPU", this);
  }

  reset() {
    this.pc = this.read16(0xFFFC);
    this.sp = 0xFF;
    this.a = 0x00;
    this.x = 0x00;
    this.y = 0x00;

    this.n = 0;
    this.v = 0;
    this.z = 0;
    this.c = 0;
    this.b = 1;
    this.d = 0;
    this.i = 1;

    this.cycles = 0;
    this.op_addr = 0x00;

    this.intr_occur = null;
  }

  read8(addr) {
    return util.to_u8(this.nes.mmc.read(addr));
  }

  read16(addr) {
    return this.read8(addr) | (this.read8(addr+1)<<8);
  }

  write8(addr, dat) {
    this.nes.mmc.write(addr, util.to_u8(dat));
  }

  write16(addr, dat) {
    this.write8(addr, util.to_u8(dat));
    this.write8(addr+1, util.to_u8(dat>>8));
  }

  set_intr(i) {
    if(i == this.INTR.NMI)
      this.intr(this.INTR.NMI);
    this.intr_occur = i;
  }

  intr(i) {
    var vector = this.INTR_VECTOR[i];
    if(this.debug) {
      switch(i) {
      case this.INTR.RESET:
        util.log(this.nes, "Interrupt RESET");
        break;
      case this.INTR.NMI:
        util.log(this.nes, "Interrupt NMI");
        break;
      case this.INTR.IRQ:
        util.log(this.nes, "Interrupt IRQ");
        break;
      default:
        util.log(this.nes, "Interrupt UNKNOWN");
        break;
      }
    }

    inst.push16(this, this.pc);
    inst.push8(this, inst.get_status(this));
    this.pc = this.read16(vector);
    this.i = 1;
    this.cycles -= 7;
  }

  check_intr() {
    if(!this.i && this.intr_occur) {
      this.intr(this.intr_occur);
      this.intr_occur = null;
    }
  }

  run(cycle) {
    this.cycles += cycle;

    do {
      this.check_intr();

      if(this.debug) this.debug_out();

      var op_code = this.read8(this.pc++);
      this.op_addr = this.pc;

      switch(op_code) {
      /* LDA */
      case 0xa9:
        inst.lda(this, 2, inst.imm(this)); break;
      case 0xa5:
        inst.lda(this, 3, inst.zp(this)); break;
      case 0xad:
        inst.lda(this, 4, inst.abs(this)); break;
      case 0xb5:
        inst.lda(this, 4, inst.zpx(this)); break;
      case 0xbd:
        inst.lda(this, 4, inst.abx(this)); break;
      case 0xb9:
        inst.lda(this, 4, inst.aby(this)); break;
      case 0xa1:
        inst.lda(this, 6, inst.indx(this)); break;
      case 0xb1:
        inst.lda(this, 5, inst.indy(this)); break;

      /* LDX */
      case 0xa2:
        inst.ldx(this, 2, inst.imm(this)); break;
      case 0xa6:
        inst.ldx(this, 3, inst.zp(this)); break;
      case 0xae:
        inst.ldx(this, 4, inst.abs(this)); break;
      case 0xb6:
        inst.ldx(this, 4, inst.zpy(this)); break;
      case 0xbe:
        inst.ldx(this, 4, inst.aby(this)); break;

      /* LDY */
      case 0xa0:
        inst.ldy(this, 2, inst.imm(this)); break;
      case 0xa4:
        inst.ldy(this, 3, inst.zp(this)); break;
      case 0xac:
        inst.ldy(this, 4, inst.abs(this)); break;
      case 0xb4:
        inst.ldy(this, 4, inst.zpx(this)); break;
      case 0xbc:
        inst.ldy(this, 4, inst.abx(this)); break;

      /* STA */
      case 0x85:
        inst.sta(this, 3, inst.zp(this)); break;
      case 0x8d:
        inst.sta(this, 4, inst.abs(this)); break;
      case 0x95:
        inst.sta(this, 4, inst.zpx(this)); break;
      case 0x9d:
        inst.sta(this, 5, inst.abx(this)); break;
      case 0x99:
        inst.sta(this, 5, inst.aby(this)); break;
      case 0x81:
        inst.sta(this, 6, inst.indx(this)); break;
      case 0x91:
        inst.sta(this, 6, inst.indy(this)); break;

      /* STX */
      case 0x86:
        inst.stx(this, 3, inst.zp(this)); break;
      case 0x8e:
        inst.stx(this, 4, inst.abs(this)); break;
      case 0x96:
        inst.stx(this, 4, inst.zpy(this)); break;

      /* STY */
      case 0x84:
        inst.sty(this, 3, inst.zp(this)); break;
      case 0x8c:
        inst.sty(this, 4, inst.abs(this)); break;
      case 0x94:
        inst.sty(this, 4, inst.zpx(this)); break;

      /* TXA */
      case 0x8a:
        inst.txa(this, 2); break;

      /* TYA */
      case 0x98:
        inst.tya(this, 2); break;

      /* TXS */
      case 0x9a:
        inst.txs(this, 2); break;

      /* TAY */
      case 0xa8:
        inst.tay(this, 2); break;

      /* TAX */
      case 0xaa:
        inst.tax(this, 2); break;

      /* TSX */
      case 0xba:
        inst.tsx(this, 2); break;

      /* PHP */
      case 0x08:
        inst.php(this, 3); break;

      /* PLP */
      case 0x28:
        inst.plp(this, 4); break;

      /* PHA */
      case 0x48:
        inst.pha(this, 3); break;

      /* PLA */
      case 0x68:
        inst.pla(this, 4); break;

      /* ADC */
      case 0x69:
        inst.adc(this, 2, inst.imm(this)); break;
      case 0x65:
        inst.adc(this, 3, inst.zp(this)); break;
      case 0x6d:
        inst.adc(this, 4, inst.abs(this)); break;
      case 0x75:
        inst.adc(this, 4, inst.zpx(this)); break;
      case 0x7d:
        inst.adc(this, 4, inst.abx(this)); break;
      case 0x79:
        inst.adc(this, 4, inst.aby(this)); break;
      case 0x61:
        inst.adc(this, 6, inst.indx(this)); break;
      case 0x71:
        inst.adc(this, 5, inst.indy(this)); break;

      /* SBC */
      case 0xe9:
        inst.sbc(this, 2, inst.imm(this)); break;
      case 0xe5:
        inst.sbc(this, 3, inst.zp(this)); break;
      case 0xed:
        inst.sbc(this, 4, inst.abs(this)); break;
      case 0xf5:
        inst.sbc(this, 4, inst.zpx(this)); break;
      case 0xfd:
        inst.sbc(this, 4, inst.abx(this)); break;
      case 0xf9:
        inst.sbc(this, 4, inst.aby(this)); break;
      case 0xe1:
        inst.sbc(this, 6, inst.indx(this)); break;
      case 0xf1:
        inst.sbc(this, 5, inst.indy(this)); break;

      /* CPX */
      case 0xe0:
        inst.cpx(this, 2, inst.imm(this)); break;
      case 0xe4:
        inst.cpx(this, 2, inst.zp(this)); break;
      case 0xec:
        inst.cpx(this, 3, inst.abs(this)); break;

      /* CPY */
      case 0xc0:
        inst.cpy(this, 2, inst.imm(this)); break;
      case 0xc4:
        inst.cpy(this, 2, inst.zp(this)); break;
      case 0xcc:
        inst.cpy(this, 3, inst.abs(this)); break;

      /* CMP */
      case 0xc9:
        inst.cmp(this, 2, inst.imm(this)); break;
      case 0xc5:
        inst.cmp(this, 3, inst.zp(this)); break;
      case 0xcd:
        inst.cmp(this, 4, inst.abs(this)); break;
      case 0xd5:
        inst.cmp(this, 4, inst.zpx(this)); break;
      case 0xdd:
        inst.cmp(this, 4, inst.abx(this)); break;
      case 0xd9:
        inst.cmp(this, 4, inst.aby(this)); break;
      case 0xc1:
        inst.cmp(this, 6, inst.indx(this)); break;
      case 0xd1:
        inst.cmp(this, 5, inst.indy(this)); break;

      /* AND */
      case 0x29:
        inst.and(this, 2, inst.imm(this)); break;
      case 0x25:
        inst.and(this, 3, inst.zp(this)); break;
      case 0x2d:
        inst.and(this, 4, inst.abs(this)); break;
      case 0x35:
        inst.and(this, 4, inst.zpx(this)); break;
      case 0x3d:
        inst.and(this, 4, inst.abx(this)); break;
      case 0x39:
        inst.and(this, 4, inst.aby(this)); break;
      case 0x21:
        inst.and(this, 6, inst.indx(this)); break;
      case 0x31:
        inst.and(this, 5, inst.indy(this)); break;

      /* EOR */
      case 0x49:
        inst.eor(this, 2, inst.imm(this)); break;
      case 0x45:
        inst.eor(this, 3, inst.zp(this)); break;
      case 0x4d:
        inst.eor(this, 4, inst.abs(this)); break;
      case 0x55:
        inst.eor(this, 4, inst.zpx(this)); break;
      case 0x5d:
        inst.eor(this, 4, inst.abx(this)); break;
      case 0x59:
        inst.eor(this, 4, inst.aby(this)); break;
      case 0x41:
        inst.eor(this, 6, inst.indx(this)); break;
      case 0x51:
        inst.eor(this, 5, inst.indy(this)); break;

      /* ORA */
      case 0x09:
        inst.ora(this, 2, inst.imm(this)); break;
      case 0x05:
        inst.ora(this, 3, inst.zp(this)); break;
      case 0x0d:
        inst.ora(this, 4, inst.abs(this)); break;
      case 0x15:
        inst.ora(this, 4, inst.zpx(this)); break;
      case 0x1d:
        inst.ora(this, 4, inst.abx(this)); break;
      case 0x19:
        inst.ora(this, 4, inst.aby(this)); break;
      case 0x01:
        inst.ora(this, 6, inst.indx(this)); break;
      case 0x11:
        inst.ora(this, 5, inst.indy(this)); break;

      /* BIT */
      case 0x24:
        inst.bit(this, 3, inst.zp(this)); break;
      case 0x2c:
        inst.bit(this, 4, inst.abs(this)); break;

      /* ASL */
      case 0x0a:
        inst.asl_a(this, 2); break;
      case 0x06:
        inst.asl(this, 5, inst.zp(this)); break;
      case 0x0e:
        inst.asl(this, 6, inst.abs(this)); break;
      case 0x16:
        inst.asl(this, 6, inst.zpx(this)); break;
      case 0x1e:
        inst.asl(this, 7, inst.abx(this)); break;

      /* LSR */
      case 0x4a:
        inst.lsr_a(this, 2); break;
      case 0x46:
        inst.lsr(this, 5, inst.zp(this)); break;
      case 0x4e:
        inst.lsr(this, 6, inst.abs(this)); break;
      case 0x56:
        inst.lsr(this, 6, inst.zpx(this)); break;
      case 0x5e:
        inst.lsr(this, 7, inst.abx(this)); break;

      /* ROL */
      case 0x2a:
        inst.rol_a(this, 2); break;
      case 0x26:
        inst.rol(this, 5, inst.zp(this)); break;
      case 0x2e:
        inst.rol(this, 6, inst.abs(this)); break;
      case 0x36:
        inst.rol(this, 6, inst.zpx(this)); break;
      case 0x3e:
        inst.rol(this, 7, inst.abx(this)); break;

      /* ROR */
      case 0x6a:
        inst.ror_a(this, 2); break;
      case 0x66:
        inst.ror(this, 5, inst.zp(this)); break;
      case 0x6e:
        inst.ror(this, 6, inst.abs(this)); break;
      case 0x76:
        inst.ror(this, 6, inst.zpx(this)); break;
      case 0x7e:
        inst.ror(this, 7, inst.abx(this)); break;

      /* INX */
      case 0xe8:
        inst.inx(this, 2); break;

      /* INY */
      case 0xc8:
        inst.iny(this, 2); break;

      /* INC */
      case 0xe6:
        inst.inc(this, 5, inst.zp(this)); break;
      case 0xee:
        inst.inc(this, 6, inst.abs(this)); break;
      case 0xf6:
        inst.inc(this, 6, inst.zpx(this)); break;
      case 0xfe:
        inst.inc(this, 7, inst.abx(this)); break;

      /* DEX */
      case 0xca:
        inst.dex(this, 2); break;

      /* DEY */
      case 0x88:
        inst.dey(this, 2); break;

      /* DEC */
      case 0xc6:
        inst.dec(this, 5, inst.zp(this)); break;
      case 0xce:
        inst.dec(this, 6, inst.abs(this)); break;
      case 0xd6:
        inst.dec(this, 6, inst.zpx(this)); break;
      case 0xde:
        inst.dec(this, 7, inst.abx(this)); break;

      /* BCC */
      case 0x90:
        inst.bcc(this, 2); break;

      /* BCS */
      case 0xb0:
        inst.bcs(this, 2); break;

      /* BNE */
      case 0xd0:
        inst.bne(this, 2); break;

      /* BEQ */
      case 0xf0:
        inst.beq(this, 2); break;

      /* BPL */
      case 0x10:
        inst.bpl(this, 2); break;

      /* BMI */
      case 0x30:
        inst.bmi(this, 2); break;

      /* BVC */
      case 0x50:
        inst.bvc(this, 2); break;

      /* BVS */
      case 0x70:
        inst.bvs(this, 2); break;

      /* CLC */
      case 0x18:
        this.c = 0; this.cycles -= 2; break;

      /* CLI */
      case 0x58:
        this.i = 0; this.cycles -= 2; break;

      /* CLV */
      case 0xb8:
        this.v = 0; this.cycles -= 2; break;

      /* CLD */
      case 0xd8:
        this.d = 0; this.cycles -= 2; break;

      /* SEC */
      case 0x38:
        this.c = 1; this.cycles -= 2; break;

      /* SEI */
      case 0x78:
        this.i = 1; this.cycles -= 2; break;

      /* SED */
      case 0xf8:
        this.d = 1; this.cycles -= 2; break;

      /* NOP */
      case 0xea:
        this.cycles -= 2; break;

      /* BRK */
      case 0x00:
        inst.brk(this); break;

      /* JSR */
      case 0x20:
        inst.jsr(this, 6); break;

      /* JMP */
      case 0x4c:
        inst.jmp(this, 3, inst.abs(this)); break;
      case 0x6c:
        inst.jmp(this, 5, inst.ind(this)); break;

      /* RTI */
      case 0x40:
        inst.rti(this, 6); break;

      /* RTS */
      case 0x60:
        inst.rts(this, 6); break;

      default:
        console.log("unknown instruction!"); break;
      }

      if(this.debug)
        util.log(this.nes, "cycles:" + parseInt(this.cycles).toString(16));
    } while(this.cycles > 0);
  }

  debug_out() {
    var op_code = this.read8(this.pc);
    var op_addr = this.read16(this.pc + 1);

    var inst_name = [
      "BRK", "ORA", "NaN", "NaN", "NaN", "ORA", "ASL", "NaN",
      "PHP", "ORA", "ASL", "NaN", "NaN", "ORA", "ASL", "NaN",
      "BPL", "ORA", "NaN", "NaN", "NaN", "ORA", "ASL", "NaN",
      "CLC", "ORA", "NaN", "NaN", "NaN", "ORA", "ASL", "NaN",
      "JSR", "AND", "NaN", "NaN", "BIT", "AND", "ROL", "NaN",
      "PLP", "AND", "ROL", "NaN", "BIT", "AND", "ROL", "NaN",
      "BMI", "AND", "NaN", "NaN", "NaN", "AND", "ROL", "NaN",
      "SEC", "AND", "NaN", "NaN", "NaN", "AND", "ROL", "NaN",
      "RTI", "EOR", "NaN", "NaN", "NaN", "EOR", "LSR", "NaN",
      "PHA", "EOR", "LSR", "NaN", "JMP", "EOR", "LSR", "NaN",
      "BVC", "EOR", "NaN", "NaN", "NaN", "EOR", "LSR", "NaN",
      "CLI", "EOR", "NaN", "NaN", "NaN", "EOR", "LSR", "NaN",
      "RTS", "ADC", "NaN", "NaN", "NaN", "ADC", "ROR", "NaN",
      "PLA", "ADC", "ROR", "NaN", "JMP", "ADC", "ROR", "NaN",
      "BVS", "ADC", "NaN", "NaN", "NaN", "ADC", "ROR", "NaN",
      "SEI", "ADC", "NaN", "NaN", "NaN", "ADC", "ROR", "NaN",
      "NaN", "STA", "NaN", "NaN", "STY", "STA", "STX", "NaN",
      "DEY", "NaN", "TXA", "NaN", "STY", "STA", "STX", "NaN",
      "BCC", "STA", "NaN", "NaN", "STY", "STA", "STX", "NaN",
      "TYA", "STA", "TXS", "NaN", "NaN", "STA", "NaN", "NaN",
      "LDY", "LDA", "LDX", "NaN", "LDY", "LDA", "LDX", "NaN",
      "TAY", "LDA", "TAX", "NaN", "LDY", "LDA", "LDX", "NaN",
      "BCS", "LDA", "NaN", "NaN", "LDY", "LDA", "LDX", "NaN",
      "CLV", "LDA", "TSX", "NaN", "LDY", "LDA", "LDX", "NaN",
      "CPY", "CMP", "NaN", "NaN", "CPY", "CMP", "DEC", "NaN",
      "INY", "CMP", "DEX", "NaN", "CPY", "CMP", "DEC", "NaN",
      "BNE", "CMP", "NaN", "NaN", "NaN", "CMP", "DEC", "NaN",
      "CLD", "CMP", "NaN", "NaN", "NaN", "CMP", "DEC", "NaN",
      "CPX", "SBC", "NaN", "NaN", "CPX", "SBC", "INC", "NaN",
      "INX", "SBC", "NOP", "NaN", "CPX", "SBC", "INC", "NaN",
      "BEQ", "SBC", "NaN", "NaN", "NaN", "SBC", "INC", "NaN",
      "SED", "SBC", "NaN", "NaN", "NaN", "SBC", "INC", "NaN",
      ];

    var addr_mode = [
      0, 7, 0, 0, 0, 3, 3, 0, 0, 2, 1, 0, 0, 9, 9, 0,
     13, 8, 0, 0, 0, 5, 5, 0, 0,11, 0, 0, 0,10,10, 0,
      9, 7, 0, 0, 3, 3, 3, 0, 0, 2, 1, 0, 9, 9, 9, 0,
     13, 8, 0, 0, 0, 5, 5, 0, 0,11, 0, 0, 0,10,10, 0,
      0, 7, 0, 0, 0, 3, 3, 0, 0, 2, 1, 0, 9, 9, 9, 0,
     13, 8, 0, 0, 0, 5, 5, 0, 0,11, 0, 0, 0,10,10, 0,
      0, 7, 0, 0, 0, 3, 3, 0, 0, 2, 1, 0,12, 9, 9, 0,
     13, 8, 0, 0, 0, 5, 5, 0, 0,11, 0, 0, 0,10,10, 0,
      0, 7, 0, 0, 3, 3, 3, 0, 0, 0, 0, 0, 9, 9, 9, 0,
     13, 8, 0, 0, 5, 5, 6, 0, 0,11, 0, 0, 0,10, 0, 0,
      2, 7, 2, 0, 3, 3, 3, 0, 0, 2, 0, 0, 9, 9, 9, 0,
     13, 8, 0, 0, 5, 5, 6, 0, 0,11, 0, 0,10,10,11, 0,
      2, 7, 0, 0, 3, 3, 3, 0, 0, 2, 0, 0, 9, 9, 9, 0,
     13, 8, 0, 0, 0, 5, 5, 0, 0,11, 0, 0, 0,10,10, 0,
      2, 7, 0, 0, 3, 3, 3, 0, 0, 2, 0, 0, 9, 9, 9, 0,
     13, 8, 0, 0, 0, 5, 5, 0, 0,11, 0, 0, 0,10,10, 0,
      ];

    var addr_mode_name = [
      "IMP",
      "ACC",
      "IMM",
      "ZP",
      "ZPI",
      "ZPX",
      "ZPY",
      "INDX",
      "INDY",
      "ABS",
      "ABSX",
      "ABSY",
      "IND",
      "REL",
      ]

    var flags = (this.c?'C':'c') 
              + (this.z?'Z':'z') 
              + (this.i?'I':'i') 
              + (this.d?'D':'d') 
              + (this.b?'B':'b') 
              + (this.v?'V':'v') 
              + (this.n?'N':'n');

    var int2hex = function(c) {
      return parseInt(c).toString(16).toUpperCase();
    };

    var regs = " A:" + int2hex(this.a).padStart(2, "0")
             + " X:" + int2hex(this.x).padStart(2, "0")
             + " Y:" + int2hex(this.y).padStart(2, "0")
             + " SP:" + int2hex(this.sp).padStart(2, "0");

    var executed = function(c, pc) {
      return int2hex(pc).padStart(4, "0") + ", "
      + "0x" + int2hex(op_code).padStart(2, "0") + ", " 
      + c.padEnd(14) + ", " 
      + addr_mode_name[addr_mode[op_code]].padStart(4, " ") + ", "
      + regs + ", "
      + flags;
    };

    var c = null;
    switch(addr_mode[op_code]) {
    case 0: // Implied
      c = inst_name[op_code];
      break;
    case 1: // Accumulator
      c = inst_name[op_code] + " A";
      break;
    case 2: // Immediate
      c = inst_name[op_code] + " #$" + int2hex(op_addr&0xff).padStart(2, "0");
      break;
    case 3: // Zero Page
      c = inst_name[op_code] + " $" + int2hex(op_addr&0xff).padStart(2, "0");
      break;
    case 4: // Zero Page Indrect
      c = inst_name[op_code] + " ($" + int2hex(op_addr&0xff).padStart(2, "0") + ")";
      break;
    case 5: // Zero Page Indexed X
      c = inst_name[op_code] + " $" + int2hex(op_addr&0xff).padStart(2, "0") + ",X";
      break;
    case 6: // Zero Page Indexed Y
      c = inst_name[op_code] + " $" + int2hex(op_addr&0xff).padStart(2, "0") + ",Y";
      break;
    case 7: // Zero Page Indexed Indirect X
      c = inst_name[op_code] + " ($" + int2hex(op_addr&0xff).padStart(2, "0") + ",X)";
      break;
    case 8: // Zero Page Indirect Indexed Y
      c = inst_name[op_code] + " ($" + int2hex(op_addr&0xff).padStart(2, "0") + "),Y";
      break;
    case 9: // Absolute
      c = inst_name[op_code] + " $" + int2hex(op_addr).padStart(4, "0");
      break;
    case 10: // Absolute Indexed X
      c = inst_name[op_code] + " $" + int2hex(op_addr).padStart(4, "0") + ",X";
      break;
    case 11: // Absolute Indexed Y
      c = inst_name[op_code] + " $" + int2hex(op_addr).padStart(4, "0") + ",Y";
      break;
    case 12: // Absolute Indirect
      c = inst_name[op_code] + " ($" + int2hex(op_addr).padStart(4, "0") + ")";
      break;
    case 13: // Relative
      c = inst_name[op_code] + " $" + int2hex(this.pc + util.to_s8(op_addr&0xff) + 2).padStart(4, "0");
      break;
    }

    util.log(this.nes, executed(c, this.pc));
  }
}
