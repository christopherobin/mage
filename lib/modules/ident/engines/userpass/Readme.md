# User/Password Ident Engine

The `userpass` engine provides a basic username/password identification mechanism to be used with
your game. It uses hash based identification and allows you to store your credentials in archivist.
This archivist topic (`credentials` by default), can be overridden in the configuration.
Requirements are that the vault you use supports `get` and `set` operations and the index is set to
`[ 'userId' ]`.

The userId is not the same as the username. To create a user ID that is unique to the whole system
and across different ident engines, the ID is built as `engine name COLON username`, for example:
`userpass:bob`.

## Configuration

This is the engine configuration:

```yaml
config:
	# you can override the archivist topic here (default: "credentials")
	#topic: "identusers"

	# change the size of salts generated when creating a new user, by default the engine uses
	# 32 bytes which should be more than enough for quite a while but like the pbkdf2 iterations
	# you may want to bump it every few years if you are using a basic hash algo (such as md5 or
	# sha1) as cloud computing and ASICs become cheaper every year making brute force easier
	#saltSize: 32

	# you can enable password hashing by setting a valid hash algo here, see:
	# http://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm
	# for a list of algorithms
	#hash: sha1

	# hmac are supported too
	#hmac:
	#	algorithm: sha256
	#	key: somelongkeythatnoonewillguess

	# pbkdf2 is nowadays the recommended way to store passwords
	# the number of iterations should be adapted to your hardware, at least 10k is recommended but
	# if the servers are good enough you can go to way up, you will need to experiment for that one
	# (maybe we should make a tool to measure the optimal amount of iterations?)
	# it is recommended to bump that number up every year or so for the same reasons given about the
	# salt size
	#pbdkf2:
	#	iterations: 15000
```

## Parameters

These are the parameters you can give to the `check` function for that engine:

* __username__ _(string)_: The user's username.
* __password__ _(string)_: The user's password.

## User management

### Getting the engine instance

```javascript
var engine = mage.ident.getEngine(engineName);
```

### Creating a user

```javascript
var credentials = {
	username: 'Bob',
	password: 'f00b4r'
};

// `user` is optional but here are the possible values
var user = {
	displayName: 'the name that is gonna be displayed (default is credentials.username)',
	data: {
		property: 'Any data you need to store about your user'
	}
};

engine.createUser(state, credentials, user, function (error, user) { /* .. */ });
```

### Getting a single user object

```javascript
engine.getUser(state, userId, function (error, user) { /* .. */ });
```

### Listing users

```javascript
engine.listUsers(state, function (error, users) {
	// users is an array of User objects
});
