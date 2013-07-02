# State

The state library exposes a constructor that constructs objects which form an interface between and
actor, a session and the archivist. Virtually any command that involves reading and modification of
data should be managed by a state object.

The state constructor is exposed on `require('./state').State`.

The state library is also an event emitter, with events:

 - `'created'`
 - `'destroyed'`
 - `'stateError'`
 - `'timeOut'`, `timeout` (in milliseconds)

These are intended for the sampler library to collect data.