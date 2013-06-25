# target: help, Display callable targets.
help:
	egrep "^# target:" [Mm]akefile

# target: setup, Do a full setup (currently an alias for git-setup).
setup: git-setup

# target: clean, Cleans the NPM cache.
clean:
	npm cache clean

# target: install, Installs all Node.js dependencies.
install:
	npm install

# target: test, Runs all tests.
test:
	npm test
