# How to run it?

Make sure you have installed python 3 and all requirements listed in the requirements.txt file. Now you can
run ```main.py``` to launch the script. The produced files get saved in the ./output directory.

In the ```main.py``` you can specify the ```DEPARTURE_TIME```, ```GPX_FILE_PATH```, and ```VELOCITY```. Note: the script
is only tested with GPX-files exported form SchweizMobil, but it should work with arbitrary GPX-files.

## About swisstopo Services

This script highly depends on the services form swisstopo (Federal Office of Topography swisstopo). Those services are
free-of-charge and do not require registration (since 01.03.2021). However, we should follow there "Fair Use" rules.
More details see [API documentation](https://api3.geo.admin.ch/services/sdiservices.html)
and [Terms of use](https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html).

Thus, in some cases, e.g. finding a swisstopo name for a coordinate, we will not use the official API but rebuild the
query algorithm locally. Therefore, please make sure, you have downloaded the necessary files in the ./res folder. The
files needed include ```swissNAMES3D_LIN.csv```, ```swissNAMES3D_PKT.csv```, and ```swissNAMES3D_PLY.csv```.