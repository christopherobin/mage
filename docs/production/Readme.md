# Taking your MAGE game to production

Taking any game to production can be stressful and intensive. To help you make sure all your tracks
are covered, we have set up this checklist.


## Configuration

Configuration as used by developers is not always quite like you want to run a game in production.
Your production environment should have its own config file, just like developers have their own,
using the `NODE_ENV` environment variable. More on how this works can be read in the
[Configuration documentation](../../lib/config).

Because of the decentralized nature of configuration, you can see the result of all combined files
by running `./game show-config`. Another way to see the combined configuration is by opening the
game's "dev" dashboard (but it will have to be running), and going to the configuration inspector.

### What to look for

#### developmentMode

The `developmentMode` entry MUST be turned off. You may also choose to run the game with an
environment variable which explicitly turns it off, just in case the configuration went wrong, by
running it like this:

```sh
DEVELOPMENT_MODE=false make start
```

You can also test for its value in an automated fashion, by running something like this:

```sh
if [ "false" != "$(node . show-config developmentMode)" ]
then
  echo 'I refuse to deploy a game that is set to development-mode!'
  exit 1
fi
```

#### server

The "server" entry in the configuration must be set up properly. That *probably* means:

- `cluster` should be set to a number to indicate a worker count, or even better, to `true` (meaning
  that as many workers will be spawned as the CPU has cores).
- `serviceDiscovery.engine` should be appropriately selected for this environment.
- `mmrp` must be set up to allow all MAGE servers to communicate with each other on the network.
- `sampler` collects performance metrics. Are you going to use them or should you turn it off?

#### logging

Should you really be logging to multiple targets? It probably makes a lot of sense to turn off
terminal logging altogether.

#### apps

If dashboards are not needed in production, disable them! There are three dashboards: `dev`, `cms`
and `support`. If you have a customer support dashboard, expose just that. Not `dev` (for
developers) and `cms` (for content managers).

#### archivist

Are all vaults (databases) set up the way they should be? Are they the right types? Check IPs,
ports, authentication.


## Packaging and deploying

When you have confirmed that configuration is appropriate for production, you can move on to the
actual push. There are a only few steps to undertake, in an order that depends on how you choose to
deploy the game.

### If you package the game before pushing to production

1. Run `make deps` (external dependency download and installation), but *expect compiled binaries*.
2. Run `make build` (web builds).
3. Package the game (don't get burned by `.gitignore` by developers).
4. Push the package to all production servers.
5. Run `make datastores` on **one** server (DB installation and migration).

### If you push the Git repository as-is

1. Push the repository to all production servers.
2. Run `make deps` on all servers (external dependency download and installation).
3. Run `make build` on all servers (web builds).
4. Run `make datastores` on **one** server (DB installation and migration).

> If there are any other requirements for a particular game, that game **must** document these in
> `Readme.md` in the root folder of the project.


## Starting, restarting, stopping

The easiest way to manage a game is by using `make`. You can use the following commands:

To **start the game**:

```sh
make start
```

To **restart the game**:

```sh
make restart
```

To have a **zero-downtime restart of all workers** (please note that the master will *not* be
restarted, so this should only be used for micro-pushes):

```sh
make reload
```

To **stop the game**:

```sh
make stop
```

To check **if a game is running**:

```sh
make status
```
