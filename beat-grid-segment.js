function BeatGridSegment(params) {
	// params: { id, audioBuffer, beatGrid, startOnBeatGrid, startBeat, durationBeats }

	if (params.beatGrid.length < 2) {
		throw {
			message: "Beat grid size must be equal or larger than 2.", 
			value: params.beatGrid
		};
		return;
	}

	var _id = params.id;

	var _startBeat = params.startBeat;
	var _durationBeats = params.durationBeats;

	var _buffer = params.audioBuffer;

	var _beatGrid = params.beatGrid;
	var _beatGridB0 = params.startOnBeatGrid;
	var _beatGridB1 = _beatGridB0 + (_endBeat - _startBeat);
	
	var _bufferCursor = this.bufferStart;
	var _beatCursor = _beatGridB0;


	var get_buffer_time = function(beat) {
		if (beat < 0 || beat >= _beatGrid.length) {
			throw new OutOfBoundsException('beat grid', _beatGrid, 'beat', beat);
		} else {
			var lowerBeat 	= Math.floor(beat);
			var upperBeat 	= Math.ceil(beat);
			var bufStart  	= Math.round(_beatGrid[lowerBeat] * _buffer.sampleRate);
			var bufEnd    	= Math.min(_buffer.length, Math.round(_beatGrid[upperBeat] * _buffer.sampleRate));
			var difBeats  	= upperBeat - lowerBeat;
			if (difBeats == 0) {
				return bufStart;
			} else {
				var coef 		= (upperBeat - beat) / difBeats;
				var bufTime 	= bufStart + coef * (bufEnd - bufStart);
				return bufTime;
			}
		}
	}

	var get_beat_time = function(bufferPosition) {
		if (bufferPosition < 0 || bufferPosition > _buffer.length) {
			throw new OutOfBoundsException('buffer', _buffer, 'buffer position', bufferPosition);
		} else {
			var idx = find_index(_beatGrid, bufferPosition / _buffer.sampleRate, function(a, b) { return a - b; });
			if (idx.length == 2) {
				if (idx[0] == undefined || idx[1] == undefined) {
					throw new OutOfBoundsException('beat grid', _beatGrid, 'buffer position', bufferPosition);
				} else {
					var lowerBeat = idx[0];
					var upperBeat = idx[1];
					var bufStart = Math.round(_beatGrid[lowerBeat] * _buffer.sampleRate);
					var bufEnd = Math.round(_beatGrid[upperBeat] * _buffer.sampleRate);
					var difBuf = (bufEnd - bufStart);
					var difBeats = 1;
					var coef = (bufEnd - bufferPosition) / difBuf;
					var beatTime = lowerBeat + coef * difBeats;
					return beatTime;
				}
			} else {
				idx = idx[0];
				return idx;
			}
		}
	}


	this.clone = function() {
		return new BeatGridSegment({
			id: _id, 
			audioBuffer: _buffer, 
			beatGrid: _beatGrid, 
			startOnBeatGrid: _beatGridB0, 
			startBeat: _startBeat, 
			durationBeats: _endBeat, 
		});
	}


	this.retrieve_frame = function(arrayL, arrayR, startOffset, frameSize, hopSize) {

		arrayL.set(this.audioBuffer.getChannelData(0).subarray(this.bufferCursor, this.bufferCursor + frameSize), startOffset);
		arrayR.set(this.audioBuffer.getChannelData(1).subarray(this.bufferCursor, this.bufferCursor + frameSize), startOffset);

		var numRead = Math.min(this.bufferEnd-this.bufferCursor, frameSize);

		var startRead = this.bufferCursor;
		var endRead = this.bufferCursor + numRead;

		/* Calculate the overall BPM for the extracted frame. */
		var b = _beatCursor;
		var accBpm = 0;
		while (startRead < endRead) {
			var delta = _beatGrid[b] - _beatGrid[b+1];
			var coef = (Math.min(_beatGrid[b+1] * this.buffer.sampleRate, endRead) - startRead) / numRead;
			startRead = Math.round(_beatGrid[b++] * this.buffer.sampleRate);
			accBpm += coef * (60 / (_beatGrid[b+1] - _beatGrid[b]));
		}

		this.bufferCursor = Math.min(this.bufferCursor + (hopSize || 0), this.bufferEnd);

		/* Updates the beat cursor according to the current buffer cursor. */
		for (var b=_beatCursor; b < b.length; b++) {
			if (_beatGrid[b] * this.buffer.sampleRate > this.bufferCursor) {
				_beatCursor = b - 1;
				break;
			}
		}

		return {
			numRead : numRead, 
			bpm : accBpm
		};
		
	}

	this.overlap_at_start = function(newStartBeat) {
		// TODO
		var newStartBeat = newSegment.endBeat;
		oldSegment.startBeat = newStartBeat;

		var oldEndBeat   = oldSegment.endBeat;
		var oldStartBeat = oldSegment.startBeat;
		var oldBufStart  = oldSegment.bufferStart;
		var oldBufEnd    = oldSegment.bufferEnd;
		var coef = (oldEndBeat - newStartBeat) / (oldEndBeat - oldStartBeat);
		var newBufStart = oldBufEnd - (oldBufEnd - oldBufStart) * coef ;

		oldSegment.bufferStart  = newBufStart;
	}

	this.overlap_at_end = function(newEndBeat) {
		// TODO
	}

	this.slice = function(cutTime) {
		// cutTime is a beat value and the origin is the one of the Segment Sequencer.
		// TODO: criar outro segmento e tratar dos markers.
		var copy = this.clone();

		return copy;
	}


	this.reset_cursor = function() {
		this.bufferCursor = this.bufferStart;
	}


	Object.defineProperties(this, 
		'id' : {
			get : function() {
				return _id;
			}, 
			set : function(v) {
				_id = v;
			}
		}, 
		'audioBuffer' : {
			get : function() {
				return _buffer;
			}
		},
		'beatGridStartBeat' : {
			get : function() {
				return _beatGridB0;
			}, 
			set : function(v) {
				if (v < 0 || v + _durationBeats >= _beatGrid.length) {
					throw new OutOfBoundsException('buffer', _beatGrid, 'buffer position', bufferPosition);
				}
				// TODO
			}
		},
		'beatGridEndBeat' : {
			get : function() {

			}, 
			set : function(v) {

			}
		},
		'durationBeats' : { 
			get: function() {
				return _durationBeats;
			}, 
			set: function(v) {
				if (v <= 0) {
					throw {
						message: "Segment size cannot be zero or negative.", 
						value: v
					};
					return;
				}
				if (_startBeat + v >= _beatGrid.length) {
					throw {
						message: "startBeat plus durationBeats cannot be larger or equal to beatGrid size.", 
						value: _startBeat + v
					};
					return;
				}
				_durationBeats = v;

				_bufferCursor = Math.min(_bufferCursor, get_buffer_time(_beatGridB0 + _durationBeats));
			}
		},
		'startBeat': { // Reference: Segments Sequencer origin
			get: function() {
				return _startBeat;
			}, 
			set: function(v) {
				_startBeat = v;
			}
		}, 
		'endBeat' : { // Reference: Segments Sequencer origin
			get: function() {
				return _startBeat + _durationBeats;
			}, 
			set: function(v) {
				// TODO: change durationBeats.
				this.durationBeats = v - _startBeat;
			}
		},
		'bufferStart' : {
			get : function() {
				var delta = _beatGrid[Math.ceil(_beatGridB0)] - _beatGrid[Math.floor(_beatGridB0)];
				var coef = _beatGridB0 - Math.floor(_beatGridB0);
				return Math.floor((_beatGrid[Math.floor(_beatGridB0)] + coef * delta) * _buffer.sampleRate);
			}
		},
		'bufferEnd' : {
			get : function() {
				var delta = _beatGrid[Math.ceil(_beatGridB1)] - _beatGrid[Math.floor(_beatGridB1)];
				var coef  = _beatGridB1 - Math.floor(_beatGridB1);
				return Math.floor((_beatGrid[Math.floor(_beatGridB1)] + coef * delta) * _buffer.sampleRate);
			}
		},
		'bufferCursor' : {
			get: function() {
				return _bufferCursor;
			}
		},
		'beatCursor' : {
			get: function() {
				return get_beat_time(_bufferCursor);
			},
			set: function(v) {
				// TODO
			}
		}
	});


	/***************************************************************/
	/******************* BINARY SEARCH FUNCTIONS *******************/
	/***************************************************************/
	function find_index(values, target, compareFn) {
		if (values.length == 0 || compareFn(target, values[0]) < 0) { 
			return [undefined, 0]; 
		}
		if (compareFn(target, values[values.length-1]) > 0 ) {
			return [values.length-1, undefined];
		}
		return modified_binary_search(values, 0, values.length - 1, target, compareFn);
	}

	function modified_binary_search(values, start, end, target, compareFn) {
		// if the target is bigger than the last of the provided values.
		if (start > end) { return [end]; } 

		var middle = Math.floor((start + end) / 2);
		var middleValue = values[middle];

		if (compareFn(middleValue, target) < 0 && values[middle+1] && compareFn(values[middle+1], target) > 0)
			// if the target is in between the two halfs.
			return [middle, middle+1];
		else if (compareFn(middleValue, target) > 0)
			return modified_binary_search(values, start, middle-1, target, compareFn); 
		else if (compareFn(middleValue, target) < 0)
			return modified_binary_search(values, middle+1, end, target, compareFn); 
		else 
			return [middle]; //found!
	}


	/***************************************************************/

	function OutOfBoundsException(on, o, vn, v) {
		var _objName = on;
		var _valName = vn;
		var _obj = o;
		var _val = v;

		Object.defineProperties(this, {
			object : { 
				get : function() {
					return _obj;
				}
			},
			value : {
				get : function() {
					return _val;
				}
			}, 
			message : {
				get : function() {
					return "The provided " + _valName + " is out of " + _objName + " bounds. ";
				}
			}
		});
	}

}