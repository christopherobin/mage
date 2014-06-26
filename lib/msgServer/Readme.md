# Message Server

The message server is in charge of event propagation through the system, and the hosting of the
HTTP server.

## MMRP

The message server uses the MMRP protocol to ensure communication between
the different instances of node.

See the [MMRP documentation](./mmrp/Readme.md).

## HTTP Server

The HTTP Server, inside MAGE also known as the client host, serves HTML, user commands and custom
routes.

See the [HTTP Server documentation](./tranports/http/Readme.md).
