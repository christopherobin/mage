BIN = ./node_modules/.bin
LIB = ./lib
LIBCOV = ./lib-cov
SCRIPTS = ./scripts
COVERAGE_REPORT = html-report
COMPLEXITY_REPORT = plato-report

# target: help, Display callable targets.
help:
	@egrep "^# target:" Makefile

# target: install, Installs all Node.js dependencies.
install:
	npm install

# target: setup, Do a full setup (currently an alias for git-setup).
setup: git-setup

# target: lint-all, Lints every JavaScript file in the project.
.PHONY: lint-all
lint-all:
	$(BIN)/jshint --config .jshintrc --extra-ext .json --reporter $(SCRIPTS)/lib/humanJshintReporter.js .

# target: lint-staged, Lints every JavaScript file in the project that is staged to be comitted.
.PHONY: lint-staged
lint-staged:
	git diff --raw --name-only --cached --diff-filter=ACMR | grep -E '\.js(on)?$$' | xargs -I '{}' $(BIN)/jshint --config .jshintrc --reporter $(SCRIPTS)/lib/humanJshintReporter.js '{}'

# target: test, Runs all tests.
.PHONY: test
test:
	$(BIN)/mocha -R spec --recursive $(shell find $(LIB) -type d -name test)

# target: coverage, Creates a test coverage report.
instrument: clean-coverage
	$(BIN)/istanbul instrument --output $(LIBCOV) --no-compact --variable global.__coverage__ $(LIB)

.PHONY: coverage
coverage: instrument
	$(BIN)/mocha -R mocha-istanbul --recursive $(shell find $(LIBCOV) -type d -name test)
	@echo Open $(COVERAGE_REPORT)/index.html in your browser

# target: complexity, Creates a Plato code complexity report.
.PHONY: complexity
complexity:
	$(BIN)/plato -r -d $(COMPLEXITY_REPORT) -l .jshintrc $(LIB)
	@echo Open $(COMPLEXITY_REPORT)/index.html in your browser

# target: clean, Cleans all caches and reports.
.PHONY: clean
clean: clean-npm clean-coverage clean-complexity

# target: clean-npm, Cleans the NPM cache.
.PHONY: clean-npm
clean-npm:
	npm cache clean

# target: clean-coverage, Removes the test coverage report and its instrumented files.
.PHONY: clean-coverage
clean-coverage:
	rm -rf $(LIBCOV)
	rm -rf $(COVERAGE_REPORT)

# target: clean-complexity, Removes the Plato report.
.PHONY: clean-complexity
clean-complexity:
	rm -rf $(COMPLEXITY_REPORT)

# target: git-setup, Sets up git hooks.
git-setup:
	$(SCRIPTS)/git-setup.sh
