# Logging

## Terminology

### Channel

Loggers have multiple channels (described at the bottom of this file) that define the verbosity or
severity of a log entry.

### Message

The message is the primary line of information you are logging. In every case, whenever you pass a
message into a logger, you are encouraged to send multiple arguments and not do any serialization
(JSON or other) yourself. The reason for this is that some messages may be surpressed by the
configuration, based on verbosity, and needless serialization would needlessly hurt performance.

Loggers can serialize any data type, including Error instances (which will yield a stack trace).

### Contexts

A logger can be given one or more contexts in order to make the source of a log-call a bit clearer.

### Details

Additional details can be passed into a logger to clarify a situation with more human readable
output where needed. This is especially helpful when observing log output in a terminal.

### Data

Loggers may be passed additional key/value data. This helps certain logging services (like Graylog2)
which allow users to query for data.


## API

The `logger` module is a logger instance that exposes multiple methods. Loggers expose several
methods.

### logger.context(context1, .., contextN)

Returns a new logger object that has the given contexts on top of the ones that logger had. The
typical use case for this is that your module (eg: 'shop') has the following code at the top:

```javascript
var logger = mage.logger.context('shop');
// all logging should now be done on logger
```

### logger.&lt;channel&gt;(arg1, .., argN)

Each channel name is a method on a logger. This allows you to write:

```javascript
mage.logger.emergency('Crucial file missing');
mage.logger.warn('Stamina too low to quest:', stamina, 'quest:', questId);
mage.logger.verbose('Reading from file:', filePath);
```

At the same time, the channel is not just a function, but an object that exposes a few more
methods. All those methods can be chained. Because you are no longer using the channel name as a
function, you have to call the `log` method at the end of the chain to provide the log message (see
examples below).

### logger.&lt;channel&gt;.details(arg1, .., argN)

To provide additional human readable details. This function can be called multiple times to provide
multiple lines of information.

### logger.&lt;channel&gt;.context(context1, .., contextN)

This adds the contexts to this one log entry, on top of the ones that were already set before.

### logger.&lt;channel&gt;.data(key, value)

Add a queryable key/value pair to the log entry.

### logger.&lt;channel&gt;.data(valueMap)

Add many key/value pairs to the queryable data of this log entry.


## Examples

### try-catch block

```javascript
try {
	throw new Error('You are too grey for me');
} catch (error) {
	mage.logger.error(error);
}
```

### Passing rich data that certain logging services may be able to query

```javascript
mage.logger.debug
	.data(questData)
	.log('Trying to run quest', questId);
```

### Passing details

```javascript
mage.logger.debug
  .details('Used Facebook mobile login')
  .details('URL', facebookServiceUrl)
  .log('User logged in', actorId);
```

## HTML5 Client API

If configured, the client module will also expose all the channels, so you can log just like you do
on the server. The API is however limited to logging a `message`. At this time, contexts, details
and key/value data are not supported. Stack traces are automatically logged in the data part
however. The client can log to console, but also to the server. Please make sure you expose the
"sendReport" user command to enable that.


## Built-in Logging Channels

The default channels have been expanded to be more granular and more meaningful; this should help
production operation by allowing you to throw alerts properly (only 3-4 emergencies or alerts a
minute should alert operation, but it might take 100's of user errors a minute to trigger the same
alerting).

### emergency

Internal service or external service unavailability. The app cannot boot or stopped unexpectedly.

### alert

There are major issues that affect the correct operation of the application.
* Internal service (datastore API call, etc) or external service
* API calls throw Exception or return errors

### critical

A user request has gone wrong; user session or data is broken or corrupted. The user is expected to
require a restart.

### error

A user request has errored and the user experience is expected to be negatively impacted.

### warning

Acceptable problems that are expected to happen and will always be dealt with gracefully.
* A user made an unusual request
* System warning

### notice

Events regarding the state of services. Server up, server down, setup completion, build completion,
and other non-error state change within the game.

### info

Summarizing requests from the end-user and their outcomes.

### debug

Relevant game debugging information that goes beyond verbose. Always turned on during development.

### verbose

For very low-level debug information (I/O details, etc). Often used by MAGE internals.

### time

Generally used for logging benchmark information.


## Configuration

The logger allows for logging in different "writers". At this time, the following are available on
the server:

* terminal: log to the console
* file: write to log files on disk
* graylog: www.graylog2.com
* loggly: www.loggly.com
* websocket: log to on-demand incoming websocket connections

And the following are available on the client:

* console: outputs to console.log/warn/error
* server: send log entries to the server to be reported in a server-side writer

Configuration happens in your config file in:

```json
{
	"logging": {
		"server": {},
		"html5": {}
	}
}
```

### Server: Terminal

```json
{
	"logging": {
		"server": {
			"terminal": {
				"channels": [">=info"],
				"config": {
					"jsonIndent": 2,
					"theme": "default"
				}
			}
		}
	}
}
```
Available themes: `default`, `dark`, `light`.

### Server: File

```json
{
	"logging": {
		"server": {
			"file": {
				"channels": ["<info", ">=critical", "error"],
				"config": {
					"jsonIndent": 2,
					path: "./logs/",
					mode: "0600"
				}
			},

		}
	}
}
```

### Server: Graylog

```json
{
	"logging": {
		"server": {
			"graylog": {
				"channels": [">=info"],
				"config": {
					"servers": [
						{ "host": "192.168.100.85", "port": 12201 },
						{ "host": "192.168.100.86", "port": 12201 }
					],
					"facility": "Application identifier"
				}
			}
		}
	}
}
```

### Server: Loggly

```json
{
	"logging": {
		"server": {
			"channels": [">=info"],
			"config": {
				"token": "the token, see loggly indication on web interface account login",
				"subdomain": "mysubdomain"
			}
		}
	}
}
```

### Server: Websocket

```json
{
	"logging": {
		"server": {
			"websocket": {
				"config": {
					"port": 31337
				}
			}
		}
	}
}
```

Socket files are not supported, nor are channels. The channel description is to be passed into the
connection once it has been established.

### HTML5: All writers

If the `disableOverride` argument is truthy for all HTML5 writers, the browser's window `console`
API will not be overriden to trigger logs through the MAGE logger. That means that by default,
calling into console.log/info/warn/error will mean "calling into the MAGE logger". This
configuration property is optional, and should generally be left out.

### HTML5: Console

```json
{
	"logging": {
		"html5": {
			"console": {
				"channels": [">=verbose"],
				"disableOverride": false
			}
		}
	}
}
```

### HTML5: Server

```json
{
	"logging": {
		"html5": {
			"server": {
				"channels": [">=verbose"],
				"disableOverride": false
			}
		}
	}
}
```
