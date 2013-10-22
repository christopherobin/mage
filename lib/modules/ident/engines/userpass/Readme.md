# User/Password Ident Engine

The `userpass` engine provides some basic user/password identification mechanism to be used with
your game, it provides plaintext and hash based identification and allow you to store your credentials
in any topic that match it's signature.

It depends on a valid topic, default being `credentials` but can be overridden in the configuration,
that supports `get` and `set` operations and whose index is `[ 'username' ]`. It will pull the
credentials data from there and look for a value named `password`. Upon successfully identification
the user for the first time it will then proceed to `set` a fixed `actorId` on the topic value.

## Configuration

This is the engine configuration:

```yaml
config:
	# access is the default access level the user get on login
	access: user

	# you can override the topic here
	#topic: something_else_than_credentials

	# you can enable password hashing by setting a valid hash algo here, see:
	# http://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm
	# for a list of algorithms
	#hash: sha1

	# hmac are supported too
	#hmac:
	#	algorithm: sha256
	#	key: somelongkeythatnoonewillguess
```

## Parameters

This is the parameters you can give to the `check` function for that engine:

* __username__ _(string)_: The user's username.
* __password__ _(string)_: The user's password.