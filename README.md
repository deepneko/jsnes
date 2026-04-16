# JSNES
NES emulator for the browser (JavaScript + Vite).

Live Demo: https://jsnes.dev/

## Current Features
- Load local `.nes` ROM files from a folder picker.
- Mapper support: NROM (000), MMC1 (001), UNROM (002), CNROM (003).
- Quick Save / Quick Load with slot selector (SLOT 0-9).
- Quick states are persisted in IndexedDB per ROM + slot.
- Battery SRAM (in-game save data) auto-save/auto-load via IndexedDB.
- Battery save export/import as `.sav` files.

## Save System
Two save systems are available and they are independent:

1. Quick State
- Buttons: `Q-SAVE`, `Q-LOAD`
- Scope: full emulator runtime state
- Storage: IndexedDB (per ROM + selected quick slot)

2. Battery Save (SRAM)
- Scope: in-game save data (for games that use SRAM)
- Storage: auto-managed IndexedDB entry (dedicated internal battery slot)
- File IO: `BATT EXPORT`, `BATT IMPORT` for `.sav`

## Usage
1. Open the app.
2. Click `LOAD ROM FOLDER`.
3. Select a local directory containing `.nes` files.
4. Click a ROM in the list to start.
5. Use `RESET` to restart the currently running game.

## Controls
| NES | Keyboard |
| --- | --- |
| Move | Arrow keys |
| A Button | Z |
| B Button | X |
| Start | Enter |
| Select | Space |
| Emulator Quit (debug) | Q |
| Emulator Reset (hotkey) | R |

## Development
Install dependencies:

    npm install

Run dev server:

    npm run dev

Build:

    npm run build

Preview production build:

    npm run preview

## Notes
- Folder loading uses the File System Access API (`showDirectoryPicker`), which is best supported in Chromium-based browsers.
- Save data is origin-scoped. Clearing browser site data removes IndexedDB saves.

## Tested Games
### NROM (iNES Mapper 000)
<img src="https://github.com/deepneko/jsnes/blob/images/mario1.png" alt="Super Mario 1" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/xevious.png" alt="Xevious" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/spelunker.png" alt="Spelunker" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/druaga.png" alt="Druaga" width="150"/>

### MMC1 (iNES Mapper 001)
<img src="https://github.com/deepneko/jsnes/blob/images/rockman2.png" alt="Rockman 2" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/ff1.png" alt="Final Fantasy I" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/dq3.png" alt="Dragon Quest III" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/dq4.png" alt="Dragon Quest IV" width="150"/>

### UNROM (iNES Mapper 002)
<img src="https://github.com/deepneko/jsnes/blob/images/rockman.png" alt="Rockman" width="150"/>

### CNROM (iNES Mapper 003)
<img src="https://github.com/deepneko/jsnes/blob/images/dq1.png" alt="Dragon Quest I" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/portopia.png" alt="Portopia Renzoku Satsujin Jiken" width="150"/> <img src="https://github.com/deepneko/jsnes/blob/images/takahashi.png" alt="Takahashi Meijin no Boken Jima" width="150"/>

## References
- https://www.nesdev.org/wiki/Nesdev_Wiki
- https://www.nesdev.org/wiki/NES_reference_guide

## License
MIT. See LICENSE.

