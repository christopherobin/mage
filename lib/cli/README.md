# Mage CLI & Tab Completion

## CLI

Those are the commands you can pass to mage:

To run those, ```cd``` to the root folder of your game,
and use ```node . [command]``` where ```[command]``` is one of the commands listed below.

- ```install-components```            install all components used in apps and dashboards into ./components
- ```build [options]```               builds all apps into ./build
- ```assets-index```                  index assets for all apps
- ```create-phantom <app>```          output a PhantomJS client for the given app
- ```show-config [options] [trail]``` output the full configuration, or the sub-config at the given trail in JSON
- ```archivist-create [vaults]```     create database environments for all configured vaults
- ```archivist-drop [vaults]```       destroy database environments for all configured vaults (use with caution!)
- ```archivist-migrate [version]```   migrates all vaults to the current version, or to the version requested
- ```start```                         start the application daemonized
- ```stop```                          stop the daemonized application
- ```restart```                       restart the daemonized application
- ```reload```                        recycle all workers with zero-downtime (not to be used on version changes)
- ```status```                        output the status of the daemonized application

## Tab Completion

### How to install

#### Recommended way:

```make dev```

Which will setup the githooks and the tab completion.

#### You can also:

```make dev-autocomplete```

Which will only setup the tab completion


### Implementation Details

The current implementation of tab completion uses tabalot.

Tabalot pretty much works this way:

- ```node . completion -- word``` Provides tabcompletion for any command starting with ```word```

Because of a few tweaks we made to simplify the installation process, you can use:

- ```node . completion --filename test_file --bash_completion bash_completion_file --save``` Which will:
    - read information from your package.json to get the necessary information to create a tab completion script
    - save this tab completion script in ```test_file```
    - add a line to ```bash_completion_file``` (usually ```~/.bash_completion```), sourcing ```test_file```
    
Typing make dev-autocomplete at the root folder of your mage project will basically do this for you.
You will then have to ```source``` your ```bash_completion``` (usually ```~/.bash_completion```) file
or restart your shell to benefit from the tab completion.

Every command added to the *program* object in ```lib/cli/index.js``` will benefit from tab completion.

### Others

- I want to create a command for the CLI of Mage, will it show up in the tab completion?

Yes, it will, as long as you respect the convention of adding it to ```program``` in ```lib/cli/index.js```
