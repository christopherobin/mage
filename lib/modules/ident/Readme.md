# Identification module

The identification module is a module used by MAGE on the dashboard and is available for the game
developer to implement authentication easily. The system allows you to reference a set of engines
and name them based on your needs. You can switch between them easily with minimal changes to your
code.

The dashboard is by default plugged on the anonymous engine. You can set it up to use username and
password by overriding the default configuration. The engine is expected to be named `default`.

## Configuration

The first step to making engines available to your game is through configuration:

```yaml
module:
    ident:
        engines:
            # configuration for all the engines we want to use

            open:                  # the name we give to the engine
                type: anonymous    # the engine type
                access: anonymous  # An anonymous user can do no more than anonymous access level
                                   # user commands. During development mode, this is ignored in
                                   # favor of "admin" level.

            userlogin:             # the name we give to the engine
                type: userpass
                access: user       # Authenticated users can access up to "user" level user commands.
                config:
                                   # engine specific config

            dashboardlogin:        # the name we give to the engine
                type: ldap
                access: admin      # Authenticated users can access up to "admin" level user commands.
                config:
                                   # engine specific config
```

The example above shows you all patterns for authentication. Feel free to name the engines anything
you want. See the individual [engines](#engines)' documentation for more details on how to configure
them.

## Engines

* [anonymous](engines/anonymous/Readme.md): Anonymous login.
* [userpass](engines/userpass/Readme.md): Username and password login.
* [ldap](engines/ldap/Readme.md): LDAP based login.

## Implementation

Once that config is here, to login from a browser you would just need to call the following.

```javascript
// Credentials to send to the auth engine. Optional for anonymous login.

var credentials = {
	userId: window.prompt('What is your username?'),
	password: window.prompt('What is your password?')
};

// The control object is optional and cannot be used outside of development mode.

var control = {
	access: 'admin',     // choose a specific access level (optional, default: admin)
	userId: someUsersId  // login as someone else (optional)
};

mage.ident.check('dev', credentials, control, function (error, user) {
	if (error) {
		return window.alert(error);
	}

	// login was successful!
});
```

### User objects

Whenever a user object is returned, it will have the following format.

```javascript
var user = {
  "userId": "string",      // unique identifier within the realm of the engine
  "displayName": "string", // a name used to represent the user, not required to be unique
  "data": {}               // an arbitrary object with extra properties to describe this user
};
```

No credentials will ever be included in this object.
