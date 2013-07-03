# target: help, Display callable targets.
help:
	egrep "^# target:" [Mm]akefile

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
lint-staged:
	npm run-script lint-staged

# target: lint-all, Lints every JavaScript file in the project.
lint-all:
	npm run-script lint-all

# target: setup, Sets up git hooks
setup:
	npm run-script setup
