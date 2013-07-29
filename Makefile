BIN = ./node_modules/.bin

# target: help, Display callable targets.
help:
	egrep "^# target:" [Mm]akefile

# target: setup, Do a full setup (currently an alias for git-setup).
setup: git-setup

# target: clean-npm, Cleans the NPM cache.
.PHONY: clean-npm
clean-npm:
	npm cache clean

# target: clean, Cleans all caches and reports.
.PHONY: clean
clean: clean-npm clean-coverage clean-complexity

# target: install, Installs all Node.js dependencies.
install:
	npm install

# target: git-setup, Sets up git hooks.
git-setup:
	./scripts/git-setup.sh

# target: lint-all, Lints every JavaScript file in the project.
.PHONY: lint-all
lint-all:
	$(BIN)/jshint --config ./scripts/jshint.cfg  --reporter ./scripts/lib/humanJshintReporter.js .

# target: lint-staged, Lints every JavaScript file in the project that is staged to be comitted.
.PHONY: lint-staged
lint-staged:
	git diff --raw --name-only --cached --diff-filter=ACMR | grep -e \\.js$ | xargs -I '{}' $(BIN)/jshint --config ./scripts/jshint.cfg --reporter ./scripts/lib/humanJshintReporter.js '{}'

# target: test, Runs all tests.
.PHONY: test
test:
	$(BIN)/mocha -R spec --recursive $(shell find lib -type d -name test)

# target: coverage, Creates a test coverage report in "./html-report" and in terminal.

.PHONY: clean-coverage
clean-coverage:
	rm -rf lib-cov
	rm -rf html-report

lib-cov: clean-coverage
	$(BIN)/istanbul instrument --output lib-cov --no-compact --variable global.__coverage__ lib

.PHONY: coverage
coverage: lib-cov
	$(BIN)/mocha -R mocha-istanbul --recursive $(shell find lib-cov -type d -name test)
	@echo Open html-report/index.html in your browser

.PHONY: clean-complexity
clean-complexity:
	rm -rf plato-report

# target: complexity, Creates a Plato code complexity report in "./plato-report".
.PHONY: complexity
complexity:
	$(BIN)/plato -r -d plato-report -l ./scripts/jshint.cfg ./lib
	@echo Open plato-report/index.html in your browser
