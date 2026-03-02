import { NES, } from './src/nes.js'
import { Output, } from './src/output.js'
import * as util from './src/util.js'

let currentNes = null;
let currentEmulation = null;

// Setup input handlers once
document.addEventListener('keydown', function(e) {
  if (!currentNes) return;
  currentNes.joypad0.keyStatus[e.code] = 1;
  if(e.code == "KeyQ")
    currentNes.quit = true;
  if(e.code == "KeyR") {
    currentNes.reset();
  }
}, false);

document.addEventListener('keyup', function(e) {
  if (!currentNes) return;
  currentNes.joypad0.keyStatus[e.code] = 0;
}, false);

async function main(rom) {
  // Stop previous emulation if running
  if (currentEmulation) {
    clearInterval(currentEmulation);
    currentEmulation = null;
  }
  
  if (currentNes) {
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

  nes.reset();

  if(nes.mapper == null) {
    console.log("unsupported mapper for the rom");
    return;
  }

  // Update global reference
  currentNes = nes;

  nes.debug = false;
  nes.cpu.debug = false;
  nes.ppu.debug = false;
  nes.apu.debug = false;

  console.log("Starting NES emulation");
  try {
    currentEmulation = setInterval(async function() {
      nes.frame();

      if(nes.quit) {
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
        currentNes = null;
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
    const romListDiv = document.querySelector('#rom-list');

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
                            main(new Uint8Array(buffer));
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
});


