function Segment(params) {

	// TODO: analisar os parâmetros para decidir qual a classe a usar.

	this.retrieve_frame = function(arrayL, arrayR, startOffset, frameSize) {
		return S.retrieve_frame(arrayL, arrayR, startOffset, frameSize);
	}


	this.hop = function(hop) {
		S.hop(hop);
	}

	this.move = function(newStartBeat) { 
		/* Expected behavior: moves both startBeat and endBeat, maintaining the beatCursor. */
		S.move(newStartBeat);
	}

	this.clone = function() {
		// TODO
	}

	/*
	 * startBeat, endBeat and beatCursor are given using the SegmentsSequencer time origin as the domain origin.
	 */
	Object.defineProperties(this, 
		'id' : {
			get : function() {
				return S.id;
			}, 
			set : function(v) {
				S.id = v;
			}
		}, 
		'audioBuffer' : {
			get : function() {
				return S.audioBuffer;
			}
		},
		'audioId' : {
			get : function() {
				return S.audioId;	
			}
		},
		'startBeat': { 
			get: function() {
				return S.startBeat;
			},
			set: function(v) { /* Expected behavior: changes the startBeat and maintains endBeat. */
				S.startBeat = v;
			}
		}, 
		'endBeat' : {
			get: function() {
				return S.endBeat;
			}, 
			set: function(v) { /* Expected behavior: changes the endBeat and maintains startBeat. */
				S.endBeat = v;
			}
		},
		'durationBeats' : {
			get: function() {
				return S.endBeat - S.startBeat;
			}
		},
		'beatCursor' : { 
			get: function() {
				return S.beatCursor;
			}
		},
		'remainingSamples' : {
			get: function() {
				return S.remainingSamples;
			}
		}
	});
}