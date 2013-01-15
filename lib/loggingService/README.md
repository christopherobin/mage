Logging
=======

Wherever meaningful, error level logging should receive an Error object.

## Examples

### try-catch block
`
try {
  throw new Error('You are too grey for me');
} catch (error) {
  mage.core.logger.error(error);
}
`

### Passing rich data that certain logging services may be able to query

`
mage.core.logger.debug
  .data(questData)
  .log('Trying to run quest', questId);
`

### Passing details

`
mage.core.logger.debug
  .details('Used Facebook mobile login').
  .details('URL', facebookServiceUrl).
  .log('User logged in', actorId);
`


## Built-in Logging Channels

The default channels have been expanded to be more granular and more meaningful;
this should help production operation by allowing us to throw alerts properly
(only 3-4 emergencies or alerts a minute should alert operation, but it might
take 100's of user errors a minute to trigger the same alerting).

### emergency

Internal service or external service unavailability. The app cannot boot or
stopped unexpectedly.

### alert

There are major issues that affect the correct operation of the application.
* Internal service (datastore API call, etc) or external service
* API calls throw Exception or return errors

### critical

A user request has gone wrong; user session or data is broken or corrupted.
The user is expected to require a restart.

### error

A user request has errored and the user experience is expected to be negatively
impacted.

### warning

Acceptable problems that are expected to happen and will always be dealt with
gracefully.
* A user made an unusual request
* System warning

### notice

Events regarding the state of services. Server up, server down, setup
completion, build completion, and other non-error state change within the game.

### info

Summarizing requests from the end-user and their outcomes.

### debug

Relevant game debugging information that goes beyond verbose. Always turned on during development.

### verbose

For very low-level debug information (I/O details, etc). Often used by MAGE internals.

### time

Generally used for logging benchmark information.
