#
# %APP_NAME% - default.yaml
# =========================
#
# This file includes all the configuration that every environment has in common. Every environment
# can have its own configuration file. If the environment specific configuration file overlaps
# entries with this file, the environment specific one will override the values here.
#

apps:
    game:
        responseCache: 30
        access: user
        delivery:
            serverCache: false
            useManifest: false
            compress: true
            postprocessors:
                css: []
                js: []
