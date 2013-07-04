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
It will try to read a configuration file named after its value (whch should probably be set to your
user name). If for example, my user name is `bob`, my `NODE_ENV` value would also be `bob`, and I
would place all configuration for my environment in `config/bob.yaml` or `config/bob.json`.

That personalized configuration file augments `default.yaml` and overwrites any values that were
already present.

## Production

In a production environment, you should set `NODE_ENV` to `production` and provide MAGE with a
configuration file called `config/production.yaml` or `config/production.json`.
