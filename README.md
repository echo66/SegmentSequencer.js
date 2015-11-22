# SegmentsSequencer.js

A javascript implementation of an audio sequencer that allows sample-accurate scheduling of audio segments through the use of bpm-timeline.js and time stretching through OLA-TS.js. This implementation is not dependent on Web Audio API but it can be integrated within ScriptProcessor or AudioWorker nodes.

TODO: explicar a problemática da sequenciação de segmentos de buffers diferentes sem os colocar um array único. E mencionar porque razão seria um problema colocar num array único.

# API

*set_current_time(Number newTime, String units)*: 

*get_current_time(String units)*:

*generate_block(Object output)*:

*remove_segments(Object params)*:

*add_segment(TODO)*:

*add_audio_buffer(String aid, Object bufferArrays, Number sampleRate)*:

*remove_audio_buffer(String aid)*:

*add_event_listener(String observerId, String eventType, Function callback)*:

*remove_event_listener(String observerId, String eventType)*:

# Notes
The order of operations should be: (1) change the tempo markers, (2) set the current time, (3) add segment


# Roadmap

* Support different time stretchers, like PhaseVocoder.js and Soundtouch.js.

* Support pitch shifting through re-sampling.

* Create a NPM package.