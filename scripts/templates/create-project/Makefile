BIN = ./node_modules/.bin
LIB = ./lib
LIBCOV = ./lib-cov
SCRIPTS = ./scripts
COVERAGE_REPORT = html-report
COMPLEXITY_REPORT = plato-report
TEST = ./test


# GETTING STARTED

define helpStarting
	@echo "Getting started:"
	@echo
	@echo "  make help              Outputs this help."
	@echo "  make install           Installs the environment (shortcut for install-deps and install-archivist)."
	@echo
	@echo "  make install-deps      Installs all NPM dependencies."
	@echo "  make install-archivist Creates databases and runs all migrations up to this version."
	@echo
endef

.PHONY: help install install-deps install-archivist

help:
	@echo
	$(helpStarting)
	$(helpDevelopment)
	$(helpQuality)
	$(helpRunning)
	$(helpCleanup)

install: install-deps install-archivist

install-deps:
	npm install

install-archivist:
	@echo Creating databases...
	node . archivist-create
	@echo Migrating databases to current application version
	node . archivist-migrate


# DEVELOPMENT

define helpDevelopment
	@echo "Development:"
	@echo
	@echo "  make dev               Sets up the development environment (shortcut for dev-githooks)."
	@echo
	@echo "  make dev-githooks      Sets up git hooks."
	@echo
endef

.PHONY: dev dev-githooks

dev: dev-githooks

dev-githooks:
	$(SCRIPTS)/githooks.sh


# QUALITY

define helpQuality
	@echo "Quality:"
	@echo
	@echo "  make lint              Lints every JavaScript and JSON file in the project."
	@echo "  make test              Runs all unit tests."
	@echo "  make coverage          Creates a unit test coverage report."
	@echo "  make complexity        Creates a Plato code complexity report."
	@echo
	@echo "  make lint path=abc     Lints the given path recursively (file or folder containing JavaScript and JSON files)."
	@echo "  make lint-staged       Lints every JavaScript and JSON file in the project that is staged to be committed."
	@echo
endef

.PHONY: lint lint-staged test instrument coverage complexity

lint:
ifdef path
	@echo Linting $(path)
	$(BIN)/jshint --config .jshintrc --extra-ext .json --reporter $(SCRIPTS)/lib/humanJshintReporter.js $(path)
else
	@echo Linting all files
	$(BIN)/jshint --config .jshintrc --extra-ext .json --reporter $(SCRIPTS)/lib/humanJshintReporter.js .
endif

lint-staged:
	git diff --raw --name-only --cached --diff-filter=ACMR | grep -E '\.js(on)?$$' | xargs -I '{}' $(BIN)/jshint --config .jshintrc --reporter $(SCRIPTS)/lib/humanJshintReporter.js '{}'

test:
	@echo Please note: Always make sure your tests point to files in $(LIBCOV), *not* $(LIB)
	$(BIN)/mocha -R spec --recursive $(TEST)

instrument: clean-coverage
	$(BIN)/istanbul instrument --output $(LIBCOV) --no-compact --variable global.__coverage__ $(LIB)

coverage: instrument
	$(BIN)/mocha -R mocha-istanbul --recursive $(TEST)
	@echo Open $(COVERAGE_REPORT)/index.html in your browser

complexity:
	$(BIN)/plato -r -d $(COMPLEXITY_REPORT) -l .jshintrc $(LIB)
	@echo Open $(COMPLEXITY_REPORT)/index.html in your browser


# RUNNING

define helpRunning
	@echo "Running:"
	@echo
	@echo "  make start             Starts the application daemonized."
	@echo "  make stop              Stops the daemonized application."
	@echo "  make restart           Restarts the daemonized application."
	@echo "  make reload            Recycles all workers with zero-downtime (not to be used on version changes)."
	@echo "  make status            Outputs the status of the daemonized application."
	@echo
endef

.PHONY: start stop restart reload status

start:
	node . start

stop:
	node . stop

restart:
	node . restart

reload:
	node . reload

status:
	node . status


# CLEANUP

define helpCleanup
	@echo "Cleanup:"
	@echo
	@echo "  make clean             Cleans all caches and reports."
	@echo
	@echo "  make clean-npm         Cleans the NPM cache."
	@echo "  make clean-coverage    Removes the test coverage report and its instrumented files."
	@echo "  make clean-complexity  Removes the Plato report."
	@echo
endef

.PHONY: clean clean-npm clean-coverage clean-complexity

clean: clean-npm clean-coverage clean-complexity

clean-npm:
	npm cache clean

clean-coverage:
	rm -rf $(LIBCOV)
	rm -rf $(COVERAGE_REPORT)

clean-complexity:
	rm -rf $(COMPLEXITY_REPORT)

