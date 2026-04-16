import * as util from './util.js'

function withDetachedRefs(target, refKeys, cb) {
  const backup = new Map();
  for (const key of refKeys) {
    backup.set(key, target[key]);
    target[key] = null;
  }

  try {
    return cb();
  } finally {
    for (const key of refKeys) {
      target[key] = backup.get(key);
    }
  }
}

function cloneComponent(target, refKeys) {
  return withDetachedRefs(target, refKeys, () => {
    const cloned = structuredClone(target);
    for (const key of refKeys) delete cloned[key];
    return cloned;
  });
}

function applyComponent(target, snapshot, refKeys) {
  withDetachedRefs(target, refKeys, () => {
    for (const key of Object.keys(snapshot)) {
      target[key] = structuredClone(snapshot[key]);
    }
  });
}

function mapperRefKeys(mapper) {
  if (!mapper) return [];
  const keys = ['nes', 'rom'];
  if (Object.prototype.hasOwnProperty.call(mapper, 'ppu')) keys.push('ppu');
  return keys;
}

export function createQuickState(nes) {
  if (!nes || !nes.mapper) return null;

  return {
    schemaVersion: 1,
    createdAt: Date.now(),
    romId: nes.rom.romId,
    mapperType: nes.mapper.constructor ? nes.mapper.constructor.name : '',
    cpu: cloneComponent(nes.cpu, ['nes']),
    apu: cloneComponent(nes.apu, ['nes']),
    ppu: cloneComponent(nes.ppu, ['nes', 'rom', 'mmc']),
    reg: cloneComponent(nes.reg, ['nes', 'cpu', 'ppu', 'apu', 'mmc', 'joypad0', 'joypad1']),
    mmc: cloneComponent(nes.mmc, ['nes', 'rom']),
    rom: {
      sram: structuredClone(nes.rom.sram),
      vram: structuredClone(nes.rom.vram),
      mirroring: nes.rom.mirroring,
      sramEnable: nes.rom.sramEnable,
      trainerPresent: nes.rom.trainerPresent,
      fourScreen: nes.rom.fourScreen,
      mapperNum: nes.rom.mapperNum,
      prgRomPageCnt: nes.rom.prgRomPageCnt,
      chrRomPageCnt: nes.rom.chrRomPageCnt,
    },
    joypad0: cloneComponent(nes.joypad0, []),
    joypad1: cloneComponent(nes.joypad1, []),
    mapper: cloneComponent(nes.mapper, mapperRefKeys(nes.mapper)),
  };
}

export function restoreQuickState(nes, snapshot) {
  if (!nes || !snapshot || !nes.mapper) return false;
  if (snapshot.romId !== nes.rom.romId) return false;

  const mapperType = nes.mapper.constructor ? nes.mapper.constructor.name : '';
  if (snapshot.mapperType !== mapperType) return false;

  if (snapshot.rom) {
    if (snapshot.rom.sram) nes.rom.sram = structuredClone(snapshot.rom.sram);
    if (snapshot.rom.vram) nes.rom.vram = structuredClone(snapshot.rom.vram);
    if (typeof snapshot.rom.mirroring !== 'undefined') nes.rom.mirroring = snapshot.rom.mirroring;
    if (typeof snapshot.rom.sramEnable !== 'undefined') nes.rom.sramEnable = snapshot.rom.sramEnable;
    if (typeof snapshot.rom.trainerPresent !== 'undefined') nes.rom.trainerPresent = snapshot.rom.trainerPresent;
    if (typeof snapshot.rom.fourScreen !== 'undefined') nes.rom.fourScreen = snapshot.rom.fourScreen;
    if (typeof snapshot.rom.mapperNum !== 'undefined') nes.rom.mapperNum = snapshot.rom.mapperNum;
    if (typeof snapshot.rom.prgRomPageCnt !== 'undefined') nes.rom.prgRomPageCnt = snapshot.rom.prgRomPageCnt;
    if (typeof snapshot.rom.chrRomPageCnt !== 'undefined') nes.rom.chrRomPageCnt = snapshot.rom.chrRomPageCnt;
  }
  applyComponent(nes.mmc, snapshot.mmc, ['nes', 'rom']);
  applyComponent(nes.cpu, snapshot.cpu, ['nes']);
  applyComponent(nes.apu, snapshot.apu, ['nes']);

  // Restore internal APU aliasing: realWrite targets channels[], generation uses pulse1/2 etc.
  nes.apu.channels = [
    nes.apu.pulse1,
    nes.apu.pulse2,
    nes.apu.triangle,
    nes.apu.noise,
    nes.apu.dmc,
  ];
  nes.apu.syncChannels = [
    nes.apu.syncPulse1,
    nes.apu.syncPulse2,
    nes.apu.syncTriangle,
    nes.apu.syncNoise,
    nes.apu.syncDmc,
  ];

  // Rebuild queue instance and drop stale queued writes to avoid audio artifacts.
  nes.apu.sampleQueue = new util.Queue();
  nes.apu.preClock = nes.cpu.masterClock();

  applyComponent(nes.ppu, snapshot.ppu, ['nes', 'rom', 'mmc']);
  applyComponent(nes.reg, snapshot.reg, ['nes', 'cpu', 'ppu', 'apu', 'mmc', 'joypad0', 'joypad1']);
  applyComponent(nes.joypad0, snapshot.joypad0, []);
  applyComponent(nes.joypad1, snapshot.joypad1, []);
  applyComponent(nes.mapper, snapshot.mapper, mapperRefKeys(nes.mapper));

  // Ensure runtime pointers that are used hot in read/write paths stay connected.
  nes.mmc.sram = nes.rom.sram;
  return true;
}