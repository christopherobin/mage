# MMRP

MMRP (MAGE Message Relay Protocol) is the messaging layer between node instances.
It is used to ensure communication between multiple MAGE instances
and between the different node processes run by MAGE.

```
+-----+                  +-----+     
|     |                  |     |     
|  M  +------------------+  M  |     
|     |                  |     |     
+--+--+                  ++---++     
   |                      |   |      
   |                   +--+   +--+   
   |                   |         |   
+--+--+             +--+--+   +--+--+
|     |             |     |   |     |
|  W  |             |  W  |   |  W  |
|     |             |     |   |     |
+-----+             +-----+   +-----+

M: MAGE master / MMRP relay
W: MAGE worker / MMRP client
```

Each MAGE master will instanciate an MMRP relay, and each worker an MMRP client.

When the `comm` module of the `msgServer` will send a message,
the MMRP client will send the message to its MMRP relay.
The relay will then transfer the message to all the other relays,
if the recipient is not one of its attached clients.
If one of the relay detects that the recipient is one of its attached clients,
it will forward the message to the client.

This protocol is implemented in the [msgServer/comm](../comm.js) module.

## Relay

Each relay uses two ZMQ sockets to communicate: a router and a dealer.

The router acts as a server and receives `request` messages,
the dealer acts as a client and receives `reply` messages.

### Relay(String identity)

Create the two ZMQ sockets and assigns the given `identity` to the created sockets.

### relay.close()

Close the ZMQ sockets.

### relay.handlePacket(Meta metadata, Buffer packet, String eventType)

Emit an event or forward the `packet` according to the recipient.

`eventType` can be one of the following:
* `request`: if the message was received by the router.
* `reply`: if the message was received by the dealer.

_Note_: Called when the router or the dealer receives a `packet`.

### relay.sendReply(Meta metadata, Buffer packet)

### relay.connect(String addr)

Make the dealer connect to another relay.
The relay is specified by its address.

### relay.disconnect(String addr)

Make the dealer disconnect from another relay.
The relay is specified by its address.

### relay.bindSync(String addr)

Make the router bind to the given address.

### relay.unbind(String addr)

_Note_: Not yet implemented.

### Events

#### error: (Error error)

Emitted when an error occurred.

#### message: (Buffer data, String returnPath, Meta metadata)

Emitted when the relay receives a message and it is the destination.

* `data` contains the body of the packet.
* `returnPath` contains the identity to the relay to which you have to send
a reply, if the `REPLY_EXPECTED` flag is enabled in `metadata`.

#### request: (String sender, Buffer data, String returnPath, Meta meta)

Emitted when the router receive a message and it has to forward it.

_Note_: Not used.

#### reply: (String sender, Buffer data, String returnPath, Meta meta)

Emitted when the dealer receive a message and it has to forward it.

_Note_: Not used.

## Client

Each client uses a ZMQ socket configured as a dealer.

### Client(String identity)

Create the ZMQ socket and assigns the given `identity` to the created socket.

### client.connect(String uri)

Make the dealer connect to the relay at the given `uri`.

### client.close()

Make the dealer disconnect.

### client.parseMessage(Buffer packet)

Parse the `packet` and emit an event with the parsed message.

_Note_: Called when the dealer receives a `packet`.

### client.send(String addr, Buffer data, Meta metadata)

Send a message to the given address.

### Events

#### error: (Error error)

Emitted when an error occurred.

#### message: (String sendToAddr, data, Meta metadata)

Emitted when the relay receives a message and it is the destination.

* `data` contains the body of the packet.
* `sendToAddr` contains the address of the recipient.

## Meta

This object contains the metadata related to a packet sent through MMRP.
The metadata are required to handle serialization and deserialized.

The attributes are stored internally in a `Buffer`.
The structure is the as follows:
```
+--------------+--------+----------+------+------+
|              |        |          |      |      |
| dataPosition |  ttl   | dataType |    flags    |
|    8 bits    | 8 bits |  8 bits  |   16 bits   |
|              |        |          |      |      |
+--------------+--------+----------+------+------+
```

### meta.dataPosition

A packet is an array of Buffer.
The typical structure is a list of addresses, followed by the body and the metadata.

This attribute allows to know the place of the body inside the packet.

Type: 8 bit integer.

### meta.ttl

Type: 8 bit integer.

_Note_: This attribute is not used.

### meta.dataType

The nature of the content of the related packet.

Type: 8 bit integer.

The supported `dataType` values are:
* `UNKNOWN`: The default value.
  The buffer is not modified when using `serialize()` or `deserialize()`.
* `UTF8STRING`: The `Buffer` will be converted to a `String`
  when using `serialize()` or `deserialize()`.
* `JSON`: The `Buffer` will be converted to a `String` (resp. an `Object`)
  when using `serialize()` (resp. `deserialize()`).

The available values are stored in the `DATATYPE` constant.

### meta.flags

Information about the packet.
Multiple flags can combined by using bitwise operators.

Type: 16 bit integer.

The supported `flags` are:
* `NONE`: Default value.
* `REPLY_EXPECTED`: The relays will update the packet to maintain a route,
  so that a reply will be able to find the final relay
  where the reply recipient is attached.
* `AUTO_DESERIALIZE`: The packet will be automatically deserialized by the client.
* `IS_RESPONSE_PKT`: Mark the packet as a response packet.
* `DST_ATTAINED`: Not used.
* `PAYLOAD_MODIFIED`: Not used.
* `PAYLOAD_CORRUPTED`: Not used.
* `PAYLOAD_ENCRYPTED`: Not used.
* `IGNORE`: The packet will not be handled by the relay router.
  It's used to notify the relay that someone is connected to it.

They available values are stored in the `FLAGS` constant.

### Meta(Buffer buffer)

Create a new `Meta` object from a `Buffer`.
This is used to read the metadata of a packet we have just received.

### Meta(int ttl, int dataType, int flags)

Create a new `Meta` object with the given information.

* `ttl`: Not used.
* `dataType`: The nature of the content of the related packet.
* `flags`: Information about the packet.

Example:
``` javascript
var meta = require('./meta');
var metadata = new meta.Meta(null, meta.DATATYPE.JSON, meta.FLAGS.REPLY_EXPECTED);
```

### meta.getBuffer()

Return the internal `Buffer`.

It's useful to send the `Meta` object over the network.

### meta.deserialize(Bufffer data)

Deserialize the provided `Buffer`.

It uses the `meta.dataType` attribute to determine how should the `data` be deserialized.

### meta.serialize(Buffer data)

Serialize the provided `Buffer`.

It uses the `meta.dataType` attribute to determine how should the `data` be serialized.

_Note_: This method is not used.
