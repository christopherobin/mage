# Configuration

Configuration is hierarchical, and based upon the `NODE_ENV` environment variable. Configuration
can be found in a number of places, and may be either JSON or YAML. In **ascending** importance:

 1. Module `config` files
 2. Game `default` file
 3. Personal configuration file

For example, if a field exists in the game default configuration, and also in a module default
configuration, then the game configuration wins.

## Module default files

A typical module is a folder that may look like:

 - `missions`
  - `clients/`
  - `usercommands/`
  - `index.js`
  - `client.js`
  - `component.json`
  - `default.json`

When you tell Mage to use a module, it will automatically know that it should look for and load the
default configuration file. It may be a YAML or a JSON file. Your choice. If no file is found, then
Mage doesn't mind and assumes that no configuration was necessary. A `config.yaml` file that
looks like:

```yaml
hello: world
```

will be loaded into the Mage configuration object under `module.missions`. The `module` field is
fixed, and the `missions` field is taken from the name of the module in the file system. The mage
configuration object will look like (considering only the added data):

```json
{
    "module": {
        "missions": {
            "hello": "world"
        }
    }
}
```

Remember, this is the lowest importance of configuration. You can choose to override it with the
game default configuration file, or a personal configuration file.

## Game default file

The game default file should contain fields common to, or sensible as defaults in, all
environments. Remember, the production and personal configurations files override the content of
this file, so having things in here does not limit you. This file lives in the top level of your
game project, in the `config/` folder.

## Personal configuration file

Finally, the environment variable `NODE_ENV` is read to determine which file to use as a personal
configuration. These files live in the `config/` directory along with the `default` configuration
file. The value of `NODE_ENV` should be equal to the name of the configuration file you want to
use, sans extension. i.e. If your `NODE_ENV` resolves to `me`, then the personal configuration file
to be used should be called `me.json` or `me.yaml` (don't have both in the directory, just don't).
Make sure you set this environment variable in your `.bash_profile` or `.profile` so you don't have
to keep typing it.

## Methods

The methods of the configuration object should be avoided most of the time and are mainly for mage
internal use. However, there may be cases for which configuration is automatically generated etc.
, when these methods may be useful.

`mage.core.config` exposes the following methods:

 - `setDefaults(defaults);`
 - `setModuleDefault(moduleName, defualtObject);`
 - `get(modulePath, [alt]);`

### `setDefaults`

Merges an object into an existing configuration, without overriding existing content. This is
intended for Mage internal use and should not be used in games.

### `setModuleDefault`

Used to define the default configuration of a game module. This should be avoided in favour of the
module default configuration file. This mechanism is used when Mage loads module default
configuration files.

### `get`

A safe getter function, so you don't have to check the existence of keys or wrap a try-catch
around your code. The `modulePath` should be an array of keys of increasing depth. The optional
`alt` parameter is a value to use if there is no value found at this path. By default `undefined`
will be returned if the object does not have this path. It should not be necessary to use this
function in most cases if you have module defaults.