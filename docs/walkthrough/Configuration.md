# Configuration

## Format

The configuration for your game is allowed to exist in either the
[YAML format](http://en.wikipedia.org/wiki/YAML) with the `.yaml` file extension, or the
[JSON format](http://en.wikipedia.org/wiki/JSON) with the `.json` file extension.

In a nutshell, YAML is the more human readable format, while JSON is more JavaScript-y in how it
represents its variable types.

## Location

The files are located in your game's `config` folder. Here you will find a `default.yaml`
configuration file, that you can use to collect all configuration that every single environment
should use (that is, configuration that is not unique to a single developer's environment).

MAGE will also read the `NODE_ENV` [environment variable](http://en.wikipedia.org/wiki/Environment_variables).
It will try to read a configuration file named after its value (which should probably be set to your
user name). If for example, my user name is `bob`, my `NODE_ENV` value would also be `bob`, and I
would place all configuration for my environment in `config/bob.yaml` or `config/bob.json`.

That personalized configuration file augments `default.yaml` and overwrites any values that were
already present.

If you want to load multiple configuration files, you can comma-separate them in your `NODE_ENV`
like this: `NODE_ENV=bob,test`. They will be loaded in order, the latter overriding the former.

## Development

To run your game in development, MAGE has a `developmentMode` configuration flag. This enables or
disables certain behaviors which make development a bit more convenient. If you want more granular
control over which of these behaviors are turned on or off, you can specify them in an object.

```yaml
developmentMode: true  # This turns on all options

# Alternatively, take control by toggling the individual options. The ones you leave out are
# considered to be set to true. Set any of the following to false to change the default
# development mode behavior.

developmentMode:
    loginAs: true              # Allows unsecure login as another user.
    customAccessLevel: true    # Allows unsecure login with any access level (eg: admin).
    adminEverywhere: true      # Changes the default access level from "anonymous" to "admin".
    archivistInspection: true  # Archivist will do heavy sanity checks on queries and mutations.
    buildAppsOnDemand: true    # The web-builder will build apps on-demand for each HTTP request.
```

## Production

In a production environment, you should set `NODE_ENV` to `production` and provide MAGE with a
configuration file called `config/production.yaml` or `config/production.json`.

For more information about running a game in production, please read
[Taking your MAGE game to production](../production/Readme.md).

## Next chapter

[The State class](./State.md)
