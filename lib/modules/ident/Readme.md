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
        apps:
            # here is your app name, usually game
            game:
                # like archivist, any name will do here, allows you to swap engines easily
                dev:
                    # "type" is the engine type (ldap, userpass, etc...).
					type: anonymous

                    # "access" is the access level the user will get after authenticating.
                    # During development mode, this will be ignored in favor of "admin".
                    access: user

                    # Specific configuration to pass to the auth engine (see their documentation).
                    #config:
```

That's all you need for anonymous authentication. You can then proceed to implementation. See the
individual [engines](#engines)' readme for more details on available configuration.

## Engines

* [anonymous](engines/anonymous/Readme.md): Anonymous login, available only in development mode.
* [userpass](engines/userpass/Readme.md): Username and password login.
* [ldap](engines/ldap/Readme.md): LDAP login.

## Implementation

Once that config is here, for anonymous login you would just need to call:

```javascript
// Credentials to send to the auth engine. Optional for anonymous login.

var credentials = {
	username: window.prompt('What is your username?'),
	password: window.prompt('What is your password?')
};

// The control object is optional and cannot be used outside of development mode.

var control = {
	access: 'admin',     // choose a specific access level (optional, default: admin)
	userId: someUsersId  // login as someone else (optional)
};

mage.ident.check('dev', credentials, control, function (error, userId) {
	if (error) {
		return window.alert(error);
	}

	// login was successful!
});
```

