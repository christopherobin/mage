# Anonymous Ident Engine

The anonymous ident engine is the default identification that was used on the dashboard before, it
runs only in development mode and allow you to quickly login without any check. It also allows you
to override the access level you are login with and force the actorId from the client.

## Configuration

This is the engine configuration:

```yaml
config:
	# access is the default access level the user get on login
	access: admin
```

## Parameters

This is the parameters you can give to the `check` function for that engine:

* __access__ _(string)_: Override the default access level.
* __actorId__ _(string)_: The actor ID, a new `actorId` will be generated for each login attempt if
  you don't provide one here.