BIN = ./node_modules/.bin
LIB = ./lib
TEST_UNIT = ./test/unit
TEST_INTEGRATION = ./test/integration
SCRIPTS = ./scripts
COVERAGE_REPORT = html-report
COMPLEXITY_REPORT = plato-report
APP_ROOT = ./tmp


# GETTING STARTED

define helpStarting
	@echo "Getting started:"
	@echo
	@echo "  make help              Prints this help."
	@echo "  make deps              Installs all dependencies (shortcut for deps-npm, deps-component)."
	@echo
	@echo "  make deps-npm          Downloads and installs all NPM dependencies."
	@echo "  make deps-component    Downloads and installs all component dependencies."
	@echo
endef

.PHONY: help build deps deps-npm deps-component start stop

help:
	@echo
	$(helpStarting)
	$(helpDevelopment)
	$(helpQuality)
	$(helpCleanup)
	$(helpApps)

build:
	@echo "MAGE has nothing to build."

start:
	@echo "MAGE has nothing to start."

stop:
	@echo "MAGE has nothing to stop."

deps: deps-npm deps-component

deps-npm:
	mkdir -p node_modules
	npm install

deps-component:
	mkdir -p components
	@cd $(TEST_INTEGRATION); node . install-components


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
	@echo "  make test              Runs all tests (shortcut for test-lint, test-style, test-unit and test-integration)."
	@echo "  make report            Creates all reports (shortcut for report-complexity and report-coverage)."
	@echo
	@echo "  make test-lint         Lints every JavaScript and JSON file in the project."
	@echo "  make test-style        Tests code style on every JavaScript and JSON file in the project."
	@echo "  make test-unit         Runs all unit tests."
	@echo "  make test-integration  Runs all integration test."
	@echo "  make report-complexity Creates a Plato code complexity report."
	@echo "  make report-coverage   Creates a unit test coverage report."
	@echo
	@echo "  available variables when linting:"
	@echo "    filter=staged        Limits linting to files that are staged to be committed."
	@echo "    path=./some/folder   Lints the given path recursively (file or a folder containing JavaScript and JSON files)."
	@echo
endef

.PHONY: test report test-lint test-style test-unit test-integration report-complexity report-coverage

test: test-lint test-style test-unit test-integration
report: report-complexity report-coverage

define lintPath
	$(BIN)/jshint --extra-ext .json --reporter $(SCRIPTS)/lib/humanJshintReporter.js "$1"
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
	$(BIN)/mocha -R spec --recursive $(TEST_UNIT)

test-integration:
	@echo Running integration tests
	@echo
	NODE_ENV="$(NODE_ENV),unit-tests" node $(TEST_INTEGRATION) autorun


report-complexity:
	$(BIN)/plato -r -d $(COMPLEXITY_REPORT) -l .jshintrc $(LIB)
	@echo Open $(COMPLEXITY_REPORT)/index.html in your browser

report-coverage:
	# unit tests
	$(BIN)/istanbul cover $(BIN)/_mocha --dir $(COVERAGE_REPORT)/unit -- -R spec --recursive $(TEST_UNIT)

	# integration tests
	NODE_ENV="$(NODE_ENV),unit-tests" $(BIN)/istanbul cover $(TEST_INTEGRATION) --dir $(COVERAGE_REPORT)/integration -- autorun

	# aggregate results
	$(BIN)/istanbul report html --root $(COVERAGE_REPORT) --dir $(COVERAGE_REPORT)
	@echo Open $(COVERAGE_REPORT)/index.html in your browser


# CLEANUP

define helpCleanup
	@echo "Cleanup:"
	@echo
	@echo "  make clean             Cleans all dependencies and reports."
	@echo
	@echo "  make clean-deps        Cleans node_modules and components."
	@echo "  make clean-report      Removes all reports."
	@echo
endef

.PHONY: clean clean-deps clean-report

clean: clean-deps clean-report

clean-deps:
	@git ls-files node_modules --error-unmatch > /dev/null 2>&1 && echo "Not removing node_modules from repo" || echo "Removing node_modules" && rm -rf node_modules
	@git ls-files components --error-unmatch > /dev/null 2>&1 && echo "Not removing components from repo" || echo "Removing components" && rm -rf components

clean-report:
	rm -rf "$(COVERAGE_REPORT)"
	rm -rf "$(COMPLEXITY_REPORT)"


# APPLICATION TESTS AGAINST MAGE

define helpApps
	@echo "Applications:"
	@echo
	@echo "  make app-update        Updates or installs the repo."
	@echo "  make app-build         Installs the app, its dependencies and datastores."
	@echo "  make app-test          Runs \"make test\" against the app."
	@echo "  make app-run           Runs the app in the foreground."
	@echo
	@echo "  variables for app-commands:"
	@echo "    user                 Name of the GitHub (default: Wizcorp)."
	@echo "    repo                 Name of the repository (not optional)."
	@echo "    branch               Name of the branch to checkout (only used by app-update, default: develop)."
	@echo
endef

.PHONY: app-check-repo-name app-check-repo-path app-update app-build app-test app-run

# set values for branch and user, only if not already set from the outside

branch := develop
user := Wizcorp

repo_path = $(APP_ROOT)/$(user)-$(repo)

app-check-repo-name:
ifndef repo
	@echo "Please specify a repository name to test against using repo=[github repo name]" && exit 1
endif

app-check-repo-path:
	@[ ! -d $(repo_path) ] \
		&& echo 'Please run `make app-update repo=$(repo)$(shell [ "$(user)" != "Wizcorp" ] && echo " user=$(user)")` first' \
		&& exit 1 \
		|| true

app-update: app-check-repo-name

# If the repository wasn't cloned yet, we clone it
	[ ! -d "$(repo_path)" ] && git clone "git@github.com:$(user)/$(repo).git" "$(repo_path)" || true

# * Checkout package.json (to make sure no uncommitted changes are left; see below)
# * Checkout the branch we wish to test
# * Pull the latest updates for that branch

	cd "$(repo_path)" && git checkout package.json && git checkout "$(branch)" && git pull origin "$(branch)"

app-build: app-check-repo-name app-check-repo-path

# * Remove MAGE dependency from package.json
# * Install node dependencies
# * Symlink to MAGE (or update the symlink if it exists)
# * Rebuild MAGE for the current platform
# * Build the apps
# * Set up datastores

	cd "$(repo_path)" \
		&& make clean \
		&& npm rm --save mage \
		&& $(MAKE) deps-npm \
		&& rm -rf ./node_modules/mage \
		&& ln -sf ../../../ ./node_modules/mage

	cd "$(repo_path)/node_modules/mage" && npm rebuild

	cd "$(repo_path)" && $(MAKE) deps-component

	if grep '^build:' "$(repo_path)/Makefile" > /dev/null; then cd "$(repo_path)" && $(MAKE) build; fi
	if grep '^datastores:' "$(repo_path)/Makefile" > /dev/null; then cd "$(repo_path)" && $(MAKE) datastores; fi

app-test: app-check-repo-name app-check-repo-path
	cd "$(repo_path)" && make test

app-run: app-check-repo-name app-check-repo-path
	cd "$(repo_path)" && node .
