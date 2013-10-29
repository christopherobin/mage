# LDAP Ident Engine

The `ldap` engine provides a username/password identification mechanism that queries a LDAP server
for checking the user credentials. It doesn't require anything beside installing the `ldapjs` module
and having a functional LDAP server.

## Configuration

This is the engine configuration:

```yaml
config:
	# access is the default access level the user get on login
	access: user

	# the url is where to query the server, use ldap:// for unencrypted access and ldaps:// for ssl
	url: 'ldap://ldap.my.organization.com'

	# the base DN is something your administrator should know, it is the location where your users
	# are stored on the ldap server
	baseDn: 'ou=users,dc=my,dc=organization,dc=com'

	# by default we match the username on the "uid" attribute of the user, which is a safe default,
	# but in some cases you may need to override it based on your ldap server and configuration
	#uidAttr: "uid"
```

## Parameters

This is the parameters you can give to the `check` function for that engine:

* __username__ _(string)_: The user's username.
* __password__ _(string)_: The user's password.
