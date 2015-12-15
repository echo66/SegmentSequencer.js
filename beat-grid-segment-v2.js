function BeatGridSegment(params) {
	/* params: { beatGrid, audioBuffer, audioId, startBeat, endBeat } */

	var _id;
	var _buffer, _bufferId;
	var _startBeat, _endBeat;
	var _bufferStart, _bufferEnd;

	var _bufferCursor, _beatCursor;


	this.retrieve_frame = function(arrayL, arrayR, startOffset, frameSize, hopSize) {
		var numRead = Math.min(this.bufferEnd - this.bufferCursor, frameSize);

		arrayL.set(this.audioBuffer.getChannelData(0).subarray(this.bufferCursor, Math.min(this.bufferCursor + frameSize, this.bufferEnd)), startOffset);
		arrayR.set(this.audioBuffer.getChannelData(1).subarray(this.bufferCursor, Math.min(this.bufferCursor + frameSize, this.bufferEnd)), startOffset);

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

		return { numRead : numRead, bpm : accBpm };
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
			set: function(v) {
				_startBeat = v;
			}
		}, 
		'endBeat' : {
			get: function() {
				return _endBeat;
			}, 
			set: function(v) {
				_endBeat = v;
			}
		},
		'durationBeats' : {
			get: function() {

			},
			set: function(v) {

			}
		},
		'bufferStart' : {
			get: function() {
				return Math.round(_bufferStart || (_bpmTimeline.time(this.startBeat) * 44100));
			}, 
			set: function(v) {
				if (_id != undefined)
					_bufferStart = v;
			}
		},
		'bufferEnd' : {
			get: function() {
				return Math.round(_bufferEnd || (_bpmTimeline.time(this.endBeat) * 44100) || Number.MAX_VALUE);
			}, 
			set: function(v) {
				if (_id != undefined)
					_bufferEnd = v;
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