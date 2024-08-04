# Changelog

A complete, technical changelog is available at [GitHub](https://github.com/cevi/automatic_walk-time_tables/releases).

## Version 5 - Drawing Paths directly within the Web App
- Adds basic path drawing functionality to the web app (experimental) (5.0.0)
- Fixes a bug where the generated Excel file was buggy (5.0.0)
- Add 1:5'000 scale to the PDF export (5.0.0)
- Dependency updates
- Bug fixes
- Do not create height profile anymore (5.1.0)
- Always create map pdf and excel (5.1.0)

## Version 4 - Improved Error handling & drop CLI support
- Add option to delete waypoints (4.1.0)
- Added waypoints are now more likely to be selected for the Excel export (4.1.0)
- Error messages are better shown to the user (4.0.0)
- CLI support is fully dropped (4.0.0)
- Map numbers computation uses less API requests (4.0.0)
- Healthcheck for docker containers at startup (4.0.0)
- Linting (PEP8), (4.0.0)
- Bug fixes
- Dependency updates

## Version 3 - Interactive Exports
- Circular Paths are now supported (3.3.2)
- Interactive exports: modify the selected waypoints using points of interest (POI) (3.0.0)
- Improved Documentation and Changelog (on this page) (3.0.0)
- combine all maps in a single PDF file (3.0.0)
- Add download button (for cases where the auto download does not work) (3.1.0)
- New [Split Screen and Mobile View](https://github.com/cevi/automatic_walk-time_tables/issues/182) (3.3.0)
- Bug fixes
- Dependency updates

## Version 2 - Web App
- Web app with user guide
- Improved point selecting algorithm (2.3.0)
- Change in background map (2.3.0)
- Support for KML files (2.2.0)
- Bug fixes
- Dependency updates

## Version 1 - Initial Script
- Docker-based deployment
- Support for GPX files