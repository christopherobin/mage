# %APP_NAME%

## Introduction

%APP_DESCRIPTION%

## Requirements

### Environment

Make sure you have a `NODE_ENV` environment variable set up to describe your environment. For
developers that means you will want it set to your user name. When running CI or production, it
should reflect that. To test if this is already the case, run the following in your shell:

```sh
echo $NODE_ENV
```

If this does not display anything, you must set this up.

Also, please ensure all MAGE requirements as instructed by the
[MAGE documentation](https://github.com/Wizcorp/mage/blob/master/docs/Requirements.md) have been
met. Else, the game may not run as intended.

## Installation

After having cloned this project, you must set up a configuration file for your particular NODE_ENV.
You can do this by copying a `.yaml` file from the `config` folder to `NODE_ENV.yaml` in the same
folder (where you replace "NODE_ENV" with the value of your NODE_ENV variable), and then editing
your copy to suit your needs.

Once you have set up your configuration, you can install all dependencies and set up databases by
running:

```sh
make all
```

For more information on what `make` can do for you, please run `make help`.

### Developers

If you are a developer working on this project, we **require** you to set up a git hook that will
test your code changes when you commit them into the repository. You can automatically set up this
hook by running:

```sh
make dev
```

You only have to do this once.

## Project Updates

After merging in a new version of this project, please run `make all` again to update dependencies
and ensure all required database migration scripts have run.
