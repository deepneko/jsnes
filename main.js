import { NES, } from './src/nes.js'
import { Output, } from './src/output.js'
import * as util from './src/util.js'

export function main(rom) {
  var canvas = document.getElementById('console');
  var output = new Output(canvas);

  var nes = new NES(output);
  if(!nes.load(rom)) {
    console.log("invalid rom");
    return;
  }

  nes.reset();

  if(nes.mapper == null) {
    console.log("unsupported mapper for the rom");
    return;
  }

  var quit = false;
  document.addEventListener('keydown', function(e) {
    nes.joypad0.key_status[e.code] = 1;

    if(nes.debug)
      util.log(nes, "Input Keydown:" + e.code);

    if(e.code == "KeyQ")
      quit = true;
    if(e.code == "Backspace") {
      nes.debug = true;
      nes.cpu.debug = true;
    }
    if(e.code == "KeyP")
      nes.ppu.debug = true;
  }, false);

  document.addEventListener('keyup', function(e) {
    nes.joypad0.key_status[e.code] = 0;
  }, false);

  console.log("Starting NES emulation");

  //nes.debug = true;
  //nes.cpu.debug = true;
  var cnt = 0;
  try {
    var timer = setInterval(function() {
      nes.frame();
      cnt++;
      /*
      if(cnt == 31 || cnt == 32) {
        nes.ppu.debug = true;
      } else {
        nes.ppu.debug = false;
      }
      */

      if(quit) {
        console.log("nes return");
        clearInterval(timer);

        var blob = new Blob([nes.log], { "type" : "text/plain" });
        var e = document.createElement("a");
        e.download = "jsnes.txt";
        e.href = window.URL.createObjectURL(blob);
        e.click();
      }
    }, 1000/60);
  } catch(e) {
    console.log(e);
    return;
  }
}

