function SilenceSegment(params) {
	// params: { startBeat, endBeat || durationBeats, bpmTimeline }

	var _startBeat;
	var _endBeat;
	var _bpmTimeline;
	var _bufferCursor;


	this.slice = function(cutBeatTime) {
		var copy = this.clone();
		this.endBeat = cutBeatTime;
		copy.startBeat = cutBeatTime;
		return copy;
	}

	this.clone = function() {
		return new SilenceSegment({ startBeat: _startBeat, endBeat: _endBeat, bpmTimeline: _bpmTimeline });
	}

	this.reset_cursor = function() {
		this.bufferCursor = this.bufferStart;
	}

	this.hop = function(hop) {
		this.bufferCursor = Math.min(this.bufferCursor + (hop || 0), this.bufferEnd);
	}

	this.move = function(newStartBeat) {
		throw {
			message: "Method not implemented."
		};
	}

	this.retrieve_frame = function(arrayL, arrayR, startOffset, frameSize, hopSize) {
		var numRead = Math.min(this.bufferEnd - this.bufferCursor, frameSize);

		for (var i=0; i < numRead; i++) {
			arrayL[i] = arrayR[i] = 0;
		}

		return { numRead : numRead, bpm : undefined };
	}

	Object.defineProperties(this, {
		'startBeat' : {
			get: function() {
				return _startBeat;
			}, 
			set: function(v) {
				_startBeat = v;
				this.bufferCursor = this.bufferCursor;
			}
		}, 
		'endBeat' : {
			get: function() {
				return _endBeat;
			}, 
			set: function(v) {
				_endBeat = v;
				this.bufferCursor = this.bufferCursor;
			}
		},
		'durationBeats' : {
			get: function() {
				return this.endBeat - this.startBeat;
			}
		},
		'bufferStart' : {
			get: function() {
				return Math.round(_bpmTimeline.time(this.startBeat) * 44100);
			}
		},
		'bufferEnd' : {
			get: function() {
				return Math.round(_bpmTimeline.time(this.endBeat) * 44100) || Number.MAX_VALUE;
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
		'remainingSamples' : {
			get: function() {
				return this.bufferEnd - this.bufferCursor;
			}
		},
		'beatCursor' : {
			get: function() {
				var coef = (this.bufferEnd - this.bufferCursor) / (this.bufferEnd - this.bufferStart);
				var beatDif = (this.endBeat - this.startBeat)
				return this.endBeat - coef * beatDif;
			},
			set: function(beat) {
				if (beat < this.startBeat || beat > this.endBeat) {
					throw {
						message: "Beat out of segment bounds.",
						beat: beat
					};
					return;
				}
				var coef = (this.endBeat - beat) / (this.endBeat - this.startBeat);
				var bufferDif = (this.bufferEnd - this.bufferStart);
				this.bufferCursor = this.bufferEnd - coef * bufferDif;
			}
		}
	});

	_startBeat = params.startBeat;
	_endBeat = params.endBeat;
	_bpmTimeline = params.bpmTimeline;
	_bufferCursor = this.bufferStart;
}