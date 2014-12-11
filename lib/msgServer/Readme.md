# Message Server

The message server is in charge of message propagation through the network.


## MMRP

The message server uses the MMRP library to ensure communication between the different MAGE
instances on the network.

See the [MMRP documentation](./mmrp/Readme.md) for more information.


## Message stream

The messages sent by the server inevitably make their way to a client through a message stream.

See the [Message Stream documentation](./msgStream/Readme.md) for more information.
