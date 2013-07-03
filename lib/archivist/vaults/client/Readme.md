# Client vault

This vault is used to send updates to the player, so that their data is always synchronized in real
time. This vault is always created when an archivist is instantiated by a `State` object, using a
name identical to the type: `client`.

## Configuration

This vault type requires no configuration.

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | no        |
get       | no        |
add       | yes       | `state.emitToActors('archivist:set')`
set       | yes       | `state.emitToActors('archivist:set' or 'archivist:applyDiff')`
touch     | yes       | `state.emitToActors('archivist:touch')`
del       | yes       | `state.emitToActors('archivist:del')`
