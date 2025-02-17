import { Circle as CircleStyle, Fill, Stroke, Style } from 'https://cdn.jsdelivr.net/npm/ol@6.5.0/style.js';

class pgRouting {

    constructor() {
        // Get locales
        this._locales = '';

        fetch(`${lizUrls.basepath}index.php/pgrouting/translate/`)
            .then((response) => {
                return response.json();
            })
            .then((json) => {
                if (json) {
                    this._locales = JSON.parse(json);
                }
            });

        lizMap.events.on({
            uicreated: () => {
                // Init draw with 2 points and hide layer
                lizMap.mainLizmap.draw.init('Point', 2, true, (feature) => {
                    let fillColor = 'green';

                    if (feature.getId() === 1) {
                        fillColor = 'red';
                    }
                    return new Style({
                        image: new CircleStyle({
                            radius: 10,
                            fill: new Fill({
                                color: fillColor,
                            }),
                        }),
                    });
                });

                lizMap.mainLizmap.draw.visible = false;

                lizMap.mainEventDispatcher.addListener(() => {
                    const features = lizMap.mainLizmap.draw.features;

                    // Add ids to identify origin and destination features for styling
                    if (features.length === 1) {
                        features[0].setId(0);
                    }
                    if (features.length === 2) {
                        features[1].setId(1);
                        this._getRoute(
                            lizMap.mainLizmap.transform(features[0].getGeometry().getCoordinates(), lizMap.mainLizmap.projection, 'EPSG:4326'),
                            lizMap.mainLizmap.transform(features[1].getGeometry().getCoordinates(), lizMap.mainLizmap.projection, 'EPSG:4326')
                        );
                    }
                }, ['draw.addFeature']
                );

                // TODO: add dispatch 'modifyend' event in Draw class
                lizMap.mainLizmap.draw._modifyInteraction.on('modifyend', () => {
                    const features = lizMap.mainLizmap.draw.features;
                    if (features.length === 2) {
                        const origin = features.find(feature => feature.getId() === 0);
                        const destination = features.find(feature => feature.getId() === 1);
                        this._getRoute(
                            lizMap.mainLizmap.transform(origin.getGeometry().getCoordinates(), lizMap.mainLizmap.projection, 'EPSG:4326'),
                            lizMap.mainLizmap.transform(destination.getGeometry().getCoordinates(), lizMap.mainLizmap.projection, 'EPSG:4326')
                        );
                    }
                });

                // Show mouse pointer when hovering origin or destination points
                lizMap.mainLizmap.map.on('pointermove', (e) => {
                    if (e.dragging) {
                        return;
                    }
                    const pixel = lizMap.mainLizmap.map.getEventPixel(e.originalEvent);
                    const featuresAtPixel = lizMap.mainLizmap.map.getFeaturesAtPixel(pixel);
                    const featureHover = featuresAtPixel.some(feature => lizMap.mainLizmap.draw.features.includes(feature));

                    lizMap.mainLizmap.map.getViewport().style.cursor = featureHover ? 'pointer' : '';
                });
            },
            dockopened: (evt) => {
                if (evt.id === "pgrouting") {
                    lizMap.mainLizmap.draw.visible = true;
                    if (this._routeLayer) {
                        this._routeLayer.setVisible(true);
                    }
                }
            },
            dockclosed: (evt) => {
                if (evt.id === "pgrouting") {
                    lizMap.mainLizmap.draw.visible = false;
                    if (this._routeLayer) {
                        this._routeLayer.setVisible(false);
                    }
                }
            }
        });
    }

    _getRoute(origin, destination) {
        fetch(`${lizUrls.basepath}index.php/pgrouting/?repository=${lizUrls.params.repository}&project=${lizUrls.params.project}&origin=${origin[0]},${origin[1]}&destination=${destination[0]},${destination[1]}&crs=4326&option=get_short_path`)
            .then((response) => {
                return response.json();
            })
            .then((json) => {
                // Remove route if any and create new one
                if (this._routeLayer) {
                    lizMap.mainLizmap.layers.removeLayer(this._routeLayer);
                }

                if (json && json.routing) {
                    // Display route
                    const width = 8;
                    this._routeLayer = lizMap.mainLizmap.layers.addLayerFromGeoJSON(json.routing, undefined, [
                        new Style({
                            stroke: new Stroke({
                                color: 'white',
                                width: width + 4
                            })
                        }),
                        new Style({
                            stroke: new Stroke({
                                color: 'purple',
                                width: width
                            })
                        })
                    ]);

                    // Display roadmap
                    const contentElement = document.querySelector('#pgrouting .menu-content');

                    // Merge road with same label when sibling
                    let mergedRoads = [];
                    let previousLabel = '';

                    for (const feature of json.routing.features) {
                        const label = feature.properties.label;
                        const distance = feature.properties.dist;

                        if (label !== previousLabel) {
                            mergedRoads.push({ label: label, distance: distance });
                        } else {
                            mergedRoads[mergedRoads.length - 1] = { label: label, distance: distance + mergedRoads[mergedRoads.length - 1].distance }
                        }
                        previousLabel = label;
                    }

                    let roadMap = `<div class="roadmap"><h4>${this._locales['roadmap.title']}</h4><dl>`;

                    for (const road of mergedRoads) {
                        roadMap += `<dt>${road.label ? road.label : this._locales['road.label.missing']}</dt><dd>${road.distance < 1 ? 1 : Math.round(road.distance)}m</dd>`;
                    }
                    roadMap += `</dl></div>`;

                    // Display POI
                    let POIList = '';
                    if (json.poi && json.poi.features) {
                        POIList += `<div class="poi"><h4>${this._locales['poi.title']}</h4><dl>`;
                        for (const feature of json.poi.features) {
                            const label = feature.properties.label;
                            const description = feature.properties.description;
                            const type = feature.properties.type;

                            POIList += `<dt>${label}</dt><dd>${description}</dd><dd>${type}</dd>`;
                        }
                        POIList += `</dl></div>`;
                    }

                    contentElement.innerHTML = `<div class="pgrouting">${roadMap}${POIList}</div>`;
                } else {
                    lizMap.addMessage(this._locales['route.error'], 'error', true)
                }
            });
    }
}

lizMap.pgRouting = new pgRouting();
