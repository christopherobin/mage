PACKAGE = Mithril

lint:
	nodelint --config ./nodelint.cfg `find ./lib -name "*.js"`

