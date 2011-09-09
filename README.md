# Mithril

## Installing Mithril server for NodeJS

### Installing your game's dependencies

If you have already installed your game's dependencies, you may skip this step.
In your game project, where you should have a package.json, execute the following steps:

1. `rm -rf node_modules`
2. `nmod deps`

### Installing Mithril

The "nmod deps" command will have recreated a directory called "node_modules". We now have to install Mithril there.
After cloning the Mithril repository, we'll install Mithril's dependencies, the same way we installed the game's dependencies.
The compress-buffer dependency has some C-code in it, so it has to be built in order to be usable.

1. `cd node_modules`
2. `git clone --branch develop git@github.com:Wizcorp/Mithril.git mithril` or `git clone --branch develop https://github.com/Wizcorp/Mithril.git mithril`
3. `cd mithril`
4. `rm -rf node_modules`
5. `nmod deps`
6. `cd node_modules/compress-buffer`
7. `./build.sh`

And we're all done! You can now run your game.

## Using Mithril


