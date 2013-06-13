# MAGE

## Description

Magic Asychronous Game Engine. A Node.js server-side game framework to simplify the development of social games.

## Versions

MAGE should generally only be used from the master branch. Version numbering is being applied using the following logic.

	Major.Minor.Build

### The meaning of version change

When a new version is released this may introduce backwards compatibility (BC) issues. Whenever a feature has been planned
to be removed from MAGE, using it will trigger a console warning 'X has been deprecated, and should no longer be used'.

__Major version change__

Backwards compatibility break, and radical API changes/improvements should be expected.
A how-to-upgrade and why-to-upgrade guide will be provided to assist with the porting of existing applications.

__Minor version change__

Some backwards compatibility breaks should be expected.
These will be announced through the Changelog file.

__Build version change__

This should not create BC issues, but may expose new APIs and fix existing bugs.
These will be announced through the [Changelog file](./CHANGELOG.md).

## See Also

* [Documentation](./docs/README.md)
* [Server requirements](./docs/REQUIREMENTS.md:w)
* [Installation guide](./docs/INSTALLATION.md)
* [API Documentation](./docs/where?)
