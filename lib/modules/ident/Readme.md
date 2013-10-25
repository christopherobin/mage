# Identification module

The identification module is a module used by MAGE on the dashboard and available for the game
developer to implement authentication easily. The system allows you to reference a set of engines
and name them based on the need and switch them easily with minimal changes to your code.

## Engines

* [anonymous](engines/anonymous/Readme.md): Anonymous login, available only in development mode.
* [userpass](engines/userpass/Readme.md): User and password login.

## Configuration

The first step to making engines available to your game is through configuration:

```yaml
module:
	ident:
		# here is your app name, usually game
		game:
			# like archivist, any name will do here, allows you to swap engines easily
			dev:
				# the type is the engine name
				type: anonymous
				config:
					# you need to tell the auth module what level the user will be set to
					access: user
```

That's all you need for anonymous authentication, you can then proceed to implementation. See the
individual [engine](#engines)'s readme for more details on available configuration.

## Implementation

Once that config is here, for anonymous login you would just need to call:

```javascript
	// here we use the our "dev" definition, you can totally omit the second parameter, which is used
	// to give data to the auth engine (for example the "userpass" engine expects a username and
	// password here
	mage.ident.check('main', {}, function (err) {
		if (err) {
			// display some error to the user
			return;
		}

		// login was successful, display the game
	});
```
