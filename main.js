import { NES, } from './src/nes.js'
import { Output, } from './src/output.js'
import * as util from './src/util.js'

export async function main(rom) {
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

  document.addEventListener('keydown', function(e) {
    nes.joypad0.keyStatus[e.code] = 1;
    if(e.code == "KeyQ")
      nes.quit = true;
    if(e.code == "KeyR") {
      nes.reset();
    }
  }, false);

  document.addEventListener('keyup', function(e) {
    nes.joypad0.keyStatus[e.code] = 0;
  }, false);

  nes.debug = false;
  nes.cpu.debug = false;
  nes.ppu.debug = false;
  nes.apu.debug = false;

  console.log("Starting NES emulation");
  try {
    var emulation = setInterval(async function() {
      nes.frame();

      if(nes.quit) {
        console.log("Finished NES emulation");
        output.soundStop();

        var blob = new Blob([nes.log], { "type" : "text/plain" });
        var e = document.createElement("a");
        e.download = "jsnes.txt";
        e.href = window.URL.createObjectURL(blob);
        e.click();

        clearInterval(emulation);
      }
    }, 1000/60);
  } catch(e) {
    console.log(e);
    return;
  }
}

