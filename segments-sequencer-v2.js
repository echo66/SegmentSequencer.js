function SegmentsSequencer(params) {

	var bufferSampleCursor;
	var FRAME_SIZE = params.frameSize || 4096;
	var sampleRate = params.sampleRate || 44100;

	var midBufferL, midBufferR;
	var stretcherL = new OLATS(FRAME_SIZE);
	var stretcherR = new OLATS(FRAME_SIZE);

	var currentSegmentIndex = 0;
	var il = new Float32Array(FRAME_SIZE);
	var ir = new Float32Array(FRAME_SIZE);
	var zeros = new Float32Array(FRAME_SIZE);

	var audioBuffers = {};

	var currentTime = 0; // Measured in seconds.
	var bpmTimeline = params.bpmTimeline || new BPMTimeline(params.initialBPM || 120); 

	var _segments = [new SilenceSegment({startBeat: 0, endBeat: Number.MAX_VALUE, bpmTimeline: bpmTimeline})];

	this.segments = _segments;

	var anyChange = false;


	var LOOP_DATA = {
		start: undefined, 
		end: undefined, 
		startSeg: undefined, 
		endSeg: undefined, 
		isLooping: false
	}

	var _loopStart, _loopEnd, _isLooping = false; // Measured in samples.

	_reset_mid_buffers();

	function _reset_mid_buffers() {
		midBufferL = new CBuffer(Math.round(FRAME_SIZE*1.2));
		midBufferR = new CBuffer(Math.round(FRAME_SIZE*1.2));
	}


	this.set_loop = function(start, end, units) {
		if (start != undefined && end != undefined) {
			if (units == "beats") {
				_loopStart = Math.round(sampleRate * bpmTimeline.time(start));
				_loopEnd = Math.round(sampleRate * bpmTimeline.time(end));
			} else if (units == "seconds") {
				_loopStart = Math.round(sampleRate * start);
				_loopEnd = Math.round(sampleRate * end);
			} else {
				throw {
					message: "Invalid units", 
					invalidValues: {
						units: units
					}
				};
			}
			_isLooping = true;
			// this.set_current_time(this.get_current_time("seconds"), "seconds", false);
		} else {
			_loopStart = undefined;
			_loopEnd   = undefined;
			_isLooping = false;
		}
	}


	this.get_bpmTimeline = function() {
		return bpmTimeline;
	}


	// newTime: Number, units: "beats" | "seconds"
	this.set_current_time = function(newTime, units, reset) {
		_segments[currentSegmentIndex].reset_cursor();
		currentSegmentIndex = undefined;
		var idx;

		if (units == "beats") {
			currentTime = bpmTimeline.time(newTime);
		} else if (units == "seconds") {
			currentTime = newTime;
			newTime = bpmTimeline.beat(newTime);
		} else {
			
			throw {
				message: "Invalid units", 
				invalidValues: {
					units: units
				}
			};

		}

		if (_isLooping && currentTime > _loopEnd) {
			currentTime = _loopStart;
			newTime = bpmTimeline.beat(currentTime);
		}

		idx = find_index(_segments, {startBeat: newTime}, function(a,b) { return a.startBeat - b.startBeat; });

		if (reset) {
			stretcherL.clear_buffers();
			stretcherR.clear_buffers();
			_reset_mid_buffers();
		}
		
		if (idx.length == 1) {
			currentSegmentIndex = idx[0];
			_segments[currentSegmentIndex].reset_cursor();
		} else {
			// TODO: replace by beatCursor assignment.
			var seg = _segments[idx[0]];
			var coef = (newTime - seg.startBeat) / (seg.endBeat - seg.startBeat);
			currentSegmentIndex = idx[0];
			seg.bufferCursor = Math.round(seg.bufferStart + coef * (seg.bufferEnd - seg.bufferStart));
		}
	}

	// units: "beats" | "seconds"
	this.get_current_time = function(units) {
		if (units == "seconds") {
			return currentTime;
		} else if (units == "beats") {
			return bpmTimeline.beat(currentTime);
		} else {
			
			throw {
				message: "Invalid units", 
				invalidValues: {
					units: units
				}
			};

		}
	}

	this.generate_block = function(output) {
		if (output.numberOfChannels == 2 && output.sampleRate == sampleRate) {
			this._generate_block(output.getChannelData(0), output.getChannelData(1), output.length);
		} else 
			throw {
				message: "Invalid parameters", 
				parameters: {
					name: 'output',
					value: output
				}
			};
	}


	this._generate_block = function(outputL, outputR, wantedNumberOfSamples) {

		var writtenNumSamples = 0;
		var currentSegment;

		while (midBufferL.size > 0 && writtenNumSamples < wantedNumberOfSamples) {
			outputL[writtenNumSamples] = midBufferL.shift();
			outputR[writtenNumSamples] = midBufferR.shift();
			writtenNumSamples++;
			currentTime += 1/sampleRate;
		}

		if (writtenNumSamples == wantedNumberOfSamples)
			return;
		
		while (writtenNumSamples < wantedNumberOfSamples) {

			var midAlpha = 0;
			var inputSamplesCount = 0;
			var neededNumSamples = FRAME_SIZE;
			var _currentSegmentIndex = currentSegmentIndex;

			/* 
			 * Retrieve samples without performing hops in the buffers. 
			 * If we know, before the retrieval, the time stretching factor (alpha), 
			 * it would be possible to perform the buffer hop within this loop. 
			 * But that is not the case because we cannot assume that there is 
			 * a constant BPM within a buffer. 
			 */
			while (inputSamplesCount < FRAME_SIZE && _currentSegmentIndex < _segments.length) {
				currentSegment = _segments[_currentSegmentIndex];

				var readObj = currentSegment.retrieve_frame(il, ir, inputSamplesCount, neededNumSamples);
				var samplesRead = readObj.numRead;
				var bpm = readObj.bpm;

				neededNumSamples -= samplesRead;
				inputSamplesCount += samplesRead;
				
				var masterTempo = bpmTimeline.tempo_at_time(currentTime + inputSamplesCount / sampleRate /*currentSegment.audioBuffer.sampleRate*/);
				midAlpha += (samplesRead / FRAME_SIZE) * ((currentSegment.bpm || masterTempo) / masterTempo);

				// console.log(masterTempo);

				if (neededNumSamples <= 0) {
					break;
				} else {
					_currentSegmentIndex++;
				}
			}

			// console.log(midAlpha);

			var alpha = midAlpha;
			stretcherL.set_alpha(alpha);
			stretcherR.set_alpha(alpha);
			
			stretcherL.process(il, midBufferL);
			stretcherR.process(ir, midBufferR);

			var hop = stretcherL.get_ha();

			// console.log(currentTime);

			while (true) {
				var s = _segments[currentSegmentIndex];
				if (currentSegmentIndex == _segments.length-1) {
					s.hop(hop);
					break;
				}
				var dif = s.remainingSamples;
				if (dif >= hop) {
					// console.log("same segment");
					s.hop(hop);
					break;
				} else {
					// console.log("next segment");
					s.reset_cursor();
					hop -= dif;
					currentSegmentIndex++;
				}
			}

			while (midBufferL.size > 0 && writtenNumSamples < wantedNumberOfSamples) {
				outputL[writtenNumSamples] = midBufferL.shift();
				outputR[writtenNumSamples] = midBufferR.shift();
				writtenNumSamples++;
				currentTime += 1/sampleRate;
			}

		}
		

	}

	
	this.remove_segments = function(startTime, endTime, units) {
		
		var startBeat, endBeat;

		if (units == "beats") {
			startBeat = startTime;
			endBeat = endTime;
		} else if (units == "seconds") {
			startBeat = bpmTimeline.beat(startTime);
			endBeat = bpmTimeline.beat(endTime);
		} else {
			
			throw {
				message: "Invalid units", 
				invalidValues: {
					units: units
				}
			};

		}

		_remove_segments(startBeat, endBeat);

		this.set_current_time(this.get_current_time("beats"), "beats");

		if (anyChange)
			_push_event_to_emit("changed-segments", {});

		_emit_all_events();

		anyChange = false;
	}

	function _remove_segments(startBeat, endBeat) {
		_add_segment(new SilenceSegment({ startBeat: startBeat, endBeat: endBeat, bpmTimeline: bpmTimeline }));
	}

	this.add_segment_2 = function(segInstance) {

		if (!audioBuffers[audioId]) {
			throw {
				message: "Invalid audio identifier", 
				invalidValues: {
					audioId: audioId
				}
			};
		}

		_add_segment(segInstance);

		this.set_current_time(this.get_current_time("beats"), "beats");

		if (anyChange)
			_push_event_to_emit("changed-segments", {});

		_emit_all_events();

		anyChange = false;
	}

	/* TODO: permitir segmentos com sub-segmentos (i.e.: batidas dos segmentos) */
	this.add_segment = function(id, audioId, bufferStart, bufferEnd, startBeat, endBeat, bpm, custom) {
		if (!audioBuffers[audioId]) {
			throw {
				message: "Invalid audio identifier", 
				invalidValues: {
					audioId: audioId
				}
			};
		}

		var newSegment = new SimpleBufferSegment({
			audioId : audioId, audioBuffer: audioBuffers[audioId].buffer, 
			id : id, bpm : bpm, 
			startBeat : startBeat, endBeat : endBeat, 
			bufferStart : bufferStart, bufferEnd  : bufferEnd
		});

		_add_segment(newSegment);

		this.set_current_time(this.get_current_time("beats"), "beats");

		if (anyChange)
			_push_event_to_emit("changed-segments", {});

		_emit_all_events();

		anyChange = false;
	}

	this.move_segment = function(id, newStartTime) {
		var movedSegs = [];
		var oldSegs = [];

		for (var i=0; i<_segments.length; i++) {
			if (_segments[i].id == id) {
				var difTime = _segments[i].endBeat - _segments[i].startBeat;
				var newSeg  = _segments[i].clone();
				oldSegs[oldSegs.length] = _segments[i].clone();
				// _segments[i] = new Segment({ startBeat: _segments[i].startBeat, endBeat: _segments[i].endBeat, bpmTimeline: bpmTimeline })
				_segments[i] = new SilenceSegment({ startBeat: _segments[i].startBeat, endBeat: _segments[i].endBeat, bpmTimeline: bpmTimeline });
				newSeg.startBeat = newStartTime;
				newSeg.endBeat = newStartTime + difTime;
				joined_silent_neighbours(_segments, (i-1<0)?undefined:i-1 , i, i+1);
				movedSegs[movedSegs.length] = newSeg;
				anyChange = true;
			} else if (movedSegs.length) 
				break;
		}

		for (var i=0; i<movedSegs.length; i++) {
			_add_segment(movedSegs[i]);
			_push_event_to_emit("moved-segment", { new: movedSegs[i], old: oldSegs[i]});
		}

		this.set_current_time(this.get_current_time("beats"), "beats");

		if (anyChange)
			_push_event_to_emit("changed-segments", {});

		_emit_all_events();

		anyChange = false;
	}

	function _add_segment(newSegment, isDrag) {

		var idx = find_index(_segments, {startBeat: newSegment.startBeat}, function(a, b) { return a.startBeat - b.startBeat; });

		if (idx.length == 1) {

			idx = idx[0];

			if (idx != _segments.length-1) {
				/*
				 *	CASE 1: NEW SEGMENT STARTS AT THE BEGINNING OF THE SEGMENTS LIST.
				 *	CASE 2: NEW SEGMENT STARTS AT THE BEGINNING OF AN EXISTING SEGMENT.
				 */
				override_segments(_segments, newSegment, idx, !isDrag);
			} else {
				/*
				 *	CASE 3: NEW SEGMENT IS THE LAST ONE IN THE SEGMENT LIST
				 */
				if (idx == _segments.length-1) {
					// change_end(_segments[idx], newSegment, true);

					if (_segments[idx].startBeat == newSegment.startBeat) 
						_segments[idx] = newSegment;
					else 
						_segments[idx+1] = newSegment;
					
					_segments[_segments.length] = new SilenceSegment({startBeat: newSegment.endBeat, endBeat: Number.MAX_VALUE, bpmTimeline: bpmTimeline});

					anyChange = true;

					if (newSegment.id != undefined && !isDrag)
							_push_event_to_emit("added-segment", {new: newSegment});
				}
			}

			joined_silent_neighbours(_segments, (idx-1 < 0)? undefined: idx-1, idx, idx+1);

		} else {

			var pIdx = idx[0];
			var nIdx = idx[1];

			/*
			 *	CASE 4: NEW SEGMENT OVERLAPS TWO, OR MORE, SEGMENTS.
			 */
			if (newSegment.endBeat < _segments[pIdx].endBeat) {
				/* SPLITS THE EXISTING SEGMENT IN TWO. */
				var copy  = _segments[pIdx].clone();
				var copy2 = (copy.id != undefined)? _segments[pIdx].clone() : undefined;
				
				// change_end(_segments[pIdx], newSegment, false);
				// change_start(copy, newSegment, false);

				_segments[pIdx].endBeat = newSegment.startBeat;
				copy.startBeat = newSegment.endBeat;


				_segments.splice(pIdx+1, 0, copy);
				_segments.splice(pIdx+1, 0, newSegment);
				joined_silent_neighbours(_segments, pIdx, pIdx+1, pIdx+2);
				if (copy.id != undefined)
					_push_event_to_emit("splitted-segment", { old: copy2, new: [_segments[pIdx], copy] });
				if (newSegment.id != undefined && !isDrag)
					_push_event_to_emit("added-segment", {new: newSegment});

			} else if (newSegment.endBeat == _segments[pIdx].endBeat) {

				// change_end(_segments[pIdx], newSegment, true);

				if (_segments[i].id != undefined) {
					var clone = _segments[pIdx].clone();
					_segments[pIdx].endBeat = newSegment.startBeat;
					_push_event_to_emit("edited-segment", { old: clone, new: oldSegment });
				} else {
					_segments[pIdx].endBeat = newSegment.startBeat;
				}

				_segments.splice(pIdx+1, 0, newSegment);
				joined_silent_neighbours(_segments, pIdx, pIdx+1, pIdx+2);
				if (newSegment.id != undefined && !isDrag)
					_push_event_to_emit("added-segment", {new: newSegment});

			} else if (newSegment.endBeat > _segments[pIdx].endBeat) {

				// change_end(_segments[pIdx], newSegment, true);

				if (_segments[i].id != undefined) {
					var clone = _segments[pIdx].clone();
					_segments[pIdx].endBeat = newSegment.startBeat;
					_push_event_to_emit("edited-segment", { old: clone, new: oldSegment });
				} else {
					_segments[pIdx].endBeat = newSegment.startBeat;
				}

				override_segments(_segments, newSegment, nIdx, !isDrag);
				joined_silent_neighbours(_segments, pIdx, pIdx+1, pIdx+2);

			}

		}
	}

	this.add_audio_buffer = function(id, audioBuffer) {
		audioBuffers[id] = { buffer: audioBuffer };
		_push_event_to_emit("added-audio-buffer", { aid: id, buffer: audioBuffer});
		_emit_all_events();
	}

	this.remove_audio_buffer = function(aid) {
		if (audioBuffers[aid]) {

			delete audioBuffers[aid];

			var _segmentsToRemove = [];

			for (var i=0; i<_segments.length; i++) {
				if (_segments[i].audioId == aid) {
					_segmentsToRemove[_segmentsToRemove.length] = {
						startBeat : _segments[i].startBeat, 
						endBeat : _segments[i].endBeat
					};
				}
			}

			for (var i=0; i<_segmentsToRemove.length; i++) {
				_remove_segments(_segmentsToRemove[i].startBeat, _segmentsToRemove[i].endBeat);
			}

			this.set_current_time(this.get_current_time("beats"), "beats");

			_push_event_to_emit("removed-audio-buffer", { aid: aid });

		} else {

			throw {
				message: "Invalid audio identifier", 
				invalidValues: {
					audioId: audioId
				}
			};

		}

		if (anyChange)
			_push_event_to_emit("changed-segments", {});

		_emit_all_events();

		anyChange = false;
	}

	this.get_segments = function() {
		var a = [];
		var _ss = _segments;
		for (var i=0; i<_ss.length; i++) {
			if (_ss[i].id == undefined)
				continue;
			if (a[a.length-1] 
					&& a[a.length-1].bufferEnd == _ss[i].bufferStart - 1 
					&& a[a.length-1].audioId == _ss[i].audioId 
					&& a[a.length-1].id == _ss[i].id) {

				a[a.length-1].endBeat = _ss[i].endBeat;
				a[a.length-1].bufferEnd = _ss[i].bufferEnd;
			} else {
				a[a.length] = _segments[i].clone();
			}
		}
		return a;
	}

	this.get_audio_buffers = function() {
		var a = [];
		for (var aid in audioBuffers) {
			a[a.length] = audioBuffers[aid];
		}
		return a;
	}




	/***************************************************************/
	/********************** HELPER FUNCTIONS ***********************/
	/***************************************************************/

	function change_start(oldSegment, newSegment, emit) {
		var newStartBeat = newSegment.endBeat;
		oldSegment.startBeat = newStartBeat;

		if (oldSegment.bufferStart == undefined)
			return;

		var oldEndBeat   = oldSegment.endBeat;
		var oldStartBeat = oldSegment.startBeat;
		var oldBufStart  = oldSegment.bufferStart;
		var oldBufEnd    = oldSegment.bufferEnd;
		var coef = (oldEndBeat - newStartBeat) / (oldEndBeat - oldStartBeat);
		var newBufStart = oldBufEnd - (oldBufEnd - oldBufStart) * coef ;

		var copy;
		if (oldSegment.id != undefined && emit) {
			anyChange = true;
			copy = oldSegment.clone();
		}

		oldSegment.bufferStart  = newBufStart;

		if (oldSegment.id != undefined && emit)
			_push_event_to_emit("edited-segment", { old: copy, new: oldSegment });


	}

	function change_end(oldSegment, newSegment, emit) {
		var newEndBeat	 = newSegment.startBeat;
		oldSegment.endBeat = newEndBeat;

		if (oldSegment.bufferEnd == undefined)
			return;

		var oldEndBeat   = oldSegment.endBeat;
		var oldStartBeat = oldSegment.startBeat;
		var oldBufStart  = oldSegment.bufferStart;
		var oldBufEnd    = oldSegment.bufferEnd;
		var coef = (newEndBeat - oldStartBeat) / (oldEndBeat - oldStartBeat);
		var newBufEnd = oldBufStart + (oldBufEnd - oldBufStart) * coef ;

		var copy;
		if (oldSegment.id != undefined && emit)
			copy = oldSegment.clone();

		oldSegment.bufferEnd  = newBufEnd;

		if (oldSegment.id != undefined && emit) {
			anyChange = true;
			_push_event_to_emit("edited-segment", { old: copy, new: oldSegment });
		}
	}

	function override_segments(segments, newSegment, idx, canEmitAdded) {
		for (var i=idx; i<_segments.length; i++) {
			if (_segments[i].endBeat > newSegment.endBeat) {
				var copy = _segments[i].clone();

				// change_start(_segments[i], newSegment, true);
				
				if (_segments[i].id != undefined) {
					var clone = _segments[i].clone();
					_segments[i].startBeat = newSegment.endBeat;
					_push_event_to_emit("edited-segment", { old: clone, new: oldSegment });
				} else {
					_segments[i].startBeat = newSegment.endBeat;
				}

				anyChange = true;
				break;
			}
			if (_segments[i].id != undefined)
				_push_event_to_emit("removed-segment", { old: _segments[i] });
		}

		if (i-idx > 0)
			anyChange = true;

		_segments.splice(idx, i-idx, newSegment);

		if (newSegment.id != undefined && canEmitAdded)
			_push_event_to_emit("added-segment", { new: newSegment });
	}

	function joined_silent_neighbours(segments, pi, i, ni) {
		if (_segments[i].id != undefined)
			return false;

		if (pi != undefined && ni != undefined && _segments[pi].id == undefined && _segments[ni].id == undefined) {
			var newSegment = { startBeat: _segments[pi].startBeat, endBeat: _segments[ni].endBeat };
			_segments.splice(pi, 3, newSegment);
			return true;
		} else if (pi != undefined && _segments[pi].id == undefined) {
			var newSegment = { startBeat: _segments[pi].startBeat, endBeat: _segments[i].endBeat };
			_segments.splice(pi, 2, newSegment);
			return true;
		} else if (ni != undefined && _segments[ni].id == undefined) {
			var newSegment = { startBeat: _segments[i].startBeat, endBeat: _segments[ni].endBeat };
			_segments.splice(i, 2, newSegment);
			return true;
		}
	}

	this.next_id_number = function() {
		return _idCounter++;
	}




	/***************************************************************/
	/******************* BINARY SEARCH FUNCTIONS *******************/
	/***************************************************************/
	function find_index(values, target, compareFn) {
		if (values.length == 0 || compareFn(target, values[0]) < 0) { 
			return [0]; 
		}
		if (compareFn(target, values[values.length-1]) > 0 ) {
			return [values.length-1];
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
	/*********************** EVENTS HANDLING ***********************/
	/***************************************************************/
	var _callbacks =  {
		"added-segment": {}, 
		"removed-segment": {},
		"edited-segment": {},
		"splitted-segment": {},
		"moved-segment": {}, 
		"changed-segments": {},
		"added-audio-buffer": {},
		"removed-audio-buffer": {}
	};
	var _idCounter = 0;

	var eventsToEmit = [];
	var eventsToEmitPointer = 0;

	function _push_event_to_emit(type, data) {
		if (_callbacks[type] != {}) {
			eventsToEmit[eventsToEmitPointer++] = { type: type, data: data };
		}
	}

	function _emit_all_events() {
		var m = eventsToEmitPointer;
		for (var i=0; i<m; i++, eventsToEmitPointer--) 
			_emit(eventsToEmit[i].type, eventsToEmit[i].data);
	}

	var _emit = function(eventType, data) {
		for (var ci in _callbacks[eventType]) 
			_callbacks[eventType][ci](data);
	}

	this.add_event_listener = function(observerID, eventType, callback) {

		// if (!eventType || _callbacks[eventType]==undefined) 
		// 	throw "Unsupported event type";

		if (observerID!=undefined && _callbacks[eventType][observerID]!=undefined) 
			throw "Illegal modification of callback";

		var __id = (observerID==undefined)? _id + "-associate-" + (_idCounter++) : observerID;
		_callbacks[eventType][__id] = callback;
		return __id;
	}

	this.remove_event_listener = function(observerID, eventType) {

		// if (!eventType || _callbacks[eventType]==undefined) 
		// 	throw "Unsupported event type";

		delete _callbacks[eventType][observerID];
	}
}