# Mithril

## Installing Mithril server for Node.js

### Installing your game's dependencies

If you have already installed your game's dependencies, you may skip this step.
In your game project, where you should have a package.json, execute the following steps:

1. `rm -rf node_modules`
2. `npm install`

### Installing Mithril

The "npm install" command will have recreated a directory called "node_modules". We now have to install Mithril there.
After cloning the Mithril repository, we'll install Mithril's dependencies, the same way we installed the game's dependencies.

1. `cd node_modules`
2. `git clone --branch develop git@github.com:Wizcorp/Mithril.git mithril` or `git clone --branch develop https://github.com/Wizcorp/Mithril.git mithril`
3. `cd mithril`
4. `rm -rf node_modules`
5. `npm install`

And we're all done! You can now run your game.

## Versions

Mithril should generally only be used from the master branch. Version numbering is being applied using the following logic.

	Major.Minor.Build

### The meaning of version change

When a new version is released this may introduce backwards compatibility (BC) issues. Whenever a feature has been planned
to be removed from Mithril, using it will trigger a console warning 'X has been deprecated, and should no longer be used'.

__Major version change__

Backwards compatibility break, and radical API changes/improvements should be expected.
A how-to-upgrade and why-to-upgrade guide will be provided to assist with the porting of existing applications.

__Minor version change__

Some backwards compatibility breaks should be expected.
These will be announced through the Changelog file.

__Build version change__

This should not create BC issues, but may expose new APIs and fix existing bugs.
These will be announced through the Changelog file.

