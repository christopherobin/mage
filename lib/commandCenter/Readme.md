# Command Center

The Command Center handles the exposure and processing of MAGE module user commands.

MAGE currently supports the following protocols:
* MAGE user command legacy protocol, through [httpBatchHandler](./httpBatchHandler.js);
* [JSON-RPC](http://www.jsonrpc.org/specification) protocol, through [jsonrpcBatchHandler](./jsonrpcBatchHandler.js).


## Legacy protocol

It uses the following endpoint: `/<appname>/`.

MAGE automatically add functions to your modules to have an easy access to your user commands.
If you have a `gift` user command a `gifting` module, you can use `mage.gifting.gift()`.

If you want to use directly the command, you have to use the `msgServer` module.
``` javascript
var mage = require('mage');
mage.msgServer.sendCommand('gifting.gift', parameters, callback);
```

## JSON-RPC

It uses the following endpoint: `/<appname>/jsonrpc`.

You must send the following to call the `gift` user command of the `gifting` module.
```
{"jsonrpc": "2.0", "method": "gifting.test", "id": 1, "params": {} }
```

### Headers

You can add custom headers of the following form `X-MAGE-*`,
which will be processed by the previously registered message hooks.

The session module define the `mage.session` hook to handle the `X-MAGE-SESSION` header.
You should use this header to make a request as an authenticated user.

To register a new message hook, you should use the `registerMessageHook(type, function)` function.
It registers a new function to execute on each request, with the header corresponding to the given type.
To handle the `X-MAGE-FOO` header, you have to register a function for `mage.foo`.
