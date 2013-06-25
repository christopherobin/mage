# Installing MAGE

## Make sure all requirements are met

Read more about this [here](./Requirements.md).

## Setting up a new MAGE project

```bash
mkdir myproject && cd myproject
BOOTSTRAP=true npm install git+ssh://git@github.com:Wizcorp/mage#master
```

This will:

* Install the latest version of MAGE.
* Install MAGE's dependencies.
* Create your MAGE application skeleton.
* Prompt for your project information (same as npm init).
* Optionally, will help you set up your git repository, do your first commit and push to your remote repository.

## Installing/upgrading MAGE in an existing project

To upgrade to a new version of MAGE, update your package.json's dependency entry for MAGE. You can
change the version number or label present after the pound (#) sign.

Snippet from package.json:
```json
{
	"dependencies": {
		"mage": "git+ssh://git@github.com:Wizcorp/mage.git#v0.13.0"
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
