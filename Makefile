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

# target: lint-staged, Lints every JavaScript file in the project that are staged to be comitted.
lint:
	npm run-script lint

# target: lint-all, Lints every JavaScript file in the project.
lint-all:
	npm run-script lint-all

# target: git-setup, Sets up git hooks.
git-setup:
	npm run-script git-setup
