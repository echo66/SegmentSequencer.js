function SimpleBufferSegment(params) {
	/* params: { id, audioBuffer, audioId, startBeat, endBeat, beatGrid, beatGridStartBeat } */

	var _id;
	var _buffer, _bufferId;
	var _startBeat, _endBeat;
	var _bufferStart, _bufferEnd;

	var _bufferCursor;



	this.slice = function(cutBeat) {
		if (cutBeat <= _startBeat || cutBeat >= _endBeat) {
			throw {
				message: "Invalid slice beat: the provided beat must be inbetween startBeat and endBeat. ", 
				startBeat: _startBeat, endBeat: _endBeat, cutBeat: cutBeat
			};
			return;
		}

		var copy = this.clone();

		var difBuf = this.bufferEnd - this.bufferStart;
		var coef = (cutBeat - this.startBeat) / this.durationBeats;

		this.bufferEnd = this.bufferStart + coef * difBuf;
		this.endBeat = cutBeat;

		copy.bufferStart = this.bufferEnd + 1;
		copy.startBeat = cutBeat;

		return [this, copy];
	}


	this.clone = function() {
		return new SimpleBufferSegment({
			id: _id,
			audioBuffer: _buffer, audioId: _bufferId, 
			startBeat: _startBeat, endBeat: _endBeat, 
			bufferStart: _bufferStart, bufferEnd: _bufferEnd
		});
	}


	this.hop = function(hop) {
		this.bufferCursor = Math.min(this.bufferCursor + (hop || 0), this.bufferEnd);
	}


	this.move = function(newStartBeat) {
		_startBeat = newStartBeat;
		_endBeat = newStartBeat + this.durationBeats;
	}


	this.retrieve_frame = function(arrayL, arrayR, startOffset, frameSize, hopSize) {
		var numRead = Math.min(this.bufferEnd - this.bufferCursor, frameSize);

		arrayL.set(this.audioBuffer.getChannelData(0).subarray(this.bufferCursor, this.bufferCursor + numRead), startOffset);
		arrayR.set(this.audioBuffer.getChannelData(1).subarray(this.bufferCursor, this.bufferCursor + numRead), startOffset);

		return { numRead: numRead, bpm: this.bpm };
	}


	this.reset_cursor = function() {
		this.bufferCursor = this.bufferStart;
	}


	Object.defineProperties(this, {
		'id' : {
			get: function() {
				return _id
			}, 
			set: function(v) {
				_id = v;
			}
		},
		'startBeat' : {
			get: function() {
				return _startBeat;
			}, 
			set: function(beat) {
				if (beat >= this.endBeat) {
					throw {
						message: "startBeat must be less than endBeat."
					};
					return;
				}

				var coef = (this.endBeat - beat) / (this.endBeat - this.startBeat);

				_startBeat = beat;

				this.bufferStart = this.bufferEnd - (this.bufferEnd - this.bufferStart) * coef ;
			}
		}, 
		'endBeat' : {
			get: function() {
				return _endBeat;
			}, 
			set: function(beat) {
				if (beat <= this.startBeat) {
					throw {
						message: "startBeat must be less than endBeat."
					};
					return;
				}

				var coef = (beat - this.startBeat) / (this.endBeat - this.startBeat);

				_endBeat = beat;

				this.bufferEnd = this.bufferStart + (this.bufferEnd - this.bufferStart) * coef;
			}
		},
		'durationBeats' : {
			get: function() {
				return this.endBeat - this.startBeat;
			},
			set: function(v) {
				this.endBeat = this.startBeat + v;
			}
		},
		'bufferStart' : {
			get: function() {
				return _bufferStart;
			}, 
			set: function(v) {
				_bufferStart = v;
				this.bufferCursor = this.bufferCursor;
			}
		},
		'bufferEnd' : {
			get: function() {
				return _bufferEnd;
			}, 
			set: function(v) {
				_bufferEnd = v;
				this.bufferCursor = this.bufferCursor;
			}
		},
		'bufferCursor' : {
			get: function() {
				return _bufferCursor;
			}, 
			set: function(v) {
				_bufferCursor = Math.min(this.bufferEnd, Math.max(this.bufferStart, v));
			}
		},
		'bpm' : {
			get: function() {
				return 60 * this.durationBeats / ((this.bufferEnd - this.bufferStart) / this.audioBuffer.sampleRate);
			}
		},
		'audioId' : {
			get: function() {
				return _bufferId;
			}
		},
		'audioBuffer' : {
			get: function() {
				return _buffer;
			}
		},
		'remainingSamples' : {
			get: function() {
				return this.bufferEnd - this.bufferCursor;
			}
		}
	});

	_id = params.id;
	_buffer = params.audioBuffer;
	_bufferId = params.audioId;
	_startBeat = params.startBeat;
	_endBeat = params.endBeat;
	_bufferStart = params.bufferStart;
	_bufferEnd = params.bufferEnd;

	_bufferCursor = this.bufferStart;
}