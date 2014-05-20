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
	@echo "  make help              Prints this help."
	@echo "  make version           Prints version information about the game, MAGE and Node.js."
	@echo "  make all               Installs all dependencies and datastores (shortcut for deps, datastores and build)."
	@echo
	@echo "  make deps              Installs all dependencies (shortcut for deps-npm, deps-submodules and deps-component)."
	@echo "  make datastores        Creates datastores and runs all migrations up to the current version."
	@echo "  make build             Creates html/css/js builds for all apps."
	@echo "  make assets-index      Indexes assets fo all apps."
	@echo
	@echo "  make deps-npm          Downloads and installs all NPM dependencies."
	@echo "  make deps-component    Downloads and installs all external components."
	@echo "  make deps-submodules   Downloads updates on git submodules."
	@echo
endef

.PHONY: help version all deps deps-npm deps-submodules deps-component datastores build

help:
	@echo
	$(helpStarting)
	$(helpDevelopment)
	$(helpQuality)
	$(helpRunning)
	$(helpCleanup)

version:
	node . --version

all: deps datastores build assets-index

deps: deps-npm deps-submodules deps-component

deps-npm:
	mkdir -p node_modules
	npm install

deps-component:
	node . install-components

deps-submodules:
	@if [ -d .git ]; then git submodule update --init; else echo "Not a git repository, skipping submodules"; fi

datastores:
	@echo Creating databases...
	node . archivist-create
	@echo Migrating databases to current application version
	node . archivist-migrate

build:
	node . build

assets-index:
	node . assets-index

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
	node . completion >> ~/.bash_completion
	@echo
	@echo Tab completion is now installed for this project.
	@echo Please restart your shell or enter:
	@echo . ~/.bash_completion
	

dev-githooks:
	node $(SCRIPTS)/githooks.js


# QUALITY

define helpQuality
	@echo "Quality:"
	@echo
	@echo "  make test              Runs all tests (shortcut for test-lint and test-unit)."
	@echo "  make report            Creates all reports (shortcut for report-complexity and report-coverage)."
	@echo
	@echo "  make test-lint         Lints every JavaScript and JSON file in the project."
	@echo "  make test-unit         Runs every unit test in $(TEST)."
	@echo "  make report-complexity Creates a Plato code complexity report."
	@echo "  make report-coverage   Creates a unit test coverage report."
	@echo
	@echo "  available variables when linting:"
	@echo "    filter=staged        Limits linting to files that are staged to be committed."
	@echo "    path=./some/folder   Lints the given path recursively (file or a folder containing JavaScript and JSON files)."
	@echo
endef

.PHONY: lint lint-all test report test-lint test-unit report-complexity report-coverage

# lint is deprecated
lint: test-lint
	@echo ">>> Warning: The make lint target has been deprecated, please change it to 'test-lint'."

# lint-all is deprecated
lint-all: test-lint
	@echo ">>> Warning: The make lint-all target has been deprecated, please change it to 'test-lint'."

test: test-lint test-unit
report: report-complexity report-coverage

define lintPath
	$(BIN)/jshint --config .jshintrc --extra-ext .json --reporter $(SCRIPTS)/lib/humanJshintReporter.js "$1"
endef

test-lint:
ifdef path
	$(call lintPath,$(path))
else
  ifdef filter
    ifeq ($(filter),staged)
	git diff --raw --name-only --cached --diff-filter=ACMR | grep -E '\.js(on)?$$' | xargs -I '{}' $(call lintPath,{})
    else
	$(error Unknown filter: $(filter))
    endif
  else
	$(call lintPath,.)
  endif
endif

test-unit:
	@echo Please note: Always make sure your tests point to files in $(LIBCOV), *not* $(LIB)
	$(BIN)/mocha -R spec --recursive $(TEST)

report-complexity:
	$(BIN)/plato -r -d $(COMPLEXITY_REPORT) -l .jshintrc $(LIB)
	@echo Open $(COMPLEXITY_REPORT)/index.html in your browser

instrument:
	rm -rf "$(LIBCOV)"
	$(BIN)/istanbul instrument --output $(LIBCOV) --no-compact --variable global.__coverage__ $(LIB)

report-coverage: instrument
	$(BIN)/mocha -R mocha-istanbul --recursive $(TEST)
	@echo Open $(COVERAGE_REPORT)/index.html in your browser


# RUNNING

define helpRunning
	@echo "Running:"
	@echo
	@echo "  make start             Starts the application daemonized."
	@echo "  make stop              Stops the daemonized application."
	@echo "  make restart           Restarts the daemonized application."
	@echo "  make reload            Recycles all workers with zero-downtime (not to be used on version changes)."
	@echo "  make status            Prints the status of the daemonized application."
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
	@echo "  make clean             Removes all builds, dependencies and reports."
	@echo
	@echo "  make clean-build       Removes all application builds."
	@echo "  make clean-deps        Removes components and node_modules."
	@echo "  make clean-report      Removes all reports."
	@echo
endef

.PHONY: clean clean-build clean-deps clean-report

clean: clean-build clean-deps clean-report

clean-build:
# If the app cannot be started (eg, if clean already happened) this will fail, but it should not be fatal.
	@if [ -d "node_modules/mage" ]; then echo "Removing builds"; node . build --clean; else echo "Cannot remove builds without MAGE installed (skipping)"; fi

clean-deps:
	@git ls-files node_modules --error-unmatch > /dev/null 2>&1 && echo "Not removing node_modules from repo" || echo "Removing node_modules" && rm -rf node_modules
	@git ls-files components --error-unmatch > /dev/null 2>&1 && echo "Not removing components from repo" || echo "Removing components" && rm -rf components

clean-report:
	@echo "Removing reports"
	rm -rf "$(LIBCOV)"
	rm -rf "$(COVERAGE_REPORT)"
	rm -rf "$(COMPLEXITY_REPORT)"

