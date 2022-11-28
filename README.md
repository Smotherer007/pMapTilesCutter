Image to map tiles converter
============================

This is a tool to converts an image into a leaflet or googlemaps compatible map tiles. Inspired by (https://github.com/bramus/photoshop-google-maps-tile-cutter)

Parameters
----------
--sourcePath # The path to the image you like to convert

--targetPath # The path where the map tiles should be saved

--tileSize # The size of the map tiles

Example
-------

./pMapTilesCutter --sourcePath ./map.png --targetPath ./mymaptiles/ --tileSize 256 