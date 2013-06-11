Installing MAGE
=================

Setting up a new MAGE project
------------------------------

```bash
mkdir myproject && cd myproject
BOOTSTRAP=true npm install git+ssh://git@github.com:Wizcorp/mage#master
```

This will:

* Install MAGE latest version
* Install MAGE's dependencies
* Create your MAGE application skeleton
* Prompt for your project information (same as npm init)
* Optionally, will help you set up your git repository, do your first commit and push to your remote repository

Installing/upgrading MAGE in an existing project
------------------------------------------------

Upgrade to a new version of MAGE is very simple. Simply update your package.json's dependency entry for MAGE. Simply change the version number or label present after the poundi (#) sign.

```
rm -rf node_modules/mage
npm install mage
```

Working with the development version
-------------------------------------

You may choose, for the duration of you application development, to work on the development version of MAGE. To do so, simply run the following:

```
rm -rf node_modules/mage
npm install git+ssh://git@github.com:Wizcorp/mage#develop
```

Be careful not to push your code in production on the develop branch. The code can change at any time, so
you are strongly advised to select a fixed version.

