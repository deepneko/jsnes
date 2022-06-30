# JSNES
JavaScript NES emulator with Canvas.

## Usage
Place your ROM file and add the file path to index.html.

    <option value="./rom/mario1.nes">mario1</option>

Start a local web server.

    $ ruby webrick.rb 9999

Then, you can play the game via http://localhost:9999.

## Games
Confirmed these games worked well.

### NROM (INES Mapper 000)
<img src="https://github.com/deepneko/jsnes/blob/images/mario1.png" alt="Super Mario 1" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/xevious.png" alt="Xevious" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/spelunker.png" alt="Spelunker" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/druaga.png" alt="Druaga" width="150"/>

### MMC1 (INES Mapper 001)
<img src="https://github.com/deepneko/jsnes/blob/images/rockman2.png" alt="Rockman 2" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/ff1.png" alt="Final Fantasy I" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/dq3.png" alt="Dragon Quest III" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/dq4.png" alt="Dragon Quest IV" width="150"/>

### UNROM (INES Mapper 002)
<img src="https://github.com/deepneko/jsnes/blob/images/rockman.png" alt="Rockman" width="150"/>

### CNROM (INES Mapper 003)
<img src="https://github.com/deepneko/jsnes/blob/images/dq1.png" alt="Dragon Quest I" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/portopia.png" alt="Portopia Renzoku Satsujin Jiken" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/takahashi.png" alt="Takahashi Meijin no Boken Jima" width="150"/>

## Reference
https://www.nesdev.org/wiki/Nesdev_Wiki  
https://www.nesdev.org/wiki/NES_reference_guide

## License
MIT License. Please see LICENSE file.

