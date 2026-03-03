# JSNES
Simple NES emulator in JavaScript.

Live Demo: https://jsnes.kokonani.com/

## Usage
1. Open the application.
2. Click the **"LOAD ROM FOLDER"** button on the left sidebar.
3. Select a local folder containing your `.nes` ROM files.
   (The browser will ask for permission to view the files.)
4. The list of ROMs will appear in the sidebar. Click on a game to start playing.
5. To restart the game, click the **"RESET"** button.

## Development

Install dependencies:

    $ npm install

Start a local development server:

    $ npm run dev

Then open http://localhost:5173 in your browser.

## Key bindings
| NES        	| Keyboard  |
|-----------	|----------	|
| Up        	| W       	|
| Down      	| S     	|
| Left      	| A     	|
| Right     	| D        	|
| A Button      | L      	|
| B Button      | K         |
| Start    	    | Enter    	|
| Select     	| Space   	|

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

