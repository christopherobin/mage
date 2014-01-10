# Time module

The time module controls client and server time, and the synchronisation between the two.

## Server API

### time.now(bool msec)

Use this function to get a unix timestamp of the current time. If `msec` is true, it will be
returned in milliseconds, rather than seconds.


## Client API

### time.now(bool msec)

Returns the unix timestamp of the current time, according to the server. That means this time is
independent from the clock on the client. If `msec` is true, the timestamp will be returned in
milliseconds, rather than seconds.

### time.getClientTime(bool msec)

Returns the unix timestamp of the current time, according to the client itself. If `msec` is true,
the timestamp will be returned in milliseconds, rather than seconds.

### time.clientTimeToServerTime(int timestamp, bool msec)

Shifts a timestamp that is based on the local time on the client to comply with reality according to
the server.

### time.serverTimeToClientTime(int timestamp, bool msec)

Shifts a timestamp that is based on the local time on the server to comply with reality according to
the client.

### time.getOffset()

Returns the amount of milliseconds that the client time is behind the server time. If the number is
smaller than `0`, that means the client time is ahead of the server.
