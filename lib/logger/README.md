Logging
=======


Wherever meaningful, error level logging should receive an Error object.

## Examples

### try-catch block
``
try {
        throw new SyntaxError('You are too grey for me');
}
catch (err) {
        mithril.core.logger.error(err);
}
``

### Pass an on-the-fly error object

``
function callbackFunction (err, data) {
        if (err) {
            mithril.core.logger.error(new Error(err));
        }

        mithril.core.logger.debug('so far, so, good').data(data);
}
``

## Default Mithril Channels

The default channels have been expanded to be more granular and more meaningful; this should help production operation by allowing us to throw alerts properly (only 3-4 emergencies or alerts a minute should alert operation, but it might take 100's of user errors a minute to trigger the same alerting)

### emergency

Internal service or external service unavailability

### alert

* Internal service (datastore API call, etc) or external service
* API calls throw Exception or return errors

### critical

An request has broken; user session or data is broken or corrupted

### error

An user request has errored; unhanded exceptions

### warning

* User requests is in an unusual state, but the situation has been handled gracefully
* System warning

### notice

Service setup completion, build completion, and other non-error state change within the game.

### info

Requests and outcomes: SHOULD include meaningful data in regards to mutation of the user's related data

### debug

Relevant game debugging information: internal process of a request

### vebose

Mithril internal. Use this to see Mithril internal info (NEVER LOG TO THIS AS A GAME DEVELOPER)

### time

Generally used for storing benchmark information.
