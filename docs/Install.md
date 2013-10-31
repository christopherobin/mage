# Installing MAGE

## Make sure all requirements are met

Read more about [requirements](./Requirements.md).

## Naming your environment

When MAGE creates a new project, it will set up a configuration file for your environment. The name
of your environment is decided by the `NODE_ENV` environment variable. If your system administrator
has not already prepared it for you on the system you are developing on, you can do it yourself by
adding the following line to `.bashrc` in your home directory (replace "bob" with your own name or
username):

```sh
export NODE_ENV=bob
```

The MAGE installer will create a `bob.yaml` configuration file, and will use that from there on,
whenever you start up the game.

## Setting up a new MAGE project

Running the following steps is the easiest way to bootstrap a new project. Do this **from inside an
empty folder** that is named after the game you are developing.

```bash
mkdir -p node_modules
BOOTSTRAP=true npm install "git+ssh://git@github.com:Wizcorp/mage#master"
```

Running the above, will:

* Install the latest version of MAGE.
* Install MAGE's dependencies.
* Create your MAGE application skeleton.
* Prompt for your project information.
* Optionally, will help you set up your git repository, do your first commit and push to your remote
  repository.
* Tell you how to start up the game and access it from your browser.

Some **special environments** have an improved flow, which can be enabled by replacing the
`BOOTSTRAP` value `true` with the name of a supported environment. For example,
`BOOTSTRAP=wizcorp-dev` for the Wizcorp development environment.

## Upgrading MAGE in an existing project

To upgrade to a new version of MAGE, update your package.json's dependency entry for MAGE. You can
change the version number or label present after the pound (#) sign.

Snippet from package.json:

```json
{
	"dependencies": {
		"mage": "git+ssh://git@github.com:Wizcorp/mage.git#v0.23.4"
	}
}
```

Installing MAGE

```bash
rm -rf node_modules/mage
npm install mage
```

## Working with the development version (USE WITH CAUTION)

You may choose, for the duration of your application development, to work on the development version
of MAGE. To do so, simply point your reference in package.json to "#develop", rather than "#master"
or a numbered version.

Be careful not to push your code into production on the develop branch. The code can change at any
time, so you are strongly advised to select a fixed version.
