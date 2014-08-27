Testing and writing tests
==========================

Writing your unit tests
------------------------

Coming soon.

Contributing unit tests to MAGE
--------------------------------

Coming soon.

Testing your application or game with the latest MAGE
------------------------------------------------------

Part of the life cycle of your project will be to upgrade
to a newer version of MAGE. However, just like with any
library or engine upgrade, MAGE upgrade do come with a set
of breaking changes which will require from you some amount
of work.

To see if your game will run against the code currently under
the `develop` branch of Wizcorp's repo, simply run from your project's directory:

```bash
make test-mage
```

This will build your project and run its test suite against
what is currently under heavy development.

It is also possible to test against a specific development branch
by running:

```bash
make test-mage branch=somebranch
```

Finally, you may also decide to test the code of a specific
developer. Once this developer has pushed his or her code
in the SCM, run:

```bash
make test-mage mage_repo=git+ssh://git@github.com/somedev/mage.git
```

Make sure the `mage_repo` variable is set accordingly, e.g. to a value which
would be accepted by `npm install`

Testing an application using MAGE (as a MAGE developer)
--------------------------------------------------------

It can be useful as a MAGE developer to either test their code
against existing MAGE applications (or to script a continuous integration tool
to do so regularly). To test your local copy of MAGE against a given application,
run the following from your MAGE project directory:

```bash
make test-app repo=someproject
```

This will clone the project locally, build it and run
its unit test suite.

By default, this will run the develop branch of the project.
To pick a different branch, run:

```bash
make test-app repo=someproject branch=someBranch
```

Finally, by default, this will clone the project from Wizcorp's blessed
repository. To test the code from a different user on GitHub, run:

```bash
make test-app repo=someproject user=someUser
```
