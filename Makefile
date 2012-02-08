# target: help, Display callable targets.
help:
	egrep "^# target:" [Mm]akefile

# target: lint-all, Lints every JavaScript file in the project.
lint-all:
	./scripts/lint-all.sh

# target: lint, Lints every JavaScript file in the project that git has marked as added or modified.
lint:
	./scripts/lint-modified.sh

# target: git-setup, Sets up git hooks
git-setup:
	./scripts/git-setup.sh

# target: full setup (currently an alias for git-setup)
setup: git-setup

# target: clean, Cleans the NPM cache
clean:
	npm cache clean

# target: install, Installs all NodeJS dependencies
install:
	npm install

