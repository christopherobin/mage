# Identification module

The identification module is a module used by MAGE on the dashboard and is available for the game
developer to implement authentication easily. The system allows you to reference a set of engines
and name them based on your needs. You can switch between them easily with minimal changes to your
code.

The dashboard is by default plugged on the anonymous engine. You can set it up to use username and
password by overriding the default configuration.

## Configuration

The first step to making engines available to your game is through configuration:

```yaml
module:
    ident:
        engines:
            # Configuration for all the engines we want to use

            userlogin:             # The name we give to the engine
                type: userpass     # The type of engine
                access: user       # Authenticated users can access up to "user" level user commands.
                config:
                                   # Engine specific config

            dashboardlogin:        # The name we give to the engine
                type: ldap         # The type of engine
                access: admin      # Authenticated users can access up to "admin" level user commands.
                config:
                                   # Engine specific config
```

The example above shows you all patterns for authentication. Feel free to name the engines anything
you want. See the individual [engines](#engines)' documentation for more details on how to configure
them.

## Engines

* [anonymous](engines/anonymous/Readme.md): Anonymous login (not configurable).
* [userpass](engines/userpass/Readme.md): Username and password login.
* [ldap](engines/ldap/Readme.md): LDAP based login.

## API

### User objects

Whenever a user object is returned through any API, it will have the following format.

```javascript
var user = {
  "userId": "string",      // unique identifier within the realm of the engine
  "displayName": "string", // a name used to represent the user, not required to be unique
  "data": {}               // an arbitrary object with extra properties to describe this user
};
```

No credentials will ever be included in this object.

### Client API

#### ident.getEngines()

If you need to detect which engines have been exposed by the ident module, please run:

```javascript
mage.ident.getEngines(function (error, engines) {
	/* engines is now [{ type: 'userpass', engineName: 'userlogin', access: 'user' }, { etc }] */
});
```

#### ident.login(engineName, credentials, options)

To login from a browser you would just need to call the following.

```javascript
// Credentials to send to the auth engine.

var credentials = {
	username: window.prompt('What is your username?'),
	password: window.prompt('What is your password?')
};

// The options object only contains parameters that can be used in development mode.

var options = {
	access: 'admin',     // choose a specific access level (optional, default: admin)
	userId: someUsersId  // login as someone else (optional)
};

// you use the `check` method to login and pass it the name of the engine as you have configured it.

mage.ident.login('userpass', credentials, options, function (error, data) {
	if (error) {
		return window.alert(error);
	}

	// Login was successful! You should now have a session.
});
```

After a successful login, the ident module will expose a property called `mage.ident.user`,
containing your user object (see the chapter above on "User objects").
It will also set the session key.

The second parameter of the callback function contains the following object:
```json
{
  "user": {
    "userId": "string",      // unique identifier within the realm of the engine
    "displayName": "string", // a name used to represent the user, not required to be unique
    "data": {}
  },
  "session": {
    "key": "string",         // The session key
    "actorId": "string"      // The actorId assigned to this session
  }
}
```

### Server API

#### ident.registerPostLoginHook([engineName], hook)

To register a function that is to be called whenever a user logs in, you can register a function on
a particular engine. If you leave out the engine name, the function will be registered on all
engines.

#### ident.unregisterPostLoginHook([engineName], hook)

By passing a previously registered function, you can remove it from the login hooks. It will then no
longer be called when a user logs in on the given engine (or all engines if engine name was left
out).

#### ident.getEngine(engineName)

Returns the engine by the given name. You can use this to access engine specific API. See the
engines documentation for more on their APIs.
