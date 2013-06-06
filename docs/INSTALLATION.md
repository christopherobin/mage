Installing MAGE
=================

Setting up a new MAGE project
------------------------------

```bash
MAGE_VERSION=0.x
mkdir myproject && cd myproject
BOOTSTRAP=true npm install --save git+ssh://git@github.com:Wizcorp/mage#${MAGE_VERSION}
```

This will:

* Install MAGE
* Install MAGE's dependencies
* Create your MAGE application skeleton
* Prompt for your project information (same as npm init)

Installing/upgrading MAGE in an existing project
------------------------------------------------

Upgrade to a new version of MAGE is very simple:

```
MAGE_VERSION=0.x
rm -rf node_modules/mage
npm install --save git+ssh://git@github.com:Wizcorp/mage#${MAGE_VERSION}
```

Working with the development version
-------------------------------------

You may choose, for the duration of you application development, to work on the development version of MAGE. To do so, simply run the following:

```
rm -rf node_modules/mage
npm install --save git+ssh://git@github.com:Wizcorp/mage#develop
```

Be careful not to push your code in production on the develop branch. The code can change at any time, so
you are strongly advised to select a fixed version.

