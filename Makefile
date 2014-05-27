BIN = ./node_modules/.bin
LIB = ./lib
LIBCOV = ./lib-cov
SCRIPTS = ./scripts
COVERAGE_REPORT = html-report
COMPLEXITY_REPORT = plato-report


# GETTING STARTED

define helpStarting
	@echo "Getting started:"
	@echo
	@echo "  make help              Prints this help."
	@echo "  make deps              Installs all dependencies (shortcut for deps-npm)."
	@echo
	@echo "  make deps-npm          Downloads and installs all NPM dependencies."
	@echo
endef

.PHONY: help build deps deps-npm start stop

help:
	@echo
	$(helpStarting)
	$(helpDevelopment)
	$(helpQuality)
	$(helpCleanup)

build:
	@echo "MAGE has nothing to build."

start:
	@echo "MAGE has nothing to start."

stop:
	@echo "MAGE has nothing to stop."

deps: deps-npm

deps-npm:
	mkdir -p node_modules
	npm install


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
	node $(SCRIPTS)/githooks.js


# QUALITY

define helpQuality
	@echo "Quality:"
	@echo
	@echo "  make test              Runs all tests (shortcut for test-lint and test-unit)."
	@echo "  make report            Creates all reports (shortcut for report-complexity and report-coverage)."
	@echo
	@echo "  make test-lint         Lints every JavaScript and JSON file in the project."
	@echo "  make test-style        Tests code style on every JavaScript and JSON file in the project."
	@echo "  make test-unit         Runs every unit test."
	@echo "  make report-complexity Creates a Plato code complexity report."
	@echo "  make report-coverage   Creates a unit test coverage report."
	@echo
	@echo "  available variables when linting:"
	@echo "    filter=staged        Limits linting to files that are staged to be committed."
	@echo "    path=./some/folder   Lints the given path recursively (file or a folder containing JavaScript and JSON files)."
	@echo
endef

.PHONY: lint lint-all test report test-lint test-style test-unit report-complexity report-coverage

# lint is deprecated
lint: test-lint
	@echo ">>> Warning: The make lint target has been deprecated, please change it to 'test-lint'."

# lint-all is deprecated
lint-all: test-lint
	@echo ">>> Warning: The make lint-all target has been deprecated, please change it to 'test-lint'."

test: test-lint test-style test-unit
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

define stylePath
	$(BIN)/jscs "$1"
endef

test-style:
ifdef path
	$(call stylePath,$(path))
else
  ifdef filter
    ifeq ($(filter),staged)
	git diff --raw --name-only --cached --diff-filter=ACMR | grep -E '\.js$$' | xargs -I '{}' $(call stylePath,{})
    else
	$(error Unknown filter: $(filter))
    endif
  else
	$(call stylePath,lib)
  endif
endif

test-unit:
	@echo Please note: Always make sure your tests point to files in $(LIBCOV), *not* $(LIB)
	$(BIN)/mocha -R spec --recursive $(shell find $(LIB) -type d -name test)

report-complexity:
	$(BIN)/plato -r -d $(COMPLEXITY_REPORT) -l .jshintrc $(LIB)
	@echo Open $(COMPLEXITY_REPORT)/index.html in your browser

instrument:
	rm -rf "$(LIBCOV)"
	$(BIN)/istanbul instrument --output $(LIBCOV) --no-compact --variable global.__coverage__ $(LIB)

report-coverage: instrument
	$(BIN)/mocha -R mocha-istanbul --recursive $(shell find $(LIBCOV) -type d -name test)
	@echo Open $(COVERAGE_REPORT)/index.html in your browser


# CLEANUP

define helpCleanup
	@echo "Cleanup:"
	@echo
	@echo "  make clean             Cleans all dependencies and reports."
	@echo
	@echo "  make clean-deps        Cleans node_modules."
	@echo "  make clean-report      Removes all reports."
	@echo
endef

.PHONY: clean clean-deps clean-report

clean: clean-deps clean-report

clean-deps:
	@git ls-files node_modules --error-unmatch > /dev/null 2>&1 && echo "Not removing node_modules from repo" || echo "Removing node_modules" && rm -rf node_modules

clean-report:
	rm -rf "$(LIBCOV)"
	rm -rf "$(COVERAGE_REPORT)"
	rm -rf "$(COMPLEXITY_REPORT)"
