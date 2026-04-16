import { NES, } from './src/nes.js'
import { Output, } from './src/output.js'
import { listBatterySaves, loadBatterySave, saveBatterySave } from './src/battery.js'
import { createQuickState, restoreQuickState } from './src/quicksave.js'
import { loadQuickState, saveQuickState } from './src/quickstate-db.js'
import * as util from './src/util.js'

let currentNes = null;
let currentEmulation = null;
const gameplayKeys = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyZ',
  'KeyX',
  'Space',
  'Enter',
]);
const batteryState = {
  romId: null,
  romName: null,
  activeSlot: 0,
  dirty: false,
  inFlight: false,
  lastSavedAt: 0,
  lastSavedSignature: null,
  timerId: null,
};
const quickStateSlots = new Map();
const BATTERY_SLOT = 0;

let saveStatusTimer = null;

function hasBatteryRam(nes) {
  return Boolean(nes && nes.rom && nes.rom.sram && nes.rom.sram.length);
}

function sramSignature(sram) {
  if (!sram || !sram.length) return 0;

  // FNV-1a 32-bit signature for cheap SRAM change detection.
  let hash = 0x811c9dc5;
  for (let i = 0; i < sram.length; i++) {
    hash ^= (sram[i] & 0xff);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function formatSavedAt(timestamp) {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

async function refreshBatterySaveList() {
  const listEl = document.querySelector('#battery-save-list');
  if (!listEl) return;

  if (!batteryState.romId) {
    listEl.innerHTML = '<div class="battery-save-empty">Load a ROM to see SRAM saves.</div>';
    return;
  }

  try {
    const items = await listBatterySaves(batteryState.romId);
    if (!items.length) {
      listEl.innerHTML = '<div class="battery-save-empty">No battery saves yet.</div>';
      return;
    }

    const activeSlot = BATTERY_SLOT;
    listEl.innerHTML = items.map((item) => {
      const cls = item.slot === activeSlot ? 'battery-save-item active' : 'battery-save-item';
      return `<div class="${cls}"><span>SLOT ${item.slot}</span><span>${formatSavedAt(item.updatedAt)}</span></div>`;
    }).join('');
  } catch (e) {
    console.warn('Failed to list battery saves:', e);
    listEl.innerHTML = '<div class="battery-save-empty">Failed to load save list.</div>';
  }
}

function currentSlotFromUI() {
  const slotEl = document.querySelector('#battery-slot');
  if (!slotEl) return 0;
  const n = Number(slotEl.value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(9, Math.floor(n)));
}

function setStatus(message, timeout = 2200) {
  const statusEl = document.querySelector('#save-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  if (saveStatusTimer) clearTimeout(saveStatusTimer);
  if (timeout > 0) {
    saveStatusTimer = window.setTimeout(() => {
      statusEl.textContent = '';
      saveStatusTimer = null;
    }, timeout);
  }
}

function markBatteryDirty() {
  batteryState.dirty = true;

  if (!batteryState.timerId) {
    batteryState.timerId = window.setTimeout(async () => {
      batteryState.timerId = null;
      await flushBatterySave(false);
    }, 800);
  }
}

async function flushBatterySave(force = false) {
  if (!hasBatteryRam(currentNes)) {
    return;
  }

  if (!batteryState.romId || batteryState.inFlight) {
    return;
  }

  const currentSig = sramSignature(currentNes.rom.sram);

  if (!force) {
    if (!batteryState.dirty && batteryState.lastSavedSignature === currentSig) return;
    if (Date.now() - batteryState.lastSavedAt < 2000) return;
  }

  batteryState.inFlight = true;
  batteryState.dirty = false;

  try {
    await saveBatterySave(batteryState.romId, currentNes.rom.sram, BATTERY_SLOT);
    batteryState.lastSavedAt = Date.now();
    batteryState.lastSavedSignature = currentSig;
    await refreshBatterySaveList();
  } catch (e) {
    batteryState.dirty = true;
    console.warn('Failed to save battery SRAM:', e);
  } finally {
    batteryState.inFlight = false;
  }
}

window.addEventListener('pagehide', () => {
  flushBatterySave(true);
});

// Setup input handlers once
document.addEventListener('keydown', function(e) {
  if (!currentNes) return;
  if (gameplayKeys.has(e.code)) e.preventDefault();
  currentNes.joypad0.keyStatus[e.code] = 1;
  if(e.code == "KeyQ")
    currentNes.quit = true;
  if(e.code == "KeyR") {
    currentNes.reset();
  }
}, false);

document.addEventListener('keyup', function(e) {
  if (!currentNes) return;
  if (gameplayKeys.has(e.code)) e.preventDefault();
  currentNes.joypad0.keyStatus[e.code] = 0;
}, false);

async function main(rom) {
  // Stop previous emulation if running
  await flushBatterySave(true);

  if (currentEmulation) {
    clearInterval(currentEmulation);
    currentEmulation = null;
  }
  
  if (currentNes) {
    currentNes.onBatteryRamWrite = null;
    if (currentNes.output) {
      currentNes.output.soundStop();
    }
    currentNes = null;
  }

  var output = new Output();

  var nes = new NES(output);
  output.nes = nes;
  output.soundStart();

  if(!nes.load(rom)) {
    console.log("invalid rom");
    return;
  }

  batteryState.romId = nes.rom.romId;
  batteryState.romName = null;
  batteryState.activeSlot = currentSlotFromUI();
  batteryState.dirty = false;
  batteryState.inFlight = false;
  batteryState.lastSavedAt = 0;
  batteryState.lastSavedSignature = null;
  if (batteryState.timerId) {
    clearTimeout(batteryState.timerId);
    batteryState.timerId = null;
  }

  if (hasBatteryRam(nes) && batteryState.romId) {
    try {
      const saved = await loadBatterySave(batteryState.romId, BATTERY_SLOT);
      if (saved) {
        for (let i = 0; i < nes.rom.sram.length; i++) {
          nes.rom.sram[i] = saved[i] & 0xff;
        }
        batteryState.lastSavedSignature = sramSignature(nes.rom.sram);
        console.log('Loaded battery save from IndexedDB');
        setStatus('BATTERY LOADED');
      } else {
        batteryState.lastSavedSignature = sramSignature(nes.rom.sram);
        setStatus('NO BATTERY SAVE DATA');
      }
      await refreshBatterySaveList();
    } catch (e) {
      console.warn('Failed to load battery SRAM:', e);
      setStatus('LOAD FAILED', 3000);
      await refreshBatterySaveList();
    }
  } else {
    await refreshBatterySaveList();
  }

  nes.reset();

  if(nes.mapper == null) {
    console.log("unsupported mapper for the rom");
    return;
  }

  // Update global reference
  currentNes = nes;
  nes.onBatteryRamWrite = markBatteryDirty;

  nes.debug = false;
  nes.cpu.debug = false;
  nes.ppu.debug = false;
  nes.apu.debug = false;

  console.log("Starting NES emulation");
  try {
    currentEmulation = setInterval(async function() {
      nes.frame();
      flushBatterySave(false);

      if(nes.quit) {
        await flushBatterySave(true);
        console.log("Finished NES emulation");
        output.soundStop();

        // Only offer download if it was a manual quit? 
        // Or keep original behavior.
        var blob = new Blob([nes.log], { "type" : "text/plain" });
        var e = document.createElement("a");
        e.download = "jsnes.txt";
        e.href = window.URL.createObjectURL(blob);
        e.click();

        clearInterval(currentEmulation);
        currentEmulation = null;
        batteryState.romId = null;
        batteryState.romName = null;
        batteryState.dirty = false;
        batteryState.lastSavedSignature = null;
        if (batteryState.timerId) {
          clearTimeout(batteryState.timerId);
          batteryState.timerId = null;
        }
        nes.onBatteryRamWrite = null;
        currentNes = null;
        refreshBatterySaveList();
      }
    }, 1000/60);
  } catch(e) {
    console.log(e);
    return;
  }
}


document.addEventListener('DOMContentLoaded', () => {
    const consoleCanvas = document.querySelector('#console');

    const openFolderBtn = document.querySelector('#open-folder');
    const resetBtn = document.querySelector('#reset-btn');
  const saveBatteryBtn = document.querySelector('#save-battery-btn');
  const loadBatteryBtn = document.querySelector('#load-battery-btn');
  const exportBatteryBtn = document.querySelector('#export-battery-btn');
  const importBatteryBtn = document.querySelector('#import-battery-btn');
  const importBatteryInput = document.querySelector('#import-battery-input');
  const batterySlot = document.querySelector('#battery-slot');
    const romListDiv = document.querySelector('#rom-list');

  refreshBatterySaveList();

    if (resetBtn) {
        resetBtn.onclick = () => {
             if (currentNes) {
                 currentNes.reset();
                 consoleCanvas.focus();
             }
        };
    }

    if (openFolderBtn) {
        openFolderBtn.onclick = async () => {
            try {
                const dirHandle = await window.showDirectoryPicker();
                romListDiv.innerHTML = '';
                romListDiv.style.display = 'block';

                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.nes')) {
                        const btn = document.createElement('button');
                        btn.textContent = entry.name;
                        // Styles are now handled in CSS for compactness
                        btn.onclick = async () => {
                            const file = await entry.getFile();
                            const buffer = await file.arrayBuffer();
                          await main(new Uint8Array(buffer));
                          batteryState.romName = entry.name.replace(/\.nes$/i, '');
                          await refreshBatterySaveList();
                          setStatus('ROM LOADED: ' + entry.name, 1800);
                            consoleCanvas.focus();
                        };
                        romListDiv.appendChild(btn);
                    }
                }
            } catch (err) {
                console.error("Error accessing folder:", err);
            }
        };
    }

    if (saveBatteryBtn) {
      saveBatteryBtn.onclick = async () => {
        if (!currentNes || !batteryState.romId) {
          setStatus('NO ROM LOADED');
          return;
        }

        const slot = currentSlotFromUI();
        const quick = createQuickState(currentNes);
        if (!quick) {
          setStatus('QUICK SAVE FAILED', 3000);
          return;
        }

        const key = `${batteryState.romId}:${slot}`;
        quickStateSlots.set(key, quick);

        try {
          await saveQuickState(batteryState.romId, slot, quick);
          setStatus('QUICK SAVED SLOT ' + slot);
        } catch (e) {
          console.warn('Failed to persist quick save:', e);
          setStatus('QUICK SAVE FAILED', 3000);
        }
      };
    }

    if (loadBatteryBtn) {
      loadBatteryBtn.onclick = async () => {
        if (!currentNes || !batteryState.romId) {
          setStatus('NO ROM LOADED');
          return;
        }

        const slot = currentSlotFromUI();
        const key = `${batteryState.romId}:${slot}`;
        let quick = quickStateSlots.get(key);
        if (!quick) {
          try {
            quick = await loadQuickState(batteryState.romId, slot);
            if (quick) quickStateSlots.set(key, quick);
          } catch (e) {
            console.warn('Failed to load quick save:', e);
          }
        }

        if (!quick) {
          setStatus('EMPTY QUICK SLOT ' + slot);
          return;
        }

        const restored = restoreQuickState(currentNes, quick);
        if (!restored) {
          setStatus('QUICK LOAD FAILED', 3000);
          return;
        }

        if (currentNes.output && currentNes.output.buf) {
          currentNes.output.buf.fill(0);
          // Prime buffer counters so newSound can immediately generate fresh samples.
          currentNes.output.playing = currentNes.output.BUF_SIZE;
          currentNes.output.played = 0;
          if (currentNes.output.soundContext && currentNes.output.soundContext.state === 'suspended') {
            currentNes.output.soundContext.resume().catch((e) => {
              console.warn('Failed to resume AudioContext after quick load:', e);
            });
          }
        }

        batteryState.activeSlot = slot;
        setStatus('QUICK LOADED SLOT ' + slot);
      };
    }

    if (exportBatteryBtn) {
      exportBatteryBtn.onclick = () => {
        if (!currentNes || !batteryState.romId || !hasBatteryRam(currentNes)) {
          setStatus('NO SRAM AVAILABLE');
          return;
        }

        const slot = currentSlotFromUI();
        const name = (batteryState.romName || batteryState.romId || 'battery').replace(/[^a-zA-Z0-9_-]/g, '_');
        const bytes = new Uint8Array(currentNes.rom.sram.length);
        for (let i = 0; i < currentNes.rom.sram.length; i++) {
          bytes[i] = currentNes.rom.sram[i] & 0xff;
        }

        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.download = `${name}-slot${slot}.sav`;
        a.href = window.URL.createObjectURL(blob);
        a.click();
        setStatus('EXPORTED SLOT ' + slot);
      };
    }

    if (importBatteryBtn && importBatteryInput) {
      importBatteryBtn.onclick = () => {
        importBatteryInput.value = '';
        importBatteryInput.click();
      };

      importBatteryInput.onchange = async () => {
        if (!currentNes || !batteryState.romId || !hasBatteryRam(currentNes)) {
          setStatus('NO SRAM AVAILABLE');
          return;
        }

        const file = importBatteryInput.files && importBatteryInput.files[0];
        if (!file) return;

        try {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const size = Math.min(bytes.length, currentNes.rom.sram.length);
          for (let i = 0; i < currentNes.rom.sram.length; i++) {
            currentNes.rom.sram[i] = i < size ? (bytes[i] & 0xff) : 0;
          }
          markBatteryDirty();
          await flushBatterySave(true);
          currentNes.reset();
          setStatus('BATTERY IMPORTED (RESET)');
          await refreshBatterySaveList();
        } catch (e) {
          console.warn('Failed to import battery SRAM:', e);
          setStatus('IMPORT FAILED', 3000);
        }
      };
    }

    if (batterySlot) {
      batterySlot.onchange = async () => {
        setStatus('ACTIVE QUICK SLOT: ' + currentSlotFromUI(), 1200);
        await refreshBatterySaveList();
      };
    }
});


