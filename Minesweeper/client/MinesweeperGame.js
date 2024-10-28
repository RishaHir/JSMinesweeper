/**
 *   This module defines a game of minesweeper
 *   
 *   Intended to be used by the server or the client depending on how the solver is being run
 */

"use strict";

// const board = require("./Board.js");
// const Board = board.Board;
// require("./Tile.js");
// const solver_main = require("./solver_main.js");
// const PLAY_STYLE_NOFLAGS = solver_main.PLAY_STYLE_NOFLAGS; 
// require("./BruteForceAnalysis.js");
// require("./SolutionCounter.js");
// require("./EfficiencyHelper.js");
// require("./FiftyFiftyHelper.js");
// require("./LongTermRiskHelper.js");
// const main = require("./main.js");
// const oldrng = main.oldrng;
// require("../Utility/PrimeSieve.js");
// require("../Utility/Binomial.js");
/**
 * 
 */
"use strict";

var height = 16;


function apply() {

	if (document.getElementById("beginner").checked) {
		doNewGame(9, 9, 10);
		return;
	}

	if (document.getElementById("intermediate").checked) {
		doNewGame(16, 16, 40);
		return;
	}

	if (document.getElementById("expert").checked) {
		doNewGame(30, 16, 99);
		return;
	}

	//const MAX_WIDTH = 250;
	//const MAX_HEIGHT = 250;

	var widthX = document.getElementById("width").value;
	var heightX = document.getElementById("height").value;
	var minesX = document.getElementById("mines").value;

	if (isNaN(widthX)) {
		document.getElementById("width").focus();
		return;
	}
	if (isNaN(heightX)) {
		document.getElementById("height").focus();
		return;
	}
	if (isNaN(minesX)) {
		document.getElementById("mines").focus();
		return;
	}

	var width = Number(widthX);
	var height = Number(heightX);
	var mines = Number(minesX);

	if (width < 1) {
		document.getElementById("width").value = 30
		width = 30;
	}

	if (width > MAX_WIDTH) {
		document.getElementById("width").value = MAX_WIDTH;
		width = MAX_WIDTH;
	}

	if (height < 1) {
		document.getElementById("height").value = 16
		height = 16;
	}

	if (height > MAX_HEIGHT) {
		document.getElementById("height").value = MAX_HEIGHT;
		height = MAX_HEIGHT;
	}

	if (mines < 1) {
		document.getElementById("mines").value = 99
		mines = 99;
	}

	if (mines > width * height - 1) {
		document.getElementById("mines").value = width * height - 1;
		mines = width * height - 1;
	}

	doNewGame(width, height, mines);

}

function doNewGame(width, height, mines) {

	if (document.getElementById("useSeed").checked) {
		newGame(width, height, mines, document.getElementById("seed").value);
	} else {
		newGame(width, height, mines, 0);
	}

}

function setAnalysis() {

	// can't switch modes while the solver is working
	if (canvasLocked) {
		return;
	}

	if (!analysisMode) {
		//document.getElementById("play0").style.display = "none";
		//document.getElementById("play1").style.display = "none";
		//document.getElementById("analysis0").style.display = "block";
		//document.getElementById("analysis1").style.display = "block";
		//document.getElementById("repeatGame").style.display = "none";
		//document.getElementById("NewGame").innerHTML = "Reset board";

		switchToAnalysis(true);
	} else {
		//document.getElementById("play0").style.display = "";
		//document.getElementById("play1").style.display = "";
		//document.getElementById("analysis0").style.display = "none";
		//document.getElementById("analysis1").style.display = "none";
		//document.getElementById("repeatGame").style.display = "";
		//document.getElementById("NewGame").innerHTML = "New game";

		switchToAnalysis(false);
	}


}

function makeCustom() {

	document.getElementById("custom").checked = true;

}

class Board {
	
	constructor(id, width, height, num_bombs, seed, gameType) {
		
		//console.log("Creating a new board with id=" + id + " ...");

		this.MAX = 4294967295;

        this.id = id;
        this.gameType = gameType;
		this.width = width;
		this.height = height;
        this.num_bombs = num_bombs;
        this.seed = seed;

		this.tiles = [];
		this.started = false;
		this.bombs_left = this.num_bombs;

		this.init_tiles();

		this.gameover = false;
		this.won = false;

		this.highDensity = false;

		this.compressor = new Compressor();

		//console.log("... board created");

		Object.seal(this) // prevent new properties being created
	}

	isStarted() {
		return this.started;
	}
	
	setGameLost() {
		this.gameover = true;
	}

    setGameWon() {
        this.gameover = true;
        this.won = true;
    }

	isGameover() {
		return this.gameover;
	}
	
	
	getID() {
		return this.id;
	}
	
	setStarted() {
		
		if (this.start) {
			console.log("Logic error: starting the same game twice");
			return;
		}
		
		this.started = true;
	}

	setHighDensity(tilesLeft, minesLeft) {

		if (minesLeft * 5 > tilesLeft * 2) {
			this.highDensity = true;
		} else {
			this.highDensity = false;
        }

    }

	isHighDensity() {
		return this.highDensity;
    }

	xy_to_index(x, y) {
		return y*this.width + x;
	}
	
	getTileXY(x, y) {

		if (x < 0 || x >= this.width || y < 0 || y >= height) {
			return null;
        }

		const index = this.xy_to_index(x,y);
		
		return this.tiles[index];
		
	}
	
	getTile(index) {
		
		return this.tiles[index];
		
	}
	
	// true if number of flags == tiles value
	// and number of unrevealed > 0
	canChord(tile) {
		
		let flagCount = 0;
		let coveredCount = 0;		
		for (let adjTile of this.getAdjacent(tile)) {
			if (adjTile.isFlagged()) {  
				flagCount++;
			}
			if (adjTile.isCovered() && !adjTile.isFlagged()) {  
				coveredCount++;
			}
		}
		
		return (flagCount == tile.getValue()) && (coveredCount > 0);
		
	}

    // return number of confirmed mines adjacent to this tile
    adjacentFoundMineCount(tile) {

        let mineCount = 0;
        for (let adjTile of this.getAdjacent(tile)) {
			if (adjTile.isSolverFoundBomb()) {
                mineCount++;
            }
        }

        return mineCount;

    }

	// return number of flags adjacent to this tile
	adjacentFlagsPlaced(tile) {

		let flagCount = 0;
		for (let adjTile of this.getAdjacent(tile)) {
			if (adjTile.isFlagged()) {
				flagCount++;
			}
		}

		return flagCount;

	}

    // return number of covered tiles adjacent to this tile
    adjacentCoveredCount(tile) {

        let coveredCount = 0;
        for (let adjTile of this.getAdjacent(tile)) {
			//if (adjTile.isCovered() && !adjTile.isFlagged()) {
			if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                coveredCount++;
            }
        }

        return coveredCount;

    }

	// header for messages sent to the server
	getMessageHeader() {
        return { "id": this.id, "width": this.width, "height": this.height, "mines": this.num_bombs, "seed": this.seed, "gametype" : this.gameType};
	}
	
	// returns all the tiles adjacent to this tile
	getAdjacent(tile) {
		
		const col = tile.x;
		const row = tile.y;

		const first_row = Math.max(0, row - 1);
		const last_row = Math.min(this.height - 1, row + 1);

		const first_col = Math.max(0, col - 1);
		const last_col = Math.min(this.width - 1, col + 1);

		const result = []

		for (let r = first_row; r <= last_row; r++) {
			for (let c = first_col; c <= last_col; c++) {
				if (!(r == row && c == col)) {  // don't include ourself
					const i = this.width * r + c;
					result.push(this.tiles[i]);
				}
			}
		}

		return result;
	}

	getFlagsPlaced() {

		let tally = 0;
		for (let i = 0; i < this.tiles.length; i++) {
			if (this.tiles[i].isFlagged()) {
				tally++;
            }
        }
			 
		return tally;
    }

	// sets up the initial tiles 
	init_tiles() {
		
		for (let y=0; y < this.height; y++) {
			for (let x=0; x < this.width; x++) {
				this.tiles.push(new Tile(x, y, y * this.width + x));
			}
		}
		
	}

	setAllZero() {
		for (let i = 0; i < this.tiles.length; i++) {
			this.tiles[i].setValue(0);
		}
    }

	hasSafeTile() {
		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			if (tile.getHasHint() && tile.probability == 1) {
				return true;
            }
		}

		return false;
	}

	getSafeTiles() {
		const result = [];

		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			if (tile.getHasHint() && tile.probability == 1) {
				result.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR));
			}
		}

		return result;
	}

	// optionally treat flags as mines (e.g. in analysis mode but not playing or replay)
	// place mines when they are trivially found
	// The idea is to get the board into a state as pobability engine friendly as possible
	// If an invalid tile is found returns it to be reported
	resetForAnalysis(flagIsMine, findObviousMines) {

		//const start = Date.now();

		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];

			if (!tile.isCovered() && tile.isFlagged()) {
				console.log(tile.asText() + " is flagged but not covered!");
			}

			if (tile.isFlagged()) {
				tile.foundBomb = flagIsMine;
			} else {
				tile.foundBomb = false;
			}
		}

		if (!findObviousMines) {
			return null;
        }

		for (let i = 0; i < this.tiles.length; i++) {

			const tile = this.getTile(i);

			if (tile.isCovered()) {
				if (this.isTileAMine(tile)) {  // a tile is an obvious mine if every adjacent witness agrees it is
					tile.setFoundBomb();  
                }
				continue;  // if the tile hasn't been revealed yet then nothing to consider
			}

			const adjTiles = this.getAdjacent(tile);

			let flagCount = 0;
			let coveredCount = 0;
			for (let j = 0; j < adjTiles.length; j++) {
				const adjTile = adjTiles[j];
				if (adjTile.isCovered()) {
					coveredCount++;
				}
				if (adjTile.isFlagged()) {
					flagCount++;
                }
			}

			if (coveredCount > 0 && tile.getValue() == coveredCount) { // can place all flags
				//for (let j = 0; j < adjTiles.length; j++) {
				//	const adjTile = adjTiles[j];
				//	if (adjTile.isCovered()) { // if covered 
				//		adjTile.setFoundBomb();   // Must be a bomb
				//	}
				//}
			} else if (tile.getValue() < flagCount) {
				//console.log(tile.asText() + " is over flagged");
			} else if (tile.getValue() > coveredCount) {
				//console.log(tile.asText() + " has an invalid value of " + tile.getValue() + " with only " + coveredCount + " surrounding covered tiles");
				return tile;
            }

		}	

		//console.log("Reset for Analysis took " + (Date.now() - start) + " milliseconds");

		return null;
    }

	// if every witness around this tile agrees it is a mine, then set it as a mine
	isTileAMine(tile) {

		const adjTiles = this.getAdjacent(tile);

		let witnessCount = 0;
		for (let j = 0; j < adjTiles.length; j++) {
			const adjTile = adjTiles[j];

			if (adjTile.isCovered()) {
				continue;
			}

			witnessCount++;

			// if this witness denies all the remaining hidden tiles are mines then don't continue
			if (!this.checkWitness(adjTile)) {
				return false;
            }

		}

		if (witnessCount == 0) {
			return false;

		} else {  // all the adjacent witnesses agree that this tile is a mine
			return true;
        }

		


    }

	// see if this witness thinks all adjacent hidden ties are mines
	checkWitness(tile) {

		const adjTiles = this.getAdjacent(tile);

		let coveredCount = 0;
		for (let j = 0; j < adjTiles.length; j++) {
			const adjTile = adjTiles[j];
			if (adjTile.isCovered()) {
				coveredCount++;
			}
		}

		if (coveredCount > 0 && tile.getValue() == coveredCount) { // only room left for mines
			return true;
		}

    }

	getHashValue() {

		let hash = (31 * 31 * 31 * this.num_bombs + 31 * 31 * this.getFlagsPlaced() + 31 * this.width + this.height) % this.MAX;

		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			if (tile.isFlagged()) {
				hash = (31 * hash + 13) % this.MAX;
			} else if (tile.isCovered()) {
				hash = (31 * hash + 12) % this.MAX;
			} else {
				hash = (31 * hash + tile.getValue()) % this.MAX;
			}
        }

		return hash;
	}

	// returns a string that represents this board state which can be save and restored later
	getStateData() {

		// wip

		for (var i = 0; i < this.tiles.length; i++) {
			var tile = this.tiles[i];
			if (tile.isFlagged()) {
				hash = (31 * hash + 13) % this.MAX;
			} else if (tile.isCovered()) {
				hash = (31 * hash + 12) % this.MAX;
			} else {
				hash = (31 * hash + tile.getValue()) % this.MAX;
			}
		}


	}

	findAutoMove() {

		const result = new Map();

		for (let i = 0; i < this.tiles.length; i++) {

			const tile = this.getTile(i);

			if (tile.isFlagged()) {
				continue;  // if the tile is a mine then nothing to consider
			} else if (tile.isCovered()) {
				continue;  // if the tile hasn't been revealed yet then nothing to consider
			}

			const adjTiles = this.getAdjacent(tile);

			let needsWork = false;
			let flagCount = 0;
			let coveredCount = 0;
			for (let j = 0; j < adjTiles.length; j++) {
				const adjTile = adjTiles[j];
				if (adjTile.isCovered() && !adjTile.isFlagged()) {
					needsWork = true;
				}
				if (adjTile.isFlagged()) {
					flagCount++;
				} else if (adjTile.isCovered()) {
					coveredCount++;
                }
			}

			if (needsWork) {  // the witness still has some unrevealed adjacent tiles
				if (tile.getValue() == flagCount) {  // can clear around here
					for (let j = 0; j < adjTiles.length; j++) {
						const adjTile = adjTiles[j];
						if (adjTile.isCovered() && !adjTile.isFlagged()) {
							result.set(adjTile.index, new Action(adjTile.getX(), adjTile.getY(), 1, ACTION_CLEAR));
						}
					}			

				} else if (tile.getValue() == flagCount + coveredCount) { // can place all flags
					for (let j = 0; j < adjTiles.length; j++) {
						const adjTile = adjTiles[j];
						if (adjTile.isCovered() && !adjTile.isFlagged()) { // if covered and isn't flagged
							adjTile.setFoundBomb();   // Must be a bomb
							result.set(adjTile.index, new Action(adjTile.getX(), adjTile.getY(), 0, ACTION_FLAG));
						}
					}			
                }
			}

		}	

		// send it back as an array
		return Array.from(result.values());

	} 

	getFormatMBF() {

		if (this.width > 255 || this.height > 255) {
			console.log("Board too large to save as MBF format");
			return null;
        }

		const length = 4 + 2 * this.num_bombs;

		const mbf = new ArrayBuffer(length);
		const mbfView = new Uint8Array(mbf);

		mbfView[0] = this.width;
		mbfView[1] = this.height;

		mbfView[2] = Math.floor(this.num_bombs / 256);
		mbfView[3] = this.num_bombs % 256;

		let minesFound = 0;
		let index = 4;
		for (let i = 0; i < this.tiles.length; i++) {

			const tile = this.getTile(i);

			if (tile.isFlagged()) {
				minesFound++;
				if (index < length) {
					mbfView[index++] = tile.getX();
					mbfView[index++] = tile.getY();
                }
			}
		}

		if (minesFound != this.num_bombs) {
			console.log("Board has incorrect number of mines. board=" + this.num_bombs + ", found=" + minesFound);
			return null;
		}

		console.log(...mbfView);

		return mbf;

    }

	getPositionData() {

		const newLine = "\n";

		let data = this.width + "x" + this.height + "x" + this.num_bombs + newLine;

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const tile = this.getTileXY(x, y);
				if (tile.isFlagged()) {
					data = data + "F";

				} else if (tile.isCovered() || tile.isBomb()) {
					data = data + "H";

				} else {
					data = data + tile.getValue();
                } 
			}
			data = data + newLine;
        }

		return data;

    }

	// this version of the compression only deflates flags which don't result in values < 0
	getSimpleCompressedData() {

		const start = Date.now();

		// The games dimensions
		const width = this.width;
		const height = this.height;
		const mines = this.num_bombs;

		// an array to do the processing
		let a = [];

		// transfer the values into an array
		for (let y = 0; y < height; y++) {

			let xa = [];

			for (let x = 0; x < width; x++) {
				const tile = this.getTileXY(x, y);

				if (tile.isFlagged()) {
					xa.push(10);  // placed flag

				} else if (tile.isCovered() || tile.isBomb()) { // a covered tile, or an exploded mine
					xa.push(9);  // hidden

				} else {
					xa.push(tile.getValue());  // revealed

				}
			}
			a.push(xa);
		}

		// find obvious mines not flagged, we need these otherwise we can't deflate games with NF style 
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {

				const value = a[y][x];

				if (value < 9) {
					const ys = Math.max(0, y - 1);
					const ye = Math.min(height - 1, y + 1);

					const xs = Math.max(0, x - 1);
					const xe = Math.min(width - 1, x + 1);

					let spaces = 0;
					for (let y1 = ys; y1 <= ye; y1++) {
						for (let x1 = xs; x1 <= xe; x1++) {
							if (a[y1][x1] > 8) {
								spaces++;
							}
						}
					}
					if (spaces == value) { // if the number of spaces equals the value then anything unflagged is a 'hidden flag'
						//console.log(x + " " + y + " " + value + " " + spaces);
						for (let y1 = ys; y1 <= ye; y1++) {
							for (let x1 = xs; x1 <= xe; x1++) {
								if (a[y1][x1] == 9) {
									//console.log( "-- " + x1 + " " + y1);
									a[y1][x1] = 11;  // a trivially found mine but not flagged
								}
							}
						}
					}

				}
			}
		}

		// see which flags can be deflated
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {

				const value = a[y][x];

				if (value == 10 || value == 11) {
					const ys = Math.max(0, y - 1);
					const ye = Math.min(height - 1, y + 1);

					const xs = Math.max(0, x - 1);
					const xe = Math.min(width - 1, x + 1);

					// check that all the adjacent revealed tiles can be reduced (i.e. not already zero)
					let okay = true;
					for (let y1 = ys; y1 <= ye; y1++) {
						for (let x1 = xs; x1 <= xe; x1++) {
							if (a[y1][x1] == 0) {
								okay = false
							}
						}
					}
					if (okay) { // every adjacent revealed tile can be reduced by 1
						for (let y1 = ys; y1 <= ye; y1++) {
							for (let x1 = xs; x1 <= xe; x1++) {
								if (a[y1][x1] < 9) {
									a[y1][x1]--;
								}
							}
						}
					} else {
						if (a[y][x] == 10) {  // placed flag that overflags a revealed tile
							a[y][x] = 12;  // overflagged ==> flag that isn't inflated

						} else if (a[y][x] == 11) {  // hidden flag that overflags a revealed tile
							a[y][x] = 9;  // revert back to a hidden tile
						} 
						
					}

				}
			}
		}

		let data = "";

		// convert to a string
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {

				const value = a[y][x];

				if (value == 10) { // flagged and deflated
					data = data + "F";

				} else if (value == 11) { // a mine is here but not flagged, deflated 
					data = data + "I";

				} else if (value == 12) { // a flag which wasn't deflated
					data = data + "O";

				} else if (value == 9) {  // a hidden tile
					data = data + "H";

				} else { // a revealed tile's value (after deflation)
					data = data + value;
				}
			}
		}

		// get a compressor class
		const compressor = new Compressor();

		// compress the data to base 62
		let cWidth = compressor.compressNumber(width, 2);
		let cHeight = compressor.compressNumber(height, 2);
		let cMines = compressor.compressNumber(mines, 4);

		let cBoard = compressor.compress(data);

		let output = cWidth + cHeight + cMines + cBoard;

		//console.log("Compressed data length " + output.length + " analysis=" + output);
		//console.log("Time to compress " + (Date.now() - start) + " milliseconds");

		return output;

	}

	getCompressedData(reduceMines) {

		// this identifies obvious mines
		this.resetForAnalysis(false, true);

		let data = "";

		let reducedMines = 0;

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const tile = this.getTileXY(x, y);

				if (tile.isSolverFoundBomb()) {
					// an enclosed certain mine can be set to '0'
					if (reduceMines && this.adjacentCoveredCount(tile) == 0) {
						data = data + "0";
						reducedMines++;

					// otherwise set to Flagged, or 'I' = Hidden + Inflate
					} else {
						if (tile.isFlagged()) {
							data = data + "F";
						} else {
							data = data + "I"
                        }
                    }


				} else if (tile.isFlagged()) {
					data = data + "F";

				} else if (tile.isCovered() || tile.isBomb()) {
					data = data + "H";

				} else {
					//let reduceBy = this.adjacentFlagsPlaced(tile);

					let reduceBy = 0;
					for (let adjTile of this.getAdjacent(tile)) {
						if (adjTile.isFlagged() || adjTile.isSolverFoundBomb()) {
							reduceBy++;
						}
					}

					if (reduceBy > tile.getValue()) {
						console.log(tile.asText() + " has too many flags around it, can't compress invalid data");
						return "";
                    }
					data = data + (tile.getValue() - reduceBy);
				}
			}
		}

		let cWidth = this.compressor.compressNumber(this.width, 2);
		let cHeight = this.compressor.compressNumber(this.height, 2);
		let cMines = this.compressor.compressNumber(this.num_bombs - reducedMines, 4);

		let cBoard = this.compressor.compress(data);

		let output = cWidth + cHeight + cMines + cBoard;

		console.log("Compressed data length " + output.length + " analysis=" + output);

		return output;

	}

}

class Compressor {

	constructor() {
		this.BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

		// this array decides how many digits to allocate to each value on the board
		// [0, 1, 2, 3, 4, 5, 6, 7, 8, hidden flag, HIDDEN, FLAG, overflagged]
		this.VALUES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "I", "H", "F", "O"];
		this.BASES = [10, 7, 5, 5, 4, 3, 3, 1, 1, 4, 10, 8, 1];
		this.digits = [];

		let start = 0;
		for (const n of this.BASES) {
			this.digits.push(this.BASE62.substring(start, start + n));
			start = start + n;
        }

		//console.log(this.digits);

    }

	compress(input) {

		let output = "";

		let count = 0;
		let prevChar = "";
		for (let i = 0; i < input.length; i++) {
			let currChar = input.charAt(i);

			if (prevChar == "") {
				prevChar = currChar;
				count = 1;

            } else if (currChar == prevChar) {
				count++;

			} else {
				// add the compressed data
				output = output + this.compressFragment(prevChar, count);

				// start counting the new data
				prevChar = currChar;
				count = 1;
            }
        }

		// add the final compressed data
		output = output + this.compressFragment(prevChar, count);

		//console.log("Compressed data length " + output.length + " data: " + output);

		return output;

	}

	// compress 'length' characters 'char'
	compressFragment(char, length) {

		// find the compression details

		let index = this.VALUES.indexOf(char);
		if (index == -1) {
			console.log("Unable to find the value '" + char + "' in the compression values array");
			return "";
        }

		let digits = this.digits[index];
		let base = digits.length;

		// for values with only 1 allocated value return that value 'length' times.
		if (base == 1) {
			return digits.repeat(length);
        }

		let output = "";

		while (length != 0) {

			let digit = length % base;
			output = digits[digit] + output;

			length = (length - digit) / base;

        }

		//console.log(output);

		return output;
    }

	decompress(input) {

		let output = "";

		let count = 0;
		let prevChar = "";
		for (let i = 0; i < input.length; i++) {

			let testChar = input.charAt(i);

			let index = this.digits.findIndex((element) => element.includes(testChar));

			// the value this character represents and the count it represents
			let currChar = this.VALUES[index];
			let currCount = this.digits[index].indexOf(testChar);
			let base = this.digits[index].length;

			if (prevChar == "") {
				prevChar = currChar;
				count = currCount;

			} else if (currChar == prevChar) {
				if (base == 1) {
					count++;
				} else {
					count = count * base + currCount;
                }

			} else {
				// add the compressed data
				output = output + prevChar.repeat(count);

				// start counting the new data
				prevChar = currChar;

				if (base == 1) {
					count = 1;
				} else {
					count = currCount;
				}
			}
		}

		// add the final compressed data
		output = output + prevChar.repeat(count);

		//console.log("Decompressed data length " + output.length + " data: " + output);

		return output;

	}

	compressNumber(number, size) {

		const base = this.BASE62.length;

		let output = "";
		for (let i = 0; i < size; i++) {

			let digit = number % base;
			output = this.BASE62[digit] + output;
			number = (number - digit) / base;

        }

		return output;

	}

	decompressNumber(value) {

		const base = this.BASE62.length;

		let output = 0;
		for (let i = 0; i < value.length; i++) {

			let digit = this.BASE62.indexOf(value.charAt(i));

			output = output * base + digit ;

		}

		return output;

	}
}

/**
 * 
 */
"use strict";

class Tile {
	constructor(x, y, index) {
		this.x = x;
		this.y = y;
		this.is_covered = true;
		this.value = 0;
		this.is_flagged = false;
		this.foundBomb = false
        this.is_bomb = null;   // this gets set when the game is lost
        this.exploded = false;  // this gets set if this tile was the one clicked
		this.index = index;

        this.onEdge = false;
        this.hint = false;
        this.probability = -1;  // of being safe
		this.hintText = "";
		this.hasHint = false;

		this.efficiencyValue = "";   // the value we need to be to be chordable
		this.efficiencyProbability = 0;  // the probability of being that value
		this.efficiencyText = "";  

		// is there an mine adjacent to this tile?  Set as part of the No flag efficiency logic
		this.adjacentMine = false;

		this.skull = false;  // used when hardcore rule triggers

		this.inflate = false; // used when constructing a compressed board

		Object.seal(this); // prevent new values being created
	}

	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}
	
	// returns true if the tile provided is adjacent to this tile
	isAdjacent(tile) {
		
		const dx = Math.abs(this.x - tile.x);
		const dy = Math.abs(this.y - tile.y);
		
		// adjacent and not equal
		if (dx < 2 && dy < 2 && !(dx == 0 && dy == 0)) {
			return true;
		} else {
			return false;
		}
		
	}

    isEqual(tile) {

        if (this.x == tile.x && this.y == tile.y) {
            return true;
        } else {
            return false;
        }

    }

	asText() {
		return "(" + this.x + "," + this.y + ")";
	}

    getHintText() {

        if (!this.hasHint) {
            return "";
		} else {
			return this.hintText + this.efficiencyText;
        }

    }

	getHasHint() {
		return this.hasHint;
    }

    setProbability(prob, progress, safety2) {
        this.probability = prob;
        this.hasHint = true;

		if (prob == 1) {
			this.hintText = "Clear";
		} else if (prob == 0) {
			this.hintText = "Mine";
		} else if (progress == null) {
			this.hintText = "\n" + (prob * 100).toFixed(2) + "% safe";
		} else {
			this.hintText = "\n" + (prob * 100).toFixed(2) + "% safe" + "\n" + (safety2 * 100).toFixed(2) + "% 2nd safety" + "\n" + (progress * 100).toFixed(2) + "% progress"
        }

	}

	setValueProbability(value, probability) {
		this.efficiencyValue = value;
		this.efficiencyProbability = probability;

		this.efficiencyText = "\n" + (probability * 100).toFixed(2) + "% value '" + value + "'"
	}

    //getProbability() {
    //    return this.probability;
    //}

    clearHint() {
        this.onEdge = false;
        this.hasHint = false;
		this.hintText = "";
		this.efficiencyValue = null;
		this.efficiencyProbability = 0;
		this.efficiencyText = "";
		this.probability = -1;
    }

    setOnEdge() {
        this.onEdge = true;
    }

	isCovered() {
		return this.is_covered;
	}

	setCovered(covered) {
		//console.log(this.asText() + " covered: " + covered);
		this.is_covered = covered;
    }

	setValue(value) {
		//console.log(this.asText() + " setting value " + value + " and not covered");
		this.value = value;
		this.is_covered = false;
	}

	setValueOnly(value) {
		if (this.is_flagged) {
			console.log(this.asText() + " assigning a value " + value + " to a flagged tile!");
		}

		this.value = value;
    }

	getValue() {
		return this.value;
	}

	rotateValue(delta) {

		var newValue = this.value + delta;

		if (newValue < 0) {
			newValue = 8;
		} else if (newValue > 8) {
			newValue = 0;
        }

		this.setValue(newValue);
    }

	toggleFlag() {
		this.is_flagged = !this.is_flagged;
	}
	
	isFlagged() {
		return this.is_flagged;
	}

	// this is set when the solver discovers a bomb - trying to separate the discovery of a bomb from the flagging of a tile
	setFoundBomb() {
		//console.log(this.asText() + " set to Found Bomb");
		this.foundBomb = true;
	}

	// this is used when a tile is speculatively set to a mine to see if the board is still valid
	unsetFoundBomb() {
		//console.log(this.asText() + " set to not Found Bomb");
		this.foundBomb = false;
	}

	isSolverFoundBomb() {
		return this.foundBomb;
    }

	// this is used to display the bombs when the game is lost
	setBomb(bomb) {
		this.is_bomb = bomb;
	}

	// this is used to display the exploded bomb when the game is lost
    setBombExploded() {
        this.is_bomb = true;
        this.exploded = true;
    }

	isBomb() {
		return this.is_bomb;
	}

	setSkull(isSkull) {
		this.skull = isSkull;
	}

	isSkull() {
		return this.skull;
    }
}

/**
 * 
 */
"use strict";

const OFFSETS = [[2, 0], [-2, 0], [0, 2], [0, -2]];
const OFFSETS_ALL = [[2, -2], [2, -1], [2, 0], [2, 1], [2, 2], [-2, -2], [-2, -1], [-2, 0], [-2, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [-1, -2], [0, -2], [1, -2]];

//const PLAY_BFDA_THRESHOLD = 1000;       // number of solutions for the Brute force analysis to start
//const ANALYSIS_BFDA_THRESHOLD = 5000;
//const BRUTE_FORCE_CYCLES_THRESHOLD = 5000000;
const HARD_CUT_OFF = 0.90;        // cutoff for considering on edge possibilities below the best probability
const OFF_EDGE_THRESHOLD = 0.95;  // when to include possibilities off the edge
const PROGRESS_CONTRIBUTION = 0.2;  // how much progress counts towards the final score

const USE_HIGH_DENSITY_STRATEGY = false;  // I think "secondary safety" generally works better than "solution space reduction"

const PLAY_STYLE_FLAGS = 1;
const PLAY_STYLE_NOFLAGS = 2;
const PLAY_STYLE_EFFICIENCY = 3;
const PLAY_STYLE_NOFLAGS_EFFICIENCY = 4;

// solver entry point
async function solver(board, options) {

    // when initialising create some entry points to functions needed from outside
    if (board == null) {
        console.log("Solver Initialisation request received");
        solver.countSolutions = countSolutions;
        return;
    }

    if (options.verbose == null) {
        options.verbose = true;
        writeToConsole("WARN: Verbose parameter not received by the solver, setting verbose = true");
    }

    if (options.playStyle == null) {
        writeToConsole("WARN: playstyle parameter not received by the solver, setting play style to flagging");
        options.playStyle = PLAY_STYLE_FLAGS;
    }

    // this is used to disable all the advanced stuff like BFDA and tie-break
    if (options.advancedGuessing == null) {
        options.advancedGuessing = true;
    }

    // this is used to force a probability engine search
    if (options.fullProbability == null) {
        options.fullProbability = false;
    }

    // this is used to stop the guess heuristic from pruning results
    // has an impact on the processing speed
    if (options.guessPruning == null) {
        options.guessPruning = true;
    }

    // this is used when using the solver to create a no-guessing board
    if (options.noGuessingMode == null) {
        options.noGuessingMode = false;
    }

    // if the option isn't set then default to false
    if (options.fullBFDA == null) {
        options.fullBFDA = false;
    }

    if (!options.guessPruning) {
        console.log("WARNING: The Guessing processing has pruning turned off, this will impact performance");
    }

    // a bit of a bodge this variable is used as a global
    let fillerTiles = [];   // this is used by the no-guess board generator 

    let noMoves = 0;
    let cleanActions = [];  // these are the actions to take
    const otherActions = [];    // this is other Actions of interest

    // allow the solver to bring back no moves 5 times. No moves is possible when playing no-flags 
    while (noMoves < 5 && cleanActions.length == 0) {
        noMoves++;
        const actions = await doSolve(board, options);  // look for solutions
        //console.log(actions);

        if (options.playStyle == PLAY_STYLE_EFFICIENCY || options.playStyle == PLAY_STYLE_NOFLAGS_EFFICIENCY) {
            cleanActions = actions;

            // find all the other actions which could be played
            top: for (let tile of board.tiles) {
                if (!tile.isCovered()) {
                    continue;
                }

                // ignore actions which are the primary actions
                for (let action of actions) {
                    if (tile.x == action.x && tile.y == action.y) {
                        //console.log(tile.asText() + " is a primary action");
                        continue top;
                    }
                }
                //console.log(tile.asText() + " mine=" + tile.isSolverFoundBomb() + ", flagged=" + tile.isFlagged() + ", probability=" + tile.probability);
                if (tile.isSolverFoundBomb() && !tile.isFlagged()) {
                    otherActions.push(new Action(tile.getX(), tile.getY(), 0, ACTION_FLAG));
                } else if (tile.probability == 1) {
                    otherActions.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR));
                }
            }

        } else {
            for (let i = 0; i < actions.length; i++) {

                const action = actions[i];

                if (action.action == ACTION_FLAG) {   // if a request to flag
 
                    const tile = board.getTileXY(action.x, action.y);
                    if (!tile.isFlagged()) {   // only accept the flag action if the tile isn't already flagged
                        if (options.playStyle == PLAY_STYLE_FLAGS) {  // if we are flagging
                            cleanActions.push(action);
                        } else {
                            otherActions.push(action);
                        }
                    }
                } else {
                    cleanActions.push(action);
                }
            }
        }
    }

    const reply = {};
    reply.actions = cleanActions;
    reply.fillers = fillerTiles;
    reply.other = otherActions;

    return reply;

    // **** functions below here ****

    // this finds the best moves 
    async function doSolve(board, options) {

        // find all the tiles which are revealed and have un-revealed / un-flagged adjacent squares
        const allCoveredTiles = [];
        const witnesses = [];
        const witnessed = [];
        const unflaggedMines = [];

        let minesLeft = board.num_bombs;
        let squaresLeft = 0;

        let deadTiles = [];  // used to hold the tiles which have been determined to be dead by either the probability engine or deep analysis

        const work = new Set();  // use a map to deduplicate the witnessed tiles

        showMessage("The solver is thinking...");

        for (let i = 0; i < board.tiles.length; i++) {

            const tile = board.getTile(i);

            tile.clearHint();  // clear any previous hints

            if (tile.isSolverFoundBomb()) {
                minesLeft--;
                tile.setProbability(0);
                if (!tile.isFlagged()) {
                    unflaggedMines.push(tile);
                }
                continue;  // if the tile is a mine then nothing to consider
            } else if (tile.isCovered()) {
                squaresLeft++;
                allCoveredTiles.push(tile);
                continue;  // if the tile hasn't been revealed yet then nothing to consider
            }

            const adjTiles = board.getAdjacent(tile);

            let needsWork = false;
            for (let j = 0; j < adjTiles.length; j++) {
                const adjTile = adjTiles[j];
                if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                    needsWork = true;
                    work.add(adjTile.index);
                }
            }

            if (needsWork) {  // the witness still has some unrevealed adjacent tiles
                witnesses.push(tile);
            }

        }

        // generate an array of tiles from the map
        for (let index of work) {
            const tile = board.getTile(index);
            tile.setOnEdge(true);
            witnessed.push(tile);
        }

        board.setHighDensity(squaresLeft, minesLeft);

        writeToConsole("tiles left = " + squaresLeft);
        writeToConsole("mines left = " + minesLeft);
        writeToConsole("Witnesses  = " + witnesses.length);
        writeToConsole("Witnessed  = " + witnessed.length);

        let result = [];

        // if we are in flagged mode then flag any mines currently unflagged
        if (options.playStyle != PLAY_STYLE_EFFICIENCY && options.playStyle != PLAY_STYLE_NOFLAGS_EFFICIENCY) {
            for (let tile of unflaggedMines) {
                result.push(new Action(tile.getX(), tile.getY(), 0, ACTION_FLAG));
            }
        }

        // if there are no mines left to find the everything else is to be cleared
        if (minesLeft == 0) {
            for (let i = 0; i < allCoveredTiles.length; i++) {
                const tile = allCoveredTiles[i];

                tile.setProbability(1);
                result.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR))
            }
            showMessage("No mines left to find all remaining tiles are safe");
            return new EfficiencyHelper(board, witnesses, witnessed, result, options.playStyle, null, allCoveredTiles).process();
        }

        const oldMineCount = result.length;

        // add any trivial moves we've found
        if (options.fullProbability || options.playStyle == PLAY_STYLE_EFFICIENCY || options.playStyle == PLAY_STYLE_NOFLAGS_EFFICIENCY) {
            console.log("Skipping trivial analysis since Probability Engine analysis is required")
        } else {
            result.push(...trivial_actions(board, witnesses));
        }
 
        if (result.length > oldMineCount) {
            showMessage("The solver found " + result.length + " trivial safe moves");
            return result;
            /*
            if (options.playStyle != PLAY_STYLE_FLAGS) {
                var mineFound = false;
                var noFlagResult = [];
                for (var i = 0; i < result.length; i++) {

                    var action = result[i];

                    if (action.prob == 0) {   // zero safe probability == mine
                        mineFound = true;
                    } else {   // otherwise we're trying to clear
                        noFlagResult.push(action);
                    }
                }
                if (options.playStyle == PLAY_STYLE_NOFLAGS) {  // flag free but not efficiency, send the clears
                    return noFlagResult;
                } else if (mineFound) { // if we are playing for efficiency and a mine was found then we can't continue. send nothing and try again
                    return [];
                }
                // if we are playing for efficiency and a mine wasn't found then go on to do the probability engine - this gets us all the possible clears and mines
                result = [];  // clear down any actions we found  trivially
                //return new EfficiencyHelper(board, witnesses, noFlagResult).process();
            } else {
                return result;
            }
            */
        }

        const pe = new ProbabilityEngine(board, witnesses, witnessed, squaresLeft, minesLeft, options);

        pe.process();

        writeToConsole("Probability Engine took " + pe.duration + " milliseconds to complete");

        if (pe.finalSolutionCount == 0) {
            showMessage("The board is in an illegal state");
            return result;
        }

        // If we have a full analysis then set the probabilities on the tile tooltips
        if (pe.fullAnalysis) {

            // Set the probability for each tile on the edge 
            for (let i = 0; i < pe.boxes.length; i++) {
                for (let j = 0; j < pe.boxes[i].tiles.length; j++) {
                    pe.boxes[i].tiles[j].setProbability(pe.boxProb[i]);
                }
            }

            // set all off edge probabilities
            for (let i = 0; i < board.tiles.length; i++) {

                const tile = board.getTile(i);

                if (tile.isSolverFoundBomb()) {
                    if (!tile.isFlagged()) {
                        tile.setProbability(0);
                    }
                } else if (tile.isCovered() && !tile.onEdge) {
                    tile.setProbability(pe.offEdgeProbability);
                }
            }
        }

        // if the tiles off the edge are definitely safe then clear them all
        let offEdgeAllSafe = false;
        if (pe.offEdgeProbability == 1) {
            const edgeSet = new Set();  // build a set containing all the on edge tiles
            for (let i = 0; i < witnessed.length; i++) {
                edgeSet.add(witnessed[i].index);
            }
            // any tiles not on the edge can be cleared
            for (let i = 0; i < allCoveredTiles.length; i++) {
                const tile = allCoveredTiles[i];
                if (!edgeSet.has(tile.index)) {
                    result.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR));
                }
            }

            if (result.length > 0) {
                writeToConsole("The Probability Engine has determined all off edge tiles must be safe");
                offEdgeAllSafe = true;
                //showMessage("The solver has determined all off edge tiles must be safe");
                //return result;
            }

        } else if (pe.offEdgeProbability == 0 && pe.fullAnalysis) {  
            writeToConsole("The Probability Engine has determined all off edge tiles must be mines");
            const edgeSet = new Set();  // build a set containing all the on edge tiles
            for (let i = 0; i < witnessed.length; i++) {
                edgeSet.add(witnessed[i].index);
            }
            // any tiles not on the edge are a mine
            for (let i = 0; i < allCoveredTiles.length; i++) {
                const tile = allCoveredTiles[i];
                if (!edgeSet.has(tile.index) && !tile.isFlagged()) {
                    pe.minesFound.push(tile)
                    //tile.setFoundBomb();
                }
            }
        }

        // have we found any local clears which we can use or everything off the edge is safe
        if (pe.localClears.length > 0 || pe.minesFound.length > 0 || offEdgeAllSafe) {
            for (let tile of pe.localClears) {   // place each local clear into an action
                tile.setProbability(1);
                const action = new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR);
                result.push(action);
            }

            for (let tile of pe.minesFound) {   // place each found flag
                tile.setProbability(0);
                tile.setFoundBomb();
                //if (options.playStyle == PLAY_STYLE_FLAGS) {
                    const action = new Action(tile.getX(), tile.getY(), 0, ACTION_FLAG);
                    result.push(action);
                //}
            }

            showMessage("The probability engine has found " + pe.localClears.length + " safe clears and " + pe.minesFound.length + " mines");
            return new EfficiencyHelper(board, witnesses, witnessed, result, options.playStyle, pe, allCoveredTiles).process();
        } 


        // this is part of the no-guessing board creation logic
        if (pe.bestProbability < 1 && options.noGuessingMode) {
            if (pe.bestOnEdgeProbability >= pe.offEdgeProbability) {
                result.push(pe.getBestCandidates(1));  // get best options
            } else {
                writeToConsole("Off edge is best, off edge prob = " + pe.offEdgeProbability + ", on edge prob = " + pe.bestOnEdgeProbability, true);
                const bestGuessTile = offEdgeGuess(board, witnessed);
                result.push(new Action(bestGuessTile.getX(), bestGuessTile.getY(), pe.offEdgeProbability), ACTION_CLEAR);
            }

            // find some witnesses which can be adjusted to remove the guessing
            findBalancingCorrections(pe);

            return result;
        }

        // if we aren't allowing advanced guessing then stop here
        if (!options.advancedGuessing) {
            writeToConsole("Advanced guessing is turned off so exiting the solver after the probability engine");
            showMessage("Press 'Analyse' for advanced guessing");
            return result;
        }


        // See if there are any unavoidable 2 tile 50/50 guesses 
        if (pe.bestOnEdgeProbability != 1 && minesLeft > 1) {
            const unavoidable5050a = pe.checkForUnavoidable5050();
            if (unavoidable5050a != null) {
                result.push(new Action(unavoidable5050a.getX(), unavoidable5050a.getY(), unavoidable5050a.probability, ACTION_CLEAR));
                showMessage(unavoidable5050a.asText() + " is an unavoidable 50/50 guess." + formatSolutions(pe.finalSolutionsCount));
                return addDeadTiles(result, pe.getDeadTiles());
            }
        }

        /*
        // if we don't have a certain guess then look for ...
        //let ltr;
        if (pe.bestOnEdgeProbability != 1 && minesLeft > 1) {

            // See if there are any unavoidable 2 tile 50/50 guesses 
            const unavoidable5050a = pe.checkForUnavoidable5050();
            if (unavoidable5050a != null) {
                result.push(new Action(unavoidable5050a.getX(), unavoidable5050a.getY(), unavoidable5050a.probability, ACTION_CLEAR));
                showMessage(unavoidable5050a.asText() + " is an unavoidable 50/50 guess." + formatSolutions(pe.finalSolutionsCount));
                return addDeadTiles(result, pe.getDeadTiles());
            }

            // look for any 50/50 or safe guesses 
            //const unavoidable5050b = new FiftyFiftyHelper(board, pe.minesFound, options, pe.getDeadTiles(), witnessed, minesLeft).process();

            //ltr = new LongTermRiskHelper(board, pe, minesLeft, options);
            //const unavoidable5050b = ltr.findInfluence();
            //if (unavoidable5050b != null) {
            //    result.push(new Action(unavoidable5050b.getX(), unavoidable5050b.getY(), unavoidable5050b.probability, ACTION_CLEAR));
            //   showMessage(unavoidable5050b.asText() + " is an unavoidable 50/50 guess, or safe." + formatSolutions(pe.finalSolutionsCount));
            //    return addDeadTiles(result, pe.getDeadTiles());
            //}
        }
        */

        // if we have an isolated edge process that
        if (pe.bestProbability < 1 && pe.isolatedEdgeBruteForce != null) {

            const solutionCount = pe.isolatedEdgeBruteForce.crunch();

            writeToConsole("Solutions found by brute force for isolated edge " + solutionCount);

            const bfda = new BruteForceAnalysis(pe.isolatedEdgeBruteForce.allSolutions, pe.isolatedEdgeBruteForce.iterator.tiles, 1000, options.verbose);  // the tiles and the solutions need to be in sync

            await bfda.process();

            // if the brute force deep analysis completed then use the results
            if (bfda.completed) {
                // if they aren't all dead then send the best guess
                if (!bfda.allTilesDead()) {
                    const nextmove = bfda.getNextMove();
                    result.push(nextmove);

                    var winChanceText = (bfda.winChance * 100).toFixed(2);
                    showMessage("The solver has calculated tile " + nextmove.asText()  + " has a " + winChanceText + "% chance to solve the isolated edge." + formatSolutions(pe.finalSolutionsCount));

                } else {  // seed 6674107430895333
                    showMessage("The solver has calculated that all the tiles on an isolated edge are dead, try tile " + bfda.bestTile.asText() + "?" + formatSolutions(pe.finalSolutionsCount));
                }

                deadTiles = bfda.deadTiles;

                // combine the dead tiles from the probability engine and the isolated edge
                for (let deadTile of pe.deadTiles) {
                    let found = false;
                    for (let bfdaDead of deadTiles) {
                        if (deadTile.isEqual(bfdaDead)) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        deadTiles.push(deadTile);
                    }
                }
                return addDeadTiles(result, deadTiles);
            }

        }

        // if we are having to guess and there are less then BFDA_THRESHOLD solutions use the brute force deep analysis...
        let bfdaThreshold;
        if (options.fullBFDA) {
            bfdaThreshold = BruteForceGlobal.ANALYSIS_BFDA_THRESHOLD;
        } else {
            bfdaThreshold = BruteForceGlobal.PLAY_BFDA_THRESHOLD;
        }

        let partialBFDA = null;
        if (pe.bestProbability < 1 && pe.finalSolutionsCount < bfdaThreshold) {

            showMessage("The solver is starting brute force deep analysis on " + pe.finalSolutionsCount + " solutions");
            await sleep(1);

            pe.generateIndependentWitnesses();

            const iterator = new WitnessWebIterator(pe, allCoveredTiles, -1);

            let bfdaCompleted = false;
            let bfda
            if (iterator.cycles <= BruteForceGlobal.BRUTE_FORCE_CYCLES_THRESHOLD) {
                const bruteForce = new Cruncher(board, iterator);

                const solutionCount = bruteForce.crunch();

                writeToConsole("Solutions found by brute force " + solutionCount + " after " + iterator.getIterations() + " cycles");

                bfda = new BruteForceAnalysis(bruteForce.allSolutions, iterator.tiles, 1000, options.verbose);  // the tiles and the solutions need to be in sync

                await bfda.process();

                bfdaCompleted = bfda.completed;
            } else {
                writeToConsole("Brute Force requires too many cycles - skipping BFDA: " + iterator.cycles);
            }


            // if the brute force deep analysis completed then use the results
            if (bfdaCompleted) {
                // if they aren't all dead then send the best guess
                if (!bfda.allTilesDead()) {
                    const nextmove = bfda.getNextMove();
                    result.push(nextmove);

                    deadTiles = bfda.deadTiles;
                    const winChanceText = (bfda.winChance * 100).toFixed(2);
                    showMessage("The solver has calculated tile " + nextmove.asText() + " has a " + winChanceText + "% chance to win the game." + formatSolutions(pe.finalSolutionsCount));

                } else {
                    showMessage("The solver has calculated that all the remaining tiles are dead, try tile " + bfda.bestTile.asText() + "?" + formatSolutions(pe.finalSolutionsCount));
                    deadTiles = allCoveredTiles;   // all the tiles are dead
                }

                return addDeadTiles(result, deadTiles);
            } else {
                deadTiles = pe.getDeadTiles();  // use the dead tiles from the probability engine
                partialBFDA = bfda;
            }

        } else {
            deadTiles = pe.getDeadTiles();  // use the dead tiles from the probability engine
        }

        // if we don't have a safe move and we have too many solutions for brute force then look for ...
        let ltr;
        if (pe.bestOnEdgeProbability != 1 && minesLeft > 1) {

            /*
            // See if there are any unavoidable 2 tile 50/50 guesses 
            const unavoidable5050a = pe.checkForUnavoidable5050();
            if (unavoidable5050a != null) {
                result.push(new Action(unavoidable5050a.getX(), unavoidable5050a.getY(), unavoidable5050a.probability, ACTION_CLEAR));
                showMessage(unavoidable5050a.asText() + " is an unavoidable 50/50 guess." + formatSolutions(pe.finalSolutionsCount));
                return addDeadTiles(result, pe.getDeadTiles());
            }
            */

            // look for any 50/50 or safe guesses - old method
            //const unavoidable5050b = new FiftyFiftyHelper(board, pe.minesFound, options, pe.getDeadTiles(), witnessed, minesLeft).process();

            ltr = new LongTermRiskHelper(board, pe, minesLeft, options);
            const unavoidable5050b = ltr.findInfluence();
            if (unavoidable5050b != null) {
                result.push(new Action(unavoidable5050b.getX(), unavoidable5050b.getY(), unavoidable5050b.probability, ACTION_CLEAR));
                showMessage(unavoidable5050b.asText() + " is an unavoidable 50/50 guess, or safe." + formatSolutions(pe.finalSolutionsCount));
                return addDeadTiles(result, pe.getDeadTiles());
            }
        }

        /*
        // calculate 50/50 influence and check for a pseudo-50/50
        let ltr;
        if (pe.bestOnEdgeProbability != 1 && minesLeft > 1) {

            ltr = new LongTermRiskHelper(board, pe, minesLeft, options);
            const unavoidable5050b = ltr.findInfluence();
            if (unavoidable5050b != null) {
                result.push(new Action(unavoidable5050b.getX(), unavoidable5050b.getY(), unavoidable5050b.probability, ACTION_CLEAR));
               showMessage(unavoidable5050b.asText() + " is an unavoidable 50/50 guess, or safe." + formatSolutions(pe.finalSolutionsCount));
                return addDeadTiles(result, pe.getDeadTiles());
            }
        }
        */

        // ... otherwise we will use the probability engines results

        result.push(...pe.getBestCandidates(HARD_CUT_OFF));  // get best options within this ratio of the best value

        // if the off edge tiles are within tolerance then add them to the candidates to consider as long as we don't have certain clears
        if (pe.bestOnEdgeProbability != 1 && pe.offEdgeProbability > pe.bestOnEdgeProbability * OFF_EDGE_THRESHOLD) {
            result.push(...getOffEdgeCandidates(board, pe, witnesses, allCoveredTiles));
            result.sort(function (a, b) { return b.prob - a.prob });
        }

        // if we have some good guesses on the edge
        if (result.length > 0) {
            for (let i = 0; i < deadTiles.length; i++) {
                const tile = deadTiles[i];

                writeToConsole("Tile " + tile.asText() + " is dead");
                for (let j = 0; j < result.length; j++) {
                    if (result[j].x == tile.x && result[j].y == tile.y) {
                        result[j].dead = true;
                        //found = true;
                        break;
                    }
                }
            }

            if (pe.bestProbability == 1) {
                showMessage("The solver has found some certain moves using the probability engine." + formatSolutions(pe.finalSolutionsCount));

                 // identify where the bombs are
                for (let tile of pe.minesFound) {
                    tile.setFoundBomb();
                    if (options.playStyle == PLAY_STYLE_FLAGS) {
                        const action = new Action(tile.getX(), tile.getY(), 0, ACTION_FLAG);
                        result.push(action);
                    }
                }
 
                result = new EfficiencyHelper(board, witnesses, witnessed, result, options.playStyle, pe, allCoveredTiles).process();
            } else {
 
                if (pe.duration < 50) {  // if the probability engine didn't take long then use some tie-break logic
                    result = tieBreak(pe, result, partialBFDA, ltr);
                    if (result.length != 0) {
                        const recommended = result[0];
                        showMessage("The solver recommends clearing tile " + recommended.asText() + "." + formatSolutions(pe.finalSolutionsCount));
                    }
                } else {
                    showMessage("The solver has found the safest guess using the probability engine." + formatSolutions(pe.finalSolutionsCount));
                }
            }

        } else {  // otherwise look for a guess with the least number of adjacent covered tiles (hunting zeros)
            const bestGuessTile = offEdgeGuess(board, witnessed);

            result.push(new Action(bestGuessTile.getX(), bestGuessTile.getY(), pe.offEdgeProbability), ACTION_CLEAR);

            showMessage("The solver has decided the best guess is off the edge." + formatSolutions(pe.finalSolutionsCount));

        }

        //return addDeadTiles(result, pe.getDeadTiles());
        return addDeadTiles(result, deadTiles);

    }

    // used to add the dead tiles to the results
    function addDeadTiles(result, deadTiles) {

        // identify the dead tiles
        for (let tile of deadTiles) {   // show all dead tiles 
            if (tile.probability != 0) {
                const action = new Action(tile.getX(), tile.getY(), tile.probability);
                action.dead = true;
                result.push(action);
            }
        }

        return result;

    }

    function tieBreak(pe, actions, bfda, ltr) {

        const start = Date.now();

        writeToConsole("");
        writeToConsole("-------- Starting Best Guess Analysis --------");

        writeToConsole("---- Tiles with long term risk ----");

        const alreadyIncluded = new Set();
        for (let action of actions) {
            alreadyIncluded.add(board.getTileXY(action.x, action.y));
        }

        const extraTiles = ltr.getInfluencedTiles(pe.bestProbability * 0.9);
        for (let tile of extraTiles) {
            if (alreadyIncluded.has(tile)) {
                //writeToConsole(tile.asText() + " is already in the list of candidates to be analysed");
            } else {
                alreadyIncluded.add(tile);
                actions.push(new Action(tile.getX(), tile.getY(), pe.getProbability(tile), ACTION_CLEAR));
                writeToConsole("Tile " + tile.asText() + " added to the list of candidates to be analysed");
            }
        }
        if (extraTiles.length == 0) {
            writeToConsole("- None found");
        }

        writeToConsole("");

        let best;
        for (let action of actions) {

            if (action.action == ACTION_FLAG) { // ignore the action if it is a flagging request
                continue;
            }

            //fullAnalysis(pe, board, action, best);  // updates variables in the Action class

            secondarySafetyAnalysis(pe, board, action, best, ltr) // updates variables in the Action class

            if (best == null || compare(best, action) > 0) {
                writeToConsole("Tile " + action.asText() + " is now the best with score " + action.weight);
                best = action;
            }
            writeToConsole("");
        }

        if (USE_HIGH_DENSITY_STRATEGY && board.isHighDensity() ) {
            writeToConsole("Board is high density prioritise minimising solutions space");
            actions.sort(function (a, b) {

                let c = b.prob - a.prob;
                if (c != 0) {
                    return c;
                } else if (a.maxSolutions > b.maxSolutions) {
                    return 1;
                } else if (a.maxSolutions < b.maxSolutions) {
                    return -1;
                } else {
                    return b.weight - a.weight;
                }

            });
        } else {
            actions.sort(function (a, b) { return compare(a, b) });
        }

        if (bfda != null && actions.length > 0) {
            const better = bfda.checkForBetterMove(actions[0]);
            if (better != null) {
                const betterAction = new Action(better.x, better.y, better.probability, ACTION_CLEAR);
                writeToConsole("Replacing Tile " + actions[0].asText() + " with Tile " + betterAction.asText() + " because it is better from partial BFDA");
                actions = [betterAction];
            }
        }

        findAlternativeMove(actions);

        if (actions.length > 0) {
            const better = actions[0].dominatingTile;
            if (better != null) {
                for (let action of actions) {
                    if (action.x == better.x && action.y == better.y) {
                        writeToConsole("Replacing Tile " + actions[0].asText() + " with Tile " + action.asText() + " because it is likely to be dominating");
                        actions = [action];
                        break;
                    }
                }
            }
        }

        writeToConsole("Solver recommends tile " + actions[0].asText());

        writeToConsole("Best Guess analysis took " + (Date.now() - start) + " milliseconds to complete");

        return actions;

    }

    // 4139912032944127.5
    function compare(a, b) {

        // Move flag actions to the bottom
        if (a.action == ACTION_FLAG && b.action != ACTION_FLAG) {
            return 1;
        } else if (a.action != ACTION_FLAG && b.action == ACTION_FLAG) {
            return -1;
        }

        // move dead tiles to the bottom
        if (a.dead && !b.dead) {
            return 1;
        } else if (!a.dead && b.dead) {
            return -1;
        }

        // then more best score to the top
        let c = b.weight - a.weight;
        if (c != 0) {
            return c;
        } else {
            return b.expectedClears - a.expectedClears;
        }

    }

    // find a move which 1) is safer than the move given and 2) when move is safe ==> the alternative is safe
    function findAlternativeMove(actions) {

        const action = actions[0]  // the current best

        // if one of the common boxes contains a tile which has already been processed then the current tile is redundant
        for (let i = 1; i < actions.length; i++) {

            const alt = actions[i];

            if (alt.action == ACTION_FLAG) { // ignore the action if it is a flagging request
                continue;
            }

            if (alt.prob - action.prob > 0.001) {  // the alternative move is at least a bit safe than the current move
                 for (let tile of action.commonClears) {  // see if the move is in the list of common safe tiles
                    if (alt.x == tile.x && alt.y == tile.y) {
                        writeToConsole("Replacing " + action.asText() + " with " + alt.asText() + " because it dominates");

                        // switch the alternative action with the best
                        actions[0] = alt;
                        actions[i] = action;

                        return;
                    }
                }
            }
        }

        // otherwise return the order
        return;

    }

    function trivial_actions(board, witnesses) {

        const result = new Map();

        for (let i = 0; i < witnesses.length; i++) {

            const tile = witnesses[i];

            const adjTiles = board.getAdjacent(tile);

            let flags = 0
            let covered = 0;
            for (let j = 0; j < adjTiles.length; j++) {
                const adjTile = adjTiles[j];
                if (adjTile.isSolverFoundBomb()) {
                    flags++;
                } else if (adjTile.isCovered()) {
                    covered++;
                }
            }

            // if the tile has the correct number of flags then the other adjacent tiles are clear
            if (flags == tile.getValue() && covered > 0) {
                for (let j = 0; j < adjTiles.length; j++) {
                    const adjTile = adjTiles[j];
                    if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                        adjTile.setProbability(1);  // definite clear
                        result.set(adjTile.index, new Action(adjTile.getX(), adjTile.getY(), 1, ACTION_CLEAR));
                    }
                }

            // if the tile has n remaining covered squares and needs n more flags then all the adjacent files are flags
            } else if (tile.getValue() == flags + covered && covered > 0) {
                for (let j = 0; j < adjTiles.length; j++) {
                    const adjTile = adjTiles[j];
                    if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) { // if covered, not already a known mine and isn't flagged
                        adjTile.setProbability(0);  // definite mine
                        adjTile.setFoundBomb();
                        //if (!adjTile.isFlagged()) {  // if not already flagged then flag it
                        result.set(adjTile.index, new Action(adjTile.getX(), adjTile.getY(), 0, ACTION_FLAG));
                        //}

                    }
                }
            } 

        }

        writeToConsole("Found " + result.size + " moves trivially");

        // send it back as an array
        return Array.from(result.values());

    }

    /**
     * Find the best guess off the edge when the probability engine doesn't give the best guess as on edge
     */
    function offEdgeGuess(board, witnessed) {

        const edgeSet = new Set();  // build a set containing all the on edge tiles
        for (let i = 0; i < witnessed.length; i++) {
            edgeSet.add(witnessed[i].index);
        }

        let bestGuess;
        let bestGuessCount = 9;

        for (let i = 0; i < board.tiles.length; i++) {
            const tile = board.getTile(i);

            // if we are an unrevealed square and we aren't on the edge
            // then store the location
            if (tile.isCovered() && !tile.isSolverFoundBomb() && !edgeSet.has(tile.index)) { // if the tile is covered and not on the edge

                const adjCovered = board.adjacentCoveredCount(tile);

                // if we only have isolated tiles then use this
                if (adjCovered == 0 && bestGuessCount == 9) {
                    writeToConsole(tile.asText() + " is surrounded by flags");
                    bestGuess = tile;
                }

                if (adjCovered > 0 && adjCovered < bestGuessCount) {
                    bestGuessCount = adjCovered;
                    bestGuess = tile;
                }
            }
        }

        if (bestGuess == null) {
            writeToConsole("Off edge guess has returned null!", true);
        }

        return bestGuess;

    }

    function getOffEdgeCandidates(board, pe, witnesses, allCoveredTiles) {

        writeToConsole("getting off edge candidates");

        const accepted = new Set();  // use a map to deduplicate the witnessed tiles

        // if there are only a small number of tiles off the edge then consider them all
        if (allCoveredTiles.length - pe.witnessed.length < 30) {
            for (let i = 0; i < allCoveredTiles.length; i++) {
                const workTile = allCoveredTiles[i];
                // if the tile  isn't on the edge
                if (!workTile.onEdge) {
                    accepted.add(workTile);
                }
            }

        } else {  // otherwise prioritise those most promising

            let offsets;
            if (board.isHighDensity()) {
                offsets = OFFSETS_ALL;
            } else {
                offsets = OFFSETS;
            }

            for (let i = 0; i < witnesses.length; i++) {

                const tile = witnesses[i];

                for (let j = 0; j < offsets.length; j++) {

                    const x1 = tile.x + offsets[j][0];
                    const y1 = tile.y + offsets[j][1];

                    if (x1 >= 0 && x1 < board.width && y1 >= 0 && y1 < board.height) {

                        const workTile = board.getTileXY(x1, y1);

                        //console.log(x1 + " " + y1 + " is within range, covered " + workTile.isCovered() + ", on Edge " + workTile.onEdge);
                        if (workTile.isCovered() && !workTile.isSolverFoundBomb() && !workTile.onEdge) {
                             accepted.add(workTile);
                        }
                    }

                }

            }

            for (let i = 0; i < allCoveredTiles.length; i++) {

                const workTile = allCoveredTiles[i];

                // if the tile isn't alrerady being analysed and isn't on the edge
                if (!accepted.has(workTile) && !workTile.onEdge) {

                    // see if it has a small number of free tiles around it
                    const adjCovered = board.adjacentCoveredCount(workTile);
                    if (adjCovered > 1 && adjCovered < 4) {
                        accepted.add(workTile);
                    }

                }

            }

        }

        const result = []

        // generate an array of tiles from the map
        for (let tile of accepted) {
            result.push(new Action(tile.x, tile.y, pe.offEdgeProbability, ACTION_CLEAR));
        }

        return result;

    }

    function fullAnalysis(pe, board, action, best) {

        const tile = board.getTileXY(action.x, action.y);
 
        const adjFlags = board.adjacentFoundMineCount(tile);
        const adjCovered = board.adjacentCoveredCount(tile);

        let progressSolutions = BigInt(0);
        let expectedClears = BigInt(0);
        let maxSolutions = BigInt(0);

        const probThisTile = action.prob;
        let probThisTileLeft = action.prob;  // this is used to calculate when we can prune this action

        // this is used to hold the tiles which are clears for all the possible values
        const commonClears = null;

        for (let value = adjFlags; value <= adjCovered + adjFlags; value++) {

            const progress = divideBigInt(solutions, pe.finalSolutionsCount, 6);
            const bonus = 1 + (progress + probThisTileLeft) * PROGRESS_CONTRIBUTION;
            const weight = probThisTile * bonus;

            if (best != null && weight < best.weight) {
                writeToConsole("(" + action.x + "," + action.y + ") is being pruned");
                action.weight = weight;
                action.pruned = true;

                tile.setCovered(true);   // make sure we recover the tile
                return;
            }

            tile.setValue(value);

            const work = countSolutions(board, null);

            if (work.finalSolutionsCount > 0) {  // if this is a valid board state
                if (commonClears == null) {
                    commonClears = work.getLocalClears();
                } else {
                    commonClears = andClearTiles(commonClears, work.getLocalClears());
                }

                const probThisTileValue = divideBigInt(work.finalSolutionsCount, pe.finalSolutionsCount, 6);
                probThisTileLeft = probThisTileLeft - probThisTileValue;

            }


            //totalSolutions = totalSolutions + work.finalSolutionsCount;
            if (work.clearCount > 0) {
                expectedClears = expectedClears + work.finalSolutionsCount * BigInt(work.clearCount);
                progressSolutions = progressSolutions + work.finalSolutionsCount;
            }

            if (work.finalSolutionsCount > maxSolutions) {
                maxSolutions = work.finalSolutionsCount;
            }

        }

        tile.setCovered(true);

        action.expectedClears = divideBigInt(expectedClears, pe.finalSolutionsCount, 6);

        const progress = divideBigInt(progressSolutions, pe.finalSolutionsCount, 6);

        action.progress = progress;

        action.weight = action.prob * (1 + progress * PROGRESS_CONTRIBUTION);
        action.maxSolutions = maxSolutions;
        action.commonClears = commonClears;

        tile.setProbability(action.prob, action.progress);

        writeToConsole(tile.asText() + ", progress = " + action.progress + ", weight = " + action.weight + ", expected clears = " + action.expectedClears + ", common clears = " + commonClears.length);

    }

    function countSolutions(board, notMines) {

        // find all the tiles which are revealed and have un-revealed / un-flagged adjacent squares
        const allCoveredTiles = [];
        const witnesses = [];
        const witnessed = [];

        let minesLeft = board.num_bombs;
        let squaresLeft = 0;

        const work = new Set();  // use a map to deduplicate the witnessed tiles

        for (let i = 0; i < board.tiles.length; i++) {

            const tile = board.getTile(i);

            if (tile.isSolverFoundBomb()) {
                minesLeft--;
                continue;  // if the tile is a flag then nothing to consider
            } else if (tile.isCovered()) {
                squaresLeft++;
                allCoveredTiles.push(tile);
                continue;  // if the tile hasn't been revealed yet then nothing to consider
            }

            const adjTiles = board.getAdjacent(tile);

            let needsWork = false;
            let minesFound = 0;
            for (let j = 0; j < adjTiles.length; j++) {
                const adjTile = adjTiles[j];
                if (adjTile.isSolverFoundBomb()) {
                    minesFound++;
                } else if (adjTile.isCovered()) {
                    needsWork = true;
                    work.add(adjTile.index);
                }
            }

            // if a witness needs work (still has hidden adjacent tiles) or is broken then add it to the mix
            if (needsWork || minesFound > tile.getValue()) {
                witnesses.push(tile);
            }

        }

        // generate an array of tiles from the map
        for (let index of work) {
            const tile = board.getTile(index);
            tile.setOnEdge(true);
            witnessed.push(tile);
        }

        //console.log("tiles left = " + squaresLeft);
        //console.log("mines left = " + minesLeft);
        //console.log("Witnesses  = " + witnesses.length);
        //console.log("Witnessed  = " + witnessed.length);

        var solutionCounter = new SolutionCounter(board, witnesses, witnessed, squaresLeft, minesLeft);

        // let the solution counter know which tiles mustn't contain mines
        if (notMines != null) {
            for (let tile of notMines) {
                if (!solutionCounter.setMustBeEmpty(tile)) {
                    writeToConsole("Tile " + tile.asText() + " failed to set must be empty", true);
                }
            }
        }

        solutionCounter.process();

        return solutionCounter;

    }

    function secondarySafetyAnalysis(pe, board, action, best, ltr) {

        //const progressContribution = 0.052;
        const progressContribution = 0.001;   // tiny amount to favour progress if everything else is the same

        const tile = board.getTileXY(action.x, action.y);

        const safePe = runProbabilityEngine(board, [tile]);
        let linkedTilesCount = 0;

        let dominated = false;  // if tile 'a' being safe ==> tile 'b' & 'c' are safe and 'b' and 'c' are in the same box ==> 'b' is safer then 'a' 

        for (let box of safePe.emptyBoxes) {
            if (box.contains(tile)) { // if the tile is in this box then ignore it

            } else {
                if (box.tiles.length > 1) {
                    dominated = true;
                } else {
                    const targetTile = box.tiles[0];
                    let isDeadTile = false;
                    for (let deadTile of pe.deadTiles) {
                        if (targetTile.isEqual(deadTile)) {
                            isDeadTile = true;
                            break;
                        }
                    }
                    if (!isDeadTile) {
                        linkedTilesCount++;
                    }
                }
            }
        }

        writeToConsole("-------- Tile " + tile.asText() + " --------");
        writeToConsole("Tile " + tile.asText() + " has " + linkedTilesCount + " linked living tiles and dominated=" + dominated);

        // a dominated tile doesn't need any further resolution
        if (dominated) {
            action.progress = action.prob;    // progress is total
            action.weight = action.prob * (1 + action.prob * progressContribution);
            action.maxSolutions = safePe.finalSolutionsCount;
            action.commonClears = safePe.localClears;

            tile.setProbability(action.prob, action.progress, action.progress);  // a dominated tile has 100% progress

            return;
        }

        const tileBox = pe.getBox(tile);
        let safetyTally;
        if (tileBox == null) {
            safetyTally = pe.finalSolutionsCount - pe.offEdgeMineTally;
        } else {
            safetyTally = pe.finalSolutionsCount - tileBox.mineTally;
        }

        const tileInfluenceTally = ltr.findTileInfluence(tile);
        //console.log("Safety Tally " + safetyTally + ", tileInfluenceTally " + tileInfluenceTally);

        //const fiftyFiftyInfluenceTally = safetyTally + tileInfluenceTally;
        const fiftyFiftyInfluence = 1 + divideBigInt(tileInfluenceTally, safetyTally, 6) * 0.9;

        let solutionsWithProgess = BigInt(0);
        let expectedClears = BigInt(0);
        let maxSolutions = BigInt(0);

        let blendedSafety = 0;
        let secondarySafety = 0;
        let probThisTileLeft = action.prob;  // this is used to calculate when we can prune this action

        // this is used to hold the tiles which are clears for all the possible values
        let commonClears = null;
        let validValues = 0;

        const adjFlags = board.adjacentFoundMineCount(tile);
        const adjCovered = board.adjacentCoveredCount(tile);

        let singleSafestTile = null;
        let sameSingleSafestTile = true;

        for (let value = adjFlags; value <= adjCovered + adjFlags; value++) {

            const progress = divideBigInt(solutionsWithProgess, pe.finalSolutionsCount, 6);
            const bonus = 1 + (progress + probThisTileLeft) * progressContribution;
            const weight = (blendedSafety + probThisTileLeft * fiftyFiftyInfluence) * bonus;

            if (options.guessPruning && best != null && !best.dead && weight < best.weight) {
                writeToConsole("Tile (" + action.x + "," + action.y + ") is being pruned,  50/50 influence = " + fiftyFiftyInfluence + ", max score possible is " + weight);
                action.weight = weight;
                action.pruned = true;

                tile.setCovered(true);   // make sure we recover the tile
                return;
            }

            tile.setValue(value);

            const work = runProbabilityEngine(board, null);

            const clearCount = work.livingClearTile;

            if (work.finalSolutionsCount > 0) {  // if this is a valid board state

                validValues++;

                if (commonClears == null) {
                    commonClears = work.localClears;
                } else {
                    commonClears = andClearTiles(commonClears, work.localClears);
                }

                //const longTermSafety = ltr.getLongTermSafety(tile, work);

                const safetyThisTileValue = divideBigInt(work.finalSolutionsCount, pe.finalSolutionsCount, 6);

                // blended safety we use to pick the best tile
                blendedSafety = blendedSafety + safetyThisTileValue * work.blendedSafety * fiftyFiftyInfluence;

                // we show the secondary safety on the tooltip
                secondarySafety = secondarySafety + safetyThisTileValue * work.bestLivingSafety;

 
                let safestTileText = "none";
                if (work.singleSafestTile == null) {  // no single safest tile, so they can't always be the same
                    sameSingleSafestTile = false;

                } else if (singleSafestTile == null) {  // the first single safest tile found
                    singleSafestTile = work.singleSafestTile;
                    safestTileText = work.singleSafestTile.asText();

                } else if (!singleSafestTile.isEqual(work.singleSafestTile)) {  // another single safest tile found, but it is different
                    sameSingleSafestTile = false;
                } else {
                    safestTileText = work.singleSafestTile.asText();
                }

                writeToConsole("Tile " + tile.asText() + " with value " + value + " Probability " + safetyThisTileValue + " ==> Safest " + work.bestLivingSafety
                    + ", Blended safety " + work.blendedSafety + ", Single safest tile: " + safestTileText + ", living clears " + clearCount);

                probThisTileLeft = probThisTileLeft - safetyThisTileValue;
             }

            //totalSolutions = totalSolutions + work.finalSolutionsCount;
            if (clearCount > 0) {
                expectedClears = expectedClears + work.finalSolutionsCount * BigInt(clearCount);

                if (clearCount > linkedTilesCount) {  // this is intended to penalise tiles which are linked to other tiles. Otherwise 2 tiles give each other all progress.
                    solutionsWithProgess = solutionsWithProgess + work.finalSolutionsCount;
                }
            }

            if (work.finalSolutionsCount > maxSolutions) {
                maxSolutions = work.finalSolutionsCount;
            }

        }

        tile.setCovered(true);

        action.expectedClears = divideBigInt(expectedClears, pe.finalSolutionsCount, 6);

        const progress = divideBigInt(solutionsWithProgess, pe.finalSolutionsCount, 6);

        action.progress = progress;

        if (validValues == 1) {
            action.dead = true;
            writeToConsole("Tile " + tile.asText() + " has only only one possible value and is being marked as dead");
        }

        if (sameSingleSafestTile) {
            writeToConsole("Tile " + singleSafestTile.asText() + " is always the safest living tile after this guess");
            if (singleSafestTile.probability > tile.probability) {
                writeToConsole("Tile " + singleSafestTile.asText() + " is also safer, so dominates " + tile.asText());
                action.dominatingTile = singleSafestTile;
            }
        }

        action.weight = blendedSafety * (1 + progress * progressContribution);
        action.maxSolutions = maxSolutions;
        action.commonClears = commonClears;

        //const realSecondarySafety = (blendedSafety / fiftyFiftyInfluence).toFixed(6);  // remove the 50/50 influence to get back to the real secondary safety

        tile.setProbability(action.prob, action.progress, secondarySafety);

        writeToConsole("Tile " + tile.asText() + ", secondary safety = " + secondarySafety + ", 50/50 influence = " + fiftyFiftyInfluence
            + ", blended safety = " + blendedSafety + ", progress = " + action.progress+ ", expected clears = " + action.expectedClears + ", always clear = " + commonClears.length + ", final score = " + action.weight);

    }

    function runProbabilityEngine(board, notMines) {

        // find all the tiles which are revealed and have un-revealed / un-flagged adjacent squares
        const allCoveredTiles = [];
        const witnesses = [];
        const witnessed = [];

        let minesLeft = board.num_bombs;
        let squaresLeft = 0;

        const work = new Set();  // use a map to deduplicate the witnessed tiles

        for (let i = 0; i < board.tiles.length; i++) {

            const tile = board.getTile(i);

            if (tile.isSolverFoundBomb()) {
                minesLeft--;
                continue;  // if the tile is a flag then nothing to consider
            } else if (tile.isCovered()) {
                squaresLeft++;
                allCoveredTiles.push(tile);
                continue;  // if the tile hasn't been revealed yet then nothing to consider
            }

            const adjTiles = board.getAdjacent(tile);

            let needsWork = false;
            let minesFound = 0;
            for (let j = 0; j < adjTiles.length; j++) {
                const adjTile = adjTiles[j];
                if (adjTile.isSolverFoundBomb()) {
                    minesFound++;
                } else if (adjTile.isCovered()) {
                    needsWork = true;
                    work.add(adjTile.index);
                }
            }

            // if a witness needs work (still has hidden adjacent tiles) or is broken then add it to the mix
            if (needsWork || minesFound > tile.getValue()) {
                witnesses.push(tile);
            }

        }

        // generate an array of tiles from the map
        for (let index of work) {
            const tile = board.getTile(index);
            tile.setOnEdge(true);
            witnessed.push(tile);
        }

        //console.log("tiles left = " + squaresLeft);
        //console.log("mines left = " + minesLeft);
        //console.log("Witnesses  = " + witnesses.length);
        //console.log("Witnessed  = " + witnessed.length);

        const options = {};
        options.verbose = false;
        options.playStyle = PLAY_STYLE_EFFICIENCY;  // this forces the pe to do a complete run even if local clears are found

        const pe = new ProbabilityEngine(board, witnesses, witnessed, squaresLeft, minesLeft, options);

        // let the solution counter know which tiles mustn't contain mines
        if (notMines != null) {
            for (let tile of notMines) {
                pe.setMustBeEmpty(tile);
            }
        }

        pe.process();

        return pe;

    }

    function andClearTiles(tiles1, tiles2) {

        if (tiles1.length == 0) {
            return tiles1;
        }
        if (tiles2.length == 0) {
            return tiles2;
        }

        const result = [];
        for (let tile1 of tiles1) {
            for (let tile2 of tiles2) {
                if (tile2.isEqual(tile1)) {
                    result.push(tile1);
                    break;
                }
            }
        }

        return result;

    }

    // when looking to fix a board to be no-guess, look for witnesses which can have mines added or removed to make then no longer guesses
    function findBalancingCorrections(pe) {

        const adders = [...pe.prunedWitnesses];
        adders.sort((a, b) => adderSort(a, b));

        /*
        for (let i = 0; i < adders.length; i++) {
            const boxWitness = adders[i];
            const minesToFind = boxWitness.minesToFind;
            const spacesLeft = boxWitness.tiles.length;

            console.log(boxWitness.tile.asText() + " length " + boxWitness.tiles.length + ", add " + (spacesLeft - minesToFind) + ", remove " + minesToFind);
        }
        */

        let balanced = false;

        for (let i = 0; i < adders.length; i++) {
            const boxWitness = adders[i];

            if (findBalance(boxWitness, adders)) {
                writeToConsole("*** Balanced ***", true);
                balanced = true;
                break;
            }

        }

        if (!balanced) {
            writeToConsole("*** NOT Balanced ***", true);
            fillerTiles = [];
        }

       
    }

    function findBalance(boxWitness, adders) {

        // these are the adjustments which will all the tile to be trivially solved
        const toRemove = boxWitness.minesToFind;
        const toAdd = boxWitness.tiles.length - toRemove;

        writeToConsole("trying to balance " + boxWitness.tile.asText() + " to Remove=" + toRemove + ", or to Add=" + toAdd, true);

        top: for (let balanceBox of adders) {
            if (balanceBox.tile.isEqual(boxWitness.tile)) {
                continue;
            }

            // ensure the balancing witness doesn't overlap with this one
            for (let adjTile of board.getAdjacent(balanceBox.tile)) {
                if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                    if (adjTile.isAdjacent(boxWitness.tile)) {
                        continue top;
                    }
                }
            }

            const toRemove1 = balanceBox.minesToFind;
            const toAdd1 = balanceBox.tiles.length - toRemove1;

            if (toAdd1 == toRemove) {
                writeToConsole("found balance " + balanceBox.tile.asText() + " to Add=" + toAdd1, true);
                addFillings(boxWitness, false); // remove from here
                addFillings(balanceBox, true); // add to here
                return true;
            }

            if (toRemove1 == toAdd) {
                writeToConsole("found balance " + balanceBox.tile.asText() + " to Remove=" + toRemove1, true);
                addFillings(boxWitness, true); // add to here
                addFillings(balanceBox, false); // remove from here
                return true;
            }

        }

        return false;

    }

    /*
    function collisionSafe(tile) {

        for (var adjTile of board.getAdjacent(tile)) {
            if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                for (var filler of fillerTiles) {
                    if (filler.x == adjTile.x && filler.y == adjTile.y) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
    */

    function adderSort(a, b) {

        // tiels with smallest area first
        let c = a.tiles.length - b.tiles.length;

        // then by the number of mines to find
        if (c == 0) {
            c = a.minesToFind - b.minesToFind;
        }

        return c;
    }

    function addFillings(boxWitness, fill) {

        for (let adjTile of boxWitness.tiles) {
            if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                const filler = new Filling(adjTile.index, adjTile.x, adjTile.y, fill);
                fillerTiles.push(filler);
                //writeToConsole(filler.asText(), true);
            }
        }


    }

    function writeToConsole(text, always) {

        if (always == null) {
            always = false;
        }

        if (options != null && options.verbose || always) {
            console.log(text);
        }

    }

}

// shared functions

function formatSolutions(count) {

    if (count > maxSolutionsDisplay) {
        let work = count;
        let index = 3;
        let power = 0;
        while (work > power10n[index * 2]) {
            work = work / power10n[index];
            power = power + index;
        }

        const value = divideBigInt(work, power10n[index], 3);
        power = power + 3;

        return " Approximately " + value + " * 10<sup>" + power + "</sup> possible solutions remain.";
    } else {
        return " " + count.toLocaleString() + " possible solutions remain.";
    }

}


function combination(mines, squares) {

    return BINOMIAL.generate(mines, squares);

}

const power10n = [BigInt(1), BigInt(10), BigInt(100), BigInt(1000), BigInt(10000), BigInt(100000), BigInt(1000000), BigInt(10000000), BigInt(100000000), BigInt(1000000000)];
const power10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
const maxSolutionsDisplay = BigInt("100000000000000000");

function divideBigInt(numerator, denominator, dp) {

    const work = numerator * power10n[dp] / denominator;

    const result = Number(work) / power10[dp];

    return result;
}

// location with probability of being safe
class Action {
    constructor(x, y, prob, action) {
        this.x = x;
        this.y = y;
        this.prob = prob;
        this.action = action;
        this.dead = false;
        this.pruned = false;

        // part of full analysis output, until then assume worst case 
        this.progress = 0;
        this.expectedClears = 0;
        this.weight = prob;
        this.maxSolutions = 0;
        this.commonClears = null;
        this.dominatingTile = null;

        Object.seal(this); // prevent new values being created
    }

    asText() {

        return "(" + this.x + "," + this.y + ")";

    }

}

// location with probability of being safe
class Filling {
    constructor(index, x, y, fill) {
        this.index = index;
        this.x = x;
        this.y = y;
        this.fill = fill;  // mines left to find
    }

    asText() {

        return "(" + this.x + "," + this.y + ") Fill " + this.fill;

    }

}

/**
 * 
 */

"use strict";

class ProbabilityEngine {

    static SMALL_COMBINATIONS = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1], [1, 5, 10, 10, 5, 1], [1, 6, 15, 20, 15, 6, 1], [1, 7, 21, 35, 35, 21, 7, 1], [1, 8, 28, 56, 70, 56, 28, 8, 1]];

	constructor(board, allWitnesses, allWitnessed, squaresLeft, minesLeft, options) {

        this.board = board;
        this.options = options;
        this.playStyle = options.playStyle;
        this.verbose = options.verbose;

		this.witnessed = allWitnessed;

        this.duration = 0;

        this.prunedWitnesses = [];  // a subset of allWitnesses with equivalent witnesses removed

        // constraints in the game
        this.minesLeft = minesLeft;
        this.tilesLeft = squaresLeft;
        this.TilesOffEdge = squaresLeft - allWitnessed.length;   // squares left off the edge and unrevealed
        this.minTotalMines = minesLeft - this.TilesOffEdge;   // //we can't use so few mines that we can't fit the remainder elsewhere on the board
        this.maxTotalMines = minesLeft;

        this.boxes = [];
        this.boxWitnesses = [];
        this.mask = [];

        // list of 'DeadCandidate' which are potentially dead
        this.deadCandidates = [];
        this.deadTiles = [];
        this.lonelyTiles = [];  // tiles with no empty space around them

        this.emptyBoxes = [];  // boxes which never contain mines - i.e. the set of safe tiles by Box

        this.boxProb = [];  // the probabilities end up here
		this.workingProbs = []; 
        this.heldProbs = [];
        this.bestProbability = 0;  // best probability of being safe
        this.offEdgeProbability = 0;
        this.offEdgeMineTally = 0;
        this.bestOnEdgeProbability = BigInt(0);
        this.finalSolutionsCount = BigInt(0);

        this.bestLivingSafety = 0;
        this.blendedSafety = 0;
        this.singleSafestTile = null;   // the uniquely safest living tile on the board 

        // details about independent witnesses
        this.independentWitnesses = [];
        this.dependentWitnesses = [];
        this.independentMines = 0;
        this.independentIterations = BigInt(1);
        this.remainingSquares = 0;

        this.livingClearTile = 0;
        this.clearCount = 0;
        this.localClears = [];
        this.fullAnalysis = false;  // unless we are playing efficiency mode we'll stop after we find some safe tiles

        this.minesFound = [];  // discovered mines are stored in here

        this.canDoDeadTileAnalysis = true;

        this.isolatedEdgeBruteForce = null;

        this.validWeb = true;
        this.recursions = 0;

        Object.seal(this); // prevent new values being created


        // can't have less than zero mines
        if (minesLeft < 0) {
            this.validWeb = false;
            return;
        }

        // generate a BoxWitness for each witness tile and also create a list of pruned witnesses for the brute force search
        let pruned = 0;
        for (let i = 0; i < allWitnesses.length; i++) {
            const wit = allWitnesses[i];

            const boxWit = new BoxWitness(this.board, wit);

            // can't have too many or too few mines 
            if (boxWit.minesToFind < 0 || boxWit.minesToFind > boxWit.tiles.length) {
                this.validWeb = false;
            }

            // if the witness is a duplicate then don't store it
            let duplicate = false;
            for (let j = 0; j < this.boxWitnesses.length; j++) {

                const w = this.boxWitnesses[j];

                if (w.equivalent(boxWit)) {
                    //if (boardState.getWitnessValue(w) - boardState.countAdjacentConfirmedFlags(w) != boardState.getWitnessValue(wit) - boardState.countAdjacentConfirmedFlags(wit)) {
                    //    boardState.display(w.display() + " and " + wit.display() + " share unrevealed squares but have different mine totals!");
                    //    validWeb = false;
                    //}
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) {
                this.prunedWitnesses.push(boxWit);
             } else {
                pruned++;
            }
            this.boxWitnesses.push(boxWit);  // all witnesses are needed for the probability engine
        }
        this.writeToConsole("Pruned " + pruned + " witnesses as duplicates");
        this.writeToConsole("There are " + this.boxWitnesses.length + " Box witnesses");

		// allocate each of the witnessed squares to a box
		let uid = 0;
		for (let i=0; i < this.witnessed.length; i++) {
			
			const tile = this.witnessed[i];
			
			let count = 0;
			
			// count how many adjacent witnesses the tile has
			for (let j=0; j < allWitnesses.length; j++) {
				if (tile.isAdjacent(allWitnesses[j])) {
					count++;
				}
			}
			
            // see if the witnessed tile fits any existing boxes
            let found = false;
			for (let j=0; j < this.boxes.length; j++) {
				
				if (this.boxes[j].fits(tile, count)) {
					this.boxes[j].add(tile);
					found = true;
					break;
				}
				
			}
			
			// if not found create a new box and store it
			if (!found) {
                this.boxes.push(new Box(this.boxWitnesses, tile, uid++));
			}

        }

        // calculate the min and max mines for each box 
        for (let i = 0; i < this.boxes.length; i++) {
            const box = this.boxes[i];
            box.calculate(this.minesLeft);
            //console.log("Box " + box.tiles[0].asText() + " has min mines = " + box.minMines + " and max mines = " + box.maxMines);
        }

        // Report how many boxes each witness is adjacent to
        //for (var i = 0; i < this.boxWitnesses.length; i++) {
        //    var boxWit = this.boxWitnesses[i];
        //      console.log("Witness " + boxWit.tile.asText() + " is adjacent to " + boxWit.boxes.length + " boxes and has " + boxWit.minesToFind + " mines to find");
        //}

 

 	}

    checkForUnavoidableGuess() {

        for (let i = 0; i < this.prunedWitnesses.length; i++) {
            const witness = this.prunedWitnesses[i];

            if (witness.minesToFind == 1 && witness.tiles.length == 2) {

                //console.log("Witness " + witness.tile.asText() + " is a possible unavoidable guess witness");
                let unavoidable = true;
                // if every monitoring tile also monitors all the other tiles then it can't provide any information
                check: for (let j = 0; j < witness.tiles.length; j++) {
                    const tile = witness.tiles[j];

                    // get the witnesses monitoring this tile
                    for (let adjTile of this.board.getAdjacent(tile)) {

                        // ignore tiles which are mines
                        if (adjTile.isSolverFoundBomb()) {
                            continue;
                        }

                        // are we one of the tiles other tiles, if so then no need to check
                        let toCheck = true;
                        for (let otherTile of witness.tiles) {
                            if (otherTile.isEqual(adjTile)) {
                                toCheck = false;
                                break;
                            }
                        }

                        // if we are monitoring and not a mine then see if we are also monitoring all the other mines
                        if (toCheck) {
                            for (let otherTile of witness.tiles) {
                                if (!adjTile.isAdjacent(otherTile)) {

                                    //console.log("Tile " + adjTile.asText() + " is not monitoring all the other witnessed tiles");
                                    unavoidable = false;
                                    break check;
                                }
                            }
                        }
                    }
                }
                if (unavoidable) {
                    this.writeToConsole("Tile " + witness.tile.asText() + " is an unavoidable guess");
                    return witness.tiles[0];
                } 
            }
        }

        return null;
    }


    checkForUnavoidable5050() {

        const links = [];

        for (let i = 0; i < this.prunedWitnesses.length; i++) {
            const witness = this.prunedWitnesses[i];

            if (witness.minesToFind == 1 && witness.tiles.length == 2) {

                // create a new link
                const link = new Link();
                link.tile1 = witness.tiles[0];
                link.tile2 = witness.tiles[1];

                //console.log("Witness " + witness.tile.asText() + " is a possible unavoidable guess witness");
                let unavoidable = true;
                // if every monitoring tile also monitors all the other tiles then it can't provide any information
                for (let j = 0; j < witness.tiles.length; j++) {
                    const tile = witness.tiles[j];

                    // get the witnesses monitoring this tile
                    for (let adjTile of this.board.getAdjacent(tile)) {

                        // ignore tiles which are mines
                        if (adjTile.isSolverFoundBomb()) {
                            continue;
                        }

                        // are we one of the tiles other tiles, if so then no need to check
                        let toCheck = true;
                        for (let otherTile of witness.tiles) {
                            if (otherTile.isEqual(adjTile)) {
                                toCheck = false;
                                break;
                            }
                        }

                        // if we are monitoring and not a mine then see if we are also monitoring all the other mines
                        if (toCheck) {
                            for (let otherTile of witness.tiles) {
                                if (!adjTile.isAdjacent(otherTile)) {

                                    //console.log("Tile " + adjTile.asText() + " is not monitoring all the other witnessed tiles");
                                    link.trouble.push(adjTile);
                                    if (tile.isEqual(link.tile1)) {
                                        link.closed1 = false;
                                    } else {
                                        link.closed2 = false;
                                    }

                                    unavoidable = false;
                                    //break check;
                                }
                            }
                        }
                    }
                }
                if (unavoidable) {
                    this.writeToConsole("Tile " + link.tile1.asText() + " is an unavoidable 50/50 guess");
                    return this.notDead([link.tile1, link.tile2]);
                }

                links.push(link);
            }
        }

        // this is the area the 50/50 spans
        let area5050 = [];

        // try and connect 2 or links together to form an unavoidable 50/50
        for (let link of links) {
            if (!link.processed && (link.closed1 && !link.closed2 || !link.closed1 && link.closed2)) {  // this is the XOR operator, so 1 and only 1 of these is closed 

                let openTile;
                let extensions = 0;
                if (!link.closed1) {
                    openTile = link.tile1;
                } else {
                    openTile = link.tile2;
                }

                area5050 = [link.tile1, link.tile2];

                link.processed = true;

                let noMatch = false;
                while (openTile != null && !noMatch) {

                    noMatch = true;
                    for (let extension of links) {
                        if (!extension.processed) {

                            if (extension.tile1.isEqual(openTile)) {
                                extensions++;
                                extension.processed = true;
                                noMatch = false;

                                // accumulate the trouble tiles as we progress;
                                link.trouble.push(...extension.trouble);
                                area5050.push(extension.tile2);   // tile2 is the new tile

                                if (extension.closed2) {
                                    if (extensions % 2 == 0 && this.noTrouble(link, area5050)) {
                                        this.writeToConsole("Tile " + openTile.asText() + " is an unavoidable guess, with " + extensions + " extensions");
                                        return this.notDead(area5050);
                                    } else {
                                        this.writeToConsole("Tile " + openTile.asText() + " is a closed extension with " + (extensions + 1) + " parts");
                                        openTile = null;
                                    }
                                } else {  // found an open extension, now look for an extension for this
                                    openTile = extension.tile2;
                                }
                                break;
                            }
                            if (extension.tile2.isEqual(openTile)) {
                                extensions++;
                                extension.processed = true;
                                noMatch = false;

                                // accumulate the trouble tiles as we progress;
                                link.trouble.push(...extension.trouble);
                                area5050.push(extension.tile1);   // tile 1 is the new tile

                                if (extension.closed1) {
                                    if (extensions % 2 == 0 && this.noTrouble(link, area5050)) {
                                        this.writeToConsole("Tile " + openTile.asText() + " is an unavoidable guess, with " + extensions + " extensions");
                                        return this.notDead(area5050);
                                    } else {
                                        this.writeToConsole("Tile " + openTile.asText() + " is a closed extension with " + (extensions + 1) + " parts");
                                        openTile = null;
                                    }

                                } else {  // found an open extension, now look for an extension for this
                                    openTile = extension.tile1;
                                }

                                break;
                            }

                        }

                    }

                }

            }
        }

        return null;
    }

    // return a tile which isn't dead
    notDead(area) {

        for (let tile of area) {
            let dead = false;
            for (let deadTile of this.deadTiles) {
                if (deadTile.isEqual(tile)) {
                    dead = true;
                    break;
                }
            }
            if (!dead) {
                return tile;
            }
        }

        // if they are all dead, return the first
        return area[0];
    }

    noTrouble(link, area) {

        // each trouble location must be adjacent to 2 tiles in the extended 50/50
        top: for (let tile of link.trouble) {

            for (let tile5050 of area) {
                if (tile.isEqual(tile5050)) {
                    continue top;    //if a trouble tile is part of the 50/50 it isn't trouble
                }
            }


            let adjCount = 0;
            for (let tile5050 of area) {
                if (tile.isAdjacent(tile5050)) {
                    adjCount++;
                }
            }
            if (adjCount % 2 !=0) {
                this.writeToConsole("Trouble Tile " + tile.asText() + " isn't adjacent to an even number of tiles in the extended candidate 50/50, adjacent " + adjCount + " of " + area.length);
                return false;
            }
        }

        return true;

    }

    // calculate a probability for each un-revealed tile on the board
	process() {

        // if the board isn't valid then solution count is zero
        if (!this.validWeb) {
            this.finalSolutionsCount = BigInt(0);
            this.clearCount = 0;
            //console.log("Invalid web");
            return;
        }

        const peStart = Date.now();

        // create an array showing which boxes have been procesed this iteration - none have to start with
        this.mask = Array(this.boxes.length).fill(false);

        // look for places which could be dead
        this.getCandidateDeadLocations();

		// create an initial solution of no mines anywhere 
        this.heldProbs.push(new ProbabilityLine(this.boxes.length, BigInt(1)));
		
		// add an empty probability line to get us started
        this.workingProbs.push(new ProbabilityLine(this.boxes.length, BigInt(1)));
		
        let nextWitness = this.findFirstWitness();

        while (nextWitness != null) {

            //console.log("Probability engine processing witness " + nextWitness.boxWitness.tile.asText());

            // mark the new boxes as processed - which they will be soon
            for (let i = 0; i < nextWitness.newBoxes.length; i++) {
                this.mask[nextWitness.newBoxes[i].uid] = true;
            }

            this.workingProbs = this.mergeProbabilities(nextWitness);

            nextWitness = this.findNextWitness(nextWitness);

        }

        // if we don't have any local clears then do a full probability determination
        if (this.localClears.length == 0) {
            this.calculateBoxProbabilities();
        } else {
            this.bestProbability = 1;
        }

        if (this.fullAnalysis) {
            this.writeToConsole("The probability engine did a full analysis - probability data is available")
        } else {
            this.writeToConsole("The probability engine did a truncated analysis - probability data is not available")
        }

        this.duration = Date.now() - peStart;

		
	}


    // take the next witness details and merge them into the currently held details
    mergeProbabilities(nw) {

        const newProbs = [];

        for (let i = 0; i < this.workingProbs.length; i++) {

            const pl = this.workingProbs[i];

            const missingMines = nw.boxWitness.minesToFind - this.countPlacedMines(pl, nw);

            if (missingMines < 0) {
                //console.log("Missing mines < 0 ==> ignoring line");
                // too many mines placed around this witness previously, so this probability can't be valid
            } else if (missingMines == 0) {
                //console.log("Missing mines = 0 ==> keeping line as is");
                newProbs.push(pl);   // witness already exactly satisfied, so nothing to do
            } else if (nw.newBoxes.length == 0) {
                //console.log("new boxes = 0 ==> ignoring line since nowhere for mines to go");
                // nowhere to put the new mines, so this probability can't be valid
            } else {
                
                const result = this.distributeMissingMines(pl, nw, missingMines, 0);
                newProbs.push(...result);

            }

        }

        // flag the last set of details as processed
        nw.boxWitness.processed = true;

        for (let i = 0; i < nw.newBoxes.length; i++) {
            nw.newBoxes[i].processed = true;
        }

        //if we haven't compressed yet and we are still a small edge then don't compress
        if (newProbs.length < 100 && this.canDoDeadTileAnalysis) {
            return newProbs;
        }

        // about to compress the line
        this.canDoDeadTileAnalysis = false;

        const boundaryBoxes = [];
        for (let i = 0; i < this.boxes.length; i++) {
            const box = this.boxes[i];
            let notProcessed = false;
            let processed = false;
            for (let j = 0; j < box.boxWitnesses.length; j++) {
                if (box.boxWitnesses[j].processed) {
                    processed = true;
                } else {
                    notProcessed = true;
                }
                if (processed && notProcessed) {
                    //boardState.display("partially processed box " + box.getUID());
                    boundaryBoxes.push(box);
                    break;
                }
            }
        }
        //boardState.display("Boxes partially processed " + boundaryBoxes.size());

        const sorter = new MergeSorter(boundaryBoxes);

        const crunched = this.crunchByMineCount(newProbs, sorter);

        //if (newProbs.length == 0) {
        //     console.log("Returning no lines from merge probability !!");
        //}

         return crunched;

    }

    // counts the number of mines already placed
    countPlacedMines(pl, nw) {

        let result = 0;

        for (let i = 0; i < nw.oldBoxes.length; i++) {

            const b = nw.oldBoxes[i];

            result = result + pl.allocatedMines[b.uid];
        }

        return result;
    }

    // this is used to recursively place the missing Mines into the available boxes for the probability line
    distributeMissingMines(pl, nw,  missingMines, index) {

        //console.log("Distributing " + missingMines + " missing mines to box " + nw.newBoxes[index].uid);

        this.recursions++;
        if (this.recursions % 1000 == 0) {
            console.log("Probability Engine recursision = " + this.recursions);
        }

        const result = [];

        // if there is only one box left to put the missing mines we have reach the end of this branch of recursion
        if (nw.newBoxes.length - index == 1) {
            // if there are too many for this box then the probability can't be valid
            if (nw.newBoxes[index].maxMines < missingMines) {
                //console.log("Abandon (1)");
                return result;
            }
            // if there are too few for this box then the probability can't be valid
            if (nw.newBoxes[index].minMines > missingMines) {
                //console.log("Abandon (2)");
                return result;
            }
            // if there are too many for this game then the probability can't be valid
            if (pl.mineCount + missingMines > this.maxTotalMines) {
                //console.log("Abandon (3)");
                return result;
            }

            // otherwise place the mines in the probability line
            //pl.mineBoxCount[nw.newBoxes[index].uid] = BigInt(missingMines);
            //pl.mineCount = pl.mineCount + missingMines;
            result.push(this.extendProbabilityLine(pl, nw.newBoxes[index], missingMines));
            //console.log("Distribute missing mines line after " + pl.mineBoxCount);
            return result;
        }


        // this is the recursion
        const maxToPlace = Math.min(nw.newBoxes[index].maxMines, missingMines);

        for (let i = nw.newBoxes[index].minMines; i <= maxToPlace; i++) {
            const npl = this.extendProbabilityLine(pl, nw.newBoxes[index], i);

            const r1 = this.distributeMissingMines(npl, nw, missingMines - i, index + 1);
            result.push(...r1);
        }

        return result;

    }

    // create a new probability line by taking the old and adding the mines to the new Box
    extendProbabilityLine(pl, newBox, mines) {

        //console.log("Extended probability line: Adding " + mines + " mines to box " + newBox.uid);
        //console.log("Extended probability line before" + pl.mineBoxCount);

        // there are less ways to place the mines if we know one of the tiles doesn't contain a mine
        const modifiedTilesCount = newBox.tiles.length - newBox.emptyTiles;

        const combination = SolutionCounter.SMALL_COMBINATIONS[modifiedTilesCount][mines];
        //const combination = ProbabilityEngine.SMALL_COMBINATIONS[newBox.tiles.length][mines];
        const bigCom = BigInt(combination);

        const newSolutionCount = pl.solutionCount * bigCom;

        const result = new ProbabilityLine(this.boxes.length, newSolutionCount);

        result.mineCount = pl.mineCount + mines;
 
        // copy the probability array

        if (combination != 1) {
            for (let i = 0; i < pl.mineBoxCount.length; i++) {
                result.mineBoxCount[i] = pl.mineBoxCount[i] * bigCom;
            }
        } else {
            result.mineBoxCount = pl.mineBoxCount.slice();
        }

        result.mineBoxCount[newBox.uid] = BigInt(mines) * result.solutionCount;

        result.allocatedMines = pl.allocatedMines.slice();
        result.allocatedMines[newBox.uid] = mines;

        //console.log("Extended probability line after " + result.mineBoxCount);

        return result;
    }


    // this combines newly generated probabilities with ones we have already stored from other independent sets of witnesses
    storeProbabilities() {

        //console.log("At store probabilities");

        const result = [];

        //this.checkCandidateDeadLocations();

        if (this.workingProbs.length == 0) {
            //this.writeToConsole("working probabilites list is empty!!", true);
            this.heldProbs = [];
        	return;
        } 

        // crunch the new ones down to one line per mine count
        //var crunched = this.crunchByMineCount(this.workingProbs);

        const crunched = this.workingProbs;

        if (crunched.length == 1) {
            this.checkEdgeIsIsolated();
        }

        //solver.display("New data has " + crunched.size() + " entries");

        for (let i = 0; i < crunched.length; i++) {

            pl = crunched[i];

            for (let j = 0; j < this.heldProbs.length; j++) {

                const epl = this.heldProbs[j];

                const npl = new ProbabilityLine(this.boxes.length);

                npl.mineCount = pl.mineCount + epl.mineCount;

                if (npl.mineCount <= this.maxTotalMines) {

                    npl.solutionCount = pl.solutionCount * epl.solutionCount;

                    for (let k = 0; k < npl.mineBoxCount.length; k++) {

                        const w1 = pl.mineBoxCount[k] * epl.solutionCount;
                        const w2 = epl.mineBoxCount[k] * pl.solutionCount;
                        npl.mineBoxCount[k] = w1 + w2;

                    }
                    result.push(npl);

                }
            }
        }

        // sort into mine order 
        result.sort(function (a, b) { return a.mineCount - b.mineCount });

        this.heldProbs = [];

        // if result is empty this is an impossible position
        if (result.length == 0) {
            return;
        }

        // and combine them into a single probability line for each mine count
        let mc = result[0].mineCount;
        let npl = new ProbabilityLine(this.boxes.length);
        npl.mineCount = mc;

        for (let i = 0; i < result.length; i++) {

            var pl = result[i];

            if (pl.mineCount != mc) {
                this.heldProbs.push(npl);
                mc = pl.mineCount;
                npl = new ProbabilityLine(this.boxes.length);
                npl.mineCount = mc;
            }
            npl.solutionCount = npl.solutionCount + pl.solutionCount;

            for (let j = 0; j < pl.mineBoxCount.length; j++) {
                npl.mineBoxCount[j] = npl.mineBoxCount[j] + pl.mineBoxCount[j];
            }
        }

        this.heldProbs.push(npl);

    }

    crunchByMineCount(target, sorter) {

        if (target.length == 0) {
            return target;
         }

        // sort the solutions by number of mines
        target.sort(function (a, b) { return sorter.compare(a,b) });

        const result = [];

        let current = null;

        for (let i = 0; i < target.length; i++) {

            const pl = target[i];

            if (current == null) {
                current = target[i];
            } else if (sorter.compare(current, pl) != 0) {
                result.push(current);
                current = pl;
            } else {
                this.mergeLineProbabilities(current, pl);
            }

        }

        //if (npl.mineCount >= minTotalMines) {
        result.push(current);
        //}	

        this.writeToConsole(target.length + " Probability Lines compressed to " + result.length); 

        return result;

    }

    // calculate how many ways this solution can be generated and roll them into one
    mergeLineProbabilities(npl, pl) {

        /*
        var solutions = BigInt(1);
        for (var i = 0; i < pl.mineBoxCount.length; i++) {
            solutions = solutions * BigInt(this.SMALL_COMBINATIONS[this.boxes[i].tiles.length][pl.mineBoxCount[i]]);
        }

        npl.solutionCount = npl.solutionCount + solutions;
        */

        npl.solutionCount = npl.solutionCount + pl.solutionCount;

        for (let i = 0; i < pl.mineBoxCount.length; i++) {
            if (this.mask[i]) {  // if this box has been involved in this solution - if we don't do this the hash gets corrupted by boxes = 0 mines because they weren't part of this edge
                npl.mineBoxCount[i] = npl.mineBoxCount[i] + pl.mineBoxCount[i];
            }

        }

    }

    // return any witness which hasn't been processed
    findFirstWitness() {

        for (let i = 0; i < this.boxWitnesses.length; i++) {
            const boxWit = this.boxWitnesses[i];
            if (!boxWit.processed) {
                return new NextWitness(boxWit);
            }
        }

        return null;
    }

    // look for the next witness to process
    findNextWitness(prevWitness) {

        let bestTodo = 99999;
        let bestWitness = null;

        // and find a witness which is on the boundary of what has already been processed
        for (let i = 0; i < this.boxes.length; i++) {
            const b = this.boxes[i];
            if (b.processed) {
                for (let j = 0; j < b.boxWitnesses.length; j++) {
                    const w = b.boxWitnesses[j];
                    if (!w.processed) {
                        let todo = 0;
                        for (let k = 0; k < w.boxes.length; k++) {
                            const b1 = w.boxes[k];

                            if (!b1.processed) {
                                todo++;
                            }
                        }
                        if (todo == 0) {    // prioritise the witnesses which have the least boxes left to process
                            return new NextWitness(w);
                        } else if (todo < bestTodo) {
                            bestTodo = todo;
                            bestWitness = w;
                        }
                    }
                }
            }
        }

        if (bestWitness != null) {
            return new NextWitness(bestWitness);
        } else {
            this.writeToConsole("Ending independent edge");
        }

        // if we are down here then there is no witness which is on the boundary, so we have processed a complete set of independent witnesses 

        // if playing for efficiency check all edges, slower but we get better information
        if (this.playStyle != PLAY_STYLE_EFFICIENCY && this.playStyle != PLAY_STYLE_NOFLAGS_EFFICIENCY && !analysisMode && !this.options.fullProbability) {

            // look to see if this sub-section of the edge has any certain clears
            for (let i = 0; i < this.mask.length; i++) {
                if (this.mask[i]) {

                    let isClear = true;
                    for (let j = 0; j < this.workingProbs.length; j++) {
                        const wp = this.workingProbs[j];
                        if (wp.mineBoxCount[i] != 0) {
                            isClear = false;
                            break;
                        }
                    }
                    if (isClear) {
                        // if the box is locally clear then store the tiles in it
                        for (let j = 0; j < this.boxes[i].tiles.length; j++) {

                            const tile = this.boxes[i].tiles[j];

                            this.writeToConsole(tile.asText() + " has been determined to be locally clear");
                            this.localClears.push(tile);
                        }
                    }

                    let isFlag = true;
                    for (let j = 0; j < this.workingProbs.length; j++) {
                        const wp = this.workingProbs[j];
                        if (wp.mineBoxCount[i] != wp.solutionCount * BigInt(this.boxes[i].tiles.length)) {
                            isFlag = false;
                            break;
                        }
                    }
                    if (isFlag) {
                        // if the box contains all mines then store the tiles in it
                        for (let j = 0; j < this.boxes[i].tiles.length; j++) {
                            const tile = this.boxes[i].tiles[j];
                            this.writeToConsole(tile.asText() + " has been determined to be locally a mine");
                            this.minesFound.push(tile);
                        }
                    }
                }
            }

            // if we have found some local clears then stop and use these
            if (this.localClears.length > 0) {
                return null;
            }

        }
 

        //independentGroups++;

        this.checkCandidateDeadLocations(this.canDoDeadTileAnalysis);

        // if we haven't compressed yet then do it now
        if (this.canDoDeadTileAnalysis) {
            const sorter = new MergeSorter();
            this.workingProbs = this.crunchByMineCount(this.workingProbs, sorter);
        } else {
            this.canDoDeadTileAnalysis = true;
        }

        // since we have calculated all the mines in an independent set of witnesses we can crunch them down and store them for later

        // get an unprocessed witness
        const nw = this.findFirstWitness();
        if (nw != null) {
            this.writeToConsole("Starting a new independent edge");
        }

        // Store the probabilities for later consolidation
        this.storeProbabilities();

        // reset the working array so we can start building up one for the new set of witnesses
        this.workingProbs = [new ProbabilityLine(this.boxes.length, BigInt(1))];
 
        // reset the mask indicating that no boxes have been processed 
        this.mask.fill(false);
 

        // return the next witness to process
        return nw;

    }


    // check the candidate dead locations with the information we have - remove those that aren't dead
    checkCandidateDeadLocations(checkPossible) {

        let completeScan;
        if (this.TilesOffEdge == 0) {
            completeScan = true;   // this indicates that every box has been considered in one sweep (only 1 independent edge)
            for (let i = 0; i < this.mask.length; i++) {
                if (!this.mask[i]) {
                    completeScan = false;
                    break;
                }
            }
            if (completeScan) {
                this.writeToConsole("This is a complete scan");
            } else {
                this.writeToConsole("This is not a complete scan");
            }
        } else {
            completeScan = false;
            this.writeToConsole("This is not a complete scan because there are squares off the edge");
        }


        for (let i = 0; i < this.deadCandidates.length; i++) {

            const dc = this.deadCandidates[i];

            if (dc.isAlive) {  // if this location isn't dead then no need to check any more
                continue;
            }

            // only do the check if all the boxes have been analysed in this probability iteration
            let boxesInScope = 0;
            for (let j = 0; j < dc.goodBoxes.length; j++) {
                const b = dc.goodBoxes[j];
                if (this.mask[b.uid]) {
                    boxesInScope++;
                }
            }
            for (let j = 0; j < dc.badBoxes.length; j++) {
                const b = dc.badBoxes[j];
                if (this.mask[b.uid]) {
                    boxesInScope++;
                }
            }
            if (boxesInScope == 0) {
                continue;
            } else if (boxesInScope != dc.goodBoxes.length + dc.badBoxes.length) {
                this.writeToConsole("Location " + dc.candidate.asText() + " has some boxes in scope and some out of scope so assumed alive");
                dc.isAlive = true;
                continue;
            }

            //if we can't do the check because the edge has been compressed mid process then assume alive
            if (!checkPossible) {
                this.writeToConsole("Location " + dc.candidate.asText() + " was on compressed edge so assumed alive");
                dc.isAlive = true;
                continue;
            }

            let okay = true;
            let mineCount = 0;
            line: for (let j = 0; j < this.workingProbs.length; j++) {

                const pl = this.workingProbs[j];

                if (completeScan && pl.mineCount != this.minesLeft) {
                    continue line;
                }

                // ignore probability lines where the candidate is a mine
                if (pl.allocatedMines[dc.myBox.uid] == dc.myBox.tiles.length) {
                    mineCount++;
                    continue line;
                }

                // all the bad boxes must be zero
                for (let k = 0; k < dc.badBoxes.length; k++) {

                    const b = dc.badBoxes[k];

                    let neededMines;
                    if (b.uid == dc.myBox.uid) {
                        neededMines = BigInt(b.tiles.length - 1) * pl.solutionCount;
                    } else {
                        neededMines = BigInt(b.tiles.length) * pl.solutionCount;
                    }

                    // a bad box must have either no mines or all mines
                    if (pl.mineBoxCount[b.uid] != 0 && pl.mineBoxCount[b.uid] != neededMines) {
                        this.writeToConsole("Location " + dc.candidate.asText() + " is not dead because a bad box has neither zero or all mines: " + pl.mineBoxCount[b.uid] + "/" + neededMines);
                        okay = false;
                        break line;
                    }
                }

                let tally = 0;
                // the number of mines in the good boxes must always be the same
                for (let k = 0; k < dc.goodBoxes.length; k++) {
                    const b = dc.goodBoxes[k];
                    tally = tally + pl.allocatedMines[b.uid];
                }
                //boardState.display("Location " + dc.candidate.display() + " has mine tally " + tally);
                if (dc.firstCheck) {
                    dc.total = tally;
                    dc.firstCheck = false;
                } else {
                    if (dc.total != tally) {
                        this.writeToConsole("Location " + dc.candidate.asText() + " is not dead because the sum of mines in good boxes is not constant. Was "
                            + dc.total + " now " + tally + ". Mines in probability line " + pl.mineCount);
                        okay = false;
                        break;
                    }
                }
            }

            // if a check failed or every this tile is a mine for every solution then it is alive
            if (!okay || mineCount == this.workingProbs.length) {
                dc.isAlive = true;
            }

        }

    }


    // find a list of locations which could be dead
    getCandidateDeadLocations() {

        // for each square on the edge
        for (let i = 0; i < this.witnessed.length; i++) {

            const tile = this.witnessed[i];

            const adjBoxes = this.getAdjacentBoxes(tile);

            if (adjBoxes == null) {  // this happens when the square isn't fully surrounded by boxes
                continue;
            }

            const dc = new DeadCandidate();
            dc.candidate = tile;
            dc.myBox = this.getBox(tile);

            for (let j = 0; j < adjBoxes.length; j++) {

                const box = adjBoxes[j];

                let good = true;
                for (let k = 0; k < box.tiles.length; k++) {

                    const square = box.tiles[k];

                    if (!square.isAdjacent(tile) && !(square.index == tile.index)) {
                        good = false;
                        break;
                    }
                }
                if (good) {
                    dc.goodBoxes.push(box);
                } else {
                    dc.badBoxes.push(box);
                }

            }

            if (dc.goodBoxes.length == 0 && dc.badBoxes.length == 0) {
                this.writeToConsole(dc.candidate.asText() + " is lonely since it has no open tiles around it");
                this.lonelyTiles.push(dc);
            } else {
                this.deadCandidates.push(dc);
            }
            

        }

        for (let i = 0; i < this.deadCandidates.length; i++) {
            const dc = this.deadCandidates[i];
            this.writeToConsole(dc.candidate.asText() + " is candidate dead with " + dc.goodBoxes.length + " good boxes and " + dc.badBoxes.length + " bad boxes");
        }

    }

    // get the box containing this tile
    getBox(tile) {

        for (let i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i].contains(tile)) {
                return this.boxes[i];
            }
        }

        //this.writeToConsole("ERROR - tile " + tile.asText() + " doesn't belong to a box");

        return null;
    }

    // return all the boxes adjacent to this tile
    getAdjacentBoxes(loc) {

        const result = [];

        const adjLocs = this.board.getAdjacent(loc);

         // get each adjacent location
        for (let i = 0; i < adjLocs.length; i++) {

            let adjLoc = adjLocs[i];

            // we only want adjacent tile which are un-revealed
            if (!adjLoc.isCovered() || adjLoc.isSolverFoundBomb()) {
                continue;
            }

            // find the box it is in
            let boxFound = false;
            for (let j = 0; j < this.boxes.length; j++) {

                const box = this.boxes[j];

                if (box.contains(adjLoc)) {
                    boxFound = true;
                    // is the box already included?
                    let found = false;
                    for (let k = 0; k < result.length; k++) {

                        if (box.uid == result[k].uid) {
                            found = true;
                            break;
                        }
                    }
                    // if not add it
                    if (!found) {
                        result.push(box);
                        //sizeOfBoxes = box.getSquares().size();
                    }
                }
            }

            // if a box can't be found for the adjacent square then the location can't be dead
            if (!boxFound) {
                return null;
            }

        }

        return result;

    }

    // an edge is isolated if every tile on it is completely surrounded by boxes also on the same edge
    checkEdgeIsIsolated() {

        const edgeTiles = new Set();
        const edgeWitnesses = new Set();

        let everything = true;

        // load each tile on this edge into a set
        for (let i = 0; i < this.mask.length; i++) {
            if (this.mask[i]) {
                //edgeTiles.add(...this.boxes[i].tiles);
                for (let j = 0; j < this.boxes[i].tiles.length; j++) {
                    edgeTiles.add(this.boxes[i].tiles[j]);
                }

                for (let j = 0; j < this.boxes[i].boxWitnesses.length; j++) {
                    edgeWitnesses.add(this.boxes[i].boxWitnesses[j].tile);
                }
 
            } else {
                everything = false;
            }
        }

        //var text = "";
        //for (var i = 0; i < edgeTiles.size; i++) {
        //    text = text + edgeTiles[i].asText() + " ";
        //}
        //console.log(text);

        // if this edge is everything then it isn't an isolated edge
        //if (everything) {
        //    this.writeToConsole("Not isolated because the edge is everything");
        //    return false;
        //}

        if (this.isolatedEdgeBruteForce != null && edgeTiles.size >= this.isolatedEdgeBruteForce.tiles.length) {
            this.writeToConsole("Already found an isolated edge of smaller size");
        }

        // check whether every tile adjacent to the tiles on the edge is itself on the edge
        for (let i = 0; i < this.mask.length; i++) {
            if (this.mask[i]) {
                for (let j = 0; j < this.boxes[i].tiles.length; j++) {
                    const tile = this.boxes[i].tiles[j];
                    const adjTiles = this.board.getAdjacent(tile);
                    for (let k = 0; k < adjTiles.length; k++) {
                        const adjTile = adjTiles[k];
                        if (adjTile.isCovered() && !adjTile.isSolverFoundBomb() && !edgeTiles.has(adjTile)) {
                            this.writeToConsole("Not isolated because a tile's adjacent tiles isn't on the edge: " + tile.asText() + " ==> " + adjTile.asText());
                            return false;
                        }
                    }
                }
            }
        }

        this.writeToConsole("*** Isolated Edge found ***");

        const tiles = [...edgeTiles];
        const witnesses = [...edgeWitnesses];
        const mines = this.workingProbs[0].mineCount;
        // build a web of the isolated edge and use it to build a brute force
        const isolatedEdge = new ProbabilityEngine(this.board, witnesses, tiles, tiles.length, mines, this.options);
        isolatedEdge.generateIndependentWitnesses();
        const iterator = new WitnessWebIterator(isolatedEdge, tiles, -1);

        const bruteForce = new Cruncher(this.board, iterator);
 
        this.isolatedEdgeBruteForce = bruteForce;

        return true;
    }

    // determine a set of independent witnesses which can be used to brute force the solution space more efficiently then a basic 'pick r from n' 
    generateIndependentWitnesses() {

        this.remainingSquares = this.witnessed.length;

        // find a set of witnesses which don't share any squares (there can be many of these, but we just want one to use with the brute force iterator)
        for (let i = 0; i < this.prunedWitnesses.length; i++) {

            const w = this.prunedWitnesses[i];

            //console.log("Checking witness " + w.tile.asText() + " for independence");

            let okay = true;
            for (let j = 0; j < this.independentWitnesses.length; j++) {

                const iw = this.independentWitnesses[j];

                if (w.overlap(iw)) {
                    okay = false;
                    break;
                }
            }

            // split the witnesses into dependent ones and independent ones 
            if (okay) {
                this.remainingSquares = this.remainingSquares - w.tiles.length;
                this.independentIterations = this.independentIterations * combination(w.minesToFind, w.tiles.length);
                this.independentMines = this.independentMines + w.minesToFind;
                this.independentWitnesses.push(w);  
            } else {
                this.dependentWitnesses.push(w);
            }
        }

        this.writeToConsole("Calculated " + this.independentWitnesses.length + " independent witnesses");

    }

    // here we expand the localised solution to one across the whole board and
    // sum them together to create a definitive probability for each box
    calculateBoxProbabilities() {

        const tally = [];
        for (let i = 0; i < this.boxes.length; i++) {
            tally[i] = BigInt(0);
        }

        // total game tally
        let totalTally = BigInt(0);

        // outside a box tally
        let outsideTally = BigInt(0);

        //console.log("There are " + this.heldProbs.length + " different mine counts on the edge");

        // calculate how many mines 
        for (let i = 0; i < this.heldProbs.length; i++) {

            const pl = this.heldProbs[i];

            //console.log("Mine count is " + pl.mineCount + " with solution count " + pl.solutionCount + " mineBoxCount = " + pl.mineBoxCount);

            if (pl.mineCount >= this.minTotalMines) {    // if the mine count for this solution is less than the minimum it can't be valid
 
                const mult = combination(this.minesLeft - pl.mineCount, this.TilesOffEdge);  //# of ways the rest of the board can be formed
                const newSolutions = mult * pl.solutionCount;

                this.writeToConsole(newSolutions + " solutions with " + pl.mineCount + " mines on Perimeter");

                outsideTally = outsideTally + mult * BigInt(this.minesLeft - pl.mineCount) * (pl.solutionCount);

                // this is all the possible ways the mines can be placed across the whole game
                totalTally = totalTally + newSolutions;

                for (let j = 0; j < tally.length; j++) {
                    //console.log("mineBoxCount " + j + " is " + pl.mineBoxCount[j]);
                    tally[j] = tally[j] + (mult * pl.mineBoxCount[j]) / BigInt(this.boxes[j].tiles.length);
                }
            }

        }

        this.minesFound = [];  // forget any mines we found on edges as we went along, we'll find them again here
        // for each box calculate a probability
        for (let i = 0; i < this.boxes.length; i++) {

            if (totalTally != 0) {
                if (tally[i] == totalTally) {  // a mine
                    //console.log("Box " + i + " contains mines");
                    this.boxProb[i] = 0;

                } else if (tally[i] == 0) {  // safe
                    this.boxProb[i] = 1;
                    this.emptyBoxes.push(this.boxes[i]);

                } else {  // neither mine nor safe
                    this.boxProb[i] = 1 - divideBigInt(tally[i], totalTally, 8);
                }

                this.boxes[i].mineTally = tally[i]; 
            } else {
                this.boxProb[i] = 0;
                this.boxes[i].mineTally = 0; 

            }

            //console.log("Box " + i + " has probabality " + this.boxProb[i]);

            // for each tile in the box allocate a probability to it
            for (let j = 0; j < this.boxes[i].tiles.length; j++) {
                if (this.boxProb[i] == 0) {
                    this.minesFound.push(this.boxes[i].tiles[j]);
                }
            }

        }

        // see if the lonely tiles are dead
        for (let i = 0; i < this.lonelyTiles.length; i++) {
            const dc = this.lonelyTiles[i];
            //if (this.boxProb[dc.myBox.uid] != 0 && this.boxProb[dc.myBox.uid] != 1) {   // a lonely tile is dead if not a definite mine or safe
            if (this.boxProb[dc.myBox.uid] != 0) {
                this.writeToConsole("PE found Lonely tile " + dc.candidate.asText() + " is dead with value +" + dc.total);
                this.deadTiles.push(dc.candidate);
            }
        }

        // add the dead locations we found
        for (let i = 0; i < this.deadCandidates.length; i++) {
            const dc = this.deadCandidates[i];
            //if (!dc.isAlive && this.boxProb[dc.myBox.uid] != 0 && this.boxProb[dc.myBox.uid] != 1) {   // if it is dead and not a definite mine or safe
            if (!dc.isAlive && this.boxProb[dc.myBox.uid] != 0) {
                this.writeToConsole("PE found " + dc.candidate.asText() + " to be dead with value +" + dc.total);
                this.deadTiles.push(dc.candidate);
            }
        }

        // avoid divide by zero
        if (this.TilesOffEdge != 0 && totalTally != BigInt(0)) {
            this.offEdgeProbability = 1 - divideBigInt(outsideTally, totalTally * BigInt(this.TilesOffEdge), 8);
            this.offEdgeMineTally = outsideTally / BigInt(this.TilesOffEdge);
        } else {
            this.offEdgeProbability = 0;
            this.offEdgeMineTally = 0;
        }

        this.finalSolutionsCount = totalTally;


        // count how many clears we have
        this.localClears = [];
        if (totalTally > 0) {
            for (let i = 0; i < this.boxes.length; i++) {

                let box = this.boxes[i];

                if (tally[i] == 0) {
                    this.clearCount = this.clearCount + this.boxes[i].tiles.length;
                    this.localClears.push(...box.tiles);

                    // count how many of the clear tiles are also living
                    for (let j = 0; j < box.tiles.length; j++) {
                        let tile = box.tiles[j];

                        let tileLiving = true;
                        for (let k = 0; k < this.deadTiles.length; k++) {
                            if (this.deadTiles[k].isEqual(tile)) {
                                tileLiving = false;
                                break;
                            }
                        }
                        if (tileLiving) {
                            this.livingClearTile++;
                        }
                    }

                }
            }
        }

        // see if we can find a guess which is better than outside the boxes
        let hwm = 0;

        let bestSafety1 = this.offEdgeProbability;    // safest tile
        let bestSafety2 = this.offEdgeProbability;    // next safest tile
        let bestTile = null;

        for (let i = 0; i < this.boxes.length; i++) {

            const b = this.boxes[i];
            var prob = this.boxProb[b.uid];

            let boxLiving = false;

            // a box is dead if all its tiles are dead
            for (let j = 0; j < this.boxes[i].tiles.length; j++) {
                const tile = this.boxes[i].tiles[j];

                let tileLiving = true;
                for (let k = 0; k < this.deadTiles.length; k++) {
                    if (this.deadTiles[k].isEqual(tile)) {
                        tileLiving = false;
                        break;
                    }
                }
                if (tileLiving) {
                    boxLiving = true;

                    if (prob > bestSafety2) {
                        if (prob > bestSafety1) {
                            bestSafety2 = bestSafety1;
                            bestSafety1 = prob;
                            bestTile = tile;
                        } else {
                            bestSafety2 = prob;
                        }
                    }
                }
            }
 
            if (boxLiving || prob == 1) {   // if living or 100% safe then consider this probability
                if (hwm < prob) {
                     hwm = prob;
                }
            }
        }

        this.bestLivingSafety = bestSafety1;

        if (bestSafety1 > bestSafety2) {
            this.singleSafestTile = bestTile;
            //console.log("Safest next living tile is " + bestTile.asText());
        }

        // belended safety is a weighted average of the best and second best living safe tiles
        this.blendedSafety = (bestSafety1 * 4 + bestSafety2) / 5;
        //this.blendedSafety = bestSafety1;


        this.bestOnEdgeProbability = hwm;

        this.bestProbability = Math.max(this.bestOnEdgeProbability, this.offEdgeProbability);            ;

        this.writeToConsole("Safe tiles " + this.localClears.length + ", Mines found " + this.minesFound.length);
        this.writeToConsole("Off edge Safety is " + this.offEdgeProbability);
        this.writeToConsole("Best on edge safety is " + this.bestOnEdgeProbability);
        this.writeToConsole("Best safety is " + this.bestProbability);
        this.writeToConsole("Best living safety is " + this.bestLivingSafety);
        this.writeToConsole("Blended safety is " + this.blendedSafety);
        this.writeToConsole("Game has  " + this.finalSolutionsCount + " candidate solutions" );

        this.fullAnalysis = true;
 
    }

    getBestCandidates(freshhold) {

        var best = [];

        //solver.display("Squares left " + this.squaresLeft + " squares analysed " + web.getSquares().size());

        // if the outside probability is the best then return an empty list
        let test;
        if (this.bestProbability == 1) {  // if we have a probability of one then don't allow lesser probs to get a look in
            test = this.bestProbability;
        } else {
            test = this.bestProbability * freshhold;
        }

        this.writeToConsole("Best probability is " + this.bestProbability + " freshhold is " + test);

        for (let i = 0; i < this.boxProb.length; i++) {
            if (this.boxProb[i] >= test) {
                for (let j = 0; j < this.boxes[i].tiles.length; j++) {
                    const squ = this.boxes[i].tiles[j];

                    //  exclude dead tiles 
                    let dead = false;
                    for (let k = 0; k < this.deadTiles.length; k++) {
                        if (this.deadTiles[k].isEqual(squ)) {
                            dead = true;
                            break;
                        }
                    }
                    if (!dead || this.boxProb[i] == 1) {   // if not dead or 100% safe then use the tile
                        best.push(new Action(squ.x, squ.y, this.boxProb[i], ACTION_CLEAR));
                    } else {
                        this.writeToConsole("Tile " + squ.asText() + " is ignored because it is dead");
                    }
 
                }
            }
        }

        // sort in to best order
        best.sort(function (a, b) { return b.prob - a.prob });

        return best;

    }

    // returns an array of 'Tile' which are dead
    getDeadTiles() {

         return this.deadTiles;
    }

    isDead(tile) {

        for (let k = 0; k < this.deadTiles.length; k++) {
            if (this.deadTiles[k].isEqual(tile)) {
                return true;
            }
        }

        return false;
    }

    getProbability(l) {

        for (const b of this.boxes) {
            if (b.contains(l)) {
                return this.boxProb[b.uid];
            }
        }

        return this.offEdgeProbability;
    }

    getFiftyPercenters() {

        const picks = [];

        for (let i = 0; i < this.boxProb.length; i++) {
            if (this.boxProb[i] == 0.5) {
                picks.push(...this.boxes[i].tiles);
            }
        }

        return picks;

    }


    // forces a box to contain a tile which isn't a mine.  If the location isn't in a box false is returned.
     setMustBeEmpty(tile) {

        const box = this.getBox(tile);

        if (box == null) {
            this.validWeb = false;
            return false;
        } else {
            box.incrementEmptyTiles();
        }

        return true;

    }
 
    writeToConsole(text, always) {

        if (always == null) {
            always = false;
        }

        if (this.verbose || always) {
            console.log(text);
        }

    }

}

class MergeSorter {

    constructor(boxes) {

        if (boxes == null) {
            this.checks = [];
            return;
        }

        this.checks = Array(boxes.length);

        for (let i = 0; i < boxes.length; i++) {
            this.checks[i] = boxes[i].uid;
        }

    }

    compare(p1, p2) {

        let c = p1.mineCount - p2.mineCount;

        if (c != 0) {
            return c;
        }

        for (let i = 0; i < this.checks.length; i++) {
            const index = this.checks[i];

            c = p1.allocatedMines[index] - p2.allocatedMines[index];

            if (c != 0) {
                return c;
            }

        }

        return 0;
    }
		
}

/*
 * Used to hold a solution
 */
class ProbabilityLine {

	constructor(boxCount, solutionCount) {
		
        this.mineCount = 0;
        if (solutionCount == null) {
            this.solutionCount = BigInt(0);
        } else {
            this.solutionCount = solutionCount;
        }
        
        this.mineBoxCount = Array(boxCount).fill(BigInt(0));
        this.allocatedMines = Array(boxCount).fill(0);

    }
	
}

// used to hold what we need to analyse next
class NextWitness {
    constructor(boxWitness) {

        this.boxWitness = boxWitness;

        this.oldBoxes = [];
        this.newBoxes = [];

        for (let i = 0; i < this.boxWitness.boxes.length; i++) {

            const box = this.boxWitness.boxes[i];
            if (box.processed) {
                this.oldBoxes.push(box);
            } else {
                this.newBoxes.push(box);
            }
        }
    }

}



// holds a witness and all the Boxes adjacent to it
class BoxWitness {
	constructor(board, tile) {

        this.tile = tile;

        this.boxes = [];  // adjacent boxes 
        this.tiles = [];  // adjacent tiles

        this.processed = false;
        this.minesToFind = tile.getValue();   

        const adjTile = board.getAdjacent(tile);

        // determine how many mines are left to find and store adjacent tiles
        for (let i = 0; i < adjTile.length; i++) {
            if (adjTile[i].isSolverFoundBomb()) {
                this.minesToFind--;
            } else if (adjTile[i].isCovered()) {
                this.tiles.push(adjTile[i]);
            }
        }		
 	}

    overlap(boxWitness) {

        // if the locations are too far apart they can't share any of the same squares
        if (Math.abs(boxWitness.tile.x - this.tile.x) > 2 || Math.abs(boxWitness.tile.y - this.tile.y) > 2) {
            return false;
        }

        top: for (let i = 0; i < boxWitness.tiles.length; i++) {

            const tile1 = boxWitness.tiles[i];

            for (let j = 0; j < this.tiles.length; j++) {

                const tile2 = this.tiles[j];

                if (tile1.isEqual(tile2)) {  // if they share a tile then return true
                    return true;
                }
            }
        }

        // no shared tile found
        return false;

    }


    // if two witnesses have the same Squares around them they are equivalent
    equivalent(boxWitness) {

        // if the number of squares is different then they can't be equivalent
        if (this.tiles.length != boxWitness.tiles.length) {
            return false;
        }

        // if the locations are too far apart they can't share the same squares
        if (Math.abs(boxWitness.tile.x - this.tile.x) > 2 || Math.abs(boxWitness.tile.y - this.tile.y) > 2) {
            return false;
        }

        for (let i = 0; i < this.tiles.length; i++) {

            const l1 = this.tiles[i];

            let found = false;
            for (let j = 0; j < boxWitness.tiles.length; j++) {
                if (boxWitness.tiles[j].index == l1.index) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }

        return true;
    }

    // add an adjacdent box 
    addBox(box) {
        this.boxes.push(box);
    }
}

// information about the boxes surrounding a dead candidate
class DeadCandidate {

    constructor() {

        this.candidate;
        this.myBox;
        this.isAlive = false;
        this.goodBoxes = [];
        this.badBoxes = [];

        this.firstCheck = true;
        this.total = 0;

    }

}

// a box is a group of tiles which share the same witnesses
class Box {
	constructor(boxWitnesses, tile, uid) {

        this.processed = false;

		this.uid = uid;
        this.minMines;
        this.maxMines;

        this.tiles = [tile];

        // this is used to indicate how many tiles in the box must not contain mine.
        this.emptyTiles = 0;
		
		this.boxWitnesses = [];

        this.mineTally = BigInt(0);

		for (let i=0; i < boxWitnesses.length; i++) {
			if (tile.isAdjacent(boxWitnesses[i].tile)) {
                this.boxWitnesses.push(boxWitnesses[i]);
                boxWitnesses[i].addBox(this);

			}
		}
		
		//console.log("Box created for tile " + tile.asText() + " with " + this.boxWitnesses.length + " witnesses");

	}
	
	// if the tiles surrounding witnesses equal the boxes then it fits
	fits(tile, count) {

		// a tile can't share the same witnesses for this box if they have different numbers
		if (count != this.boxWitnesses.length) {
			return false;
		}
		
		for (let i=0; i < this.boxWitnesses.length; i++) {
			if (!this.boxWitnesses[i].tile.isAdjacent(tile)) {
				return false;
			}
		}		
		
		//console.log("Tile " + tile.asText() + " fits in box with tile " + this.tiles[0].asText());
		
		return true;
		
	}

    /*
    * Once all the squares have been added we can do some calculations
    */
    calculate(minesLeft) {

        this.maxMines = Math.min(this.tiles.length, minesLeft);  // can't have more mines then there are tiles to put them in or mines left to discover
        this.minMines = 0;

        for (let i = 0; i < this.boxWitnesses.length; i++) {
            if (this.boxWitnesses[i].minesToFind < this.maxMines) {  // can't have more mines than the lowest constraint
                this.maxMines = this.boxWitnesses[i].minesToFind;
            }
            // if the box witness has this as its only box then all the mines must be here
            if (this.boxWitnesses[i].boxes.length == 1) {
                this.minMines = this.boxWitnesses[i].minesToFind;
            }
        }		

    }

    incrementEmptyTiles() {

        this.emptyTiles++;
        if (this.maxMines > this.tiles.length - this.emptyTiles) {
            this.maxMines = this.tiles.length - this.emptyTiles;
        }

    }

	// add a new tile to the box
	add(tile) {
		this.tiles.push(tile);
	}

    contains(tile) {

        // return true if the given tile is in this box
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i].index == tile.index) {
                return true;
            }
        }

        return false;

    }

}

// Links which when joined together might form a 50/50 chain
class Link {

    constructor() {

        this.tile1;
        this.closed1 = true;
        this.tile2;
        this.closed2 = true;

        this.processed = false;

        this.trouble = [];
    }

}

"use strict";

/**
 *  Performs a brute force search on the provided squares using the iterator 
 * 
 */
class Cruncher {

    constructor(board, iterator) {

        this.board = board;
        this.iterator = iterator;   // the iterator
        this.tiles = iterator.tiles;  // the tiles the iterator is iterating over
        this.witnesses = iterator.probabilityEngine.dependentWitnesses;  // the dependent witnesses (class BoxWitness) which need to be checked to see if they are satisfied

        this.allSolutions = [];  // this is where the solutions needed by the Brute Force Analysis class are held

        // determine how many flags are currently next to each tile
        this.currentFlagsTiles = [];
        for (let i = 0; i < this.tiles.length; i++) {
            this.currentFlagsTiles.push(board.adjacentFoundMineCount(this.tiles[i]));
        }

        // determine how many flags are currently next to each witness
        this.currentFlagsWitnesses = [];
        for (let i = 0; i < this.witnesses.length; i++) {
            this.currentFlagsWitnesses.push(board.adjacentFoundMineCount(this.witnesses[i].tile));
        }

        this.duration = 0;

    }


    
    crunch() {

        const peStart = Date.now();

        let sample = this.iterator.getSample();  // first sample

        let candidates = 0;  // number of samples which satisfy the current board state

        while (sample != null) {

            if (this.checkSample(sample)) {
                candidates++;
            }

            sample = this.iterator.getSample();

        }

        this.duration = Date.now() - peStart;

        console.log(this.iterator.iterationsDone + " cycles took " + this.duration + " milliseconds");

        return candidates;

    }

    // this checks whether the positions of the mines are a valid candidate solution
    checkSample(sample) {

        // get the tiles which are mines in this sample
        const mine = [];
        for (let i = 0; i < sample.length; i++) {
            mine.push(this.tiles[sample[i]]);
        }

        for (let i = 0; i < this.witnesses.length; i++) {

            const flags1 = this.currentFlagsWitnesses[i];
            let flags2 = 0;

            // count how many candidate mines are next to this witness
            for (let j = 0; j < mine.length; j++) {
                if (mine[j].isAdjacent(this.witnesses[i].tile)) {
                    flags2++;
                }
            }

            const value = this.witnesses[i].tile.getValue();  // number of flags indicated on the tile

            if (value != flags1 + flags2) {
                return false;
            }
        }

        //if it is a good solution then calculate the distribution if required

        const solution = new Array(this.tiles.length);

        for (let i = 0; i < this.tiles.length; i++) {

            let isMine = false;
            for (let j = 0; j < sample.length; j++) {
                if (i == sample[j]) {
                    isMine = true;
                    break;
                }
            }

            // if we are a mine then it doesn't matter how many mines surround us
            if (!isMine) {
                var flags2 = this.currentFlagsTiles[i];
                // count how many candidate mines are next to this square
                for (let j = 0; j < mine.length; j++) {
                    if (mine[j].isAdjacent(this.tiles[i])) {
                        flags2++;
                    }
                }
                solution[i] = flags2;
            } else {
                solution[i] = BOMB;
            }

        }
 
        this.allSolutions.push(solution);

        /*
        var output = "";
        for (var i = 0; i < mine.length; i++) {
            output = output + mine[i].asText();
        }
        console.log(output);
        */

        return true;

    }
    
}



class WitnessWebIterator {

    // create an iterator which is like a set of rotating wheels
    // if rotation is -1 then this does all the possible iterations
    // if rotation is not - 1 then this locks the first 'cog' in that position and iterates the remaining cogs.  This allows parallel processing based on the position of the first 'cog'
    constructor(pe, allCoveredTiles, rotation) {

        //console.log("Creating Iterator");

        this.sample = [];  // int array

        this.tiles = [];  // list of tiles being iterated over

        this.cogs = []; // array of cogs
        this.squareOffset = [];  // int array
        this.mineOffset = [];   // int array

        this.iterationsDone = 0;

        this.top;
        this.bottom;

        this.done = false;

        this.probabilityEngine = pe;

        this.cycles = BigInt(1);

        // if we are setting the position of the top cog then it can't ever change
        if (rotation == -1) {
            this.bottom = 0;
        } else {
            this.bottom = 1;
        }

        //cogs = new SequentialIterator[this.probabilityEngine..size() + 1];
        //squareOffset = new int[web.getIndependentWitnesses().size() + 1];
        //mineOffset = new int[web.getIndependentWitnesses().size() + 1];
 
        const loc = [];  // array of locations

        var indWitnesses = this.probabilityEngine.independentWitnesses;

        var cogi = 0;
        let indSquares = 0;
        let indMines = 0;

        // create an array of locations in the order of independent witnesses
        for (let i = 0; i < indWitnesses.length; i++) {

            const w = indWitnesses[i];

            this.squareOffset.push(indSquares);
            this.mineOffset.push(indMines);
            this.cogs.push(new SequentialIterator(w.minesToFind, w.tiles.length));
 
            indSquares = indSquares + w.tiles.length;
            indMines = indMines + w.minesToFind;

            loc.push(...w.tiles);

            // multiply up the number of iterations needed
            this.cycles = this.cycles * combination(w.minesToFind, w.tiles.length);

        }

        //System.out.println("Mines left = " + (mines - indMines));
        //System.out.println("Squrs left = " + (web.getSquares().length - indSquares));

        // the last cog has the remaining squares and mines

        //add the rest of the locations
        for (let i = 0; i < allCoveredTiles.length; i++) {

            const l = allCoveredTiles[i];

            var skip = false;
            for (let j = 0; j < loc.length; j++) {

                const m = loc[j];

                if (l.isEqual(m)) {
                    skip = true;
                    break;
                }
            }
            if (!skip) {
                loc.push(l);
            }
        }

        this.tiles = loc;

        //console.log("Mines left " + this.probabilityEngine.minesLeft);
        //console.log("Independent Mines " + indMines);
        //console.log("Tiles left " + this.probabilityEngine.tilesLeft);
        //console.log("Independent tiles " + indSquares);


        // if there are more mines left then squares then no solution is possible
        // if there are not enough mines to satisfy the minimum we know are needed
        if (this.probabilityEngine.minesLeft - indMines > this.probabilityEngine.tilesLeft - indSquares
            || indMines > this.probabilityEngine.minesLeft) {
            this.done = true;
            this.top = 0;
            //console.log("Nothing to do in this iterator");
            return;
        }

        // if there are no mines left then no need for a cog
        if (this.probabilityEngine.minesLeft > indMines) {
            this.squareOffset.push(indSquares);
            this.mineOffset.push(indMines);
            this.cogs.push(new SequentialIterator(this.probabilityEngine.minesLeft - indMines, this.probabilityEngine.tilesLeft - indSquares));

            this.cycles = this.cycles * combination(this.probabilityEngine.minesLeft - indMines, this.probabilityEngine.tilesLeft - indSquares);
        }

        this.top = this.cogs.length - 1;

        this.sample = new Array(this.probabilityEngine.minesLeft);  // make the sample array the size of the number of mines

        // if we are locking and rotating the top cog then do it
        //if (rotation != -1) {
        //    for (var i = 0; i < rotation; i++) {
        //        this.cogs[0].getSample(0);
        //    }
        //}

        // now set up the initial sample position
        for (let i = 0; i < this.top; i++) {
            const s = this.cogs[i].getNextSample();
            for (let j = 0; j < s.length; j++) {
                this.sample[this.mineOffset[i] + j] = this.squareOffset[i] + s[j];
            }
        }

        //console.log("Iterations needed " + this.cycles);
 
    }


    getSample() {


        if (this.done) {
            console.log("**** attempting to iterator when already completed ****");
            return null;
        }
        let index = this.top;

        let s = this.cogs[index].getNextSample();

        while (s == null && index != this.bottom) {
            index--;
            s = this.cogs[index].getNextSample();
        }

        if (index == this.bottom && s == null) {
            this.done = true;
            return null;
        }

        for (let j = 0; j < s.length; j++) {
            this.sample[this.mineOffset[index] + j] = this.squareOffset[index] + s[j];
        }
        index++;
        while (index <= this.top) {
            this.cogs[index] = new SequentialIterator(this.cogs[index].numberBalls, this.cogs[index].numberHoles);
            s = this.cogs[index].getNextSample();
            for (let j = 0; j < s.length; j++) {
                this.sample[this.mineOffset[index] + j] = this.squareOffset[index] + s[j];
            }
            index++;
        }

         //console.log(...this.sample);

        this.iterationsDone++;

        return this.sample;
 
    }

    getTiles() {
        return this.allCoveredTiles;
    }

    getIterations() {
        return this.iterationsDone;
    }

    // if the location is a Independent witness then we know it will always
    // have exactly the correct amount of mines around it since that is what
    // this iterator does
    witnessAlwaysSatisfied(location) {

        for (let i = 0; i < this.probabilityEngine.independentWitness.length; i++) {
            if (this.probabilityEngine.independentWitness[i].equals(location)) {
                return true;
            }
        }

        return false;

    }

}


class SequentialIterator {


    // a sequential iterator that puts n-balls in m-holes once in each possible way
    constructor (n, m) {

        this.numberHoles = m;
        this.numberBalls = n;

        this.sample = [];  // integer

        this.more = true;

        this.index = n - 1;

        for (let i = 0; i < n; i++) {
            this.sample.push(i);
        }

        // reduce the iterator by 1, since the first getSample() will increase it
        // by 1 again
        this.sample[this.index]--;

        //console.log("Sequential Iterator has " + this.numberBalls + " mines and " + this.numberHoles + " squares");

    }

    getNextSample() {

        if (!this.more) {
            console.log("****  Trying to iterate after the end ****");
            return null;
        }

        this.index = this.numberBalls - 1;

        // add on one to the iterator
        this.sample[this.index]++;

        // if we have rolled off the end then move backwards until we can fit
        // the next iteration
        while (this.sample[this.index] >= this.numberHoles - this.numberBalls + 1 + this.index) {
            if (this.index == 0) {
                this.more = false;
                return null;
            } else {
                this.index--;
                this.sample[this.index]++;
            }
        }

        // roll forward 
        while (this.index != this.numberBalls - 1) {
            this.index++;
            this.sample[this.index] = this.sample[this.index - 1] + 1;
        }

        return this.sample;

    }

}

"use strict";


// these variables are used across the family of classes used in this process
class BruteForceGlobal {

    // constants used in this processing
    static PLAY_BFDA_THRESHOLD = 1000;                   // number of remaining solutions for the Brute force analysis to start during play mode
    static ANALYSIS_BFDA_THRESHOLD = 5000;               // number of solutions for the Brute force analysis to start when pressing "analyse"
    static BRUTE_FORCE_ANALYSIS_MAX_NODES = 5000000;     // Max number of nodes processed during brute force before we stop
    static BRUTE_FORCE_CYCLES_THRESHOLD = 5000000;       // Max number of cycles used to try and find the remaining solutions 
    static PRUNE_BF_ANALYSIS = true;                     // Performance. Change to false to see the exact win rate for every living tile.
    static BRUTE_FORCE_ANALYSIS_TREE_DEPTH = 4;          // Depth of tree kept and displayed in the console after a successful brute force

    static INDENT = "................................................................................";

    // globals used in this processing
    static processCount = 0;   // how much work has been done
    static allSolutions;       // this is class 'SolutionTable'
    static allTiles;           // this is an array of the tiles being analysed 

    // cache details
    static cache = new Map();
    static cacheHit = 0;
    static cacheWinningLines = 0;

}


class BruteForceAnalysis {

	constructor(solutions, tiles, size, verbose) {  // tiles is array of class 'Tile' being considered

        BruteForceGlobal.allTiles = tiles;

        this.allDead = false;   // this is true if all the locations are dead
        this.deadTiles = [];

        this.winChance;
        this.currentNode;
        this.expectedMove;

        this.bestTile;
        this.processedMoves = [];

        //this.maxSolutionSize = size;
        this.completed = false;

        this.verbose = verbose;

        // reset the globals
        BruteForceGlobal.allSolutions = new SolutionTable(solutions);
        BruteForceGlobal.cache.clear();  //clear the cache
        BruteForceGlobal.cacheHit = 0;
        BruteForceGlobal.cacheWinningLines = 0;
        BruteForceGlobal.processCount = 0;
    }

    async process() {

        const start = performance.now();

        this.writeToConsole("----- Brute Force Deep Analysis starting ----");
        this.writeToConsole(BruteForceGlobal.allSolutions.size() + " solutions in BruteForceAnalysis");

        // create the top node 
        let top = this.buildTopNode(BruteForceGlobal.allSolutions);  // top is class 'Node'

        if (top.getLivingLocations().length == 0) {
            this.allDead = true;
        }

        let best = 0;

        for (let i = 0; i < top.getLivingLocations().length; i++) {

            if (this.verbose) {
                showMessage("Analysing Brute Force Deep Analysis line " + i + " of " + top.getLivingLocations().length);
                await sleep(1);
            }
 
            const move = top.getLivingLocations()[i];  // move is class 'Livinglocation'

            const winningLines = top.getWinningLinesStart(move);  // calculate the number of winning lines if this move is played

            // if the move wasn't pruned is it a better move
            if (!move.pruned) {
                if (best < winningLines || (top.bestLiving != null && best == winningLines && top.bestLiving.mineCount < move.mineCount)) {
                    best = winningLines;
                    top.bestLiving = move;
                }
            }

            const singleProb = (BruteForceGlobal.allSolutions.size() - move.mineCount) / BruteForceGlobal.allSolutions.size();

            if (move.pruned) {
                this.writeToConsole(move.index + " " + BruteForceGlobal.allTiles[move.index].asText() + " is living with " + move.count + " possible values and probability "
                    + this.percentage(singleProb) + ", this location was pruned (max winning lines " + winningLines + ", process count " + BruteForceGlobal.processCount + ")");
            } else {
                this.writeToConsole(move.index + " " + BruteForceGlobal.allTiles[move.index].asText() + " is living with " + move.count + " possible values and probability "
                    + this.percentage(singleProb) + ", winning lines " + winningLines + " (" + "process count " + BruteForceGlobal.processCount + ")");
            }

            if (BruteForceGlobal.processCount < BruteForceGlobal.BRUTE_FORCE_ANALYSIS_MAX_NODES) {
                this.processedMoves.push(BruteForceGlobal.allTiles[move.index]);  // store the tiles we've processed
            }

        }

        top.winningLines = best;

        this.currentNode = top;

        // this is the best tile to guess (or the best we've calculated if incomplete).  "Tile" class.
        if (top.bestLiving != null) {  //  processing possible
            this.bestTile = BruteForceGlobal.allTiles[top.bestLiving.index];

        } else {  // all dead  - so just pick the first
            this.bestTile = BruteForceGlobal.allTiles[0];
        }
 

        if (BruteForceGlobal.processCount < BruteForceGlobal.BRUTE_FORCE_ANALYSIS_MAX_NODES) {
            this.winChance = best / BruteForceGlobal.allSolutions.size() ;
            this.completed = true;
            if (true) {
                this.writeToConsole("--------- Probability Tree dump start ---------");
                this.showTree(0, 0, top);
                this.writeToConsole("---------- Probability Tree dump end ----------");
            }
        }

        const end = performance.now();;
        this.writeToConsole("Total nodes in cache = " + BruteForceGlobal.cache.size + ", total cache hits = " + BruteForceGlobal.cacheHit + ", total winning lines saved = " + BruteForceGlobal.cacheWinningLines);
        this.writeToConsole("process took " + (end - start) + " milliseconds and explored " + BruteForceGlobal.processCount + " nodes");
        this.writeToConsole("----- Brute Force Deep Analysis finished ----");

        // clear down the cache
        BruteForceGlobal.cache.clear();

    }

    // 6020245077845603
    checkForBetterMove(guess) {

        // if we haven't processed 2 tiles or this tile is the best then stick with it
        if (this.processedMoves.length < 2 || (guess.x == this.bestTile.x && guess.y == this.bestTile.y)) {
            return null;
        }

        for (let tile of this.processedMoves) {
            if (guess.x == tile.x && guess.y == tile.y) {  // if we have processed the guess and it isn't the best tile then return the best tile
                return this.bestTile;
            }
        }

        //  otherwise nothing better
        return null;

    }

	/**
	 * Builds a top of tree node based on the solutions provided
	 */
	buildTopNode(solutionTable) {

        const result = new Node();   

        result.startLocation = 0;
        result.endLocation = solutionTable.size();

        const living = [];  // living is an array of 'LivingLocation'

        for (let i = 0; i < BruteForceGlobal.allTiles.length; i++) {
            let value;

            const valueCount = new Array(9).fill(0);
            let mines = 0;
            let maxSolutions = 0;
            let count = 0;
            let minValue = 0;
            let maxValue = 0;

            for (let j = 0; j < result.getSolutionSize(); j++) {
                if (solutionTable.get(j)[i] != BOMB) {
                    value = solutionTable.get(j)[i];
                    valueCount[value]++;
                } else {
                    mines++;
                }
            }

            for (let j = 0; j < valueCount.length; j++) {
                if (valueCount[j] > 0) {
                    if (count == 0) {
                        minValue = j;
                    }
                    maxValue = j;
                    count++;
                    if (maxSolutions < valueCount[j]) {
                        maxSolutions = valueCount[j];
                    }
                }
            }
            if (count > 1) {
                const alive = new LivingLocation(i);   // alive is class 'LivingLocation'
                alive.mineCount = mines;
                alive.count = count;
                alive.minValue = minValue;
                alive.maxValue = maxValue;
                alive.maxSolutions = maxSolutions;
                alive.zeroSolutions = valueCount[0];
                living.push(alive);
            } else {
                console.log(BruteForceGlobal.allTiles[i].asText() + " is dead with value " + minValue);
                this.deadTiles.push(BruteForceGlobal.allTiles[i]);   // store the dead tiles
            }

        }

        living.sort((a, b) => a.compareTo(b));

        result.livingLocations = living;

        return result;
    }   


 
    getNextMove() {

        const bestLiving = this.getBestLocation(this.currentNode);  /// best living is 'LivingLocation'

        if (bestLiving == null) {
            return null;
        }

        const loc = BruteForceGlobal.allTiles[bestLiving.index];  // loc is class 'Tile'

        //solver.display("first best move is " + loc.display());
        const prob = 1 - (bestLiving.mineCount / this.currentNode.getSolutionSize());

        console.log("mines = " + bestLiving.mineCount + " solutions = " + this.currentNode.getSolutionSize());
        for (let i = 0; i < bestLiving.children.length; i++) {
            if (bestLiving.children[i] == null) {
                //solver.display("Value of " + i + " is not possible");
                continue; //ignore this node but continue the loop
            }

            let probText;
            if (bestLiving.children[i].bestLiving == null) {
                probText = 1 / bestLiving.children[i].getSolutionSize();
            } else {
                probText = bestLiving.children[i].getProbability();
            }
            console.log("Value of " + i + " leaves " + bestLiving.children[i].getSolutionSize() + " solutions and winning probability " + probText + " (work size " + bestLiving.children[i].work + ")");
        }

        const action = new Action(loc.getX(), loc.getY(), prob, ACTION_CLEAR);

        this.expectedMove = loc;

        return action;

    }
	
	getBestLocation(node) {
        return node.bestLiving;
    }
	
	
	showTree(depth, value, node) {

        let condition;
        if (depth == 0) {
            condition = node.getSolutionSize() + " solutions remain";
        } else {
            condition = "When '" + value + "' ==> " + node.getSolutionSize() + " solutions remain";
        }

        if (node.bestLiving == null) {
            const line = BruteForceGlobal.INDENT.substring(0, depth * 3) + condition + " Solve chance " + node.getProbability();

            this.writeToConsole(line);
            return;
        }

        const loc = BruteForceGlobal.allTiles[node.bestLiving.index];

        const prob = 1 - (node.bestLiving.mineCount / node.getSolutionSize());


        const line = BruteForceGlobal.INDENT.substring(0, depth * 3) + condition + " play " + loc.asText() + " Survival chance " + prob + ", Solve chance " + node.getProbability();
        this.writeToConsole(line);

        for (let val = 0; val < node.bestLiving.children.length; val++) {
            const nextNode = node.bestLiving.children[val];
            if (nextNode != null) {
                this.showTree(depth + 1, val, nextNode);
            }
        }

    }


    getExpectedMove() {
        return this.expectedMove;
    }
	
	percentage(prob) {
        return prob * 100;
    }

    allTilesDead() {
        return this.allDead;
    }

    writeToConsole(text) {
        if (this.verbose) {
            console.log(text);
        }
    }

}


/**
 * A key to uniquely identify a position
 */
class Position {

    constructor(p, index, value) {

        this.position;
        this.hash = 0;
        this.mod = BigInt(Number.MAX_SAFE_INTEGER);


        if (p == null) {
            this.position = new Array(BruteForceGlobal.allTiles.length).fill(15);
        } else {
            // copy and update to reflect the new position
            this.position = p.position.slice(); 
            //this.position.push(...p.position); 
            this.position[index] = value + 50;
        }

    }

 
    // copied from String hash
    hashCode() {
        let h = BigInt(this.hash);
        if (h == 0 && this.position.length > 0) {
            for (let i = 0; i < this.position.length; i++) {
                h = (BigInt(31) * h + BigInt(this.position[i])) % this.mod;
            }
            this.hash = Number(h);  // convert back to a number
        }
        return this.hash;
    }

}

/**
 * Positions on the board which can still reveal information about the game.
 */
class LivingLocation {

    constructor (index) {
        this.index = index;

        this.pruned = false;
        this.mineCount = 0;  // number of remaining solutions which have a mine in this position
        this.maxSolutions = 0;    // the maximum number of solutions that can be remaining after clicking here
        this.zeroSolutions = 0;    // the number of solutions that have a '0' value here
        this.maxValue = -1;
        this.minValue = -1;
        this.count;  // number of possible values at this location

        this.children;  // children is an array of class 'Node'

    }

    /**
     * Determine the Nodes which are created if we play this move. Up to 9 positions where this locations reveals a value [0-8].
     */
    buildChildNodes(parent) {  // parent is class 'Node'

        // sort the solutions by possible values
        BruteForceGlobal.allSolutions.sortSolutions(parent.startLocation, parent.endLocation, this.index);
        let index = parent.startLocation;

        const work = Array(9);  // work is an array of class 'Node' with size 9

        for (let i = this.minValue; i < this.maxValue + 1; i++) {

             // if the node is in the cache then use it
            const pos = new Position(parent.position, this.index, i);

            const temp1 = BruteForceGlobal.cache.get(pos.hashCode());  // temp1 is class 'Node'

            if (temp1 == null) {

                const temp = new Node(pos);

                temp.startLocation = index;
                // find all solutions for this values at this location
                while (index < parent.endLocation && BruteForceGlobal.allSolutions.get(index)[this.index] == i) {
                    index++;
                }
                temp.endLocation = index;

                work[i] = temp;

            } else {
                work[i] = temp1;
                BruteForceGlobal.cacheHit++;
                BruteForceGlobal.cacheWinningLines = BruteForceGlobal.cacheWinningLines + temp1.winningLines;
                // skip past these details in the array
                while (index < parent.endLocation && BruteForceGlobal.allSolutions.get(index)[this.index] <= i) {
                    index++;
                }
            }
        }

        // skip over the mines
        while (index < parent.endLocation && BruteForceGlobal.allSolutions.get(index)[this.index] == BOMB) {
            index++;
        }

        if (index != parent.endLocation) {
            console.log("**** Didn't read all the elements in the array; index = " + index + " end = " + parent.endLocation + " ****");
        }


        for (let i = this.minValue; i <= this.maxValue; i++) {
            if (work[i].getSolutionSize() > 0) {
                //if (!work[i].fromCache) {
                //	work[i].determineLivingLocations(this.livingLocations, living.index);
                //}
            } else {
                work[i] = null;   // if no solutions then don't hold on to the details
            }

        }

        this.children = work;

    }


     compareTo(o) {

        // return location most likely to be clear  - this has to be first, the logic depends upon it
        let test = this.mineCount - o.mineCount;
        if (test != 0) {
            return test;
        }

        // then the location most likely to have a zero
        test = o.zeroSolutions - this.zeroSolutions;
        if (test != 0) {
            return test;
        }

        // then by most number of different possible values
        test = o.count - this.count;
        if (test != 0) {
            return test;
        }

        // then by the maxSolutions - ascending
        return this.maxSolutions - o.maxSolutions;

    }

}

/**
 * A representation of a possible state of the game
 */
class Node {

    constructor (position) {

        this.position;   // representation of the position we are analysing / have reached

        if (position == null) {
            this.position = new Position();
        } else {
            this.position = position;
        }

        this.livingLocations;       // these are the locations which need to be analysed

        this.winningLines = 0;      // this is the number of winning lines below this position in the tree
        this.work = 0;              // this is a measure of how much work was needed to calculate WinningLines value
        this.fromCache = false;     // indicates whether this position came from the cache

        this.startLocation;         // the first solution in the solution array that applies to this position
        this.endLocation;           // the last + 1 solution in the solution array that applies to this position

        this.bestLiving;            // after analysis this is the location that represents best play

    }

    getLivingLocations() {
        return this.livingLocations;
    }

    getSolutionSize() {
        return this.endLocation - this.startLocation;
    }

    /**
     * Get the probability of winning the game from the position this node represents  (winningLines / solution size)
      */
    getProbability() {

        return this.winningLines / this.getSolutionSize();

    }

    /**
     * Calculate the number of winning lines if this move is played at this position
     * Used at top of the game tree
     */
    getWinningLinesStart(move) {  // move is class LivingLocation 

        //if we can never exceed the cutoff then no point continuing
        if (BruteForceGlobal.PRUNE_BF_ANALYSIS && (this.getSolutionSize() - move.mineCount <= this.winningLines)) {
            move.pruned = true;
            return this.getSolutionSize() - move.mineCount;
        }

        var winningLines = this.getWinningLines(1, move, this.winningLines);

        if (winningLines > this.winningLines) {
            this.winningLines = winningLines;
        }

        return winningLines;
    }


    /**
     * Calculate the number of winning lines if this move is played at this position
     * Used when exploring the game tree
     */
    getWinningLines(depth, move, cutoff) {  // move is class 'LivingLocation' 

        //console.log("At depth " + depth + " cutoff=" + cutoff);

        let result = 0;

        BruteForceGlobal.processCount++;
        if (BruteForceGlobal.processCount > BruteForceGlobal.BRUTE_FORCE_ANALYSIS_MAX_NODES) {
            return 0;
        }

        let notMines = this.getSolutionSize() - move.mineCount;   // number of solutions (at this node) which don't have a mine at this location 

        // if the max possible winning lines is less than the current cutoff then no point doing the analysis
        if (BruteForceGlobal.PRUNE_BF_ANALYSIS && (result + notMines <= cutoff)) {
            move.pruned = true;
            return result + notMines;
        }

        move.buildChildNodes(this);

        for (let i = 0; i < move.children.length; i++) {

            const child = move.children[i];  // child is class 'Node'

            if (child == null) {
                continue;  // continue the loop but ignore this entry
            }

            if (child.fromCache) {  // nothing more to do, since we did it before
                this.work++;
            } else {

                child.determineLivingLocations(this.livingLocations, move.index);
                this.work++;

                if (child.getLivingLocations().length == 0) {  // no further information ==> all solution indistinguishable ==> 1 winning line

                    child.winningLines = 1;

                } else {  // not cached and not terminal node, so we need to do the recursion

                    for (let j = 0; j < child.getLivingLocations().length; j++) {

                        const childMove = child.getLivingLocations()[j];  // childmove is class 'LivingLocation'

                        // if the number of safe solutions <= the best winning lines then we can't do any better, so skip the rest
                        if (child.getSolutionSize() - childMove.mineCount <= child.winningLines) {
                            break;
                        }

                        // now calculate the winning lines for each of these children
                        const winningLines = child.getWinningLines(depth + 1, childMove, child.winningLines);
                        if (!childMove.pruned) {
                            if (child.winningLines < winningLines || (child.bestLiving != null && child.winningLines == winningLines && child.bestLiving.mineCount < childMove.mineCount)) {
                                child.winningLines = winningLines;
                                child.bestLiving = childMove;
                            }
                        }

                        // if there are no mines then this is a 100% safe move, so skip any further analysis since it can't be any better
                        if (childMove.mineCount == 0) {
                            break;
                        }


                    }

                    // no need to hold onto the living location once we have determined the best of them
                    child.livingLocations = null;

                    //add the child to the cache if it didn't come from there and it is carrying sufficient winning lines
                    if (child.work > 10) {
                        //console.log("Entry placed in cache with key " + child.position.hashCode());
                        child.work = 0;
                        child.fromCache = true;
                        BruteForceGlobal.cache.set(child.position.hashCode(), child);
                    } else {
                        this.work = this.work + child.work;
                    }


                }

            }

            if (depth > BruteForceGlobal.BRUTE_FORCE_ANALYSIS_TREE_DEPTH) {  // stop holding the tree beyond this depth
                child.bestLiving = null;
            }

            // store the aggregate winning lines 
            result = result + child.winningLines;

            notMines = notMines - child.getSolutionSize();  // reduce the number of not mines

            // if the max possible winning lines is less than the current cutoff then no point doing the analysis
            if (BruteForceGlobal.PRUNE_BF_ANALYSIS && (result + notMines <= cutoff)) {
                move.pruned = true;
                return result + notMines;
            }

        }

        return result;

    }

    /**
     * this generates a list of Location that are still alive, (i.e. have more than one possible value) from a list of previously living locations
     * Index is the move which has just been played (in terms of the off-set to the position[] array)
     */
    determineLivingLocations(liveLocs, index) {  // liveLocs is a array of class 'LivingLocation' 

        const living = [];

        for (let i = 0; i < liveLocs.length; i++) {

            const live = liveLocs[i];

            if (live.index == index) {  // if this is the same move we just played then no need to analyse it - definitely now non-living.
                continue;
            }

            let value;

            const valueCount = Array(9).fill(0);
            let mines = 0;
            let maxSolutions = 0;
            let count = 0;
            let minValue = 0;
            let maxValue = 0;

            for (let j = this.startLocation; j < this.endLocation; j++) {
                value = BruteForceGlobal.allSolutions.get(j)[live.index];
                if (value != BOMB) {
                     valueCount[value]++;
                } else {
                    mines++;
                }
            }

            // find the new minimum value and maximum value for this location (can't be wider than the previous min and max)
            for (let j = live.minValue; j <= live.maxValue; j++) {
                if (valueCount[j] > 0) {
                    if (count == 0) {
                        minValue = j;
                    }
                    maxValue = j;
                    count++;
                    if (maxSolutions < valueCount[j]) {
                        maxSolutions = valueCount[j];
                    }
                }
            }
            if (count > 1) {
                const alive = new LivingLocation(live.index);  // alive is class 'LivingLocation'
                alive.mineCount = mines;
                alive.count = count;
                alive.minValue = minValue;
                alive.maxValue = maxValue;
                alive.maxSolutions = maxSolutions;
                alive.zeroSolutions = valueCount[0];
                living.push(alive);
            }

        }

        living.sort((a, b) => a.compareTo(b));

        this.livingLocations = living;

    }

}

// used to hold all the solutions left in the game
class SolutionTable {

    constructor(solutions) {
        this.solutions = solutions;
    }

    get(index) {
        return this.solutions[index];
    }

    size() {
        return this.solutions.length;
    }

    sortSolutions(start, end, index) {

        const section = this.solutions.slice(start, end);
        section.sort((a, b) => a[index] - b[index]);
        this.solutions.splice(start, section.length, ...section);


        //subSort(this.solutions, start, end - start + 1, (a, b) => b[index] - a[index]);

        //this.solutions.sort(solutions, start, end, sorters[index]);

    }

}

// utility to sort an array 
let subSort = (arr, i, n, sortFx) => [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));

// Identifying which functions are exposed externally - only do this if we are in node.js
if (typeof module === "object" && module && typeof module.exports === "object") {
    module.exports = {
        heartbeat: function () {
            return heartbeat();
        },
        handleActions: async function (message) {
			var reply = await handleActions(message);
            return reply;
        },
        getNextGameID: function () {
            return getNextGameID();
        },
        killGame: function (message) {
            return killGame(message);
        }
    }
}

const ACTION_CLEAR = 1;
const ACTION_FLAG = 2;
const ACTION_CHORD = 3;

const WON = "won";
const LOST = "lost";
const IN_PLAY = "in-play";

let gameID = 123;
//var gamesWon = 0;
//var gamesLost = 0;
//var gamesAbandoned = 0;

let ngCancel = false;

const FIND_3BV = 1;     // 1 for high 3BV, -1 for low
const FIND_3BV_CYCLES = 0;

// provides the next game id
function getNextGameID() {

    gameID++;

    const reply = { "id": gameID };

    return reply;

}

// copies a previously played game
function copyGame(id) {

	console.log("Replaying game " + id);

	const game = getGame(id);

	if (game == null) {
		console.log("Game " + id + " not found");

		return getNextGameID();
	}

	game.reset();

	const reply = {};
	reply.id = game.getID();

	return reply;

}

// called from main.js
function createGameFromMFB(blob) {

	const width = blob[0];
	const height = blob[1];
	const mines = blob[2] * 256 + blob[3];

	const id = gameID++;

	const game = new ServerGame(id, width, height, mines, 0, 0, "safe");

	game.resetMines(blob);
	game.generateMbfUrl();

	serverGames.set(id, game);

	const reply = {};
	reply.id = id;

	return reply;

}

// a function which runs periodically to tidy stuff up
function heartbeat() {
	
	console.log("heartbeat starting...");

    for (let game of serverGames.values()) {

        let action;
        if (game.cleanUp) {
            action = "Being removed due to cleanUp flag";
            serverGames.delete(game.getID());
        } else {
            action = "No action";
        }
        
        console.log("Game " + game.id + " created " + game.created + " last action " + game.lastAction + "Tiles left " + game.tiles_left + " ==> " + action);
    }

    console.log("...heartbeat ending, " + serverGames.size + " games in memory");
}

// used to mark a game as no longer required
function killGame(message) {

    const id = message.id;

    const game = getGame(id);

    // if we found the game then mark for clean-up
    if (game != null) {
        console.log("Game " + id + " marked for housekeeping");
		game.cleanUp = true;
		// need to revoke the url at some point
		if (game.url != null) {
			window.URL.revokeObjectURL(game.url);
        }

        return { "result": "okay" };
    } else {
        return { "result": "not found" };
    }

}

/**
 * Below here is the Minesweeper game state logic
 */

// this holds the games being played
const serverGames = new Map();


// read the data message and perform the actions
async function handleActions(message) {
	console.log("INSIDE handleActions()");
	const header = message.header;
	
	if (header == null) {
		console.log("Header is missing");
		return;
	}

	const reply = {"header" : {}, "tiles" : []};

    reply.header.id = header.id;   // reply with the same game id
	
	const actions = message.actions;

	if (actions == null) {
        reply.header.status = IN_PLAY;
		console.log("JSEM TADY" + JSON.stringify(reply))
 		return reply;
	}
	
	let game = getGame(header.id);
	console.log("game: " + game);
	if (game == null) {
		// if (docNgMode.checked) {
			// vždycky chceme no guess hru
			console.log("Vytváří se no guess hra");
			game = await createNoGuessGame(header, actions[0].index);
		// } else {
		// 	game = createGame(header, actions[0].index);
        // }
	}

    // send the game details to the client
	reply.header.seed = game.seed;
	reply.header.gameType = game.gameType;
	reply.header.width = game.width;
	reply.header.height = game.height;
	reply.header.mines = game.num_bombs;
	reply.header.startIndex = game.startIndex;

	if (game.url != null) {
		reply.header.url = game.url;
	}

	// process each action sent
	for (let i = 0; i < actions.length; i++) {
		const action = actions[i];
		
		var tile = game.getTile(action.index);  
		
		if (action.action == ACTION_CLEAR) {  // click tile
			const revealedTiles = game.clickTile(tile);

			// get all the tiles revealed by this click
			for (let j=0; j < revealedTiles.tiles.length; j++) {
				reply.tiles.push(revealedTiles.tiles[j]);   // add each of the results of clicking to the reply
			}

			reply.header.status = revealedTiles.header.status;
			reply.header.actions = game.actions;
			
		} else if (action.action == ACTION_FLAG) {  // toggle flag

			game.flag(tile);

			//tile.toggleFlag();
			reply.header.status = IN_PLAY;
			reply.header.actions = game.actions;
			reply.tiles.push({"action" : 2, "index" : action.index, "flag" : tile.isFlagged()});    // set or remove flag

		} else if (action.action == ACTION_CHORD) {  // chord
			let revealedTiles = game.chordTile(tile);

			// get all the tiles revealed by this chording
			for (let j=0; j < revealedTiles.tiles.length; j++) {
				reply.tiles.push(revealedTiles.tiles[j]);   // add each of the results of chording to the reply
			}
			
			reply.header.status = revealedTiles.header.status;
			reply.header.actions = game.actions;
			
		} else {
			console.log("Invalid action received: " + action.action);
		}		  
		  
		if (reply.header.status != IN_PLAY) {
			//console.log("Tile " + tile.getIndex());
			console.log("status is now: " + reply.header.status);
			break;
		}
	}

    // if we have lost then return the location of all unflagged mines
    if (reply.header.status == LOST) {

		reply.header.value3BV = game.value3BV;
		reply.header.solved3BV = game.cleared3BV;

		for (let i = 0; i < game.tiles.length; i++) {

            const tile = game.tiles[i];

            if (!tile.isFlagged() && tile.isBomb()) {
                if (tile.exploded) {
                    reply.tiles.push({ "action": 4, "index": tile.getIndex() });    // exploded mine
                } else {
                    reply.tiles.push({ "action": 3, "index": tile.getIndex() });    // unflagged mine
                }

            } else if (tile.isFlagged() && !tile.isBomb()) {
                reply.tiles.push({ "action": 5, "index": tile.getIndex() });    // wrongly flagged tile
            }

        }
		game.cleanUp = true;  // mark for housekeeping

	} else if (reply.header.status == WON) {

		reply.header.value3BV = game.value3BV;
		reply.header.solved3BV = game.cleared3BV;
        game.cleanUp = true;  // mark for housekeeping
    }

	return reply;
}

function getGame(id) {

	return serverGames.get(id);
	
}

function createGame(header, index) {

	let cycles;
    let seed;
    if (header.seed != null && header.seed != 0) {
		seed = header.seed;
		cycles = 0;
    } else {
		seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		cycles = FIND_3BV_CYCLES - 1;
    }

	let game = new ServerGame(header.id, header.width, header.height, header.mines, index, seed, header.gametype);

	while (cycles > 0) {
		seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const tryGame = new ServerGame(header.id, header.width, header.height, header.mines, index, seed, header.gametype);
		if (FIND_3BV * tryGame.value3BV > FIND_3BV * game.value3BV) {
			game = tryGame;
		}
		cycles--;
    }

	game.generateMbfUrl();

	serverGames.set(header.id, game);
	
	console.log("Holding " + serverGames.size + " games in memory");
	
	return game;
	
}

async function createNoGuessGame(header, index) {

	// pop up to show we are generating the ng map
	//ngModal.style.display = "block";
	//ngText.innerHTML = "";
	//await sleep(500);

	let won = false;
	let loopCheck = 0;
	let minTilesLeft = Number.MAX_SAFE_INTEGER;
	let maxLoops = 100000;
	ngCancel = false;

	const options = {};
	options.playStyle = PLAY_STYLE_NOFLAGS;
	options.verbose = false;
	options.advancedGuessing = false;
	options.noGuessingMode = true;

	const startTime = Date.now();

	let revealedTiles;
	let game
	while (!won && loopCheck < maxLoops && !ngCancel) {

		const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

		game = new ServerGame(header.id, header.width, header.height, header.mines, index, seed, "zero");

		const board = new Board(header.id, header.width, header.height, header.mines, seed, "zero");

		const tile = game.getTile(index);

		revealedTiles = game.clickTile(tile);
		applyResults(board, revealedTiles);

		let guessed = false;
		while (revealedTiles.header.status == IN_PLAY && loopCheck < maxLoops && !guessed && !ngCancel) {

			loopCheck++;

			if (loopCheck % 100 == 0) {
				const curTime = Date.now();
				if (curTime - startTime > 1000) {
					ngText.innerHTML = "Working " + loopCheck;
					ngModal.style.display = "block";
					await sleep(1);
                }
            }

			const reply = await solver(board, options);  // look for solutions

			const fillers = reply.fillers;
			for (let i = 0; i < fillers.length; i++) {

				const filler = fillers[i];

				revealedTiles = game.fix(filler);

				applyResults(board, revealedTiles);

            }

			let actions;
			if (fillers.length > 0) {
				actions = [];
				console.log("tiles left " + game.tilesLeft);
			} else {
				actions = reply.actions;
            }

			for (let i = 0; i < actions.length; i++) {

				const action = actions[i];

				if (action.action == ACTION_CHORD) {
					console.log("Got a chord request!");

				} else if (action.action == ACTION_FLAG) {   // zero safe probability == mine
					console.log("Got a flag request!");

				} else {   // otherwise we're trying to clear

					if (action.prob != 1) {  // do no more actions after a guess
						guessed = true;
						break;
					}

					const tile1 = game.getTile(board.xy_to_index(action.x, action.y));

					revealedTiles = game.clickTile(tile1);

					if (revealedTiles.header.status != IN_PLAY) {  // if won or lost nothing more to do
						break;
					}

					applyResults(board, revealedTiles);

				}
			}

		}

		console.log("Seed " + seed + " tiles left " + game.tilesLeft);
		if (game.tilesLeft < minTilesLeft) {
			minTilesLeft = game.tilesLeft;
        }

		if (revealedTiles.header.status == WON) {
			won = true;
        }

    }

	console.log(revealedTiles.header.status);
	if (revealedTiles.header.status != WON) {
		ngText.innerHTML = "** FAILED **";
		await sleep(1000);
    }


	// rebuild the same game and send it back
	//game = new ServerGame(header.id, header.width, header.height, header.mines, index, bestSeed, "zero");
	game.reset();

	game.generateMbfUrl();
	serverGames.set(header.id, game);

	ngModal.style.display = "none";

	return game;

}

// called from index.html
function noGuessCancel() {
	ngText.innerHTML = "Cancelling";
	ngCancel = true;
}

function applyResults(board, revealedTiles) {

	//console.log("Tiles to reveal " + revealedTiles.tiles.length);
	//console.log(revealedTiles);

	// apply the changes to the logical board
	for (let i = 0; i < revealedTiles.tiles.length; i++) {

		const target = revealedTiles.tiles[i];

		const index = target.index;
		const action = target.action;

		const tile = board.getTile(index);

		if (action == 1) {    // reveal value on tile
			tile.setValue(target.value);
			//console.log("Setting Tile " + target.index + " to " + target.value);

		} else if (action == 2) {  // add or remove flag
			if (target.flag != tile.isFlagged()) {
				tile.toggleFlag();
				if (tile.isFlagged()) {
					board.bombs_left--;
				} else {
					board.bombs_left++;
				}
			}

		} else if (action == 3) {  // a tile which is a mine (these get returned when the game is lost)
			board.setGameLost();
			tile.setBomb(true);

		} else if (action == 4) {  // a tile which is a mine and is the cause of losing the game
			board.setGameLost();
			tile.setBombExploded();

		} else if (action == 5) {  // a which is flagged but shouldn't be
			tile.setBomb(false);

		} else {
			console.log("action " + action + " is not valid");
		}

	}

}

function getMbfData(id) {

	const game = getGame(id);

	if (game == null) {
		console.log("Game Id " + id + " not found");
		return null;
	}

	return game.getFormatMBF();

}

/**
 * This describes a game of minesweeper
 */
class ServerGame {
	
	constructor(id, width, height, num_bombs, index, seed, gameType) {
		
		//console.log("Creating a new game with id=" + id + " ...");

        this.created = new Date();
        this.lastAction = this.created;

        this.id = id;
        this.gameType = gameType;
		this.width = width;
		this.height = height;
        this.num_bombs = num_bombs;
        this.seed = seed;
		this.cleanUp = false;
		this.actions = 0;
		this.cleared3BV = 0;
		this.startIndex = index;

        //console.log("Using seed " + this.seed);

		this.tiles = [];
		this.started = false;

		// create adjacent offsets
		this.adj_offset = [];
		this.adj_offset[0] =  - width - 1;
		this.adj_offset[1] =  - width;
		this.adj_offset[2] =  - width + 1;
		this.adj_offset[3] =  - 1;
		this.adj_offset[4] =  1;
		this.adj_offset[5] =  + width - 1;
		this.adj_offset[6] =  + width;
		this.adj_offset[7] =  + width + 1;
		
		// hold the tiles to exclude from being a mine 
		const exclude = {};
		exclude[index] = true;
		var excludeCount = 1;

		if (this.gameType == "zero") {
            for (let adjIndex of this.getAdjacentIndex(index)) {
				exclude[adjIndex] = true;
				excludeCount++;
            }
        }

		if (this.width * this.height - excludeCount < this.num_bombs) {
			this.num_bombs = this.width * this.height - excludeCount;
			console.log("WARN: Too many mines to be placed! Reducing mine count to " + this.num_bombs);
        }

		this.tilesLeft = this.width * this.height - this.num_bombs;

		this.init_tiles(exclude);

		this.value3BV = this.calculate3BV();

		//console.log("... game created");

	}

	reset() {

		this.cleanUp = false;
		this.actions = 0;
		this.cleared3BV = 0;
		this.started = false;
		this.tilesLeft = this.width * this.height - this.num_bombs;

		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			tile.reset();
		}

		// this is used by the NG processing and because mines have been moved
		// the 3BV needs to be recalculated
		this.value3BV = this.calculate3BV();

    }

	resetMines(blob) {

		// reset every tile and it isn't a bomb
		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			tile.reset();
			tile.is_bomb = false;
			tile.value = 0;
		}

		let index = 4;

		// set the tiles in the mbf to mines
		while (index < blob.length) {
			const i = blob[index + 1] * this.width + blob[index];

			const tile = this.tiles[i];

			tile.make_bomb();
			for (let adjTile of this.getAdjacent(tile)) {
				adjTile.value += 1;
			}

			index = index + 2;
        }

		this.value3BV = this.calculate3BV();
		this.url = this.getFormatMBF();

    }

	getID() {
		return this.id;
	}
	
	getTile(index) {
		return this.tiles[index];
	}

	// toggles the flag on a tile
	flag(tile) {

		this.actions++;
		tile.toggleFlag();

    }

	// clicks the assigned tile and returns an object containing a list of tiles cleared
	clickTile(tile) {
		
        const reply = { "header": {}, "tiles": [] };

        // are we clicking on a mine
		if (tile.isBomb()) {
			this.actions++;

            reply.header.status = LOST;
            tile.exploded = true;
			//reply.tiles.push({"action" : 3, "index" : tile.getIndex()});    // mine

        } else {
			if (tile.isCovered() && !tile.isFlagged()) {    // make sure the tile is clickable
				this.actions++;

				const tilesToReveal = [];
				tilesToReveal.push(tile);
				return this.reveal(tilesToReveal);
			} else {
				reply.header.status = IN_PLAY;
            }
		}
		
		return reply;
		
		
	}
	
	// clicks the tiles adjacent to the assigned tile and returns an object containing a list of tiles cleared
	chordTile(tile) {
		
        const reply = { "header": {}, "tiles": [] };
 		
		let flagCount = 0;
		for (let adjTile of this.getAdjacent(tile)) {
			if (adjTile.isFlagged()) {
				flagCount++;
			}
		}

		// nothing to do if the tile is not yet surrounded by the correct number of flags
		if (tile.getValue() != flagCount) {
			console.log("Unable to Chord:  value=" + tile.getValue() + " flags=" + flagCount);
			reply.header.status = IN_PLAY;
			return reply;
		}
		
		// see if there are any unflagged bombs in the area to be chorded - this loses the game
		let bombCount = 0;
		for (let adjTile of this.getAdjacent(tile)) {
            if (adjTile.isBomb() && !adjTile.isFlagged()) {
                adjTile.exploded = true;
				bombCount++;
				//reply.tiles.push({"action" : 3, "index" : adjTile.getIndex()});    // mine
			}
		}
		
		// if we have triggered a bomb then return
		if (bombCount != 0) {
			this.actions++;

			reply.header.status = LOST;
			return reply;
		}
		
		const tilesToReveal = [];

		this.actions++;

		// determine which tiles need revealing 
		for (var adjTile of this.getAdjacent(tile)) {
			if (adjTile.isCovered() && !adjTile.isFlagged()) {  // covered and not flagged
				tilesToReveal.push(adjTile);
			}
		}

		return this.reveal(tilesToReveal);
		
	}
	
	reveal(firstTiles) {
		
		const toReveal = [];
		let soFar = 0;
		
        const reply = { "header": {}, "tiles": [] };
		
		for (let firstTile of firstTiles) {
			firstTile.setNotCovered();
			if (firstTile.is3BV) {
				this.cleared3BV++;
            }
			toReveal.push(firstTile);			
		}
		
		let safety = 100000;
		
		while (soFar < toReveal.length) {
			
			const tile = toReveal[soFar];

			reply.tiles.push({"action" : 1, "index" : tile.getIndex(), "value" : tile.getValue()});   		
			this.tilesLeft--;
			
			// if the value is zero then for each adjacent tile not yet revealed add it to the list
			if (tile.getValue() == 0) {
				
				for (let adjTile of this.getAdjacent(tile)) {
					
					if (adjTile.isCovered() && !adjTile.isFlagged()) {  // if not covered and not a flag
						adjTile.setNotCovered();  // it will be uncovered in a bit
						if (adjTile.is3BV) {
							this.cleared3BV++;
						}
						toReveal.push(adjTile);
					}
				}
				
			}

			soFar++;
			if (safety-- < 0) {
				console.log("Safety limit reached !!");
				break;
			}
			
		}

        // if there are no tiles left to find then set the remaining tiles to flagged and we've won
		if (this.tilesLeft == 0) {
			for (let i=0; i < this.tiles.length; i++) {
				const tile = this.tiles[i];
				if (tile.isBomb() && !tile.isFlagged()) {
					tile.toggleFlag();
					reply.tiles.push({"action" : 2, "index" : i, "flag" : tile.isFlagged()});    // auto set remaining flags
				}
			}
			
			reply.header.status = WON;
		} else {
			reply.header.status = IN_PLAY;
		}
		
		
		return reply;
	}

	// fix modify the mines around this withness to make it a safe move
	fix(filler) {

		const reply = { "header": {}, "tiles": [] };
		reply.header.status = IN_PLAY;

		const tile = this.getTile(filler.index);


		if (filler.fill) {

			if (!tile.is_bomb) {  // if filling and not a bomb add a bomb
				tile.make_bomb();
				this.num_bombs++;
				for (let adjTile1 of this.getAdjacent(tile)) {
					adjTile1.value += 1;
					if (!adjTile1.isCovered()) {
						reply.tiles.push({ "action": 1, "index": adjTile1.getIndex(), "value": adjTile1.getValue() });
					}
				}
			}

		} else {

			if (tile.is_bomb) {  // if emptying and is a bomb - remove it
				tile.is_bomb = false;
				this.num_bombs--;
				for (let adjTile1 of this.getAdjacent(tile)) {
					adjTile1.value -= 1;
					if (!adjTile1.isCovered()) {
						reply.tiles.push({ "action": 1, "index": adjTile1.getIndex(), "value": adjTile1.getValue() });
					}
				}
			}

        }

		//console.log(reply);

		return reply;
    }


	// auto play chords
	checkAuto(tile, reply) {

		return false;

		let flagCount = 0;
		let covered = 0;
		for (var adjTile of this.getAdjacent(tile)) {
			if (adjTile.isFlagged()) {
				flagCount++;
			} else if (adjTile.isCovered()) {
				covered++;
            }
		}

		// can be chorded
		if (tile.getValue() == flagCount) {
			return true;
		}

		// all covered tiles are flags
		if (tile.getValue() == flagCount + covered) {
			for (let adjTile of this.getAdjacent(tile)) {
				if (adjTile.isFlagged()) {
				} else if (adjTile.isCovered()) {
					this.flag(adjTile);
					reply.tiles.push({ "action": 2, "index": adjTile.getIndex(), "flag": adjTile.isFlagged() });
				}
			}
        }


    }

	// builds all the tiles and assigns bombs to them
	init_tiles(to_exclude) {
		
		// create the tiles
		const indices = [];
		for (let i = 0; i < this.width * this.height; i++) {
			
			this.tiles.push(new ServerTile(i));
			
			if (!to_exclude[i]) {
				indices.push(i);
			}
        }

        const rng = JSF(this.seed);  // create an RNG based on the seed

		shuffle(indices,rng);
		
		// allocate the bombs and calculate the values
		for (let i = 0; i < this.num_bombs; i++) {
			const index = indices[i];
			const tile = this.tiles[index];
			
			tile.make_bomb();
			for (let adjTile of this.getAdjacent(tile)) {
				adjTile.value += 1;
			}
		}
		
		//console.log(this.tiles.length + " tiles added to board");
	}
	
	
	// returns all the tiles adjacent to this tile
	getAdjacent(tile) {
		
		const index = tile.getIndex();
		
		const col = index % this.width;
		const row = Math.floor(index / this.width);

		const first_row = Math.max(0, row - 1);
		const last_row = Math.min(this.height - 1, row + 1);

		const first_col = Math.max(0, col - 1);
		const last_col = Math.min(this.width - 1, col + 1);

		const result = []

		for (let r = first_row; r <= last_row; r++) {
			for (let c = first_col; c <= last_col; c++) {
				const i = this.width * r + c;
				if (i != index) {
					result.push(this.tiles[i]);
				}
			}
		}

		return result;
	}

    // returns all the tiles adjacent to this tile
    getAdjacentIndex(index) {

        const col = index % this.width;
        const row = Math.floor(index / this.width);

        const first_row = Math.max(0, row - 1);
        const last_row = Math.min(this.height - 1, row + 1);

        const first_col = Math.max(0, col - 1);
        const last_col = Math.min(this.width - 1, col + 1);

        const result = []

        for (let r = first_row; r <= last_row; r++) {
            for (let c = first_col; c <= last_col; c++) {
                const i = this.width * r + c;
                if (i != index) {
                    result.push(i);
                }
            }
        }

        return result;
    }

	calculate3BV() {

		let value3BV = 0;

		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];

			if (!tile.used3BV && !tile.isBomb() && tile.getValue() == 0) {

				value3BV++;
				tile.used3BV = true;
				tile.is3BV = true;

				const toReveal = [tile];
				let soFar = 0;

				let safety = 100000;

				while (soFar < toReveal.length) {

					const tile1 = toReveal[soFar];

					// if the value is zero then for each adjacent tile not yet revealed add it to the list
					if (tile1.getValue() == 0) {

						for (let adjTile of this.getAdjacent(tile1)) {

							if (!adjTile.used3BV) {

								adjTile.used3BV = true;

								if (!adjTile.isBomb() && adjTile.getValue() == 0) {  // if also a zero add to ties to be exploded
									toReveal.push(adjTile);
								}
                            }
						}
					}

					soFar++;
					if (safety-- < 0) {
						console.log("Safety limit reached !!");
						break;
					}
				}
            }
		}

		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			if (!tile.isBomb() && !tile.used3BV) {
				value3BV++;
				tile.is3BV = true;
            }

		}

		//console.log("3BV is " + value3BV);

		return value3BV;
	}

	generateMbfUrl() {

		// revoke the previous url
		if (this.url != null) {
			window.URL.revokeObjectURL(this.url);
		}

		const mbf = this.getFormatMBF();

		const blob = new Blob([mbf], { type: 'application/octet-stream' })

		this.url = URL.createObjectURL(blob);

		console.log(this.url);

    }

	getFormatMBF() {

		if (this.width > 255 || this.height > 255) {
			console.log("Board to large to save as MBF format");
			return null;
		}

		const length = 4 + 2 * this.num_bombs;

		const mbf = new ArrayBuffer(length);
		const mbfView = new Uint8Array(mbf);

		mbfView[0] = this.width;
		mbfView[1] = this.height;

		mbfView[2] = Math.floor(this.num_bombs / 256);
		mbfView[3] = this.num_bombs % 256;

		let minesFound = 0;
		let index = 4;
		for (let i = 0; i < this.tiles.length; i++) {

			const tile = this.getTile(i);
			const x = i % this.width;
			const y = Math.floor(i / this.width);

			if (tile.isBomb()) {
				minesFound++;
				if (index < length) {
					mbfView[index++] = x;
					mbfView[index++] = y;
				}
			}
		}

		if (minesFound != this.num_bombs) {
			console.log("Board has incorrect number of mines. board=" + this.num_bombs + ", found=" + minesFound);
			return null;
		}

		console.log(...mbfView);

		//const blob = new Blob([mbf], { type: 'application/octet-stream' })
		//const url = URL.createObjectURL(blob);
		//console.log(url);

		return mbf;

	}

	getGameDescription() {

		return new gameDescription(this.seed, this.gameType, this.width, this.height, this.mines, this.startIndex, this.actions);

    }

} 

/**
 * Describes a single tile on a minesweeper board
 */

class ServerTile {
	constructor(index) {
		this.index = index
		this.is_covered = true;
		this.value = 0;
        this.is_flagged = false;
        this.exploded = false;
		this.is_bomb = false;
		this.used3BV = false;
		this.is3BV = false;
	}

	reset() {
		this.is_covered = true;
		this.is_flagged = false;
		this.exploded = false;
		this.used3BV = false;
		this.is3BV = false;
	}

	getIndex() {
		return this.index;
	}
	
	isCovered() {
		return this.is_covered;
	}
	
	setNotCovered() {
		this.is_covered = false;
	}
	
	getValue() {
		return this.value;
	}
	
	// toggle the flag value
	toggleFlag() {
		
		// if the tile is uncovered then we can't put a flag here
		if (!this.is_covered) {
			this.is_flagged = false;
			return;
		}
		
		this.is_flagged = !this.is_flagged;
	}
	
	isFlagged() {
		return this.is_flagged;
	}

	make_bomb() {
		this.is_bomb = true;
	}
	
	isBomb() {
		return this.is_bomb;
	}

}

class gameDescription {

	constructor(seed, gameType, width, height, mines, index, actions) {

		console.log("Creating a new game state with");

		this.seed = seed;
		this.gameType = gameType;
		this.width = width;
		this.height = height;
		this.mines = mines;
		this.index = index;
		this.actions = actions;
	}

}

// used to shuffle an array
function shuffle(a, rng) {
 
    for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		//console.log(j);
        //j = Math.floor(Math.random() * (i + 1));
        const x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

// a RNG which allows a seed
function JSF(seed) {
    function jsf() {
        var e = s[0] - (s[1] << 27 | s[1] >>> 5);
        s[0] = s[1] ^ (s[2] << 17 | s[2] >>> 15),
            s[1] = s[2] + s[3],
			s[2] = s[3] + e, s[3] = s[0] + e;
		//console.log(e + " " + s[0] + " " + s[1] + " " + s[2] + " " + s[3]);
        return (s[3] >>> 0) / 4294967296; // 2^32
	}
	var seed1 = Math.floor(seed / 4294967296);
	seed >>>= 0;
	//console.log(seed + " " + seed1);
	if (oldrng) {
		var s = [0xf1ea5eed, seed, seed, seed];
	} else {
		var s = [0xf1ea5eed, seed, seed1, seed];
    }

    for (var i = 0; i < 20; i++) jsf();
    return jsf;
}

/**
 * 
 */

"use strict";

class SolutionCounter {

    static SMALL_COMBINATIONS = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1], [1, 5, 10, 10, 5, 1], [1, 6, 15, 20, 15, 6, 1], [1, 7, 21, 35, 35, 21, 7, 1], [1, 8, 28, 56, 70, 56, 28, 8, 1]];

	constructor(board, allWitnesses, allWitnessed, squaresLeft, minesLeft) {

        this.board = board;

		//this.witnesses = allWitnesses;
		this.witnessed = allWitnessed;

        this.prunedWitnesses = [];  // a subset of allWitnesses with equivalent witnesses removed

        // constraints in the game
        this.minesLeft = minesLeft;
        //this.tilesLeft = squaresLeft;
        this.tilesOffEdge = squaresLeft - allWitnessed.length;   // squares left off the edge and unrevealed
        this.minTotalMines = minesLeft - this.tilesOffEdge;   // //we can't use so few mines that we can't fit the remainder elsewhere on the board
        this.maxTotalMines = minesLeft;

        this.boxes = [];
        this.boxWitnesses = [];
        this.mask = [];

		this.workingProbs = []; 
        this.heldProbs = [];
        this.offEdgeMineTally = BigInt(0);
        this.finalSolutionsCount = BigInt(0);
        this.clearCount = 0;
        this.localClears = [];

        this.validWeb = true;
        this.invalidReasons = [];

        this.recursions = 0;

        Object.seal(this) // prevent new properties being created


        // can't have less than zero mines
        if (minesLeft < 0) {
            this.validWeb = false;
            this.invalidReasons.push("Not enough mines left to complete the board.");
            return;
        }

        // generate a BoxWitness for each witness tile and also create a list of pruned witnesses for the brute force search
        var pruned = 0;
        for (var i = 0; i < allWitnesses.length; i++) {
            var wit = allWitnesses[i];

            var boxWit = new BoxWitness(this.board, wit);

            // can't have too many or too few mines 
            if (boxWit.minesToFind < 0) {
                this.invalidReasons.push("Tile " + wit.asText() + " value '" + wit.getValue() + "' is too small? Or a neighbour too large?");
                this.validWeb = false;
            }

            if (boxWit.minesToFind > boxWit.tiles.length) {
                this.invalidReasons.push("Tile " + wit.asText() + " value '" + wit.getValue() + "' is too large? Or a neighbour too small?");
                this.validWeb = false;
            }

            // if the witness is a duplicate then don't store it
            var duplicate = false;
            for (var j = 0; j < this.boxWitnesses.length; j++) {

                var w = this.boxWitnesses[j];

                if (w.equivalent(boxWit)) {

                    if (w.tile.getValue() - board.adjacentFoundMineCount(w.tile) != boxWit.tile.getValue() - board.adjacentFoundMineCount(boxWit.tile)) {
                        this.invalidReasons.push("Tiles " + w.tile.asText() + " and " + boxWit.tile.asText() + " are contradictory.");
                        this.validWeb = false;
                    }

                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) {
                this.prunedWitnesses.push(boxWit);
             } else {
                pruned++;
            }
            this.boxWitnesses.push(boxWit);  // all witnesses are needed for the probability engine
        }
        //console.log("Pruned " + pruned + " witnesses as duplicates");
        //console.log("There are " + this.boxWitnesses.length + " Box witnesses");

		// allocate each of the witnessed squares to a box
		var uid = 0;
		for (var i=0; i < this.witnessed.length; i++) {
			
			var tile = this.witnessed[i];
			
			var count = 0;
			
			// count how many adjacent witnesses the tile has
			for (var j=0; j < allWitnesses.length; j++) {
				if (tile.isAdjacent(allWitnesses[j])) {
					count++;
				}
			}
			
            // see if the witnessed tile fits any existing boxes
            var found = false;
			for (var j=0; j < this.boxes.length; j++) {
				
				if (this.boxes[j].fits(tile, count)) {
					this.boxes[j].add(tile);
					found = true;
					break;
				}
				
			}
			
			// if not found create a new box and store it
			if (!found) {
                this.boxes.push(new Box(this.boxWitnesses, tile, uid++));
			}

        }

        // calculate the min and max mines for each box 
        let leastMinesNeeded = 0;
        for (var i = 0; i < this.boxes.length; i++) {
            var box = this.boxes[i];
            box.calculate(this.minesLeft);
            leastMinesNeeded = leastMinesNeeded + box.minMines;
            //console.log("Box " + box.tiles[0].asText() + " has min mines = " + box.minMines + " and max mines = " + box.maxMines);
        }

        if (leastMinesNeeded > minesLeft) {
            this.validWeb = false;
            this.invalidReasons.push(minesLeft + " mines left is not enough mines left to complete the board.");
        }

        // Report how many boxes each witness is adjacent to 
        for (var i = 0; i < this.boxWitnesses.length; i++) {
            var boxWit = this.boxWitnesses[i];
            //console.log("Witness " + boxWit.tile.asText() + " is adjacent to " + boxWit.boxes.length + " boxes and has " + boxWit.minesToFind + " mines to find");
        }

        // show all the reasons the web is invalid
        //for (let msg of this.invalidReasons) {
        //    console.log(msg);
        //}

 	}


    // calculate a probability for each un-revealed tile on the board
	process() {

        // if the board isn't valid then solution count is zero
        if (!this.validWeb) {
            //console.log("Web is invalid");
            this.finalSolutionsCount = BigInt(0);
            this.clearCount = 0;
            return;
        }

        // create an array showing which boxes have been procesed this iteration - none have to start with
        this.mask = Array(this.boxes.length).fill(false);

		// create an initial solution of no mines anywhere 
        this.heldProbs.push(new ProbabilityLine(this.boxes.length, BigInt(1)));
		
		// add an empty probability line to get us started
        this.workingProbs.push(new ProbabilityLine(this.boxes.length, BigInt(1)));
		
        var nextWitness = this.findFirstWitness();

        while (nextWitness != null) {

            //console.log("Solution counter processing witness " + nextWitness.boxWitness.tile.asText());

            // mark the new boxes as processed - which they will be soon
            for (var i = 0; i < nextWitness.newBoxes.length; i++) {
                this.mask[nextWitness.newBoxes[i].uid] = true;
            }

            this.workingProbs = this.mergeProbabilities(nextWitness);

            // if we have no solutions then report where it happened
            if (this.workingProbs.length == 0) {
                //console.log("Board invalid near " + nextWitness.boxWitness.tile.asText());
                this.invalidReasons.push("Problem near " + nextWitness.boxWitness.tile.asText() + "?");
                this.heldProbs = [];
                break;
            }

            nextWitness = this.findNextWitness(nextWitness);

        }

        //this.calculateBoxProbabilities();

        // if this isn't a valid board than nothing to do
        if (this.heldProbs.length != 0) {
            this.calculateBoxProbabilities();
        } else {
            this.finalSolutionsCount = BigInt(0);
            this.clearCount = 0;
        }
  		
	}


    // take the next witness details and merge them into the currently held details
    mergeProbabilities(nw) {

        var newProbs = [];

        for (var i = 0; i < this.workingProbs.length; i++) {

            var pl = this.workingProbs[i];

            var missingMines = nw.boxWitness.minesToFind - this.countPlacedMines(pl, nw);

            if (missingMines < 0) {
                //console.log("Missing mines < 0 ==> ignoring line");
                // too many mines placed around this witness previously, so this probability can't be valid
            } else if (missingMines == 0) {
                //console.log("Missing mines = 0 ==> keeping line as is");
                newProbs.push(pl);   // witness already exactly satisfied, so nothing to do
            } else if (nw.newBoxes.length == 0) {
                //console.log("new boxes = 0 ==> ignoring line since nowhere for mines to go");
                // nowhere to put the new mines, so this probability can't be valid
            } else {
                
                var result = this.distributeMissingMines(pl, nw, missingMines, 0);
                newProbs.push(...result);
            }

        }

        // flag the last set of details as processed
        nw.boxWitness.processed = true;

        for (var i = 0; i < nw.newBoxes.length; i++) {
            nw.newBoxes[i].processed = true;
        }

        var boundaryBoxes = [];
        for (var i = 0; i < this.boxes.length; i++) {
            var box = this.boxes[i];
            var notProcessed = false;
            var processed = false;
            for (var j = 0; j < box.boxWitnesses.length; j++) {
                if (box.boxWitnesses[j].processed) {
                    processed = true;
                } else {
                    notProcessed = true;
                }
                if (processed && notProcessed) {
                    //boardState.display("partially processed box " + box.getUID());
                    boundaryBoxes.push(box);
                    break;
                }
            }
        }
        //boardState.display("Boxes partially processed " + boundaryBoxes.size());

        var sorter = new MergeSorter(boundaryBoxes);

        newProbs = this.crunchByMineCount(newProbs, sorter);

        return newProbs;

    }

    // counts the number of mines already placed
    countPlacedMines(pl, nw) {

        var result = 0;

        for (var i = 0; i < nw.oldBoxes.length; i++) {

            var b = nw.oldBoxes[i];

            result = result + pl.allocatedMines[b.uid];
        }

        return result;
    }

    // this is used to recursively place the missing Mines into the available boxes for the probability line
    distributeMissingMines(pl, nw,  missingMines, index) {

        //console.log("Distributing " + missingMines + " missing mines to box " + nw.newBoxes[index].uid);

        this.recursions++;
        if (this.recursions % 1000 == 0) {
            console.log("Solution Counter recursision = " + this.recursions);
        }

        var result = [];

        // if there is only one box left to put the missing mines we have reach the end of this branch of recursion
        if (nw.newBoxes.length - index == 1) {
            // if there are too many for this box then the probability can't be valid
            if (nw.newBoxes[index].maxMines < missingMines) {
                //this.invalidReasons.push("Not enough mines left to complete the board.");
                //console.log("Abandon (1)");
                return result;
            }
            // if there are too few for this box then the probability can't be valid
            if (nw.newBoxes[index].minMines > missingMines) {
                //console.log("Abandon (2)");
                return result;
            }
            // if there are too many for this game then the probability can't be valid
            if (pl.mineCount + missingMines > this.maxTotalMines) {
                //console.log("Abandon (3)");
                return result;
            }

            result.push(this.extendProbabilityLine(pl, nw.newBoxes[index], missingMines));
            //console.log("Distribute missing mines line after " + pl.mineBoxCount);
            return result;
        }


        // this is the recursion
        var maxToPlace = Math.min(nw.newBoxes[index].maxMines, missingMines);

        for (var i = nw.newBoxes[index].minMines; i <= maxToPlace; i++) {
            var npl = this.extendProbabilityLine(pl, nw.newBoxes[index], i);

            var r1 = this.distributeMissingMines(npl, nw, missingMines - i, index + 1);
            result.push(...r1);

        }

        return result;

    }

    // create a new probability line by taking the old and adding the mines to the new Box
    extendProbabilityLine(pl, newBox, mines) {

        //console.log("Extended probability line: Adding " + mines + " mines to box " + newBox.uid);
        //console.log("Extended probability line before" + pl.mineBoxCount);

        // there are less ways to place the mines if we know one of the tiles doesn't contain a mine
        const modifiedTilesCount = newBox.tiles.length - newBox.emptyTiles;

        //var combination = SolutionCounter.SMALL_COMBINATIONS[newBox.tiles.length][mines];
        var combination = SolutionCounter.SMALL_COMBINATIONS[modifiedTilesCount][mines];
        var bigCom = BigInt(combination);

        var newSolutionCount = pl.solutionCount * bigCom;

        var result = new ProbabilityLine(this.boxes.length, newSolutionCount);

        result.mineCount = pl.mineCount + mines;
        //result.solutionCount = pl.solutionCount;

        // copy the probability array

        if (combination != 1) {
            for (var i = 0; i < pl.mineBoxCount.length; i++) {
                result.mineBoxCount[i] = pl.mineBoxCount[i] * bigCom;
            }
        } else {
            result.mineBoxCount = pl.mineBoxCount.slice();
        }

        result.mineBoxCount[newBox.uid] = BigInt(mines) * result.solutionCount;

        result.allocatedMines = pl.allocatedMines.slice();
        result.allocatedMines[newBox.uid] = mines;

        //console.log("Extended probability line after " + result.mineBoxCount);

        return result;
    }


    // this combines newly generated probabilities with ones we have already stored from other independent sets of witnesses
    storeProbabilities() {

        //console.log("At store probabilities");

        var result = [];

        if (this.workingProbs.length == 0) {
            //console.log("working probabilites list is empty!!");
            this.heldProbs = [];
        	return;
        } 

        // crunch the new ones down to one line per mine count
        //var crunched = this.crunchByMineCount(this.workingProbs);

        var crunched = this.workingProbs;

        //solver.display("New data has " + crunched.size() + " entries");

        for (var i = 0; i < crunched.length; i++) {

            pl = crunched[i];

            for (var j = 0; j < this.heldProbs.length; j++) {

                var epl = this.heldProbs[j];

                var npl = new ProbabilityLine(this.boxes.length);

                npl.mineCount = pl.mineCount + epl.mineCount;

                if (npl.mineCount <= this.maxTotalMines) {

                    npl.solutionCount = pl.solutionCount * epl.solutionCount;

                    for (var k = 0; k < npl.mineBoxCount.length; k++) {

                        var w1 = pl.mineBoxCount[k] * epl.solutionCount;
                        var w2 = epl.mineBoxCount[k] * pl.solutionCount;
                        npl.mineBoxCount[k] = w1 + w2;

                    }
                    result.push(npl);

                }
            }
        }

        // sort into mine order 
        result.sort(function (a, b) { return a.mineCount - b.mineCount });

        this.heldProbs = [];

        // if result is empty this is an impossible position
        if (result.length == 0) {
            this.invalidReasons.push(this.minesLeft + " mines left is not enough to complete the board?");
            return;
        }

        // and combine them into a single probability line for each mine count
        var mc = result[0].mineCount;
        var npl = new ProbabilityLine(this.boxes.length);
        npl.mineCount = mc;

        for (var i = 0; i < result.length; i++) {

            var pl = result[i];

            if (pl.mineCount != mc) {
                this.heldProbs.push(npl);
                mc = pl.mineCount;
                npl = new ProbabilityLine(this.boxes.length);
                npl.mineCount = mc;
            }
            npl.solutionCount = npl.solutionCount + pl.solutionCount;

            for (var j = 0; j < pl.mineBoxCount.length; j++) {
                npl.mineBoxCount[j] = npl.mineBoxCount[j] + pl.mineBoxCount[j];
            }
        }

        this.heldProbs.push(npl);


    }

    crunchByMineCount(target, sorter) {

        if (target.length == 0) {
            return target;
         }

        // sort the solutions by number of mines
        target.sort(function (a, b) { return sorter.compare(a,b) });

        var result = [];

        var current = null;

        for (var i = 0; i < target.length; i++) {

            var pl = target[i];

            if (current == null) {
                current = target[i];
            } else if (sorter.compare(current, pl) != 0) {
                result.push(current);
                current = pl;
            } else {
                this.mergeLineProbabilities(current, pl);
            }

        }

        //if (npl.mineCount >= minTotalMines) {
        result.push(current);
        //}	

        //console.log(target.length + " Probability Lines compressed to " + result.length); 

        return result;

    }

    // calculate how many ways this solution can be generated and roll them into one
    mergeLineProbabilities(npl, pl) {

        npl.solutionCount = npl.solutionCount + pl.solutionCount;

        for (var i = 0; i < pl.mineBoxCount.length; i++) {
            if (this.mask[i]) {  // if this box has been involved in this solution - if we don't do this the hash gets corrupted by boxes = 0 mines because they weren't part of this edge
                npl.mineBoxCount[i] = npl.mineBoxCount[i] + pl.mineBoxCount[i];
            }

        }

    }

    // return any witness which hasn't been processed
    findFirstWitness() {

        for (var i = 0; i < this.boxWitnesses.length; i++) {
            var boxWit = this.boxWitnesses[i];
            if (!boxWit.processed) {
                return new NextWitness(boxWit);
            }
        }

        return null;
    }

    // look for the next witness to process
    findNextWitness(prevWitness) {

        var bestTodo = 99999;
        var bestWitness = null;

        // and find a witness which is on the boundary of what has already been processed
        for (var i = 0; i < this.boxes.length; i++) {
            var b = this.boxes[i];
            if (b.processed) {
                for (var j = 0; j < b.boxWitnesses.length; j++) {
                    var w = b.boxWitnesses[j];
                    if (!w.processed) {
                        var todo = 0;
                        for (var k = 0; k < w.boxes.length; k++) {
                            var b1 = w.boxes[k];

                            if (!b1.processed) {
                                todo++;
                            }
                        }
                        if (todo == 0) {    // prioritise the witnesses which have the least boxes left to process
                            return new NextWitness(w);
                        } else if (todo < bestTodo) {
                            bestTodo = todo;
                            bestWitness = w;
                        }
                    }
                }
            }
        }

        if (bestWitness != null) {
            return new NextWitness(bestWitness);
        }

        // if we are down here then there is no witness which is on the boundary, so we have processed a complete set of independent witnesses 


        // since we have calculated all the mines in an independent set of witnesses we can crunch them down and store them for later

        // get an unprocessed witness
        var nw = this.findFirstWitness();

        this.storeProbabilities();

        // reset the working array so we can start building up one for the new set of witnesses
        this.workingProbs = [];
        this.workingProbs.push(new ProbabilityLine(this.boxes.length, BigInt(1)));

        // reset the mask indicating that no boxes have been processed 
        this.mask.fill(false);

        // if the position is invalid exit now
        if (this.heldProbs.length == 0) {
            return null;
        }

        // return the next witness to process
        return nw;

    }

    // here we expand the localised solution to one across the whole board and
    // sum them together to create a definitive probability for each box
    calculateBoxProbabilities() {

        const emptyBox = Array(this.boxes.length).fill(true);

        // total game tally
        let totalTally = BigInt(0);

        // outside a box tally
        let outsideTally = BigInt(0);

        //console.log("There are " + this.heldProbs.length + " different mine counts on the edge");

        // calculate how many mines 
        for (let i = 0; i < this.heldProbs.length; i++) {

            const pl = this.heldProbs[i];

            //console.log("Mine count is " + pl.mineCount + " with solution count " + pl.solutionCount + " mineBoxCount = " + pl.mineBoxCount);

            if (pl.mineCount >= this.minTotalMines) {    // if the mine count for this solution is less than the minimum it can't be valid

                //console.log("Mines left " + this.minesLeft + " mines on PL " + pl.mineCount + " squares left = " + this.squaresLeft);
                var mult = combination(this.minesLeft - pl.mineCount, this.tilesOffEdge);  //# of ways the rest of the board can be formed

                outsideTally = outsideTally + mult * BigInt(this.minesLeft - pl.mineCount) * (pl.solutionCount);

                // this is all the possible ways the mines can be placed across the whole game
                totalTally = totalTally + mult * (pl.solutionCount);

                for (let j = 0; j < emptyBox.length; j++) {
                    if (pl.mineBoxCount[j] != 0) {
                        emptyBox[j] = false;
                    }
                }
            }

        }

        if (totalTally == 0) {
            this.invalidReasons.push(this.minesLeft + " mines left is too many to place on the board?");
        }

        // count how many clears we have
        if (totalTally > 0) {
            for (let i = 0; i < this.boxes.length; i++) {
                if (emptyBox[i]) {
                    this.clearCount = this.clearCount + this.boxes[i].tiles.length;
                    this.localClears.push(...this.boxes[i].tiles);
                 }
            }
        }

        if (this.tilesOffEdge != 0) {
            this.offEdgeMineTally = outsideTally / BigInt(this.tilesOffEdge);
        } else {
            this.offEdgeMineTally = 0;
        }
 
        this.finalSolutionsCount = totalTally;

         //console.log("Game has  " + this.finalSolutionsCount + " candidate solutions and " + this.clearCount + " clears");

    }

    // forces a box to contain a tile which isn't a mine.  If the location isn't in a box then reduce the off edge details.

    setMustBeEmpty(tile) {

        const box = this.getBox(tile);

        if (box == null) {  // if the tiles isn't on the edge then adjust the off edge values
            this.tilesOffEdge--;
            this.minTotalMines = Math.max(0, this.minesLeft - this.tilesOffEdge);

            //this.validWeb = false;
            //return false;
        //} else if (box.minMines != 0) {
        //    this.validWeb = false;
        //    return false;

        } else {
            box.incrementEmptyTiles();
        }

        return true;

    }

    // get the box containing this tile
    getBox(tile) {

        for (var i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i].contains(tile)) {
                return this.boxes[i];
            }
        }

        return null;
    }

    getLocalClears() {
        return this.localClears;
    }

}

"use strict";

class EfficiencyHelper {

    static ALLOW_ZERO_NET_GAIN_CHORD = true;
    static ALLOW_ZERO_NET_GAIN_PRE_CHORD = true;

    static IGNORE_ZERO_THRESHOLD = 0.375;   // ignore a zero when the chance it happens is less than this
 
    constructor(board, witnesses, witnessed, actions, playStyle, pe, coveredTiles) {

        this.board = board;
        this.actions = actions;
        this.witnesses = witnesses;
        this.witnessed = witnessed;
        this.playStyle = playStyle;
        this.pe = pe;
        this.coveredTiles = coveredTiles;

    }

    process() {

        // try the No flag efficiency strategy
        if (this.playStyle == PLAY_STYLE_NOFLAGS_EFFICIENCY) {
            return this.processNF(false);
        }

        if (this.playStyle != PLAY_STYLE_EFFICIENCY || this.actions.length == 0) {
            return this.actions;
        }

        let firstClear;
        let result = [];
        const chordLocations = [];

        //
        // identify all the tiles which are next to a known mine
        //

        // clear the adjacent mine indicator
        for (let tile of this.board.tiles) {
            tile.adjacentMine = false;
        }

        // set the adjacent mine indicator
        for (let tile of this.board.tiles) {
            if (tile.isSolverFoundBomb() || tile.probability == 0) {
                for (let adjTile of this.board.getAdjacent(tile)) {
                    if (!adjTile.isSolverFoundBomb() && adjTile.isCovered()) {
                        adjTile.adjacentMine = true;
                    }
                }
            }
        }

        //
        // Look for tiles which are satisfied by known mines and work out the net benefit of placing the mines and then chording
        //
        for (let tile of this.witnesses) {   // for each witness

            if (tile.getValue() == this.board.adjacentFoundMineCount(tile)) {

                // how many hidden tiles are next to the mine(s) we would have flagged, the more the better
                // this favours flags with many neighbours over flags buried against cleared tiles.
                const hiddenMineNeighbours = new Set();  
                for (let adjMine of this.board.getAdjacent(tile)) {

                    if (!adjMine.isSolverFoundBomb()) {
                        continue;
                    }
                    for (let adjTile of this.board.getAdjacent(adjMine)) {
                        if (!adjTile.isSolverFoundBomb() && adjTile.isCovered()) {
                            hiddenMineNeighbours.add(adjTile.index);
                        }
                    }                       
                }

                var benefit = this.board.adjacentCoveredCount(tile);
                var cost = tile.getValue() - this.board.adjacentFlagsPlaced(tile);
                if (tile.getValue() != 0) {  // if the witness isn't a zero then add the cost of chording - zero can only really happen in the analyser
                    cost++;
                }

                // either we have a net gain, or we introduce more flags at zero cost. more flags means more chance to get a cheaper chord later
                if (benefit >= cost) {
                    console.log("Chord " + tile.asText() + " has reward " + (benefit - cost) + " and tiles adjacent to new flags " + hiddenMineNeighbours.size);
                    chordLocations.push(new ChordLocation(tile, benefit, cost, hiddenMineNeighbours.size));
                }

            }
        }

        // sort the chord locations so the best one is at the top
        chordLocations.sort(function (a, b) {
            if (a.netBenefit == b.netBenefit) {  // if the benefits are the same return the one which exposes most tiles to flags
                return b.exposedTiles - a.exposedTiles;
            } else {
                return b.netBenefit - a.netBenefit;
            }
        });

        let bestChord = null;
        let bestChordReward = 0;
        for (let cl of chordLocations) {

            if (cl.netBenefit > 0 || EfficiencyHelper.ALLOW_ZERO_NET_GAIN_CHORD && cl.netBenefit == 0 && cl.cost > 0) {
                bestChord = cl;
                bestChordReward = cl.netBenefit;
            }

            break;
        }

        if (bestChord != null) {
            console.log("Chord " + bestChord.tile.asText() + " has best reward of " + bestChord.netBenefit);
        } else {
            console.log("No chord with net benefit > 0");
        }


        // 2. look for safe tiles which could become efficient if they have a certain value
        //if (result.length == 0) {

            //if (this.actions.length < 2) {
            //    return this.actions;
            //}

            let neutral3BV = [];
            let bestAction = null;
            let highest = BigInt(0);

            let bestLowZero = null;
            let bestLowZeroProb = 0; 

            const currSolnCount = solver.countSolutions(this.board);
            if (bestChordReward != 0) {
                highest = currSolnCount.finalSolutionsCount * BigInt(bestChordReward);
            } else {
                highest = BigInt(0);
            }

            for (let act of this.actions) {
            //for (let act of this.coveredTiles) {  // swap this for risky efficiency
            
                if (act.action == ACTION_CLEAR) {
                //if (!act.isSolverFoundBomb()) {   // swap this for risky efficiency

                    // this is the default move;
                    if (firstClear == null) {
                        firstClear = act;
                    }

                    // check to see if the tile (trivially) can't be next to a zero. i.e. 3BV safe
                    let valid = true;
                    for (let adjTile of this.board.getAdjacent(act)) {
                        if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                            valid = valid && adjTile.adjacentMine;
                        }
                    }

                    if (valid) {
                        console.log("Tile " + act.asText() + " is 3BV safe because it can't be next to a zero");
                        neutral3BV.push(act);
                    }

                    const tile = this.board.getTileXY(act.x, act.y);

                    // find the best chord adjacent to this clear if there is one
                    let adjChord = null;
                    let adjChords = [];
                    for (let cl of chordLocations) {
                        if (cl.netBenefit == 0 && !EfficiencyHelper.ALLOW_ZERO_NET_GAIN_PRE_CHORD) {
                            continue;
                        }

                        if (cl.tile.isAdjacent(tile)) {
                            adjChords.push(cl);
                        }
                    }

                    const adjMines = this.board.adjacentFoundMineCount(tile);
                    const adjFlags = this.board.adjacentFlagsPlaced(tile);
                    const hidden = this.board.adjacentCoveredCount(tile);   // hidden excludes unflagged but found mines

                    let chord;
                    if (adjMines != 0) {  // if the value we want isn't zero subtract the cost of chording
                        chord = 1;
                    } else {
                        chord = 0;
                    }

                     const reward = hidden - adjMines + adjFlags - chord;

                    //console.log("considering " + act.x + "," + act.y + " with value " + adjMines + " and reward " + reward + " ( H=" + hidden + " M=" + adjMines + " F=" + adjFlags + " Chord=" + chord + ")");

                    // if the reward could be better than the best chord or the click is a possible zero then consider it
                    if (reward > bestChordReward || adjMines == 0) {

                        tile.setValue(adjMines);
                        const counter = solver.countSolutions(this.board);
                        tile.setCovered(true);

                        const prob = divideBigInt(counter.finalSolutionsCount, currSolnCount.finalSolutionsCount, 6);
                        const expected = prob * reward;

                        // set this information on the tile, so we can display it in the tooltip
                        tile.setValueProbability(adjMines, prob);

                        console.log("considering Clear (" + act.x + "," + act.y + ") with value " + adjMines + " and reward " + reward + " ( H=" + hidden + " M=" + adjMines + " F=" + adjFlags + " Chord=" + chord
                            + " Prob=" + prob + "), expected benefit " + expected);

                        // if we have found an 100% safe zero then just click it.
                        if (adjMines == 0 && prob == 1) {
                            console.log("(" + act.x + "," + act.y + ") is a certain zero no need for further analysis");
                            bestAction = act;
                            bestChord = null;
                            break;
                        } else if (adjMines == 0 && prob < EfficiencyHelper.IGNORE_ZERO_THRESHOLD) {
                            console.log("(" + act.x + "," + act.y + ") is a zero with low probability of " + prob + " and is being ignored");
                            if (prob > 0 && (bestLowZero == null || bestLowZeroProb < prob)) {
                                bestLowZero = act;
                                bestLowZeroProb = prob;
                                console.log("(" + bestLowZero.x + "," + bestLowZero.y + ") is a zero with low probability of " + bestLowZeroProb + " is the best low probability so far");
                            }
                            continue;
                        }

                        const clickChordNetBenefit = BigInt(reward) * counter.finalSolutionsCount; // expected benefit from clicking the tile then chording it

                        let current = clickChordNetBenefit;  // expected benefit == p*benefit
                        //if (adjMines == 0 && adjChord != null) {
                        //   console.log("Not considering Chord Chord combo because we'd be chording into a zero");
                        //    adjChord = null;
                        //}

                        // consider each adjacent chord
                        for (let cl of adjChords) {
                            console.log("(" + act.x + "," + act.y + ") has adjacent chord " + cl.tile.asText() + " with net benefit " + cl.netBenefit);
                            const tempCurrent = this.chordChordCombo(cl, tile, counter.finalSolutionsCount, currSolnCount.finalSolutionsCount);

                            // if the chord/chord is better, or the chord/chord is the same as a click/chord (prioritise the chord/chord)
                            if (tempCurrent > current || tempCurrent == current && adjChord == null) {  // keep track of the best chord / chord combo
                                current = tempCurrent;
                                adjChord = cl;
                            }
                        }

                        // calculate the safety tally for this click
                        // probability engine can be null if all the remaining tiles are safe
                        if (this.pe != null) {
                            const tileBox = this.pe.getBox(tile);
                            let safetyTally;
                            if (tileBox == null) {
                                safetyTally = this.pe.finalSolutionsCount - this.pe.offEdgeMineTally;
                            } else {
                                safetyTally = this.pe.finalSolutionsCount - tileBox.mineTally;
                            }

                            // scale the best reward to the safety of the click - this might be a bit simplistic!
                            current = current * safetyTally / this.pe.finalSolutionsCount;
                        }

                        if (current > highest) {
                            //console.log("best " + act.x + "," + act.y);
                            highest = current;
                            if (adjChord != null) {  // if there is an adjacent chord then use this to clear the tile
                                bestChord = adjChord;
                                bestAction = null;
                            } else {
                                bestChord = null;
                                bestAction = act;
                            }
  
                        }
                    } else {
                        console.log("not considering (" + act.x + "," + act.y + ") with value " + adjMines + " and reward " + reward + " ( H=" + hidden + " M=" + adjMines + " F=" + adjFlags + " Chord=" + chord + ")");
                    }
                }

            }

            if (bestAction != null) {
                result = [bestAction];
            }

            if (bestChord != null) {
                result = []
                // add the required flags
                for (let adjTile of this.board.getAdjacent(bestChord.tile)) {
                    if (adjTile.isSolverFoundBomb() && !adjTile.isFlagged()) {
                        result.push(new Action(adjTile.getX(), adjTile.getY(), 0, ACTION_FLAG));
                    }
                }

                // Add the chord action
                result.push(new Action(bestChord.tile.getX(), bestChord.tile.getY(), 0, ACTION_CHORD))
            }
 

        //}

        if (result.length > 0) {
            return result;   // most efficient move

        } else if (bestLowZero != null) {
            return [bestLowZero];  // a zero, but low chance

        } else if (neutral3BV.length > 0) {
            return [neutral3BV[0]];  // 3BV neutral move

        } else  if (firstClear != null) {
            return [firstClear];  // first clear when no efficient move

        } else {
            return [];  // nothing when no clears available
        }


    }

    // the ChordLocation of the tile to chord, the Tile to be chorded afterwards if the value comes up good, the number of solutions where this occurs
    // and the total number of solutions
    // this method works out the net benefit of this play
    chordChordCombo(chord1, chord2Tile, occurs, total) {

        const failedBenefit = chord1.netBenefit;
 
        const chord1Tile = chord1.tile;

        // now check each tile around the tile to be chorded 2nd and see how many mines to flag and tiles will be cleared
        //let alreadyCounted = 0;
        let needsFlag = 0;
        let clearable = 0;
        let chordClick = 0;
        for (let adjTile of this.board.getAdjacent(chord2Tile)) {

            if (adjTile.isSolverFoundBomb()) {
                chordClick = 1;
            }

            // if adjacent to chord1
            if (chord1Tile.isAdjacent(adjTile)) {
               // alreadyCounted++;
            } else if (adjTile.isSolverFoundBomb() && !adjTile.isFlagged()) {
                needsFlag++;
            } else if (!adjTile.isSolverFoundBomb() && adjTile.isCovered()) {
                clearable++;
            }
        }

        const secondBenefit = clearable - needsFlag - chordClick;  // tiles cleared - flags placed - the chord click (which isn't needed if a zero is expected)

        const score = BigInt(failedBenefit) * total + BigInt(secondBenefit) * occurs;

        const expected = failedBenefit + divideBigInt(occurs, total, 6) * secondBenefit;

        console.log("Chord " + chord1Tile.asText() + " followed by Chord " + chord2Tile.asText() + ": Chord 1: benefit " + chord1.netBenefit + ", Chord2: H=" + clearable + ", to F=" + needsFlag + ", Chord=" + chordClick
            + ", Benefit=" + secondBenefit + " ==> expected benefit " + expected);

        //var score = BigInt(failedBenefit) * total + BigInt(secondBenefit) * occurs;

        return score;

    }


    //
    // Below here is the logic for No-flag efficiency
    //
    processNF(SafeOnly) {

        const NFE_BLAST_PENALTY = 0.75;

        // the first clear in the actions list
        let firstClear = null;

        // clear the adjacent mine indicator
        for (let tile of this.board.tiles) {
            tile.adjacentMine = false;
        }

        const alreadyChecked = new Set(); // set of tiles we've already checked to see if they can be zero

        // set the adjacent mine indicator
        for (let tile of this.board.tiles) {
            if (tile.isSolverFoundBomb() || tile.probability == 0) {
                for (let adjTile of this.board.getAdjacent(tile)) {
                    if (!adjTile.isSolverFoundBomb() && adjTile.isCovered()) {
                        adjTile.adjacentMine = true;
                        adjTile.setValueProbability(0, 0);  // no chance of this tile being a zero

                        alreadyChecked.add(adjTile.index);

                    }
 
                }
            }
        }

        // find the current solution count
        const currSolnCount = solver.countSolutions(this.board);

        let result = [];
        let zeroTile;
        let zeroTileScore;



        const onEdgeSet = new Set();
        for (let tile of this.witnessed) {
            onEdgeSet.add(tile.index);
        }

        // these are tiles adjacent to safe witnesses which aren't themselves safe
        const adjacentWitnessed = new Set();

        // do a more costly check for whether zero is possible, for those which haven't already be determined
        for (let tile of this.witnessed) {

            if (!alreadyChecked.has(tile.index) && !tile.isSolverFoundBomb() && !tile.probability == 0) { // already evaluated or a mine
                tile.setValue(0);
                const counter = solver.countSolutions(this.board);
                tile.setCovered(true);

                const zeroProb = divideBigInt(counter.finalSolutionsCount, currSolnCount.finalSolutionsCount, 6);

                // set this information on the tile, so we can display it in the tooltip
                tile.setValueProbability(0, zeroProb);

                alreadyChecked.add(tile.index);

                if (counter.finalSolutionsCount == 0) {  // no solution where this tile is zero means there must always be an adjacent mine
                    tile.adjacentMine = true;
                } else if (counter.finalSolutionsCount == currSolnCount.finalSolutionsCount) {
                    console.log("Tile " + tile.asText() + " is a certain zero");
                    result.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR));
                    break;
                } else {

                    const safety = this.pe.getProbability(tile);

                    const score = zeroProb - (1 - safety) * NFE_BLAST_PENALTY;

                    if (zeroTile == null || zeroTileScore < score) {
                        zeroTile = tile;
                        zeroTileScore = score;
                    }
 
                }
            }

            for (let adjTile of this.board.getAdjacent(tile)) {
                if (adjTile.isCovered() && !adjTile.isSolverFoundBomb() && adjTile.probability != 0 && !onEdgeSet.has(adjTile.index)) {
                    //console.log("Adding tile " + adjTile.asText() + " to extra tiles");
                    adjacentWitnessed.add(adjTile.index);
                } else {
                    //console.log("NOT Adding tile " + adjTile.asText() + " to extra tiles: On edge " + adjTile.onEdge);
                }
            }

        }

         // do a more costly check for whether zero is possible for actions not already considered, for those which haven't already be determined
        for (let act of this.actions) {

            const tile = this.board.getTileXY(act.x, act.y);

            if (act.action == ACTION_CLEAR && !alreadyChecked.has(tile.index) && !tile.isSolverFoundBomb() && !tile.probability == 0) { // already evaluated or a mine
                tile.setValue(0);
                const counter = solver.countSolutions(this.board);
                tile.setCovered(true);

                const zeroProb = divideBigInt(counter.finalSolutionsCount, currSolnCount.finalSolutionsCount, 6);

                // set this information on the tile, so we can display it in the tooltip
                tile.setValueProbability(0, zeroProb);

                alreadyChecked.add(tile.index);

                if (counter.finalSolutionsCount == 0) {  // no solution where this tile is zero means there must always be an adjacent mine
                    tile.adjacentMine = true;
                } else if (counter.finalSolutionsCount == currSolnCount.finalSolutionsCount) {
                    console.log("Tile " + tile.asText() + " is a certain zero");
                    result.push(act);
                    break;
                } else {

                    const safety = this.pe.getProbability(tile);

                    const score = zeroProb - (1 - safety) * NFE_BLAST_PENALTY;

                    if (zeroTile == null || zeroTileScore < score) {
                        zeroTile = tile;
                        zeroTileScore = score;
                    }
                }
            }

            for (let adjTile of this.board.getAdjacent(tile)) {
                if (adjTile.isCovered() && !adjTile.isSolverFoundBomb() && adjTile.probability != 0 && !onEdgeSet.has(adjTile.index)) {
                    //console.log("Adding tile " + adjTile.asText() + " to extra tiles");
                    adjacentWitnessed.add(adjTile.index);
                } else {
                    //console.log("NOT Adding tile " + adjTile.asText() + " to extra tiles: On edge " + adjTile.onEdge);
                }
            }

        }

        console.log("Extra tiles to check " + adjacentWitnessed.size);

        // we have found a certain zero
        if (result.length > 0) {
            return result;
        }

        let offEdgeSafety;
        if (this.pe == null) {
            offEdgeSafety = 1;
        } else {
            offEdgeSafety = this.pe.offEdgeProbability;
        }

        // see if adjacent tiles can be zero or not
        for (let index of adjacentWitnessed) {
            const tile = board.getTile(index);

            tile.setValue(0);
            const counter = solver.countSolutions(this.board);
            tile.setCovered(true);

            const prob = divideBigInt(counter.finalSolutionsCount, currSolnCount.finalSolutionsCount, 6);

            // set this information on the tile, so we can display it in the tooltip
            tile.setValueProbability(0, prob);

            if (counter.finalSolutionsCount == 0) {  // no solution where this tile is zero means there must always be an adjacent mine
                tile.adjacentMine = true;
            } else if (counter.finalSolutionsCount == currSolnCount.finalSolutionsCount) {
                console.log("Tile " + tile.asText() + " is a certain zero");
                result.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR));
                break;
            } else {

                const score = prob - (1 - offEdgeSafety) * NFE_BLAST_PENALTY;

                if (zeroTile == null || zeroTileScore < score) {
                    zeroTile = tile;
                    zeroTileScore = score;
                }
            }

        }

        // we have found a certain zero
        if (result.length > 0) {
            return result;
        }


        let maxAllNotZeroProbability;
        let bestAllNotZeroAction;
        // see if any of the safe tiles are also surrounded by all non-zero tiles
        for (let act of this.actions) {

            if (act.action == ACTION_CLEAR) {

                // this is the default move;
                if (firstClear == null) {
                    firstClear = act;
                }

                let valid = true;
                let allNotZeroProbability = 1;
                for (let adjTile of this.board.getAdjacent(act)) {
                    if (adjTile.isCovered() && !adjTile.isSolverFoundBomb()) {
                        valid = valid && adjTile.adjacentMine;
                        allNotZeroProbability = allNotZeroProbability * (1 - adjTile.efficiencyProbability);
                    }
                }

                if (bestAllNotZeroAction == null || maxAllNotZeroProbability < allNotZeroProbability) {
                    bestAllNotZeroAction = act;
                    maxAllNotZeroProbability = allNotZeroProbability;
                }

                if (valid) {
                    console.log("Tile " + act.asText() + " is 3BV safe because it can't be next to a zero");
                    result.push(act);
                }
            }
 
        }

        if (result.length > 0 || SafeOnly) {
            return result;
        }


        if (bestAllNotZeroAction != null) {
            console.log("Tile " + bestAllNotZeroAction.asText() + " has no adjacent zero approx " + maxAllNotZeroProbability);
        }
        if (zeroTile != null) {
            console.log("Tile " + zeroTile.asText() + " has best zero chance score " + zeroTileScore);
        }

        if (zeroTile != null) {

            let prob;
            if (this.pe == null) {
                prob = 1;
            } else {
                prob = this.pe.getProbability(zeroTile);
            }

            if (bestAllNotZeroAction != null) {
                //const zeroTileProb = divideBigInt(zeroTileCount, currSolnCount.finalSolutionsCount, 6);
                if (maxAllNotZeroProbability > zeroTileScore && zeroTileScore < 0.0) {
                    result.push(bestAllNotZeroAction);
                } else {
                    result.push(new Action(zeroTile.getX(), zeroTile.getY(), prob, ACTION_CLEAR));
                }
            } else {
                result.push(new Action(zeroTile.getX(), zeroTile.getY(), prob, ACTION_CLEAR));
            }
        } else {
            if (bestAllNotZeroAction != null) {
                result.push(bestAllNotZeroAction);
            }
        }

        if (result.length > 0) {
            return result;
        }

        if (firstClear != null) {
            return [firstClear];  // first clear when no efficient move
        } else {
            return [];  // nothing when no clears available
        }


    }

}

// information about the boxes surrounding a dead candidate
class ChordLocation {

    constructor(tile, benefit, cost, exposedTiles) {

        this.tile = tile;
        this.benefit = benefit;
        this.cost = cost;
        this.netBenefit = benefit - cost;
        this.exposedTiles = exposedTiles;

    }

}

"use strict";



class FiftyFiftyHelper {

	// ways to place mines in a 2x2 box
	static PATTERNS = [
		[true, true, true, true],   // four mines
		[true, true, true, false], [true, false, true, true], [false, true, true, true], [true, true, false, true],   // 3 mines
		[true, false, true, false], [false, true, false, true], [true, true, false, false], [false, false, true, true],   // 2 mines
		[false, true, false, false], [false, false, false, true], [true, false, false, false], [false, false, true, false]  // 1 mine   
	];


    constructor(board, minesFound, options, deadTiles, witnessedTiles, minesLeft) {

        this.board = board;
        this.options = options;
        this.minesFound = minesFound;  // this is a list of tiles which the probability engine knows are mines
		this.deadTiles = deadTiles;
		this.witnessedTiles = witnessedTiles;
		this.minesLeft = minesLeft;

    }

    // this process looks for positions which are either 50/50 guesses or safe.  In which case they should be guessed as soon as possible
    process() {

        const startTime = Date.now();

        // place all the mines found by the probability engine
        for (let mine of this.minesFound) {
            mine.setFoundBomb();
        }

		for (let i = 0; i < this.board.width - 1; i++) {
			for (let j = 0; j < this.board.height; j++) {

                const tile1 = this.board.getTileXY(i, j);
				if (!tile1.isCovered() || tile1.isSolverFoundBomb()) {  // cleared or a known mine
                    continue;
                }

                const tile2 = this.board.getTileXY(i + 1, j);
				if (!tile2.isCovered() || tile2.isSolverFoundBomb()) {  // cleared or a known mine
                    continue;
                }

                // if information can come from any of the 6 tiles immediately right and left then can't be a 50-50
				if (this.isPotentialInfo(i - 1, j - 1) || this.isPotentialInfo(i - 1, j) || this.isPotentialInfo(i - 1, j + 1)
					|| this.isPotentialInfo(i + 2, j - 1) || this.isPotentialInfo(i + 2, j) || this.isPotentialInfo(i + 2, j + 1)) {
					continue;  // this skips the rest of the logic below this in the for-loop 
				}

                // is both hidden tiles being mines a valid option?
                tile1.setFoundBomb();
                tile2.setFoundBomb();
                var counter = solver.countSolutions(this.board, null);
                tile1.unsetFoundBomb();
                tile2.unsetFoundBomb();

                if (counter.finalSolutionsCount != 0) {
                    this.writeToConsole(tile1.asText() + " and " + tile2.asText() + " can support 2 mines");
                } else {
                    this.writeToConsole(tile1.asText() + " and " + tile2.asText() + " can not support 2 mines, we should guess here immediately");
                    return tile1;
                 }

			}
		} 

        for (let i = 0; i < this.board.width; i++) {
            for (let j = 0; j < this.board.height - 1; j++) {

                const tile1 = this.board.getTileXY(i, j);
				if (!tile1.isCovered() || tile1.isSolverFoundBomb()) {  // cleared or a known mine
                    continue;
                }

                const tile2 = this.board.getTileXY(i, j + 1);
				if (!tile2.isCovered() || tile2.isSolverFoundBomb()) {  // cleared or a known mine
                    continue;
                }

                // if information can come from any of the 6 tiles immediately above and below then can't be a 50-50
                if (this.isPotentialInfo(i - 1, j - 1) || this.isPotentialInfo(i, j - 1) || this.isPotentialInfo(i + 1, j - 1)
                    || this.isPotentialInfo(i - 1, j + 2) || this.isPotentialInfo(i, j + 2) || this.isPotentialInfo(i + 1, j + 2)) {
                    continue;  // this skips the rest of the logic below this in the for-loop 
                }

                // is both hidden tiles being mines a valid option?
                tile1.setFoundBomb();
                tile2.setFoundBomb();
                var counter = solver.countSolutions(this.board, null);
                tile1.unsetFoundBomb();
                tile2.unsetFoundBomb();

                if (counter.finalSolutionsCount != 0) {
                    this.writeToConsole(tile1.asText() + " and " + tile2.asText() + " can support 2 mines");
                } else {
                    this.writeToConsole(tile1.asText() + " and " + tile2.asText() + " can not support 2 mines, we should guess here immediately");
                    return tile1;
                }

            }
        } 

		// box 2x2
		const tiles = Array(4);

		//const mines = [];
		//const noMines = [];
		for (let i = 0; i < this.board.width - 1; i++) {
			for (let j = 0; j < this.board.height - 1; j++) {

				// need 4 hidden tiles
				tiles[0] = this.board.getTileXY(i, j);
				if (!tiles[0].isCovered() || tiles[0].isSolverFoundBomb()) {
					continue;
				}

				tiles[1] = this.board.getTileXY(i + 1, j);
				if (!tiles[1].isCovered() || tiles[1].isSolverFoundBomb()) {
					continue;
				}

				tiles[2] = this.board.getTileXY(i, j + 1);
				if (!tiles[2].isCovered() || tiles[2].isSolverFoundBomb()) {
					continue;
				}

				tiles[3] = this.board.getTileXY(i + 1, j + 1);
				if (!tiles[3].isCovered() || tiles[3].isSolverFoundBomb()) {
					continue;
				}

				// need the corners to be flags
				if (this.isPotentialInfo(i - 1, j - 1) || this.isPotentialInfo(i + 2, j - 1) || this.isPotentialInfo(i - 1, j + 2) || this.isPotentialInfo(i + 2, j + 2)) {
					continue;  // this skips the rest of the logic below this in the for-loop 
				}

				this.writeToConsole(tiles[0].asText() + " " + tiles[1].asText() + " " + tiles[2].asText() + " " + tiles[3].asText() + " is candidate box 50/50");

				// keep track of which tiles are risky - once all 4 are then not a pseudo-50/50
				let riskyTiles = 0;
				const risky = Array(4).fill(false);

				// check each tile is in the web and that at least one is living
				let okay = true;
				let allDead = true;
				for (let l = 0; l < 4; l++) {
					if (!this.isDead(tiles[l])) {
						allDead = false;
					} else {
						riskyTiles++;
						risky[l] = true;  // since we'll never select a dead tile, consider them risky
					}

					if (!this.isWitnessed(tiles[l])) {
						this.writeToConsole(tiles[l].asText() + " has no witnesses");
						okay = false;
						break;
					}
				}
				if (!okay) {
					continue;
				}
				if (allDead) {
					this.writeToConsole("All tiles in the candidate are dead");
					continue
				}

				let start;
				if (this.minesLeft > 3) {
					start = 0;
				} else if (this.minesLeft == 3) {
					start = 1;
				} else if (this.minesLeft == 2) {
					start = 5;
				} else {
					start = 9;
				}

				for (let k = start; k < FiftyFiftyHelper.PATTERNS.length; k++) {

					const mines = [];
					const noMines = [];

					var run = false;
					// allocate each position as a mine or noMine
					for (let l = 0; l < 4; l++) {
						if (FiftyFiftyHelper.PATTERNS[k][l]) {
							mines.push(tiles[l]);
							if (!risky[l]) {
								run = true;
							}
						} else {
							noMines.push(tiles[l]);
						}
					}

					// only run if this pattern can discover something we don't already know
					if (!run) {
						this.writeToConsole("Pattern " + k + " skipped");
						continue;
					}

					// place the mines
					for (let tile of mines) {
						tile.setFoundBomb();
					}

					// see if the position is valid
					const counter = solver.countSolutions(this.board, noMines);

					// remove the mines
					for (let tile of mines) {
						tile.unsetFoundBomb();
					}

					// if it is then mark each mine tile as risky
					if (counter.finalSolutionsCount != 0) {
						this.writeToConsole("Pattern " + k + " is valid");
						for (let l = 0; l < 4; l++) {
							if (FiftyFiftyHelper.PATTERNS[k][l]) {
								if (!risky[l]) {
									risky[l] = true;
									riskyTiles++;
								}
							}
						}
						if (riskyTiles == 4) {
							break;
						}
					} else {
						this.writeToConsole("Pattern " + k + " is not valid");
					}
				}

				// if not all 4 tiles are risky then send back one which isn't
				if (riskyTiles != 4) {
					for (let l = 0; l < 4; l++) {
						// if not risky and not dead then select it
						if (!risky[l]) {
							this.writeToConsole(tiles[0].asText() + " " + tiles[1].asText() + " " + tiles[2].asText() + " " + tiles[3].asText() + " is pseudo 50/50 - " + tiles[l].asText() + " is not risky");
							return tiles[l];
						}

					}
				}
			}
		}                        

        this.duration = Date.now() - startTime;

        // remove all the mines found by the probability engine - if we don't do this it upsets the brute force deep analysis processing
        for (var mine of this.minesFound) {
            mine.unsetFoundBomb();
        }

        this.writeToConsole("5050 checker took " + this.duration + " milliseconds");

        return null;

	}

    // returns whether there information to be had at this location; i.e. on the board and either unrevealed or revealed
    isPotentialInfo(x, y) {

        if (x < 0 || x >= this.board.width || y < 0 || y >= this.board.height) {
            return false;
        }

        if (this.board.getTileXY(x, y).isSolverFoundBomb()) {
            return false;
        } else {
            return true;
        }

    }

	isDead(tile) {

		//  is the tile dead
		for (let k = 0; k < this.deadTiles.length; k++) {
			if (this.deadTiles[k].isEqual(tile)) {
				return true;
			}
		}

		return false;

    }

	isWitnessed(tile) {

		//  is the tile witnessed
		for (let k = 0; k < this.witnessedTiles.length; k++) {
			if (this.witnessedTiles[k].isEqual(tile)) {
				return true;
			}
		}

		return false;

	}

    writeToConsole(text, always) {

        if (always == null) {
            always = false;
        }

        if (this.options.verbose || always) {
            console.log(text);
        }

    }

}

"use strict";

class LongTermRiskHelper {

	constructor(board, pe, minesLeft, options)  {

		this.board = board;
		//this.wholeEdge = wholeEdge;
		this.currentPe = pe;
		this.minesLeft = minesLeft
		this.options = options;

		this.pseudo = null;

		this.influence5050s = new Array(this.board.width * this.board.height);
		this.influenceEnablers = new Array(this.board.width * this.board.height);

		this.totalSolutions = pe.finalSolutionsCount;

		Object.seal(this) // prevent new properties being created

	}

	/**
	 * Scan whole board looking for tiles heavily influenced by 50/50s
	 */
	findInfluence() {

		//TODO place mines found by the probability engine

		this.checkFor2Tile5050();

		this.checkForBox5050();

		if (this.pseudo != null) {
			this.writeToConsole("Tile " + this.pseudo.asText() + " is a 50/50, or safe");
		}

		//TODO remove mines found by the probability engine

		return this.pseudo;

	}

	/**
	 * Get the 50/50 influence for a particular tile
	 */
	findTileInfluence(tile) {
		
		let influence = BigInt(0);
		
		// 2-tile 50/50
		const tile1 = this.board.getTileXY(tile.getX() - 1, tile.getY());

		influence = this.addNotNull(influence, this.getHorizontal(tile, 4));
		influence = this.addNotNull(influence, this.getHorizontal(tile1, 4));

		const tile2 = this.board.getTileXY(tile.getX(), tile.getY() - 1);
		influence = this.addNotNull(influence, this.getVertical(tile, 4));
		influence = this.addNotNull(influence, this.getVertical(tile2, 4));

		// 4-tile 50/50
		let influence4 = BigInt(0);
		const tile3 = this.board.getTileXY(tile.getX() - 1, tile.getY() - 1);
		influence4 = this.maxNotNull(influence4, this.getBoxInfluence(tile, 5));
		influence4 = this.maxNotNull(influence4, this.getBoxInfluence(tile1, 5));
		influence4 = this.maxNotNull(influence4, this.getBoxInfluence(tile2, 5));
		influence4 = this.maxNotNull(influence4, this.getBoxInfluence(tile3, 5));

		if (influence4 > 0) {
			const percentage = divideBigInt(influence4, this.totalSolutions, 5) * 100;
			this.writeToConsole("Tile " + tile.asText() + " best 4-tile 50/50 has percentage " + percentage.toFixed(3) + "%");
        }

		influence = influence + influence4;

		// enablers also get influence, so consider that as well as the 50/50
		if (this.influenceEnablers[tile.index] != null) {
			influence = influence + this.influenceEnablers[tile.index];
		}
		
		let maxInfluence;
		const box = this.currentPe.getBox(tile);
		if (box == null) {
			maxInfluence = this.currentPe.offEdgeMineTally;
		} else {
			maxInfluence = box.mineTally;
		}

		// 50/50 influence P(50/50)/2 can't be larger than P(mine) or P(safe)
		const other = this.currentPe.finalSolutionsCount - maxInfluence;

		maxInfluence = this.bigIntMin(maxInfluence, other);

		influence = this.bigIntMin(influence, maxInfluence);

		return influence;

	}
	
	checkFor2Tile5050() {
		
		const maxMissingMines = 2;

		this.writeToConsole("Checking for 2-tile 50/50 influence");
    	
		// horizontal 2x1
		for (let i = 0; i < this.board.width - 1; i++) {
			for (let j = 0; j < this.board.height; j++) {

				const tile1 = this.board.getTileXY(i, j);
				const tile2 = this.board.getTileXY(i + 1, j);
				
				const result = this.getHorizontal(tile1, maxMissingMines, this.minesLeft);

				if (result != null) {
					let influenceTally = this.addNotNull(BigInt(0), result);
					//const influence = divideBigInt(influenceTally, this.currentPe.finalSolutionsCount, 4); 
					//this.writeToConsole("Tile " + tile1.asText() + " and " + tile2.asText() + " have horiontal 2-tile 50/50 influence " + influence);

					this.addInfluence(influenceTally, result.enablers, [tile1, tile2]);
					if (this.pseudo != null) {  // if we've found a pseudo then we can stop here
						return;
					}
				}



			}
		}

		// vertical 2x1
		for (let i = 0; i < this.board.width; i++) {
			for (let j = 0; j < this.board.height - 1; j++) {

				const tile1 = this.board.getTileXY(i, j);
				const tile2 = this.board.getTileXY(i, j + 1);
				
				const result = this.getVertical(tile1, maxMissingMines, this.minesLeft);

				if (result != null) {
					
					let influenceTally = this.addNotNull(BigInt(0), result);
					//const influence = divideBigInt(influenceTally, this.currentPe.finalSolutionsCount, 4); 
					//this.writeToConsole("Tile " + tile1.asText() + " and " + tile2.asText() + " have vertical 2-tile 50/50 influence " + influence);

					this.addInfluence(influenceTally, result.enablers, [tile1, tile2]);
					if (this.pseudo != null) {  // if we've found a pseudo then we can stop here
						return;
					}
				}

			}
		}
	}

	getHorizontal(subject, maxMissingMines) {

		if (subject == null) {
			return null;
        }

		const i = subject.x;
		const j = subject.y;

		if (i < 0 || i + 1 >= this.board.width) {
			return null;
		}

		// need 2 hidden tiles
		if (!this.isHidden(i, j) || !this.isHidden(i + 1, j)) {
			return null;
		}

		const missingMines = this.getMissingMines([this.board.getTileXY(i - 1, j - 1), this.board.getTileXY(i - 1, j), this.board.getTileXY(i - 1, j + 1),
			this.board.getTileXY(i + 2, j - 1), this.board.getTileXY(i + 2, j), this.board.getTileXY(i + 2, j + 1)]);

		// only consider possible 50/50s with less than 3 missing mines or requires more mines then are left in the game (plus 1 to allow for the extra mine in the 50/50)
		if (missingMines == null || missingMines.length + 1 > maxMissingMines || missingMines.length + 1 > this.minesLeft) {
			return null;
		}
		
		const tile1 = subject;
		const tile2 = this.board.getTileXY(i + 1, j);

		//this.writeToConsole("Evaluating candidate 50/50 - " + tile1.asText() + " " + tile2.asText());

		// add the missing Mines and the mine required to form the 50/50
		//missingMines.push(tile1);

		const mines = [...missingMines, tile1];
		const notMines = [tile2];

		// place the mines
		for (let tile of mines) {
			tile.setFoundBomb();
		}

		// see if the position is valid
		const counter = solver.countSolutions(this.board, notMines);

		// remove the mines
		for (let tile of mines) {
			tile.unsetFoundBomb();
		}

		if (counter.finalSolutionsCount == 0) {
			return null;
		}

		const percentage = divideBigInt(counter.finalSolutionsCount, this.totalSolutions, 5) * 100;

		this.writeToConsole("Possible 50/50 - " + tile1.asText() + " " + tile2.asText() + " probability " + percentage.toFixed(3) + "%");

		return new LTResult(counter.finalSolutionsCount, missingMines);

	}
	
	getVertical(subject, maxMissingMines) {

		if (subject == null) {
			return null;
		}

		const i = subject.getX();
		const j = subject.getY();

		if (j < 0 || j + 1 >= this.board.height) {
			return null;
		}

		// need 2 hidden tiles
		if (!this.isHidden(i, j) || !this.isHidden(i, j + 1)) {
			return null;
		}

		const missingMines = this.getMissingMines([this.board.getTileXY(i - 1, j - 1), this.board.getTileXY(i, j - 1), this.board.getTileXY(i + 1, j - 1),
			this.board.getTileXY(i - 1, j + 2), this.board.getTileXY(i, j + 2), this.board.getTileXY(i + 1, j + 2)]);

		// only consider possible 50/50s with less than 3 missing mines or requires more mines then are left in the game (plus 1 to allow for the extra mine in the 50/50)
		if (missingMines == null || missingMines.length + 1 > maxMissingMines || missingMines.length + 1 > this.minesLeft) {
			return null;
		}
		
		const tile1 = this.board.getTileXY(i, j);
		const tile2 = this.board.getTileXY(i, j + 1);

		//this.writeToConsole("Evaluating candidate 50/50 - " + tile1.asText() + " " + tile2.asText());

		// add the missing Mines and the mine required to form the 50/50
		//missingMines.push(tile1);

		const mines = [...missingMines, tile1];
		const notMines = [tile2];

		// place the mines
		for (let tile of mines) {
			tile.setFoundBomb();
		}

		// see if the position is valid
		const counter = solver.countSolutions(this.board, notMines);

		// remove the mines
		for (let tile of mines) {
			tile.unsetFoundBomb();
		}

		if (counter.finalSolutionsCount == 0) {
			return null;
		}

		const percentage = divideBigInt(counter.finalSolutionsCount, this.totalSolutions, 5) * 100;

		this.writeToConsole("Possible 50/50 - " + tile1.asText() + " " + tile2.asText() + " Probability " + percentage.toFixed(3) + "%");

		return new LTResult(counter.finalSolutionsCount, missingMines);

	}

	checkForBox5050() {
		
		const maxMissingMines = 2;
		
		this.writeToConsole("Checking for 4-tile 50/50 influence");

		// box 2x2 
		for (let i = 0; i < this.board.width - 1; i++) {
			for (let j = 0; j < this.board.height - 1; j++) {

				const tile1 = this.board.getTileXY(i, j);
				const tile2 = this.board.getTileXY(i, j + 1);
				const tile3 = this.board.getTileXY(i + 1, j);
				const tile4 = this.board.getTileXY(i + 1, j + 1);
				
				const result = this.getBoxInfluence(tile1, maxMissingMines);

				if (result != null) {
					
					const influenceTally = this.addNotNull(BigInt(0), result);
					
					//const influence = divideBigInt(influenceTally, this.currentPe.finalSolutionsCount, 4); 
					//this.writeToConsole("Tile " + tile1.asText() + " " + tile2.asText() + " " + tile3.asText() + " " + tile4.asText() + " have box 4-tile 50/50 influence " + influence);

					this.addInfluence(influenceTally, result.enablers, [tile1, tile2, tile3, tile4]);
					if (this.pseudo != null) {  // if we've found a pseudo then we can stop here
						return;
					}
				}

			}
		}

	}
	
	getBoxInfluence(subject, maxMissingMines) {

		if (subject == null) {
			return null;
		}

		const i = subject.getX();
		const j = subject.getY();

		if (j < 0 || j + 1 >= board.height || i < 0 || i + 1 >= board.width) {
			return null;
		}

		// need 4 hidden tiles
		if (!this.isHidden(i, j) || !this.isHidden(i, j + 1) || !this.isHidden(i + 1, j) || !this.isHidden(i + 1, j + 1)) {
			return null;
		}

		const missingMines = this.getMissingMines([this.board.getTileXY(i - 1, j - 1), this.board.getTileXY(i + 2, j - 1), this.board.getTileXY(i - 1, j + 2), this.board.getTileXY(i + 2, j + 2)]);

		// only consider possible 50/50s with less than 3 missing mines or requires more mines then are left in the game (plus 1 to allow for the extra mine in the 50/50)
		if (missingMines == null || missingMines.length + 2 > maxMissingMines || missingMines.length + 2 > this.minesLeft) {
			return null;
		}
		
		const tile1 = this.board.getTileXY(i, j);
		const tile2 = this.board.getTileXY(i, j + 1);
		const tile3 = this.board.getTileXY(i + 1, j);
		const tile4 = this.board.getTileXY(i + 1, j + 1);

		//this.writeToConsole("Evaluating candidate 50/50 - " + tile1.asText() + " " + tile2.asText() + " " + tile3.asText() + " " + tile4.asText());

		// add the missing Mines and the mine required to form the 50/50
		//missingMines.push(tile1);
		//missingMines.push(tile4);

		const mines = [...missingMines, tile1, tile4];
		const notMines = [tile2, tile3];

		// place the mines
		for (let tile of mines) {
			tile.setFoundBomb();
		}

		// see if the position is valid
		const counter = solver.countSolutions(this.board, notMines);

		// remove the mines
		for (let tile of mines) {
			tile.unsetFoundBomb();
		}

		if (counter.finalSolutionsCount == 0) {
			return null;
		}

		const percentage = divideBigInt(counter.finalSolutionsCount, this.totalSolutions, 5) * 100;

		this.writeToConsole("Possible 50/50 - " + tile1.asText() + " " + tile2.asText() + " " + tile3.asText() + " " + tile4.asText() + " probability " + percentage.toFixed(3) + "%");

		return new LTResult(counter.finalSolutionsCount, missingMines);

	}
	
	addNotNull(influence, result) {

		if (result == null) {
			return influence;
		} else {
			return influence + result.influence;
		}

	}

	maxNotNull(influence, result) {

		if (result == null) {
			return influence;
		} else {
			return this.bigIntMax(influence, result.influence);
		}

	}

	addInfluence(influence, enablers, tiles) {

		const pseudos = [];

		// the tiles which enable a 50/50 but aren't in it also get an influence
		if (enablers != null) {
			for (let loc of enablers) {

				// store the influence
				if (this.influenceEnablers[loc.index] == null) {
					this.influenceEnablers[loc.index] = influence;
				} else {
					this.influenceEnablers[loc.index] = this.influenceEnablers[loc.index] + influence;
				}
				//this.writeToConsole("Enabler " + loc.asText() + " has influence " + this.influences[loc.index]);
			}
		}

		for (let loc of tiles) {
			
			const b = this.currentPe.getBox(loc);
			let mineTally;
			if (b == null) {
				mineTally = this.currentPe.offEdgeMineTally;
			} else {
				mineTally = b.mineTally;
			}
			// If the mine influence covers the whole of the mine tally then it is a pseudo-5050
			if (influence == mineTally && this.pseudo == null) {
				if (!this.currentPe.isDead(loc)) {  // don't accept dead tiles
					pseudos.push(loc);
				}
			}

			// store the influence
			if (this.influence5050s[loc.index] == null) {
				this.influence5050s[loc.index] = influence;
			} else {
				//influences[loc.x][loc.y] = influences[loc.x][loc.y].max(influence);
				this.influence5050s[loc.index] = this.influence5050s[loc.index] + influence;
			}
			//this.writeToConsole("Interior " + loc.asText() + " has influence " + this.influences[loc.index]);
		}

		if (pseudos.length == 3) {
			this.pickPseudo(pseudos);
		} else if (pseudos.length != 0) {
			this.pseudo = pseudos[0];
        }

	}

	pickPseudo(locations) {

		let maxX = 0;
		let maxY = 0;

		for (let loc of locations) {
			maxX = Math.max(maxX, loc.getX());
			maxY = Math.max(maxY, loc.getY());
		}

		const maxX1 = maxX - 1;
		const maxY1 = maxY - 1;

		let found = 0;
		for (let loc of locations) {
			if (loc.getX() == maxX && loc.getY() == maxY || loc.getX() == maxX1 && loc.getY() == maxY1) {
				found++;
			}
		}

		// if the 2 diagonals exist then choose the pseudo from those, other wise choose the pseudo from the other diagonal
		if (found == 2) {
			this.pseudo = this.board.getTileXY(maxX, maxY);
		} else {
			this.pseudo = this.board.getTileXY(maxX1, maxY);
		}

	}


	/**
	 * Get how many solutions have common 50/50s at this location
	 */
	/*
	get5050Influence(loc) {

		if (influences[loc.index] == null) {
			return BigInt(0);
		} else {
			return influences[loc.index];
		}

	}
	*/

	/**
	 * Return all the locations with 50/50 influence
	 */
	getInfluencedTiles(threshold) {

		const top = BigInt(Math.floor(threshold * 10000));
		const bot = BigInt(10000);

		const cutoffTally = this.currentPe.finalSolutionsCount * top / bot;

		const result = [];

		for (let tile of this.board.tiles) {

			let influence = BigInt(0);

			if (this.influence5050s[tile.index] != null) {
				influence = influence + this.influence5050s[tile.index];
            }
			if (this.influenceEnablers[tile.index] != null) {
				influence = influence + this.influenceEnablers[tile.index];
			}

			if (influence != 0) {	  // if we are influenced by 50/50s

				if (!this.currentPe.isDead(tile)) {  // and not dead

					const b = this.currentPe.getBox(tile);
					let mineTally;
					if (b == null) {
						mineTally = this.currentPe.offEdgeMineTally;
					} else {
						mineTally = b.mineTally;
					}

					const safetyTally = this.currentPe.finalSolutionsCount - mineTally + influence;

					if (safetyTally > cutoffTally) {
						//this.writeToConsole("Tile " + tile.asText() + " has mine tally " + mineTally + " influence " + this.influences[tile.index]);
						//this.writeToConsole("Tile " + tile.asText() + " has  modified tally  " + safetyTally + " cutoff " + cutoffTally);
						result.push(tile);
					}

				}
			}
		}

		return result;
	}

	// given a list of tiles return those which are on the board but not a mine
	// if any of the tiles are revealed then return null
	getMissingMines(tiles) {

		const result = [];

		for (let loc of tiles) {

			if (loc == null) {
				continue;
            }

			// if out of range don't return the location
			if (loc.getX() >= this.board.width || loc.getX() < 0 || loc.getY() < 0 || loc.getY() >= this.board.getHeight) {
				continue;
			}

			// if the tile is revealed then we can't form a 50/50 here
			if (!loc.isCovered()) {
				return null;
			}

			// if the location is already a mine then don't return the location
			if (loc.isSolverFoundBomb()) {
				continue;
			}

			result.push(loc);
		}

		return result;
	}



	// not a certain mine or revealed
	isHidden(x, y) {

		const tile = this.board.getTileXY(x, y);

		if (tile.isSolverFoundBomb()) {
			return false;
		}

		if (!tile.isCovered()) {
			return false;
		}

		return true;

	}

	bigIntMin(a, b) {
		if (a < b) {
			return a;
		} else {
			return b;
        }
    }

	bigIntMax(a, b) {
		if (a > b) {
			return a;
		} else {
			return b;
        }
    }

	writeToConsole(text, always) {

		if (always == null) {
			always = false;
		}

		if (this.options.verbose || always) {
			console.log(text);
		}

	}
}

class LTResult {
	constructor(influence, enablers) {
		this.influence = influence;
		this.enablers = enablers;

		Object.seal(this) // prevent new properties being created
	}
}


"use strict";
/*tslint:disabled*/

// if (typeof module === "object" && module && typeof module.exports === "object") {
//     module.exports = {
//         start: function () {
// 			console.log("HALOOOOOOOOOOO");
//             return load_images();
//         }
//     }
// }

console.log('At start of main.js');

let TILE_SIZE = 24;
const DIGIT_HEIGHT = 32;
const DIGIT_WIDTH = 20;
const DIGITS = 5;

const MAX_WIDTH = 250;
const MAX_HEIGHT = 250;

const CYCLE_DELAY = 100;  // minimum delay in milliseconds between processing cycles

// offset 0 - 8 are the numbers and the bomb, hidden and flagged images are defined below
const BOMB = 9;
const HIDDEN = 10;
const FLAGGED = 11;
const FLAGGED_WRONG = 12;
const EXPLODED = 13;
const SKULL = 14;

const PLAY_CLIENT_SIDE = true;

let BINOMIAL;

// holds the images
const images = [];
let imagesLoaded = 0;
const led_images = [];

let canvasLocked = false;   // we need to lock the canvas if we are auto playing to prevent multiple threads playing the same game

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const docMinesLeft = document.getElementById('myMinesLeft');
const ctxBombsLeft = docMinesLeft.getContext('2d');

const canvasHints = document.getElementById('myHints');
const ctxHints = canvasHints.getContext('2d');

let analysisBoard;
let gameBoard;
let board;

let oldrng = false;

// define the whole board and set the event handlers for the file drag and drop
const wholeBoard = document.getElementById('wholeboard');
wholeBoard.ondrop = dropHandler;
wholeBoard.ondragover = dragOverHandler;

// define the other html elements we need
const tooltip = document.getElementById('tooltip');
const autoPlayCheckBox = document.getElementById("autoplay");
const showHintsCheckBox = document.getElementById("showhints");
const acceptGuessesCheckBox = document.getElementById("acceptguesses");
const seedText = document.getElementById("seed");
const gameTypeSafe = document.getElementById("gameTypeSafe");
const gameTypeZero = document.getElementById("gameTypeZero");
const switchButton = document.getElementById("switchButton");
const analysisButton = document.getElementById("AnalysisButton");
const messageBar = document.getElementById("messageBar");
const messageLine = document.getElementById("messageLine");
const messageBarBottom = document.getElementById("messageBarBottom");
const messageLineBottom = document.getElementById("messageLineBottom");
const downloadBar = document.getElementById("downloadBar");
const title = document.getElementById("title");
const lockMineCount = document.getElementById("lockMineCount");
const buildMode = document.getElementById("buildMode");
const docPlayStyle = document.getElementById("playstyle");
const docTileSize = document.getElementById("tilesize");
const docFastPlay = document.getElementById("fastPlay");
const docNgMode = document.getElementById("noGuessMode");
const docHardcore = document.getElementById("hardcore");
const docOverlay = document.getElementById("overlay");
//const docAnalysisParm = document.getElementById("analysisParm");
const urlQueryString = document.getElementById("urlQueryString");

const docBeginner = document.getElementById("beginner");
const docIntermediate = document.getElementById("intermediate");
const docExpert = document.getElementById("expert");
const docCustom = document.getElementById("custom");
const docWidth = document.getElementById("width");
const docHeight = document.getElementById("height");
const docMines = document.getElementById("mines");

// define the save buttons and assign their event functions
const downloadMBF = document.getElementById('savembf');
const downloadPosition = document.getElementById('saveposition');

downloadMBF.onclick = saveMBF;
downloadPosition.onclick = savePosition;

// variables for display expand or shrink
let isExpanded = false;
let originalLeftBoard = 185;
let originalTopHeight = 60
let originalLeftMessage = 185;

let hasTouchScreen = false;
let supportsInputDeviceCapabilities = false;

//variables for left-click flag
let leftClickFlag = false;

// elements used in the local storage modal - wip
const localStorageButton = document.getElementById("localStorageButton");
const localStorageModal = document.getElementById("localStorage");
const localStorageSelection = document.getElementById("localStorageSelection");

//properties panel
const propertiesPanel = document.getElementById("properties");

// elements used in the no guess build modal
const ngModal = document.getElementById("noGuessBuilder");
const ngText = document.getElementById("ngText");

let analysisMode = false;
let replayMode = false;
let replayData = null;
let replayStep = 0;
let replayInterrupt = false;
let replaying = false;

let previousBoardHash = 0;
let previousAnalysisQuery = "";
let justPressedAnalyse = false;
let dragging = false;  //whether we are dragging the cursor
let dragTile;          // the last tile dragged over
let hoverTile;         // tile the mouse last moved over
let analysing = false;  // try and prevent the analyser running twice if pressed more than once

let guessAnalysisPruning = true;

let lastFileHandle = null;

const urlParams = new URLSearchParams(window.location.search);

const filePickerAvailable = ('showSaveFilePicker' in window);

// things to do when the page visibility changes
function visibilityChange() {

    //console.log("visibility changed to " + document.visibilityState);
     
}


// things to do to get the game up and running
async function startup() {

    console.log("At start up...");

    if (filePickerAvailable) {
        console.log("Browser supports Save File Picker dialogue");
    } else {
        console.log("Browser does not support Save File Picker dialogue - files will be downloaded instead");
        downloadMBF.innerText = "Download MBF";
        downloadPosition.innerText = "Download position";
    }

    // do we have a touch screen?
    hasTouchScreen = false;
    if ("maxTouchPoints" in navigator) {
        hasTouchScreen = navigator.maxTouchPoints > 0;
    }
    if (hasTouchScreen) {
        console.log("Device supports touch screen");
    } else {
        console.log("Device does not supports touch screen");
        document.getElementById("leftClickFlag").style.display = "none"; 
    }

    try {
        let idc = new InputDeviceCapabilities();
        supportsInputDeviceCapabilities = true;
    } catch {
        supportsInputDeviceCapabilities = false;
    }
    console.log("Browser supports Input Device Capabilities: " + supportsInputDeviceCapabilities);

    //const urlParams = new URLSearchParams(window.location.search);
    const testParm = urlParams.get('test');
    if (testParm == "y") {
        localStorageButton.style.display = "block";
    } else {
        localStorageButton.style.display = "none";
    }

    const rngParm = urlParams.get('rng');
    if (rngParm == "old") {
        oldrng = true;
        console.log("Using old rng");
    }

    let seed = urlParams.get('seed');
    if (seed == null) {
        seed = 0;
    } else {
        seedText.value = seed;
    }

    const start = urlParams.get('start');

    if (urlParams.has("nopruning")) {
        console.log("WARNING: The Analyse button has Pruning turned off - pruning remains for all other solver calls");
        guessAnalysisPruning = false;
    }

    const boardSize = urlParams.get('board');

    let width = 30;
    let height = 16;
    let mines = 99;
    if (boardSize != null) {
        const size = boardSize.split("x");

        if (size.length != 3) {
            console.log("board parameter is invalid: " + boardSize);
        } else {
            width = parseInt(size[0]);
            height = parseInt(size[1]);
            mines = parseInt(size[2]);

            if (isNaN(width) || isNaN(height) || isNaN(mines)) {
                console.log("board parameter is invalid: " + boardSize);
                width = 30;
                height = 16;
                mines = 99;
            }
            width = Math.min(width, MAX_WIDTH);
            height = Math.min(height, MAX_HEIGHT);
            mines = Math.min(mines, width * height - 1);

        }

    }

    docMinesLeft.width = DIGIT_WIDTH * DIGITS;
    docMinesLeft.height = DIGIT_HEIGHT;

    BINOMIAL = new Binomial(70000, 500);

    console.log("Binomials calculated");

    //window.addEventListener("beforeunload", (event) => exiting(event));

    // add a listener for mouse clicks on the canvas
    canvas.addEventListener("mousedown", (event) => on_click(event));
    canvas.addEventListener("mouseup", (event) => mouseUpEvent(event));
    canvas.addEventListener('mousemove', (event) => followCursor(event));
    canvas.addEventListener('wheel', (event) => on_mouseWheel(event));
    canvas.addEventListener('mouseenter', (event) => on_mouseEnter(event));
    canvas.addEventListener('mouseleave', (event) => on_mouseLeave(event));

    document.addEventListener("visibilitychange", visibilityChange);

    docMinesLeft.addEventListener('wheel', (event) => on_mouseWheel_minesLeft(event));

    // add some hot key 
    document.addEventListener('keyup', event => { keyPressedEvent(event) });

    // make the properties div draggable
    dragElement(propertiesPanel);
    propertiesClose();

    // set the board details
    setBoardSizeOnGUI(width, height, mines);

    // read the url string before it gets over written by the new game processing
    const analysis = urlParams.get('analysis');

    // create the playable game;
    await newGame(width, height, mines, seed);
    gameBoard = board;

    if (analysis != null) {
        const compressor = new Compressor();

        width = compressor.decompressNumber(analysis.substring(0, 2));
        height = compressor.decompressNumber(analysis.substring(2, 4));
        mines = compressor.decompressNumber(analysis.substring(4, 8));

        let boardData = compressor.decompress(analysis.substring(8));
        if (boardData.length != width * height) {
            console.log("Analysis data doesn't fit the board - ignoring it");
        } else {
            const newLine = "\n";

            let boardString = width + "x" + height + "x" + mines + newLine;
            for (let i = 0; i < boardData.length; i = i + width) {
                boardString = boardString + boardData.substring(i, i + width) + newLine;
            }

            console.log(boardString);

            newBoardFromString(boardString, true);

            // make the analysis board this board
            analysisBoard = board;

            // and switch the display board back to the game board
            board = gameBoard;

         }

    }

    // initialise the solver
    await solver();

    //await newGame(width, height, mines, seed); // default to a new expert game

    // create an initial analysis board if we haven't already done so
    if (analysisBoard == null) {
        analysisBoard = new Board(1, 30, 16, 0, seed, "");
        analysisBoard.setAllZero();

    } else {
        switchToAnalysis(true);
    }

    setInterval(checkBoard, 1000);

    if (start != null) {
        showHintsCheckBox.checked = false;
        const tile = board.getTile(start);
        const message = buildMessageFromActions([new Action(tile.x, tile.y, 1, ACTION_CLEAR)], true);
        await sendActionsMessage(message);
        board.setStarted();
    }

    //bulkRun(21, 12500);  // seed '21' Played 12500 won 5192
    //bulkRun(321, 10000);  // seed 321 played 10000 won 4141

    showMessage("Welcome to minesweeper solver dedicated to Annie");
}

function setBoardSizeOnGUI(width, height, mines) {

    // set the board details
    if (width == 30 && height == 16 && mines == 99) {
        docExpert.checked = true;
    } else if (width == 16 && height == 16 && mines == 40) {
        docIntermediate.checked = true;
    } else if (width == 9 && height == 9 && mines == 10) {
        docBeginner.checked = true;
    } else {
        docCustom.checked = true;
        docWidth.value = width;
        docHeight.value = height;
        docMines.value = mines;
    }

}

// launch a floating window to store/retrieve from local storage
function openLocalStorage() {

    console.log("There are " + localStorage.length + " items in local storage");

    // remove all the options from the selection
    localStorageSelection.length = 0;

    // iterate localStorage
    for (let i = 0; i < localStorage.length; i++) {

        // set iteration key name
        const key = localStorage.key(i);

        const option = document.createElement("option");
        option.text = key;
        option.value = key;
        localStorageSelection.add(option);

        // use key name to retrieve the corresponding value
        const value = localStorage.getItem(key);

        // console.log the iteration key and value
        console.log('Key: ' + key + ', Value: ' + value);

    }

    localStorageModal.style.display = "block";

}

function closeLocalStorage() {

    localStorageModal.style.display = "none";

}

function saveLocalStorage() {

    const key = localStorageSelection.value;

    console.log("Saving board position to local storage key '" + key + "'");

}

function loadLocalStorage() {


}

function fetchLocalStorage() {


}

function propertiesClose() {
    propertiesPanel.style.display = "none";
}

function propertiesOpen() {
    propertiesPanel.style.display = "block";
}

// pop up a file save dialogue to store the layout as MBF format
async function saveMBF(e) {

    // if we are in analysis mode then create the url, otherwise the url was created when the game was generated
    let mbf;
    let okay = true;

    if (analysisMode) {
        if (board == null) {
            console.log("No Board defined, unable to generate MBF");
            okay = false;
        }

        if (board.bombs_left != 0) {
            showMessage("Mines left must be zero in order to download the board from Analysis mode.");
            okay = false;
        }

        mbf = board.getFormatMBF();

        if (mbf == null) {
            console.log("Null data returned from getFormatMBF()");
            okay = false;
        }

    } else {
        mbf = getMbfData(board.id);   // this function is in MinesweeperGame.js
        if (mbf == null) {
            showMessage("No game data available to convert to an MBF file");
            okay = false;
        }
    }

    // if an error was found, prevent the download and exit
    if (!okay) {
        e.preventDefault();
        return false;
    }

    let filename;
    if (analysisMode) {
        filename = "JSM_" + new Date().toISOString() + ".mbf";
    } else {
        filename = "JSM_Seed_" + board.seed + ".mbf";
    }

    const data = mbf;

    // if the file picker isn't available then do a download
    if (!filePickerAvailable) {
 
        console.log("Doing a file download...");

        // file picker failed try as a download
        const blob = new Blob([data], { type: 'application/octet-stream' })

        const url = URL.createObjectURL(blob);

        console.log(url);

        downloadMBF.href = url;  // Set the url ready to be downloaded

        // give it 10 seconds then revoke the url
        setTimeout(function () { console.log("Revoked " + url); URL.revokeObjectURL(url) }, 10000, url);

        downloadMBF.download = filename;

        return true;
    }

    // if we're using the file picker then prevent the download
    e.preventDefault();

    const options = {
        excludeAcceptAllOption: true,
        suggestedName: filename,
        startIn: 'documents',
        types: [
            {
                description: 'Minesweeper board format',
                accept: {
                    'application/blob': ['.mbf'],
                },
            },
        ],
    };

    if (lastFileHandle != null) {
        options.startIn = lastFileHandle;
    }

    try {

        const fileHandle = await window.showSaveFilePicker(options);

        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();

        lastFileHandle = fileHandle;

    } catch (err) {
        console.log("Save file picker exception: " + err.message);

    }

}


// pop up a file save dialogue to store the board details
async function savePosition(e) {

    let filename;
    if (analysisMode) {
        filename = "JSM_" + new Date().toISOString() + ".mine";
    } else {
        filename = "JSM_Seed_" + board.seed + ".mine";
    }
 
    const data = board.getPositionData()

    // if the file picker isn't available then do a download
    if (!filePickerAvailable) {

        console.log("Doing a file download...");

        // file picker failed try as a download
        const blob = new Blob([data], { type: 'text/html' })

        const url = URL.createObjectURL(blob);

        console.log(url);

        downloadPosition.href = url;  // Set the url ready to be downloaded

        // give it 10 seconds then revoke the url
        setTimeout(function () { console.log("Revoked " + url); URL.revokeObjectURL(url) }, 10000, url);

        downloadPosition.download = filename;

        return true;
    }

    // if we're using the file picker then prevent the download
    e.preventDefault();

    const options = {
        excludeAcceptAllOption: true,
        suggestedName: filename,
        startIn: 'documents',
        types: [
            {
                description: 'Minesweeper board',
                accept: {
                    'text/plain': ['.mine'],
                },
            },
        ],
    };

    if (lastFileHandle != null) {
        options.startIn = lastFileHandle;
    }

    try {
        const fileHandle = await window.showSaveFilePicker(options);

        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();

        lastFileHandle = fileHandle;

    } catch(err) {
        console.log("Save file picker exception: " + err.message);
    }

}


function switchToAnalysis(doAnalysis) {

    // can't switch modes while the solver is working
    if (canvasLocked) {
        return;
    }

     if (doAnalysis) {
        document.getElementById("play0").style.display = "none";
        document.getElementById("play1").style.display = "none";
        document.getElementById("analysis0").style.display = "block";
        document.getElementById("analysis1").style.display = "block";
        document.getElementById("repeatGame").style.display = "none";
        document.getElementById("NewGame").innerHTML = "Reset board";

     } else {
        document.getElementById("play0").style.display = "";
        document.getElementById("play1").style.display = "";
        document.getElementById("analysis0").style.display = "none";
        document.getElementById("analysis1").style.display = "none";
        document.getElementById("repeatGame").style.display = "";
        document.getElementById("NewGame").innerHTML = "New game";

    }

    if (doAnalysis) {
        gameBoard = board;
        board = analysisBoard;

        //showDownloadLink(true, "")  // display the hyperlink

        switchButton.innerHTML = "Switch to Player";
    } else {
        analysisBoard = board;
        board = gameBoard;

        //showDownloadLink(false, "")  // hide the hyperlink (we don't have the url until we play a move - this could be improved)

        switchButton.innerHTML = "Switch to Analyser";
    }

    analysisMode = doAnalysis;

    setPageTitle();

    changeTileSize();

    renderHints([]);  // clear down hints

    updateMineCount(board.bombs_left);  // reset the mine count

    previousBoardHash = 0; // reset the board hash, so it gets recalculated
}

function setPageTitle() {

    if (analysisMode) {
        if (replayMode) {
            title.innerHTML = "Minesweeper replay";  // change the title
        } else {
            title.innerHTML = "Minesweeper analyser";  // change the title
        }

    } else {
        title.innerHTML = "Minesweeper player"; // change the title
    }

    document.title = title.innerHTML;
}

// render an array of tiles to the canvas
function renderHints(hints, otherActions, drawOverlay) {

    if (drawOverlay == null) {
        drawOverlay = (docOverlay.value != "none")
    }

    //console.log(hints.length + " hints to render");
    //ctxHints.clearRect(0, 0, canvasHints.width, canvasHints.height);
    ctxHints.reset();

    if (hints == null) {
        return;
    }

    let firstGuess = 0;  // used to identify the first (best) guess, subsequent guesses are just for info 
    for (let i = 0; i < hints.length; i++) {

        const hint = hints[i];

        if (hint.action == ACTION_CHORD) {
            ctxHints.fillStyle = "#00FF00";
        } else if (hint.prob == 0) {   // mine
            ctxHints.fillStyle = "#FF0000";
        } else if (hint.prob == 1) {  // safe
            ctxHints.fillStyle = "#00FF00";
        } else if (hint.dead) {  // uncertain but dead
            ctxHints.fillStyle = "black";
        } else {  //uncertain
            ctxHints.fillStyle = "orange";
            if (firstGuess == 0) {
                firstGuess = 1;
            }
        }

        ctxHints.globalAlpha = 0.5;

        //console.log("Hint X=" + hint.x + " Y=" + hint.y);
        ctxHints.fillRect(hint.x * TILE_SIZE, hint.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        if (firstGuess == 1) {
            ctxHints.fillStyle = "#00FF00";
            ctxHints.fillRect((hint.x + 0.25) * TILE_SIZE, (hint.y + 0.25) * TILE_SIZE, 0.5 * TILE_SIZE, 0.5 * TILE_SIZE);
            firstGuess = 2;
        }

    }

     // put percentage over the tile 
    if (drawOverlay) {

        if (TILE_SIZE == 12) {
            ctxHints.font = "7px serif";
        } else if (TILE_SIZE == 16) {
            ctxHints.font = "10px serif";
        } else if (TILE_SIZE == 20) {
            ctxHints.font = "12px serif";
        } else if (TILE_SIZE == 24) {
            ctxHints.font = "14px serif";
        } else if (TILE_SIZE == 28) {
            ctxHints.font = "16px serif";
        } if (TILE_SIZE == 32) {
            ctxHints.font = "21px serif";
        } else {
            ctxHints.font = "6x serif";
        }

        ctxHints.globalAlpha = 1;
        ctxHints.fillStyle = "black";
        for (let tile of board.tiles) {
            if (tile.getHasHint() && tile.isCovered() && !tile.isFlagged() && tile.probability != null) {
                if (!showHintsCheckBox.checked || (tile.probability != 1 && tile.probability != 0)) {  // show the percentage unless we've already colour coded it

                    let value;
                    if (docOverlay.value == "safety") {
                        value = tile.probability * 100;
                    } else {
                        value = (1 - tile.probability) * 100;
                    }

                    let value1;
                    if (value < 9.95) {
                        value1 = value.toFixed(1);
                    } else {
                        value1 = value.toFixed(0);
                    }

                    const offsetX = (TILE_SIZE - ctxHints.measureText(value1).width) / 2;

                    ctxHints.fillText(value1, tile.x * TILE_SIZE + offsetX, (tile.y + 0.7) * TILE_SIZE, TILE_SIZE);

                }
            }
        }
    }


    if (otherActions == null) {
        return;
    }

    ctxHints.globalAlpha = 1;
    // these are from the efficiency play style and are the known moves which haven't been made
    for (let action of otherActions) {
        if (action.action == ACTION_CLEAR) {
            ctxHints.fillStyle = "#00FF00";
        } else {
            ctxHints.fillStyle = "#FF0000";
        }
        ctxHints.fillRect((action.x + 0.35) * TILE_SIZE, (action.y + 0.35) * TILE_SIZE, 0.3 * TILE_SIZE, 0.3 * TILE_SIZE);
    }

}

// render an array of tiles to the canvas
function renderBorder(hints, flag) {

    //console.log(hints.length + " hints to render");

     for (let i = 0; i < hints.length; i++) {

         const hint = hints[i];

         ctxHints.globalAlpha = 0.7;
         ctxHints.lineWidth = 6;

         if (flag) {
             ctxHints.strokeStyle = "red";
         } else {
             ctxHints.strokeStyle = "black";
         }
 
         ctxHints.strokeRect(hint.x * TILE_SIZE, hint.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
 
    }

}

// render an array of tiles to the canvas
function renderTiles(tiles) {

    //console.log(tiles.length + " tiles to render");

    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        let tileType = HIDDEN;

        if (tile.isBomb()) {
            if (tile.exploded) {
                tileType = EXPLODED;
            } else {
                tileType = BOMB;
            }
 
        } else if (tile.isFlagged()) {
            if (tile.isBomb() == null || tile.isBomb()) {  // isBomb() is null when the game hasn't finished
                tileType = FLAGGED;
            } else {
                tileType = FLAGGED_WRONG;
            }

        } else if (tile.isSkull()) {
            //console.log("Render skull at " + tile.asText());
            tileType = SKULL;

        } else if (tile.isCovered()) {
            tileType = HIDDEN;

        } else {
            tileType = tile.getValue();
        }
        draw(tile.x, tile.y, tileType);
    }


}

function updateMineCount(minesLeft) {

    let work = minesLeft;
    const digits = getDigitCount(minesLeft);

    let position = digits - 1;

    docMinesLeft.width = DIGIT_WIDTH * digits;

    for (let i = 0; i < DIGITS; i++) {

        const digit = work % 10;
        work = (work - digit) / 10;

        ctxBombsLeft.drawImage(led_images[digit], DIGIT_WIDTH * position + 2, 2, DIGIT_WIDTH - 4, DIGIT_HEIGHT - 4);

        position--;
    }

}

function getDigitCount(mines) {

    let digits;
    if (mines < 1000) {
        digits = 3;
    } else if (mines < 10000) {
        digits = 4;
    } else {
        digits = 5;
    }

    return digits;
}

// display or hide the download link 
function showDownloadLink(show, url) {
    console.log("Obsolete method 'showDownloadLink' called");

}

async function bulkRun(runSeed, size) {

    const options = {};
    options.playStyle = PLAY_STYLE_NOFLAGS;
    options.verbose = false;
    options.advancedGuessing = true;

    const startTime = Date.now();

    let played = 0;
    let won = 0;

    const rng = JSF(runSeed);  // create an RNG based on the seed
    const startIndex = 0;

    while (played < size) {

        played++;

        const gameSeed = rng() * Number.MAX_SAFE_INTEGER;

        console.log(gameSeed);

        const game = new ServerGame(0, 30, 16, 99, startIndex, gameSeed, "safe");

        const board = new Board(0, 30, 16, 99, gameSeed, "safe");

        let tile = game.getTile(startIndex);

        let revealedTiles = game.clickTile(tile);
        applyResults(board, revealedTiles);  // this is in MinesweeperGame.js

        let loopCheck = 0;
        while (revealedTiles.header.status == IN_PLAY) {

            loopCheck++;

            if (loopCheck > 10000) {
                break;
            }

            const reply = await solver(board, options);  // look for solutions

            const actions = reply.actions;

            for (let i = 0; i < actions.length; i++) {

                const action = actions[i];

                if (action.action == ACTION_CHORD) {
                    console.log("Got a chord request!");

                } else if (action.action == ACTION_FLAG) {   // zero safe probability == mine
                    console.log("Got a flag request!");

                } else {   // otherwise we're trying to clear

                    tile = game.getTile(board.xy_to_index(action.x, action.y));

                    revealedTiles = game.clickTile(tile);

                    if (revealedTiles.header.status != IN_PLAY) {  // if won or lost nothing more to do
                        break;
                    }

                    applyResults(board, revealedTiles);

                    if (action.prob != 1) {  // do no more actions after a guess
                    	break;
                    }
                }
            }

        }

        console.log(revealedTiles.header.status);

        if (revealedTiles.header.status == WON) {
            won++;
        }

    }

    console.log("Played " + played + " won " + won);
}

async function playAgain() {

    // let the server know the game is over
    if (board != null && !analysisMode) {
        callKillGame(board.getID());

        const reply = copyGame(board.getID());

        const id = reply.id;

        board = new Board(id, board.width, board.height, board.num_bombs, board.seed, board.gameType);

        changeTileSize();

        updateMineCount(board.num_bombs);

        canvasLocked = false;  // just in case it was still locked (after an error for example)

        placeAnalysisQuery();

        showMessage("Replay game requested");
    } else {
        showMessage("No game to replay");
    }

}

// take a .mine format string and try to create a MBF format from it
function StringToMBF(data) {

    const lines = data.split("\n");
    const size = lines[0].split("x");

    if (size.length != 3) {
        console.log("Header line is invalid: " + lines[0]);
        return null;
    }

    const width = parseInt(size[0]);
    const height = parseInt(size[1]);
    const mines = parseInt(size[2]);

    console.log("width " + width + " height " + height + " mines " + mines);

    if (width < 1 || height < 1 || mines < 1) {
        console.log("Invalid dimensions for game");
        return null;
    }

    if (lines.length < height + 1) {
        console.log("Insufficient lines to hold the data: " + lines.length);
        return null;
    }

    if (width > 255 || height > 255) {
        console.log("Board too large to convert to MBF format");
        return null;
    }

    const length = 4 + 2 * mines;

    const mbf = new ArrayBuffer(length);
    const mbfView = new Uint8Array(mbf);

    mbfView[0] = width;
    mbfView[1] = height;

    mbfView[2] = Math.floor(mines / 256);
    mbfView[3] = mines % 256;

    let minesFound = 0;
    let index = 4;

    for (let y = 0; y < height; y++) {
        const line = lines[y + 1];
        console.log(line);
        for (let x = 0; x < width; x++) {

            const char = line.charAt(x);

            if (char == "F" || char == "M" || char == "?") {
                minesFound++;
                if (index < length) {
                    mbfView[index++] = x;
                    mbfView[index++] = y;
                }
            }
        }
    }
    if (minesFound != mines) {
        console.log("Board has incorrect number of mines. board=" + mines + ", found=" + minesFound);
        return null;
    }

    console.log(...mbfView);

    return mbf;

}

async function newGameFromBlob(blob) {
    const mbf = await blob.arrayBuffer();
    await newGameFromMBF(mbf);
    showMessage("Game " + board.width + "x" + board.height + "/" + board.num_bombs + " created from MBF file " + blob.name);
}

async function newGameFromMBF(mbf) {

    const view = new Uint8Array(mbf);

    console.log(...view);

    // let the server know the game is over
    if (board != null) {
        callKillGame(board.getID());
    }

    const width = view[0];
    const height = view[1];
    const mines = view[2] * 256 + view[3];

    const reply = createGameFromMFB(view);  // this function is in MinesweeperGame.js

    const id = reply.id;

    let gameType;
    if (gameTypeZero.checked) {
        gameType = "zero";
    } else {
        gameType = "safe";
    }

    board = new Board(id, width, height, mines, "", gameType);

    setPageTitle();

    changeTileSize();

    //showDownloadLink(false, ""); // remove the download link

    updateMineCount(board.num_bombs);

    canvasLocked = false;  // just in case it was still locked (after an error for example)

    //showMessage("Game "  + width + "x" + height + "/" + mines + " created from MBF file");
 
}

async function newBoardFromFile(file) {

    const fr = new FileReader();

    fr.onloadend = async function (e) {

        if (analysisMode) {
            await newBoardFromString(e.target.result);
            showMessage("Position loaded from file " + file.name);
        } else {
            const mbf = StringToMBF(e.target.result);
            if (mbf == null) {
                showMessage("File " + file.name + " doesn't contain data for a whole board");
                return;
            } else {
                newGameFromMBF(mbf);
                showMessage("Game " + board.width + "x" + board.height + "/" + board.num_bombs + " created from mine positions extracted from file " + file.name);
            }
        }
 
        //lockMineCount.checked = true;
        //buildMode.checked = false;
 
        checkBoard();

    };

    fr.readAsText(file);

}

async function newBoardFromString(data, inflate) {

    if (inflate == null) {
        inflate = false;
    }

    const lines = data.split("\n");
    const size = lines[0].split("x");

    if (size.length != 3) {
        console.log("Header line is invalid: " + lines[0]);
        return;
    }

    const width = parseInt(size[0]);
    const height = parseInt(size[1]);
    const mines = parseInt(size[2]);

    console.log("width " + width + " height " + height + " mines " + mines);

    if (width < 1 || height < 1 || mines < 0) {
        console.log("Invalid dimensions for game");
        return;
    }

    if (lines.length < height + 1) {
        console.log("Insufficient lines to hold the data: " + lines.length);
        return;
    }

    const newBoard = new Board(1, width, height, mines, "", "safe");

    for (let y = 0; y < height; y++) {
        const line = lines[y + 1];
        console.log(line);
        for (let x = 0; x < width; x++) {

            const char = line.charAt(x);
            const tile = newBoard.getTileXY(x, y);

            if (char == "F" || char == "M") {
                tile.toggleFlag();
                newBoard.bombs_left--;
                tile.inflate = true;
            } else if (char == "0") {
                tile.setValue(0);
            } else if (char == "1") {
                tile.setValue(1);
            } else if (char == "2") {
                tile.setValue(2);
            } else if (char == "3") {
                tile.setValue(3);
            } else if (char == "4") {
                tile.setValue(4);
            } else if (char == "5") {
                tile.setValue(5);
            } else if (char == "6") {
                tile.setValue(6);
            } else if (char == "7") {
                tile.setValue(7);
            } else if (char == "8") {
                tile.setValue(8);
            } else if (char == "I") {  // hidden but needs inflating, part of the compression of NF games
                tile.setCovered(true);
                tile.setFoundBomb();
                tile.inflate = true;
            } else if (char == "O") {  // a flag which doesn't need inflating
                tile.toggleFlag();
                newBoard.bombs_left--;
            } else {
                tile.setCovered(true);
            }
        }
    }

    // if the data needs inflating then for each flag increase the adjacent tiles value by 1
    if (inflate) {
        for (let tile of newBoard.tiles) {
            if (tile.inflate) {
                const adjTiles = newBoard.getAdjacent(tile);
                for (let i = 0; i < adjTiles.length; i++) {
                    const adjTile = adjTiles[i];
                    if (!adjTile.isCovered()) {  // inflate tiles which aren't flags
                        let value = adjTile.getValue() + 1;
                        adjTile.setValueOnly(value);
                    }
                }

            }
        }
    }

    // switch to the board
    board = newBoard;

    // this redraws the board
    changeTileSize();

    updateMineCount(board.bombs_left);

    replayMode = false;
    replayData = null;

    setPageTitle();

    lockMineCount.checked = true;
    buildMode.checked = false;

    canvasLocked = false;  // just in case it was still locked (after an error for example)

}

// load replay data into the system
function loadReplayData(file) {

    if (!analysisMode) {
        showMessage("Switch to analysis mode before loading the replay");
        return;
    }

    const fr = new FileReader();

    fr.onloadend = async function (e) {

        replayData = JSON.parse(e.target.result);
        replayStep = 0;
        replayMode = true;
        replayData.breaks = Array(replayData.replay.length);
        replayData.breaks.fill(false);

        showMessage("Replay for " + replayData.header.width + "x" + replayData.header.height + "/" + replayData.header.mines + " loaded from " + file.name);

        const newBoard = new Board(1, replayData.header.width, replayData.header.height, replayData.header.mines, "", "safe");

        // switch to the board
        board = newBoard;

        setPageTitle();

        // this redraws the board
        changeTileSize();

        updateMineCount(board.bombs_left);

        // enable the analysis button - it might have been previous in an invalid layout
        analysisButton.disabled = false;

    };

    fr.readAsText(file);

}

async function newGame(width, height, mines, seed) {

    console.log("New game requested: Width=" + width + " Height=" + height + " Mines=" + mines + " Seed=" + seed);

    // let the server know the game is over
    if (board != null) {
        callKillGame(board.getID());
    }

    // this is a message to the server or local
    let reply;
    if (PLAY_CLIENT_SIDE) {
        reply = getNextGameID();
    } else {
        const json_data = await fetch("/requestID");
        reply = await json_data.json();
    }

    console.log("<== " + JSON.stringify(reply));
    const id = reply.id;

    let gameType;
    if (gameTypeZero.checked) {
        gameType = "zero";
    } else {
        gameType = "safe";
    }

    if (analysisMode) {
        lockMineCount.checked = !document.getElementById('buildZero').checked;  // lock the mine count or not
        buildMode.checked = !lockMineCount.checked;
        //showDownloadLink(true, "");
    } else {
        //showDownloadLink(false, "");
    }

    let drawTile = HIDDEN;
    if (analysisMode) {
        replayMode = false;
        replayData = null;

        if (document.getElementById('buildZero').checked) {
            board = new Board(id, width, height, 0, seed, gameType);
            board.setAllZero();
            drawTile = 0;
        } else {
            board = new Board(id, width, height, mines, seed, gameType);
        }
    } else {
        board = new Board(id, width, height, mines, seed, gameType);
    }

    changeTileSize();

    updateMineCount(board.num_bombs);

    setPageTitle();

    canvasLocked = false;  // just in case it was still locked (after an error for example)

    // store the board size in the url
    const boardSize = width + "x" + height + "x" + mines;
    setURLParms("board", boardSize);

    placeAnalysisQuery();

    showMessage("New game requested with width " + width + ", height " + height + " and " + mines + " mines.");

}

function doToggleFlag() {
    //console.log("DoToggleFlag");

    if (leftClickFlag) {
        document.getElementById("leftClickFlag").src = 'resources/images/flaggedWrong_thin.png';
        leftClickFlag = false;
    } else {
        document.getElementById("leftClickFlag").src = 'resources/images/flagged.png';
        leftClickFlag = true;
    }

}

function changeTileSize() {

    TILE_SIZE = parseInt(docTileSize.value);

    //console.log("Changing tile size to " + TILE_SIZE);

    resizeCanvas(board.width, board.height);  // resize the canvas

    browserResized();  // do we need scroll bars?

    renderTiles(board.tiles); // draw the board

}

// expand or shrink the game display
function doToggleScreen() {

    //console.log("DoToggleScreen");

    if (isExpanded) {
        document.getElementById("controls").style.display = "block";
        document.getElementById("headerPanel").style.display = "block";
        document.getElementById("wholeboard").style.left = originalLeftBoard;
        document.getElementById("wholeboard").style.top = originalTopHeight;

        document.getElementById("messageBar").style.left = originalLeftMessage;
        isExpanded = false;
 
        document.getElementById("toggleScreen").innerHTML = "+";
        messageBarBottom.className = "";
        messageBar.className = "hidden";
        downloadBar.className = "";

        isExpanded = false;
    } else {
        originalLeftBoard = document.getElementById("wholeboard").style.left;
        originalLeftMessage = document.getElementById("messageBar").style.left;
        originalTopHeight = document.getElementById("wholeboard").style.top;
        document.getElementById("wholeboard").style.left = "0px";
        document.getElementById("wholeboard").style.top = "0px";
        document.getElementById("messageBar").style.left = "0px";

        document.getElementById("controls").style.display = "none";
        document.getElementById("headerPanel").style.display = "none";

        document.getElementById("toggleScreen").innerHTML = "-";

        messageBarBottom.className = "hidden";
        downloadBar.className = "hidden";
        messageBar.className = "";
        isExpanded = true;
    }

    browserResized();

}

// make the canvases large enough to fit the game
function resizeCanvas(width, height) {

    const boardWidth = width * TILE_SIZE;
    const boardHeight = height * TILE_SIZE;

    canvas.width = boardWidth;
    canvas.height = boardHeight;

    canvasHints.width = boardWidth;
    canvasHints.height = boardHeight;

}

function browserResized() {

    const boardElement = document.getElementById('board');

    const boardWidth = board.width * TILE_SIZE;
    const boardHeight = board.height * TILE_SIZE;

    const screenWidth = document.getElementById('canvas').offsetWidth - 10;

    let screenHeight;
    if (isExpanded) {
        screenHeight = document.getElementById('canvas').offsetHeight - 40;   // subtract some space to allow for the mine count panel and the hyperlink
    } else {
        screenHeight = document.getElementById('canvas').offsetHeight - 60;   // subtract some space to allow for the mine count panel and the hyperlink
    }
 
    //console.log("Available size is " + screenWidth + " x " + screenHeight);

    // things to determine
    let useWidth;
    let useHeight;
    let scrollbarYWidth;
    let scrollbarXHeight;

    // decide screen size and set scroll bars
    if (boardWidth > screenWidth && boardHeight > screenHeight) {  // both need scroll bars
        useWidth = screenWidth;
        useHeight = screenHeight;
        boardElement.style.overflowX = "scroll";
        boardElement.style.overflowY = "scroll";

        scrollbarYWidth = 0;    
        scrollbarXHeight = 0;

    } else if (boardWidth > screenWidth) {  // need a scroll bar on the bottom
        useWidth = screenWidth;
        boardElement.style.overflowX = "scroll";

        scrollbarXHeight = boardElement.offsetHeight - boardElement.clientHeight - 10;
        scrollbarYWidth = 0;

        if (boardHeight + scrollbarXHeight > screenHeight) {  // the scroll bar has made the height to large now !
            useHeight = screenHeight;
            boardElement.style.overflowY = "scroll";
            scrollbarXHeight = 0;
        } else {
            useHeight = boardHeight;
            boardElement.style.overflowY = "hidden";
        }

    } else if (boardHeight > screenHeight) {  // need a scroll bar on the right
        useHeight = screenHeight;
        boardElement.style.overflowY = "scroll";

        scrollbarYWidth = boardElement.offsetWidth - boardElement.clientWidth - 10;
        scrollbarXHeight = 0;

        if (boardWidth + scrollbarYWidth > screenWidth) {  // the scroll bar has made the width to large now !
            useWidth = screenWidth;
            scrollbarYWidth = 0;
            boardElement.style.overflowX = "scroll";
        } else {
            useWidth = boardWidth;
            boardElement.style.overflowX = "hidden";
        }

    } else {
        useWidth = boardWidth;
        boardElement.style.overflowX = "hidden";
        useHeight = boardHeight;
        boardElement.style.overflowY = "hidden";
        scrollbarYWidth = 0;
        scrollbarXHeight = 0;
    }

    //console.log("Usable size is " + useWidth + " x " + useHeight);
    //console.log("Scroll bar Y width  " + scrollbarYWidth);
    //console.log("Scroll bar X Height  " + scrollbarXHeight);

    // change the size of the viewable frame
    boardElement.style.width = (useWidth + scrollbarYWidth) + "px";
    boardElement.style.height = (useHeight + scrollbarXHeight) + "px";

    document.getElementById("display").style.width = (useWidth + scrollbarYWidth) + "px";

}

function keyPressedEvent(e) {

    //console.log("Key pressed: " + e.key);
    let newValue = null;
    if (e.key == 'a') {
        if (!analysisButton.disabled) {  // don't allow the hotkey if the button is disabled
            doAnalysis();
        }

    } else if (analysisMode) {
        if (e.key == 'l') {   // 'L'
            lockMineCount.checked = !lockMineCount.checked;
        } else if (e.key == '0') {
            newValue = 0;
        } else if (e.key == '1') {  // '1'
            newValue = 1;
        } else if (e.key == '2') {
            newValue = 2;
        } else if (e.key == '3') {
            newValue = 3;
        } else if (e.key == '4') {
            newValue = 4;
        } else if (e.key == '5') {
            newValue = 5;
        } else if (e.key == '6') {
            newValue = 6;
        } else if (e.key == '7') {
            newValue = 7;
        } else if (e.key == '8') {
            newValue = 8;
        } else if (e.key == 'h') {
            const tile = hoverTile;
            tile.setCovered(true);
            window.requestAnimationFrame(() => renderTiles([tile]));
        } else if (e.key == 'f') {
            const tile = hoverTile;
            const tilesToUpdate = analysis_toggle_flag(tile);
            window.requestAnimationFrame(() => renderTiles(tilesToUpdate));
        } else if (e.key == 'v' && e.ctrlKey) {
            //console.log("Control-V pressed");
            navigator.clipboard.readText().then(
                clipText => newBoardFromString(clipText));
        } else if (e.key == 'ArrowRight') {
             if (replayMode) {
                if (e.shiftKey) {
                    replayForward("S");
                } else {
                    replayForward("1");
                }
            }
        } else if (e.key == 'ArrowLeft') {
            if (replayMode) {
                if (e.shiftKey) {
                    replayBackward("S");
                } else {
                    replayBackward("1");
                }
            }
        } else if (e.key == 'ArrowUp') {
            if (replayMode) {
                replayInterrupt = true;
            }
        }
    } else {
        if (e.key == ' ' && board.isGameover()) {
            apply();  // this is in the index.html file
        }
    }

    if (newValue == null) {
        return;
    }

    const tile = hoverTile;

    //console.log('tile is' + tile);
    // can't replace a flag
    if (tile == null || tile.isFlagged()) {
        return;
    }

    const flagCount = board.adjacentFoundMineCount(tile);
    const covered = board.adjacentCoveredCount(tile);

    // check it is a legal value
    if (newValue < flagCount || newValue > flagCount + covered) {
        return;
    }

    tile.setValue(newValue);

    // update the graphical board
    window.requestAnimationFrame(() => renderTiles([tile]));

}

async function replayForward(replayType) {

    if (replaying) {
        console.log("Replay is already in progress")
        return;
    }

    const size = replayData.replay.length;
    replayInterrupt = false;

    if (replayStep == size) {
        console.log("Replay can't advance beyond the end")
        return;
    }

    replaying = true;

    while (replayStep != size) {

        replayStep++;

        if (replayType == "S") {
            showMessage("Advancing to step " + replayStep + " of " + size);
            await sleep(1);
        }

        // clear the hints overlay
        window.requestAnimationFrame(() => renderHints([], []));

        const step = replayData.replay[replayStep - 1];

        const tiles = [];

        // type 0 = clear, type 3 = chord
        if (step.type == 0 || step.type == 3) {
            let gameBlasted = false;
            for (let i = 0; i < step.touchCells.length; i = i + 5) {

                const x = step.touchCells[i];
                const y = step.touchCells[i + 1];
                const value = step.touchCells[i + 2];

                const tile = board.getTileXY(x, y);

                if (tile == null) {
                    console.log("Unable to find tile (" + x + "," + y + ")");
                    continue;
                } else {
                    //console.log("Tile (" + tile.getX() + "," + tile.getY() + ") to value " + value);
                }

                if (value < 9) {    // reveal value on tile
                    tile.setValue(value);
                    tiles.push(tile);

                } else if (value == 10) {  // add or remove flag

                    if (gameBlasted) {
                        tile.setBomb(true);
                    } else {
                        tile.toggleFlag();
                        if (tile.isFlagged()) {
                            board.bombs_left--;
                        } else {
                            board.bombs_left++;
                        }
                    }

                    tiles.push(tile);

                } else if (value == 11) {  // a tile which is a mine and is the cause of losing the game
                    gameBlasted = true;
                    tile.setBombExploded();
                    tiles.push(tile);

                } else if (value == 12) {  // a tile which is flagged but shouldn't be
                    board.bombs_left++;
                    tile.setBomb(false);
                    tiles.push(tile);

                } else {
                    console.log(tile.asText() + " Replay value '" + value + "' is not recognised");
                }

            }

        } else if (step.type == 1) {
            const x = step.x;
            const y = step.y;

            const tile = board.getTileXY(x, y);

            if (tile == null) {
                console.log("Unable to find tile (" + x + "," + y + ")");
                continue;
            }

            tile.toggleFlag();
            if (tile.isFlagged()) {
                board.bombs_left--;
            } else {
                board.bombs_left++;
            }
            tiles.push(tile);

        }
        // update the graphical board

        window.requestAnimationFrame(() => renderTiles(tiles));
        window.requestAnimationFrame(() => updateMineCount(board.bombs_left));

        // run the solver
        const options = {};

        if (docPlayStyle.value == "flag") {
            options.playStyle = PLAY_STYLE_FLAGS;
        } else if (docPlayStyle.value == "noflag") {
            options.playStyle = PLAY_STYLE_NOFLAGS;
        } else if (docPlayStyle.value == "eff") {
            options.playStyle = PLAY_STYLE_EFFICIENCY;
        } else {
            options.playStyle = PLAY_STYLE_NOFLAGS_EFFICIENCY;
        }

        options.fullProbability = true;
        options.advancedGuessing = false;
        options.verbose = false;

        let hints;
        let other;

        const solve = await solver(board, options);  // look for solutions
        hints = solve.actions;
        other = solve.other;

        // determine the next tile to be clicked
        let doBreak = replayInterrupt;

        if (replayStep != size) {
            const nextStep = replayData.replay[replayStep];
            const nextTile = board.getTileXY(nextStep.x, nextStep.y);

            // see if the left click is definitely safe
            if (nextStep.type == 0 && nextTile.isCovered() && !nextTile.isFlagged() && nextTile.probability != 1) {
                replayData.breaks[replayStep] = true;
                doBreak = true;
            }

            // see if any of the click or chord affects a non-certain safe tile
            if (nextStep.type == 3) {
                for (let i = 0; i < nextStep.touchCells.length; i = i + 5) {

                    const x = nextStep.touchCells[i];
                    const y = nextStep.touchCells[i + 1];

                    const chordTile = board.getTileXY(x, y);

                    // only check the adjacent tiles, the others are the result of zeros being found
                    if (!nextTile.isAdjacent(chordTile)) {
                        continue;
                    }

                    if (chordTile.isCovered() && !chordTile.isFlagged() && chordTile.probability != 1) {
                        replayData.breaks[replayStep] = true;
                        doBreak = true;
                        break;
                    }
                }
            }
 
        }

        if (replayType == "1") {
            doBreak = true;
        }

        // only show the percentages if we are about to break
        window.requestAnimationFrame(() => renderHints(hints, other, doBreak));

        if (replayStep != size) {
            const nextStep = replayData.replay[replayStep];
            showNextStep(nextStep);
        }

        if (doBreak) {
            break;
        }

    }

    const totalTime = replayData.replay[replayStep - 1].time;
    let clickTime = 0;

    if (replayStep != size) {
        //totalTime = replayData.replay[replayStep - 1].time;
        const prevStep = replayData.replay[replayStep];
        clickTime = prevStep.time - totalTime;

    }

    if (replayStep != 0) {
        prefixMessage("Total time: " + showDuration(totalTime) + ", Next move thinking time: " + showDuration(clickTime));
    }

    replaying = false;
 
}

async function replayBackward(replayType) {

    if (replaying) {
        console.log("Replay is already in progress")
        return;
    }

    const size = replayData.replay.length;
    replayInterrupt = false;

    if (replayStep == 0) {
        console.log("Replay can't move before the start")
        return;
    }

    replaying = true;

    while (replayStep != 0) {

        if (replayType == "S") {
            showMessage("Backwards to step " + replayStep + " of " + size);
            await sleep(1);
        }

        // clear the hints overlay
        window.requestAnimationFrame(() => renderHints([], []));

        const step = replayData.replay[replayStep - 1];

        const tiles = [];

        if (step.type == 0 || step.type == 3) {

            let unGameBlasted = false;
            for (let i = 0; i < step.touchCells.length; i = i + 5) {

                const x = step.touchCells[i];
                const y = step.touchCells[i + 1];
                const value = step.touchCells[i + 2];

                const tile = board.getTileXY(x, y);

                if (tile == null) {
                    console.log("Unable to find tile (" + x + "," + y + ")");
                    continue;
                } else {
                    //console.log("Tile (" + tile.getX() + "," + tile.getY() + ") to value " + value);
                }

                if (value < 9) {    // reveal value on tile
                    tile.setCovered(true);
                    tiles.push(tile);

                } else if (value == 10) {  // add or remove flag

                    if (unGameBlasted) {
                        tile.setBomb(false);

                    } else {
                        tile.toggleFlag();
                        if (tile.isFlagged()) {
                            board.bombs_left--;
                        } else {
                            board.bombs_left++;
                        }
                    }

                    tiles.push(tile);

                } else if (value == 11) {  // a tile which is a mine and is the cause of losing the game
                    unGameBlasted = true;   // Any flagging after this is actually showing a mine
                    tile.setBomb(false);
                    tile.exploded = false;
                    tiles.push(tile);

                } else if (value == 12) {  // a tile which is flagged but shouldn't be - occurs at the end of the replay
                    board.bombs_left--;
                    tile.setBomb(null);
                    tiles.push(tile);

                } else {
                    console.log(tile.asText() + " Replay value '" + value + "' is not recognised");
                }

            }

        } else if (step.type == 1) {
            const x = step.x;
            const y = step.y;

            const tile = board.getTileXY(x, y);

            if (tile == null) {
                console.log("Unable to find tile (" + x + "," + y + ")");
                continue;
            }

            tile.toggleFlag();
            if (tile.isFlagged()) {
                board.bombs_left--;
            } else {
                board.bombs_left++;
            }
            tiles.push(tile);

        }
        // update the graphical board

        window.requestAnimationFrame(() => renderTiles(tiles));
        window.requestAnimationFrame(() => updateMineCount(board.bombs_left));

        replayStep--;

        if (replayData.breaks[replayStep] || replayType == "1" || replayInterrupt) {

            // run the solver
            const options = {};

            if (docPlayStyle.value == "flag") {
                options.playStyle = PLAY_STYLE_FLAGS;
            } else if (docPlayStyle.value == "noflag") {
                options.playStyle = PLAY_STYLE_NOFLAGS;
            } else if (docPlayStyle.value == "eff") {
                options.playStyle = PLAY_STYLE_EFFICIENCY;
            } else {
                options.playStyle = PLAY_STYLE_NOFLAGS_EFFICIENCY;
            }

            options.fullProbability = true;
            options.advancedGuessing = false;
            options.verbose = false;

            let hints;
            let other;

            board.resetForAnalysis(false, true);
 
            const solve = await solver(board, options);  // look for solutions
            hints = solve.actions;
            other = solve.other;

            window.requestAnimationFrame(() => renderHints(hints, other, true));

            // determine the next tile to be clicked
            const nextStep = replayData.replay[replayStep];
            showNextStep(nextStep);

            break;
        }

    }

    let totalTime = 0;
    let clickTime = 0;

    if (replayStep != 0) {
        totalTime = replayData.replay[replayStep - 1].time;

        const prevStep = replayData.replay[replayStep];
        clickTime = prevStep.time - totalTime;
    }

    if (replayStep != 0) {
        prefixMessage("Total time: " + showDuration(totalTime) + ", Next move thinking time: " + showDuration(clickTime));
    } else {
        showMessage("");
    }

    replaying = false;

}

function showNextStep(step) {

    const x = step.x;
    const y = step.y;
    const type = step.type;

    const nextTile = board.getTileXY(x, y);
    window.requestAnimationFrame(() => renderBorder([nextTile], (type == 1)));

}

function showDuration(milliseconds) {

    let work = milliseconds;
    const mins = Math.floor(work / 60000);

    work = work - mins * 60000;
    const secs = work / 1000;

    if (mins > 0) {
        if (secs < 10) {
            return mins + ":0" + secs.toFixed(3);
        } else {
            return mins + ":" + secs.toFixed(3);
        }
       
    } else {
        return secs.toFixed(3);
    }

}

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

async function doAnalysis() {

    if (canvasLocked) {
        console.log("Already analysing... request rejected");
        return;
    } else {
        console.log("Doing analysis");
        canvasLocked = true;
    }

    /*
    //console.log(docAnalysisParm.value);
    let compressed = "";
    if (docAnalysisParm.value == "full") {
        compressed = board.getCompressedData(false);
    } else if (docAnalysisParm.value == "reduced") {
        compressed = board.getCompressedData(true);
    }
    //new Compressor().decompress(compressed.substr(8));
 
    if (compressed.length < 2000) {
        setURLParms("analysis", compressed);
    }
    */

    // put out a message and wait long enough for the ui to update
    showMessage("Analysing...");
    await sleep(1);

    // this will set all the obvious mines which makes the solution counter a lot more efficient on very large boards
    if (analysisMode) {
        const flagIsMine = document.getElementById("flagIsMine").checked;
        board.resetForAnalysis(!replayMode && flagIsMine, true);  // in replay mode don't treat flags as mines
    }
 
    const solutionCounter = solver.countSolutions(board);

    if (solutionCounter.finalSolutionsCount != 0) {

         const options = {};
        if (docPlayStyle.value == "flag") {
            options.playStyle = PLAY_STYLE_FLAGS;
        } else if (docPlayStyle.value == "noflag") {
            options.playStyle = PLAY_STYLE_NOFLAGS;
        } else if (docPlayStyle.value == "eff") {
            options.playStyle = PLAY_STYLE_EFFICIENCY;
        } else {
            options.playStyle = PLAY_STYLE_NOFLAGS_EFFICIENCY; 
        } 

        if (docOverlay.value != "none") {
            options.fullProbability = true;
        } else {
            options.fullProbability = false;
        }

        options.guessPruning = guessAnalysisPruning;
        options.fullBFDA = true;

        const solve = await solver(board, options);  // look for solutions
        const hints = solve.actions;

        justPressedAnalyse = true;

        window.requestAnimationFrame(() => renderHints(hints, solve.other));

        // show the next tile to be clicked if in replay mode
        if (analysisMode && replayMode) {
            const nextStep = replayData.replay[replayStep];
            showNextStep(nextStep);
        }
 
    } else {
        showMessage("The board is in an invalid state");
        window.requestAnimationFrame(() => renderHints([], []));
    }

    // by delaying removing the logical lock we absorb any secondary clicking of the button / hot key
    setTimeout(function () { canvasLocked = false; }, 200);
    //canvasLocked = false;

}

async function checkBoard() {

    if (canvasLocked) {
        console.log("Not checking the board because analysis is being done");
    }

    // this will set all the obvious mines which makes the solution counter a lot more efficient on very large boards
    //board.resetForAnalysis(true, true);
 
    const currentBoardHash = board.getHashValue();

    if (currentBoardHash == previousBoardHash) {
        return;
    } 

    previousBoardHash = currentBoardHash;

    // build the analysis URL Query string
    placeAnalysisQuery();

    // only check the board in analysis mode
    if (!analysisMode || replayMode) {
        return;
    }

    // lock the canvas while we check the board
    canvasLocked = true;

    window.requestAnimationFrame(() => renderHints([], []));

    console.log("Checking board with hash " + currentBoardHash);

    // this will set all the obvious mines which makes the solution counter a lot more efficient on very large boards
    const badTile = board.resetForAnalysis(true, true);
    if (badTile != null) {
        analysisButton.disabled = true;
        showMessage("The board is in an invalid state. Tile " + badTile.asText() + " is invalid.");
        canvasLocked = false;
        return;
    }

    const solutionCounter = solver.countSolutions(board);
    board.resetForAnalysis(true, false);

    if (solutionCounter.finalSolutionsCount != 0) {
        analysisButton.disabled = false;
        //showMessage("The board has" + solutionCounter.finalSolutionsCount + " possible solutions");
        let logicText;
        if (solutionCounter.clearCount != 0) {
            logicText = "There are safe tile(s). ";
        } else {
            logicText = "There are no safe tiles. ";
        }

        showMessage("The board is valid. " + board.getFlagsPlaced() + " Mines placed. " + logicText + formatSolutions(solutionCounter.finalSolutionsCount));
        
    } else {
        let msg = "";
        if (solutionCounter.invalidReasons.length > 0) {
            msg = solutionCounter.invalidReasons[0];
        }
        analysisButton.disabled = true;
        //showMessage("The board is in an invalid state. " + msg + " " + board.getFlagsPlaced() + " Mines placed. ");
        showMessage("The board is in an invalid state. " + msg);
    }

    canvasLocked = false;
}

function placeAnalysisQuery() {

    let compressed = null;
    if (urlQueryString.checked) {
        compressed = board.getSimpleCompressedData();
    } else {
        compressed = null;
    }

    if (previousAnalysisQuery != compressed) {
        setURLParms("analysis", compressed);
        previousAnalysisQuery = compressed;
    }

}

// draw a tile to the canvas
function draw(x, y, tileType) {

    //console.log('Drawing image...');

    if (tileType == BOMB || tileType == SKULL) {
        ctx.drawImage(images[0], x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);  // before we draw the bomb depress the square
    }

    ctx.drawImage(images[tileType], x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

}

// have the tooltip follow the mouse
function followCursor(e) {

    //console.log("Follow cursor, touch event? " + e.sourceCapabilities.firesTouchEvents);

    // if we got here from a touch event then don't do tool tip
    if (supportsInputDeviceCapabilities && e.sourceCapabilities.firesTouchEvents) {
        tooltip.innerText = "";
        return;
    }

    // get the tile we're over
    const row = Math.floor(e.offsetY / TILE_SIZE);
    const col = Math.floor(e.offsetX / TILE_SIZE);
    hoverTile = board.getTileXY(col, row);

    // if not showing hints don't show tooltip
    if (!showHintsCheckBox.checked && !analysisMode && !justPressedAnalyse) {
        tooltip.innerText = "";
        return;
    }

    //console.log("Following cursor at X=" + e.offsetX + ", Y=" + e.offsetY);

    if (isExpanded) {
        tooltip.style.left = (TILE_SIZE + e.clientX - 20) + 'px';
        tooltip.style.top = (e.clientY - TILE_SIZE * 1.5 - 5) + 'px';
    } else {
        tooltip.style.left = (TILE_SIZE + e.clientX - 190) + 'px';
        tooltip.style.top = (e.clientY - TILE_SIZE * 1.5 - 70) + 'px';
    }

    if (dragging && analysisMode) {

        const tile = hoverTile;

        if (!tile.isEqual(dragTile)) {

            dragTile = tile;  // remember the latest tile

            // not covered or flagged
            if (tile.isCovered() && !tile.isFlagged()) {
                const flagCount = board.adjacentFoundMineCount(tile);
                tile.setValue(flagCount);
            } else {
                tile.setCovered(true);
            }

            // update the graphical board
            window.requestAnimationFrame(() => renderTiles([tile]));
        }

    }

    // || hasTouchScreen)
    if (row >= board.height || row < 0 || col >= board.width || col < 0 ) {
        //console.log("outside of game boundaries!!");
        tooltip.innerText = "";
        tooltip.style.display = "none";
        return;
    } else {
        const tile = board.getTileXY(col, row);
        tooltip.innerText = tile.asText() + " " + tile.getHintText();
        tooltip.style.display = "inline-block";
    }

}

function mouseUpEvent(e) {
    if (dragging && e.which == 1) {
        console.log("Dragging stopped due to  mouse up event");
        dragging = false;
    }
}

function on_mouseEnter(e) {

    tooltip.style.display = "inline-block";
 
}

function on_mouseLeave(e) {

    hoverTile = null;

    tooltip.style.display = "none";

    if (dragging) {
        console.log("Dragging stopped due to mouse off canvas");
        dragging = false;
    }

}

// stuff to do when we click on the board
function on_click(event) {

    //console.log("Click event at X=" + event.offsetX + ", Y=" + event.offsetY);

    if (board.isGameover()) {
        console.log("The game is over - no action to take");
        return;
    }

    if (canvasLocked) {
        console.log("The canvas is logically locked - this happens while the previous click is being processed");
        return;
    } 

    if (analysisMode && replayMode) {
        console.log("Input is locked when in Replay mode");
        return;
    }

    const row = Math.floor(event.offsetY / TILE_SIZE);
    const col = Math.floor(event.offsetX / TILE_SIZE);

    //console.log("Resolved to Col=" + col + ", row=" + row);

    let message;

    if (row >= board.height || row < 0 || col >= board.width || col < 0) {
        console.log("Click outside of game boundaries!!");
        return;

    } else if (analysisMode) {  // analysis mode

        const button = event.which

        const tile = board.getTileXY(col, row);

        let tiles = [];

        if (button == 1) {   // left mouse button

            if (tile.isFlagged()) {  // no point clicking on an tile with a flag on it
                console.log("Tile has a flag on it - no action to take");
                return;
            }

            if (!board.isStarted()) {
                 board.setStarted();
            }

            // allow for dragging and remember the tile we just changed
            dragging = true;
            dragTile = tile;

            if (tile.isCovered()) {
                const flagCount = board.adjacentFoundMineCount(tile);
                tile.setValue(flagCount);
            } else {
                tile.setCovered(true);
            }

            tiles.push(tile);

        } else if (button == 3) {  // right mouse button

            // toggle the flag and return the tiles which need to be redisplayed
            tiles = analysis_toggle_flag(tile);

            console.log("Number of bombs " + board.num_bombs + "  bombs left to find " + board.bombs_left);

        } else {
            console.log("Mouse button " + button + " ignored");
            return;
        }

        // update the graphical board
        window.requestAnimationFrame(() => renderTiles(tiles));

    } else {  // play mode
        const button = event.which

        const tile = board.getTileXY(col, row);

        if (button == 1 && !leftClickFlag) {   // left mouse button and not left click flag

            if (tile.isFlagged()) {  // no point clicking on an tile with a flag on it
                console.log("Tile has a flag on it - no action to take");
                return;
            }

            if (!board.isStarted()) {
                //message = {"id" : "new", "index" : board.xy_to_index(col, row), "action" : 1};
                board.setStarted();
            }

            //if (!tile.isCovered()) {  // no point clicking on an already uncovered tile
            //	console.log("Tile is already revealed - no action to take");
            //	return;
            //}

            if (!tile.isCovered()) {  // clicking on a revealed tile is considered chording
                if (board.canChord(tile)) {

                    // check that the tiles revealed by the chord are safe
                    if (docHardcore.checked) {

                        let uncertainChords = [];
                        let lethalChord = false;
                        for (let adjTile of board.getAdjacent(tile)) {
                            if (adjTile.isCovered() && !adjTile.isFlagged() && adjTile.getHasHint()) {
                                if (adjTile.probability == 0) {  // chording onto a certain mine
                                    lethalChord = true;
                                    break;
                                } else if (adjTile.probability != 1) {  // guessing by chording, outcome uncertain
                                    uncertainChords.push(adjTile);
                                }
                            }
                        }

                        // if it's a lethal chord then let the game end normally
                        if (!lethalChord && uncertainChords.length > 0 && board.hasSafeTile()) {
                            board.setGameLost();

                            //renderHints(board.getSafeTiles(), [], false);
                            for (let uncertainTile of uncertainChords) {
                                uncertainTile.setSkull(true);
                                //draw(uncertainTile.x, uncertainTile.y, SKULL);
                            }

                            renderTiles(uncertainChords);

                            showMessage("Hard Core: Game is lost because you guessed (by chording) when there were safe tiles!");
                            console.log("Chord is not hardcore valid");

                            return;
                        }

                    }


                    message = { "header": board.getMessageHeader(), "actions": [{ "index": board.xy_to_index(col, row), "action": 3 }] }; //chord
                } else {
                    console.log("Tile is not able to be chorded - no action to take");
                    return;
                }

            } else {

                // if playing hardcore and we click a non-certain tile when there is a certain safe tile
                // if the tile is a mine let it fail normally
                if (docHardcore.checked && tile.getHasHint() && tile.probability != 1 && tile.probability != 0 && board.hasSafeTile()) {
                    board.setGameLost();

                    //renderHints(board.getSafeTiles(), [], false);
                    tile.setSkull(true);
                    renderTiles([tile]);

                    //draw(tile.x, tile.y, SKULL);
                    showMessage("Hard Core: Game is lost because you guessed when there were safe tiles!");
                    console.log("Move is not hardcore valid");

                    return;
                }

                message = { "header": board.getMessageHeader(), "actions": [{ "index": board.xy_to_index(col, row), "action": 1 }] }; // click
            }

        } else if (button == 3 || leftClickFlag) {  // right mouse button or left click flag

            if (!tile.isCovered()) {  // no point flagging an already uncovered tile
                return;
            }

            if (!board.isStarted()) {
                console.log("Can't flag until the game has started!");
                return;
            } else {
                message = { "header": board.getMessageHeader(), "actions": [{ "index": board.xy_to_index(col, row), "action": 2 }] };
            }

        } else {
            console.log("Mouse button " + button + " ignored");
            return;
        }
    }

    // we don't need to send a message if we are drawing a board in analysis mode
    if (!analysisMode) {
        // one last check before we send the message
        if (canvasLocked) {
            console.log("The canvas is logically locked");
            return;
        } else {
            canvasLocked = true;
        }

        // remove the analysis parm when playing a game
        //setURLParms("analysis", null);

        justPressedAnalyse = false;

        sendActionsMessage(message);
    }

}

/**
 * toggle the flag and update any adjacent tiles
 * Return the tiles which need to be redisplayed
 */
function analysis_toggle_flag(tile) {

    const tiles = [];

    if (!tile.isCovered()) {
        tile.setCovered(true);
    }

    let delta;
    if (tile.isFlagged()) {
        delta = -1;
        tile.foundBomb = false;
    } else {
        delta = 1;
        tile.foundBomb = true;  // in analysis mode we believe the flags are mines
    }

    // if we have locked the mine count then adjust the bombs left 
    if (lockMineCount.checked) {
        if (delta == 1 && board.bombs_left == 0) {
            showMessage("Can't reduce mines to find to below zero whilst the mine count is locked");
            return tiles;
        }
        board.bombs_left = board.bombs_left - delta;
        window.requestAnimationFrame(() => updateMineCount(board.bombs_left));

    } else {   // otherwise adjust the total number of bombs
        const tally = board.getFlagsPlaced();
        board.num_bombs = tally + board.bombs_left + delta;
    }

    // if the adjacent tiles values are in step then keep them in step
    if (buildMode.checked) {
        const adjTiles = board.getAdjacent(tile);
        for (let i = 0; i < adjTiles.length; i++) {
            const adjTile = adjTiles[i];
            const adjFlagCount = board.adjacentFlagsPlaced(adjTile);
            if (adjTile.getValue() == adjFlagCount) {
                adjTile.setValueOnly(adjFlagCount + delta);
                tiles.push(adjTile);
            }
        }
    }


    tile.toggleFlag();
    tiles.push(tile);

    return tiles;
}


function on_mouseWheel(event) {

    // can't change tiles value when playing a game
    if (!analysisMode) {
        return;
    }

    // Can't change tiles value during replay mode
    if (analysisMode && replayMode) {
        return;
    }

    //console.log("Mousewheel event at X=" + event.offsetX + ", Y=" + event.offsetY);

    const row = Math.floor(event.offsetY / TILE_SIZE);
    const col = Math.floor(event.offsetX / TILE_SIZE);

    //console.log("Resolved to Col=" + col + ", row=" + row);

    const delta = Math.sign(event.deltaY);

    const tile = board.getTileXY(col, row);

    // can't update a value on a flagged tile
    if (tile.isFlagged()) {
        return;
    }

    const flagCount = board.adjacentFoundMineCount(tile);
    const covered = board.adjacentCoveredCount(tile);

    //console.log("flag=" + flagCount + ", Covered=" + covered);

    let newValue;
    if (tile.isCovered()) {
        newValue = flagCount;
    } else {
        newValue = tile.getValue() + delta;
    }
 
    if (newValue < flagCount) {
        newValue = flagCount + covered;
    } else if (newValue > flagCount + covered) {
        newValue = flagCount;
    }

    tile.setValue(newValue);

     // update the graphical board
    window.requestAnimationFrame(() => renderTiles([tile]));

}

function on_mouseWheel_minesLeft(event) {

    // Can't change the number of mines left when playing a game
    if (!analysisMode) {
        return;
    }

    // Can't change the number of mines left during replay mode
    if (analysisMode && replayMode) {
        return;
    }

    //console.log("Mousewheel event at X=" + event.offsetX + ", Y=" + event.offsetY);

    const delta = Math.sign(event.deltaY);

    const digit = Math.floor(event.offsetX / DIGIT_WIDTH);

    //console.log("Mousewheel event at X=" + event.offsetX + ", Y=" + event.offsetY + ", digit=" + digit);

    let newCount = board.bombs_left;

    const digits = getDigitCount(newCount);

    if (digit == digits - 1) {
        newCount = newCount + delta; 
    } else if (digit == digits - 2) {
        newCount = newCount + delta * 10;
    } else {
        newCount = newCount + delta * 10;
    }

    const flagsPlaced = board.getFlagsPlaced();

    if (newCount < 0) {
        board.bombs_left = 0;
        board.num_bombs = flagsPlaced;
    } else if (newCount > 9999) {
        board.bombs_left = 9999;
        board.num_bombs = 9999 + flagsPlaced;
    } else {
        board.bombs_left = newCount;
        board.num_bombs = newCount + flagsPlaced;
    }

    window.requestAnimationFrame(() => updateMineCount(board.bombs_left));

}

// reads a file dropped onto the top of the minesweeper board
async function dropHandler(ev) {
    console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();

    if (ev.dataTransfer.items) {
        console.log("Using Items Data Transfer interface");
        // Use DataTransferItemList interface to access the file(s)
        for (let i = 0; i < ev.dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (ev.dataTransfer.items[i].kind === 'file') {
                const file = ev.dataTransfer.items[i].getAsFile();
                console.log('... file[' + i + '].name = ' + file.name);

                if (file.name.endsWith(".mbf") || file.name.endsWith(".abf")) {
                    if (!analysisMode) {
                        newGameFromBlob(file);
                        break; // only process the first one
                    }
                } else if (file.name.endsWith(".msor")) {
                    loadReplayData(file);
                    break;
                } else { 
                    newBoardFromFile(file);
                    break; // only process the first one
                }
  
            }
        }
    } else {
        // Use DataTransfer interface to access the file(s)
        console.log("File Transfer Interface not supported");
        for (let i = 0; i < ev.dataTransfer.files.length; i++) {
            console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
        }
    }
}

// Prevent default behavior (Prevent file from being opened)
function dragOverHandler(ev) {
    //console.log('File(s) in drop zone');
    ev.preventDefault();
}

function buildMessageFromActions(actions, safeOnly) {

    const message = { "header": board.getMessageHeader(), "actions": [] };

    for (let i = 0; i < actions.length; i++) {

        const action = actions[i];

        if (action.action == ACTION_CHORD) {
            message.actions.push({ "index": board.xy_to_index(action.x, action.y), "action": 3 });

        } else if (action.prob == 0) {   // zero safe probability == mine
            message.actions.push({ "index": board.xy_to_index(action.x, action.y), "action": 2 });

        } else {   // otherwise we're trying to clear
            if (!safeOnly || safeOnly && action.prob == 1) {
                message.actions.push({ "index": board.xy_to_index(action.x, action.y), "action": 1 });
            }
        }
    }

    return message;

}


// send a JSON message to the server describing what action the user made
async function sendActionsMessage(message) {

    const solverStart = Date.now();

    const outbound = JSON.stringify(message);

    console.log("==> " + outbound);

    // either play locally or send to server
    let reply;
    if (PLAY_CLIENT_SIDE) {
        reply = await handleActions(message);
    } else {
        const json_data = await fetch("/data", {
            method: "POST",
            body: outbound,
            headers: new Headers({
                "Content-Type": "application/json"
            })
        });

        reply = await json_data.json();
    }

    console.log("<== " + JSON.stringify(reply));
    //console.log(reply.header);

    if (board.id != reply.header.id) {
        console.log("Game when message sent " + reply.header.id + " game now " + board.id + " ignoring reply");
        canvasLocked = false;
        return;
    }

    if (board.seed == 0) {
        board.seed = reply.header.seed;
        console.log("Setting game seed to " + reply.header.seed);
        seedText.value = board.seed;
        if (board.num_bombs != reply.header.mines) {
            console.log("Number of mines changed from  " + board.num_bombs + " to " + reply.header.mines);
            board.num_bombs = reply.header.mines;
            board.bombs_left = board.num_bombs;
        }
    }

    if (reply.header.status == "lost") { 
        document.getElementById("canvas").style.cursor = "default";
        board.setGameLost();
    } else if (reply.header.status == "won") {
        document.getElementById("canvas").style.cursor = "default";
        board.setGameWon();
    } 

    if (reply.tiles.length == 0) {
        showMessage("Unable to continue");
        document.getElementById("canvas").style.cursor = "default";
        canvasLocked = false;
        return;
    }

    // add the hyperlink the hyperlink
    if (reply.header.url != null) {
        //showDownloadLink(true, reply.header.url);
    }
 
    // translate the message and redraw the board
    const tiles = [];
    const prevMineCounter = board.bombs_left;

    // apply the changes to the logical board
    for (let i = 0; i < reply.tiles.length; i++) {

        const target = reply.tiles[i];

        const index = target.index;
        const action = target.action;

        const tile = board.getTile(index);

        if (action == 1) {    // reveal value on tile
            tile.setValue(target.value);
            tiles.push(tile);

        } else if (action == 2) {  // add or remove flag
            if (target.flag != tile.isFlagged()) {
                tile.toggleFlag();
                if (tile.isFlagged()) {
                    board.bombs_left--;
                } else {
                    board.bombs_left++;
                }
                tiles.push(tile);
            }

        } else if (action == 3) {  // a tile which is a mine (these get returned when the game is lost)
            board.setGameLost();
            tile.setBomb(true);
            tiles.push(tile);

        } else if (action == 4) {  // a tile which is a mine and is the cause of losing the game
            board.setGameLost();
            tile.setBombExploded();
            tiles.push(tile);

        } else if (action == 5) {  // a which is flagged but shouldn't be
            tile.setBomb(false);
            tiles.push(tile);

        } else {
            console.log("action " + action + " is not valid");
        }

    }

    // update the mine count if a flag has changed
    if (prevMineCounter != board.bombs_left) {
        window.requestAnimationFrame(() => updateMineCount(board.bombs_left));
    }

    // update the graphical board
    window.requestAnimationFrame(() => renderTiles(tiles));

    if (board.isGameover()) {
        console.log("Game is over according to the server");
        canvasLocked = false;
        window.requestAnimationFrame(() => renderHints([], []));  // clear the hints overlay

        const value3BV = reply.header.value3BV;
        const solved3BV = reply.header.solved3BV;
        const actionsMade = reply.header.actions;

        let efficiency;
        if (reply.header.status == "won") {
            efficiency = (100 * value3BV / actionsMade).toFixed(2) + "%";
        } else {
            efficiency = (100 * solved3BV / actionsMade).toFixed(2) + "%";
        }

        showMessage("The game has been " + reply.header.status + ". 3BV: " + solved3BV + "/" + value3BV + ",  Actions: " + actionsMade + ",  Efficiency: " + efficiency);
        return;
    }

    //const solverStart = Date.now();

    let assistedPlay = docFastPlay.checked;
    let assistedPlayHints;
    if (assistedPlay) {
        assistedPlayHints = board.findAutoMove();
        if (assistedPlayHints.length == 0) {
            assistedPlay = false;
        }
    } else {
        assistedPlayHints = [];
    }

    // do we want to show hints
    if (showHintsCheckBox.checked || autoPlayCheckBox.checked || assistedPlayHints.length != 0 || docOverlay.value != "none" || docHardcore.checked) {

        document.getElementById("canvas").style.cursor = "wait";

        const options = {};
        if (docPlayStyle.value == "flag") {
            options.playStyle = PLAY_STYLE_FLAGS;
        } else if (docPlayStyle.value == "noflag") {
            options.playStyle = PLAY_STYLE_NOFLAGS;
        } else if (docPlayStyle.value == "eff") {
            options.playStyle = PLAY_STYLE_EFFICIENCY;
        } else {
            options.playStyle = PLAY_STYLE_NOFLAGS_EFFICIENCY;
        } 

        if (docOverlay.value != "none" || docHardcore.checked) {
            options.fullProbability = true;
        } else {
            options.fullProbability = false;
        }

        let hints;
        let other;
        if (assistedPlay) {
            hints = assistedPlayHints;
            other = [];
        } else {
            const solve = await solver(board, options);  // look for solutions
            hints = solve.actions;
            other = solve.other;
        }

        const solverDuration = Date.now() - solverStart;

        if (board.id != reply.header.id) {
            console.log("Game when Solver started " + reply.header.id + " game now " + board.id + " ignoring solver results");
            canvasLocked = false;
            return;
        }

        //console.log("Rendering " + hints.length + " hints");
        //setTimeout(function () { window.requestAnimationFrame(() => renderHints(hints)) }, 10);  // wait 10 milliseconds to prevent a clash with the renderTiles redraw

        // only show the hints if the hint box is checked
        if (showHintsCheckBox.checked) {
            window.requestAnimationFrame(() => renderHints(hints, other));
        } else {
            window.requestAnimationFrame(() => renderHints([], []));  // clear the hints overlay
            showMessage("Press the 'Analyse' button to see the solver's suggested move.");
        }

        if (autoPlayCheckBox.checked || assistedPlay) {
            if (hints.length > 0 && (hints[0].prob == 1 || hints[0].prob == 0)) {
                const message = buildMessageFromActions(hints, true);  // send all safe actions

                const wait = Math.max(0, (CYCLE_DELAY - solverDuration));

                setTimeout(function () { sendActionsMessage(message) }, wait);

            } else if (hints.length > 0 && acceptGuessesCheckBox.checked) { // if we are accepting guesses

                //const hint = [];
                //hint.push(hints[0]);

                const message = buildMessageFromActions([hints[0]], false); // if we are guessing send only the first guess

                const wait = Math.max(0, (CYCLE_DELAY - solverDuration));

                setTimeout(function () { sendActionsMessage(message) }, wait);

            } else {
                document.getElementById("canvas").style.cursor = "default";
                canvasLocked = false;
            }
        } else {
            document.getElementById("canvas").style.cursor = "default";
            canvasLocked = false;
         }

    } else {
        canvasLocked = false;
        window.requestAnimationFrame(() => renderHints([], []));  // clear the hints overlay
        document.getElementById("canvas").style.cursor = "default";
        showMessage("The solver is not running. Press the 'Analyse' button to see the solver's suggested move.");
    }
 
    return reply;

}

// send a JSON message to the server asking it to kill the game
async function callKillGame(id) {

    const message = { "id": id };

    const outbound = JSON.stringify(message);
    console.log("==> " + outbound);

    // either client side or server side
    let reply;
    if (PLAY_CLIENT_SIDE) {
        reply = killGame(message);   
    } else {
        const json_data = await fetch("/kill", {
            method: "POST",
            body: outbound,
            headers: new Headers({
                "Content-Type": "application/json"
            })
        });
        reply = await json_data.json();
    }

    console.log("<== " + JSON.stringify(reply));

}

// generic function to make a div dragable (https://www.w3schools.com/howto/howto_js_draggable.asp)
function dragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "Header")) {
        // if present, the header is where you move the DIV from:
        document.getElementById(elmnt.id + "Header").onmousedown = dragMouseDown;
    } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        //e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        //console.log("Pos3=" + pos3 + ", Pos4=" + pos4);
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        //e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        //console.log("Pos1=" + pos1 + ", Pos2=" + pos2);
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2 - 25) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1 - 5) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// load an image 
function load_image(image_path) {
    const image = new Image();
    image.addEventListener('load', function () {

        console.log("An image has loaded: " + image_path);
        imagesLoaded++;
        if (imagesLoaded == images.length + led_images.length) {
            startup();
        }

    }, false);
    image.src = image_path;
    return image;
}

function load_images() {

    console.log('Loading images...');

    for (let i = 0; i <= 8; i++) {
        const file_path = "resources/images/" + i.toString() + ".png";
        images.push(load_image(file_path));
        const led_path = "resources/images/led" + i.toString() + ".svg";
        led_images.push(load_image(led_path));
    }

    led_images.push(load_image("resources/images/led9.svg"));

    images.push(load_image("resources/images/bomb.png"));
    images.push(load_image("resources/images/facingDown.png"));
    images.push(load_image("resources/images/flagged.png"));
    images.push(load_image("resources/images/flaggedWrong.png"));
    images.push(load_image("resources/images/exploded.png"));
    images.push(load_image("resources/images/skull.png"));

    console.log(images.length + ' Images Loaded');

}

function setURLParms(parm, value) {

    if (value == null || value == "") {
        urlParams.delete(parm);
    } else {
        urlParams.set(parm, value);
    }
   
    window.history.replaceState(null, null, "index.html?" + urlParams.toString());
}

function showMessage(text) {
    messageLine.innerHTML = text;
    messageLineBottom.innerHTML = text;
}

function prefixMessage(text) {
    if (messageLine.innerHTML != "") {
        showMessage(text + " - " + messageLine.innerHTML);
    } else {
        showMessage(text);
    }
    
}

"use strict";

class PrimeSieve {


	constructor(n) {

		if (n < 2) {
			this.max = 2;
		} else {
			this.max = n;
		}

		this.composite = Array(this.max).fill(false);

		const rootN = Math.floor(Math.sqrt(n));

		for (let i = 2; i < rootN; i++) {

			// if this is a prime number (not composite) then sieve the array
			if (!this.composite[i]) {
				let index = i + i;
				while (index <= this.max) {
					this.composite[index] = true;
					index = index + i;
				}
			}
		}

	}
	
	isPrime(n) {
		if (n <= 1 || n > this.max) {
			throw new Error("Prime check is outside of range: " + n);
		}

		return !this.composite[n];
	}
 	
}

"use strict";

class Binomial {

	constructor(max, lookup) {

		const start = Date.now();

		this.max = max;

		this.ps = new PrimeSieve(this.max);

		if (lookup < 10) {
			lookup = 10;
		}
		this.lookupLimit = lookup;

		const lookup2 = lookup / 2;

		this.binomialLookup = Array(lookup + 1);

		for (let total = 1; total <= lookup; total++) {

			this.binomialLookup[total] = Array(lookup2 + 1);

			for (let choose = 0; choose <= total / 2; choose++) {
				this.binomialLookup[total][choose] = this.generate(choose, total);
			}
		}

		console.log("Binomial coefficients look-up generated up to " + lookup + ", on demand up to " + max);
		console.log("Processing took " + (Date.now() - start) + " milliseconds");
	}


	generate(k, n) {

		if (n == 0 && k == 0) {
			return BigInt(1);
		}

		if (n < 1 || n > this.max) {
			throw new Error("Binomial: 1 <= n and n <= max required, but n was " + n + " and max was " + this.max);
		}

		if (0 > k || k > n) {
			console.log("Binomial: 0 <= k and k <= n required, but n was " + n + " and k was " + k);
			throw new Error("Binomial: 0 <= k and k <= n required, but n was " + n + " and k was " + k);
		}

		var choose = Math.min(k, n - k);

		var answer;
		if (n <= this.lookupLimit) {
			answer = this.binomialLookup[n][choose];
		}

		if (answer != null) {
			return answer;
		} else if (choose < 25) {
			return this.combination(choose, n);
		} else {
			return this.combinationLarge(choose, n);
		}

	}
	
    combination(mines, squares) {

		let top = BigInt(1);
		let bot = BigInt(1);

		const range = Math.min(mines, squares - mines);

		// calculate the combination. 
		for (let i = 0; i < range; i++) {
			top = top * BigInt(squares - i);
			bot = bot* BigInt(i + 1);
		}

		const result = top / bot;

		return result;

	}    
	
	
	combinationLarge(k, n) {

		if ((k == 0) || (k == n)) return BigInt(1);

		const n2 = n / 2;

		if (k > n2) {
			k = n - k;
		}

		const nk = n - k;

		const rootN = Math.floor(Math.sqrt(n));

		let result = BigInt(1);

		for (let prime = 2; prime <= n; prime++) {

			// we only want the primes
			if (!this.ps.isPrime(prime)) {
				continue;
            }

			if (prime > nk) {
				result = result * BigInt(prime);
				continue;
			}

			if (prime > n2) {
				continue;
			}

			if (prime > rootN) {
				if (n % prime < k % prime) {
					result = result * BigInt(prime);
				}
				continue;
			}

			let r = 0;
			let N = n;
			let K = k;
			let p = 1;

			let safety = 100;
			while (N > 0) {
				r = (N % prime) < (K % prime + r) ? 1 : 0;
				if (r == 1) {
					p *= prime;
				}
				N = Math.floor( N / prime);
				K = Math.floor( K / prime);
				//console.log("r=" + r + " N=" + N + " k=" + k + " p=" + p);
				safety--;
				if (safety < 1) {
					console.log("Safety stop!!!");
					break;
                }
			}
			if (p > 1) {
				result = result * BigInt(p);
			}
		}

		return result;
	}

}

