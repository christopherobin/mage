# Modules

## File structure

```plaintext
mygame/
  lib/
    modules/
      players/    -- the name of our module
        index.js  -- the entry point of the module
        usercommands/
          login.js  -- the user command we use to login
```

Modules are a way to separate concerns; they contain groups of
functionality for a certain subject (users, ranking, shop, etc),
and expose API (called user commands) that are accessible through
the different client SDKs.

## Module setup and teardown

> lib/modules/players/index.js

```javascript
exports.setup = function (state, callback) {
  // load some data
  callSomething('someData', callback);
};

exports.teardown = function (state, callback) {
  // load some data
  callSomething('someData', callback);
};
```

MAGE modules can optionally have the two following hooks:

  * **setup**: When the server is started
  * **teardown**: When the server is about to be stopped

The setup function will run when MAGE boots up allowing your module
to prepare itself, for example by loading vital information from a data store into memory.
This function is optional, so if you do not have a setup phase, you don't need to add it.

Teardown functions in a similar way; you may want to store to database
some data you have been keeping in memory, or send some notifications to your users.

Note that by default, each hook will have 5000 milliseconds to complete; should you need
longer than that, you will need to set `exports.setupTimeout` and `exports.teardownTimeout`
respectively to the value of your choice.

## Module methods

> lib/modules/players/index.js

```javascript
var mage = require('mage');

exports.register = function (state, username, password, callback) {
  var options = {
    acl: ['user']
  };

  mage.auth.register(state, username, password, { options }, callback);
};
```

You will then want to add methods to your modules. These are different from your API endpoints;
they are similar to model methods in an MVC framework, but they are not attached to an object
instance.

This example shows how you could create a quick player registration method.

## User commands

> lib/modules/players/usercommands/register.js

```javascript
var mage = require('mage');

// Who can access this API?
exports.acl = ['*'];

// The API endpoint function
exports.execute = function (state, username, password, callback) {
  mage.players.register(state, username, password, function (error, userId) {
    if (error) {
      return state.error(error.code, error, callback);
    }

    state.respond(userId);

    return callback();
  });
};
```

User commands are the endpoints which the game client will be accessing. They define
what class of users may access them, and what parameters are acceptable.

The name of a user command is composed of its module name and the name of the file.
For instance, in the example here, the name of the user command would be `players.register`.
The parameters this user command accepts are everything between the `state` parameter and the
`callback` parameter; so in this case, `players.register` accepts a `username` parameter, and
a `password` parameter.

Our user command also receives a state object. We won't describe exactly what states are used
for yet, but we can see that they are to be used to respond with an error should one occur.

## Testing your user command

```shell
npm run archivist-create
npm run develop
```

```powershell
npm run archivist-create
npm run develop
```

Before we try to test the code above, we will first need to create a place for the auth module
to store the data. `archivist-create` will do just that.

Once this command completes, we'll start our MAGE project in development mode.

> In a separate terminal window

```shell
curl -X POST http://127.0.0.1:8080/game/players.register \
--data-binary @- << EOF
[]
{"username": "test","password": "secret"}
EOF
```

```powershell
 Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/game/players.register" -Body '[]
{"username": "username", "password": "password"}'
```

For testing most user commands in MAGE, you would normally need to use one
of the [client SDKs](#client-sdks); however, this example is simple enough
for us to be able to simply query the endpoint manually.

You may notice that the content we send is in line-separated JSON format, and
that the first thing we send is an empty array; this array, under normal
circumstances, would contain credentials and other metadata.

## Using async/await (Node 7.6+)

<aside class="notice">
If you are using Node.js 7 but older than 7.6, you can still use
async/await by adding [enable-async](https://www.npmjs.com/package/enable-async)
to your project.
</aside>

> lib/modules/players/index.js

```javascript
'use strict';

const promisify = require('es6-promisify');
const {
  auth
} = require('mage');

exports.register = function (state, username, password) {
  const options = {
    acl: ['user']
  };

  const register = promisify(auth.register, auth);

  return register(state, username, password, options);
};
```

> lib/modules/players/usercommands/register.js

```javascript
'use strict';

const {
  players
} = require('mage');

module.exports = {
  acl: ['*'],
  async execute(state, username, password) {
    return await players.register(state, username, password);
  }
};
```

> lib/modules/players/usercommands/staticData.js

```javascript
'use strict';

module.exports = {
  serialize: false,
  acl: ['*'],
  async execute(state) {
    return '{"static": "data"}';
  }
};
```

If you are using a newer Node.js version, which includes the latest ES2015 and ES2017
language features, you can rewrite the previous API as follows. As you can see, this results not
only in much fewer lines of code, but also into a much simpler, easier to read code.

Let's review what we have done here:

  1. Variable declaration using `const`, which prohibits the variable to be rebound;
  2. Destructuring, to extract the specific MAGE modules and components we want to use;
  3. async/await and Promises, to simplify the expression of asynchronous code paths;

Note that due to legacy, most of MAGE's API are callback-based, which can sometimes conflict with
the latest Promise-based API's; to help with this, we recommend that you install
[es6-promisify](https://www.npmjs.com/package/es6-promisify) in your project, and then use it to
wrap the different MAGE APIs you wish to use.

Also, you can see that the `players.staticData` user command serializes data by itself to JSON
instead of relying on MAGE to serialize the return data. This can be useful when you wish to optimize how MAGE
will serve certain pieces of data which will not change frequently. When you wish to do so, simply make
sure that `exports.serialize` is set to `false`, and to manually return a stringified version of your
data.
