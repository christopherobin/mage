lint:
	jshint `find ./lib -name "*.js"` --config ./jshint.cfg

git-setup:
	if [[ -d "./git" ]]; then echo This is not a git repository; exit 1; fi

