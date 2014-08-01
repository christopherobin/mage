# Single-server

This engine allows you to have a fake service discovery engine, to have the
service discovery library available when you are using only one server and
you don't use the cluster mode.

All the services are registered directly in the memory, that's why the services
can't be shared between multiples processes.

## Limitations

* It works only if you have one server.
* You can't use the cluster mode.
