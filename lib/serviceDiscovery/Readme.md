# The Service Discovery library

The Service Discovery library is a library that allows you to announce and discover services on the local network,
through different types of engines. It helps coordinating larges clusters of applications by providing a near zero
configuration environment.

The service allows the user to provides metadata that is stored on the network and retrieved when discovering devices,
code can then do filtering or retrieve basic configuration options from this metadata.

__Warning!__ Metadata should never contain any sensitive data such as usernames, passwords, etc...! In the case of mDNS
for example, data is broadcasted using UDP on the local network with no restriction, as such any device on the local
network can access this metadata!

## Configuration

By default, configuration is not mandatory, it will default to mDNS for local network discovery. Due to the nature of
cloud based solutions such as Amazon EC2, mDNS will fail to work correctly and you will need to setup an alternative.
For now the only alternative is zookeeper, here is the configuration:

```yaml
server:
    serviceDiscovery:
        engine: "zookeeper"
        options:
            hosts: "192.168.1.12:2181,192.168.3.18:2181,etc..."
```

## Engines

 - [mdns](engines/mdns/Readme.md), announce on the local network using udp broadcasts/multicasts, useful for development
    purposes.
 - [zookeeper](engines/zookeeper/Readme.md), uses zookeeper to store the network topology, allowing usage in specific
    environments where servers cannot be located on the same local network (Amazon and Cloud providers for example).

## API

### Module

#### Methods

 - `serviceDiscovery.createService(name, type)`, where `name` is the name of your service, and `type` is either _tcp_
    or _udp_. Returns a `Service` instance.

### Service

#### Methods

 - `service.announce(port, metadata, cb)`, where `port` is the port you want to announce, `metadata` is a blob of data associated
    with the service and `cb` is a callback called with a potential error object once the announcement is done.
 - `service.discover()`, starts the discovery process, firing events when nodes gets up or down on the network

#### Events

 - `up`, fired when a node appear on the network (after an announcement), provides a `ServiceNode` instance.
 - `down`, fired when a node disappear from the network, also provides a `ServiceNode` instance.
 - `error`, fired when an error occur.

### ServiceNode

#### Properties

 - `host`, the hostname of the machine hosting the service.
 - `port`, the announced port.
 - `addresses`, a list of ips, either IPv4 or IPv6, see the method `getIp` for a better way to access this list.
 - `data`, the metadata associated with the service.

#### Methods

 - `getIp(version)`, allows you to retrieve an IP from the addresses list, `version` is the IP version, either 4 or 6.
 - `isLocal()`, whether the node is running on the current server or not.

#### Todo

 - Add a method to iterate on ips by version
 - Add a up/down event on the node itself?

## Examples

### Finding nodes on the network

```javascript
// load the module
var serviceDiscovery = require('../serviceDiscovery'),
    mage = require('../mage'),
    logger = mage.core.logger.context('mysql'),
    mysql = require('some-imaginary-mysql-client-module');

// create our service, let's say for mysql servers on a tcp socket
var service = serviceDiscovery.createService('mysql', 'tcp');

// when a mysql server appear on the network
service.on('up', function (service) {
    // connect to the mysql service we just found
    mysql.connect(service.getIp(4), service.port, function (error) {
        if (error) {
            // fatal
        }

        // do stuff
    });
});

// or when one goes down
service.on('down', function (service) {
    // mysql went down, start panicking!
});

// start discovering
service.discover();
```

### Announcing your service to the world

```javascript
// load the module
var serviceDiscovery = require('../serviceDiscovery'),
    mage = require('../mage'),
    logger = mage.core.logger.context('hello'),
    hello = require('imaginary-hello-server');

// create our service, let's say this is a hello world HTTP server
var service = serviceDiscovery.createService('hello', 'tcp');

hello.listen(80, function (error) {
    if (error) {
        // error stuff
        logger.emergency('Could not start hello server on port 80');
        mage.fatalError();
        return;
    }

    // announce our service to everyone, and also tell them that we support SPDY
    service.announce(80, { spdySupport: true }, function (error) {
        if (error) {
            // error stuff
            logger.emergency('No one can see us, announcing failed!');
            return;
        }

        logger.debug('Server announced successfully!');
    });
});
```

## TODO

 - Right now `zookeeper` only announces the first IPv4 it can find in the interfaces that is not internal, it may be
better to exposes every non-internal ips in the future though it may need more work for whoever is discovering the
network to filter the unwanted ip types.