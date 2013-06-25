# The sampler library

The sampler library is an interface for Panopticon. It uses configuration to handle the setup of panoptica, and exposes the methods of these panoptica as a group. Sampler handles the sending of data to all of the panoptica, so you only need to worry about the API:

 - `sampler.set(path, id, n)`, where `n`, a finite number, may replace a previous `n` for this `id`.
 - `sampler.inc(path, id, n)`, where `n` is added to the previous value if `n` is a finite number. If `n` is not a finite number, then it defaults to `1`.
 - `sampler.sample(path, id, n)`, which keeps track of the max, min, average and standard deviation of `n` over an interval.
 - `sampler.timedSample(path, id, dt)`, which is like sample, but takes the output of a high resolution timer `dt` (or rather the difference between two timers).

These methods take the same arguments as a panopticon, so please see the Panopticon documentation for more detail.
