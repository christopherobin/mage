# Message Server

The message server is in charge of message propagation through the network.


## MMRP

The message server uses the MMRP library to ensure communication between the different MAGE
instances on the network.

See the [MMRP documentation](./mmrp/Readme.md) for more information.


## Message stream

The messages sent by the server inevitably make their way to a client through a message stream.

See the [Message Stream documentation](./msgStream/Readme.md) for more information.


## Testing your application with AerisCloud and Marathon

When using AerisCloud to test your application across a cluster of servers using the Marathon service, please make sure
to include the following configuration in `config/marathon.yaml`. Over time, the addresses below may change, so always
stay in touch with your friendly local system administrator to make sure these make sense.

```yaml
server:
    clientHost:
        expose: null
        bind:
            port: PORT0
    serviceDiscovery:
        engine: "zookeeper"
        options:
            hosts: "192.168.2.21:2181"
    mmrp:
        bind:
            port: PORT1
        network:
            - "192.168.2"
```

Your Makefile needs to replace the magical constants PORT0 and PORT1 in this file when running. Here's an example of
the marathon Make target:

```make
.PHONY: marathon

marathon:
	source /opt/nvm/nvm.sh && \
	sed -i "s/PORT0/${PORT0}/" config/marathon.yaml && \
	sed -i "s/PORT1/${PORT1}/" config/marathon.yaml && \
	sed -i "s/PORT/${PORT}/" config/marathon.yaml && \
	nvm use 0.10.33 && \
	NODE_ENV=production,marathon HOME=${MESOS_DIRECTORY} make deps && \
	NODE_ENV=production,marathon node .
```

When pushing the application to Marathon, you need to select ports for PORT0 and PORT1. An example:

```sh
aeriscloud marathon office/jp push -p 80 16001
```

[Read more about how to use AerisCloud and Marathon](https://github.com/Wizcorp/AerisCloud/blob/master/docs/walkthrough/marathon.md)