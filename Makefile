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

# target: lint, Lints every JavaScript file in the project that are staged to be comitted.
lint:
	@echo linting staged files...
	git diff --raw --name-only --cached --diff-filter=ACMR | grep -e '\.js$$' | xargs -I '{}' ./node_modules/.bin/jshint --config ./scripts/jshint.cfg --reporter ./scripts/humanJshintReporter.js '{}'

# target: lint-all, Lints every JavaScript file in the project.
lint-all:
	@echo linting all files...
	./node_modules/.bin/jshint --config ./scripts/jshint.cfg  --reporter ./scripts/humanJshintReporter.js .

# target: git-setup, Sets up git hooks.
git-setup:
	./scripts/git-setup.sh

