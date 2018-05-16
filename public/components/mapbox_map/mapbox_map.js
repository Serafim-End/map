(function () {
    const app = angular.module('SberbankApp');

    app.directive('mapboxMap', ['$http', function ($http) {
        return {
            restrict: 'E',
            templateUrl: 'components/mapbox_map/mapbox_map.html',
            scope: {},
            link: function ($scope) {
                $scope.overlay = {currentNumberOfCheques: null};
                $scope.revenueFilter = {value: 0};

                $scope.charts = [
                    {
                        labels: ["Download Sales", "In-Store Sales", "Mail-Order Sales"],
                        values: [300, 500, 100]
                    },
                    {
                        labels: ["Download Sales", "In-Store Sales", "Mail-Order Sales"],
                        values: [3000, 500, 800]
                    }];

                $scope.chartOptions = {legend: {display: true}};

                mapboxgl.accessToken = 'pk.eyJ1IjoibWFrYXIiLCJhIjoiOGE4YzlmN2ZkMWEwNTc3MzQ3ODUxMDI0MDhiYjAyYzYifQ.ThEh3pk_BEVntMx2GcI6Sw';
                const map = new mapboxgl.Map({
                    container: 'map',
                    style: 'mapbox://styles/mapbox/dark-v9',
                    center: [37.621659419715826, 55.75455600738101],
                    zoom: 15
                });

                map.on('load', function() {
                    map.addSource('shops', {
                        type: 'geojson',
                        data: 'json_5mln_loc_005mln.geojson'
                        // url: 'mapbox://endnikita.4049812305537525000'
                    });

                    map.addLayer({
                        "id": "shops-heat",
                        "type": "heatmap",
                        "source": "shops",
                        "maxzoom": 9,
                        "paint": {
                            // Increase the heatmap weight based on frequency and property magnitude
                            "heatmap-weight": [
                                "interpolate",
                                ["linear"],
                                ["get", "total_sum"],
                                0, 0,
                                1000000, 1
                            ],
                            // Increase the heatmap color weight weight by zoom level
                            // heatmap-intensity is a multiplier on top of heatmap-weight
                            "heatmap-intensity": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                0, 1,
                                9, 3
                            ],
                            // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
                            // Begin color ramp at 0-stop with a 0-transparancy color
                            // to create a blur-like effect.
                            "heatmap-color": [
                                "interpolate",
                                ["linear"],
                                ["heatmap-density"],
                                0, "rgba(33,102,172,0)",
                                0.2, "rgb(103,169,207)",
                                0.4, "rgb(209,229,240)",
                                0.6, "rgb(253,219,199)",
                                0.8, "rgb(239,138,98)",
                                1, "rgb(178,24,43)"
                            ],
                            // Adjust the heatmap radius by zoom level
                            "heatmap-radius": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                0, 2,
                                9, 20
                            ],
                            // Transition from heatmap to circle layer by zoom level
                            "heatmap-opacity": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                7, 1,
                                9, 0
                            ],
                        }
                    }, 'waterway-label');

                    map.addLayer({
                        "id": "shops-point",
                        "type": "circle",
                        "source": "shops",
                        "minzoom": 7,
                        "paint": {
                            // Size circle radius by earthquake magnitude and zoom level
                            "circle-radius": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                7, [
                                    "interpolate",
                                    ["linear"],
                                    ["get", "total_sum"],
                                    0, 1,
                                    10000000, 10
                                ],
                                16, [
                                    "interpolate",
                                    ["linear"],
                                    ["get", "total_sum"],
                                    0, 5,
                                    10000000, 50
                                ]
                            ],
                            // Color circle by earthquake magnitude
                            "circle-color": [
                                "interpolate",
                                ["linear"],
                                ["get", "total_sum"],
                                0, "rgba(33,102,172,0)",
                                1000, "rgb(103,169,207)",
                                10000, "rgb(209,229,240)",
                                100000, "rgb(253,219,199)",
                                1000000, "rgb(239,138,98)",
                                10000000, "rgb(178,24,43)"
                            ],
                            "circle-stroke-color": "white",
                            "circle-stroke-width": 1,
                            // Transition from heatmap to circle layer by zoom level
                            "circle-opacity": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                7, 0,
                                8, 1
                            ]
                        }
                    }, 'waterway-label');

                    const draw = new MapboxDraw({
                        displayControlsDefault: false,
                        controls: {
                            polygon: true,
                            trash: true
                        }
                    });

                    map.addControl(draw);

                    map.on('draw.create', onSelectionChange);
                    map.on('draw.delete', onSelectionChange);
                    map.on('draw.update', onSelectionChange);

                    function isPointInsideMultiplePolygons(p, polygons) {
                        for (let i = 0; i < polygons.length; i++) {
                            if (turf.booleanPointInPolygon(p, polygons[i])) {
                                return true;
                            }
                        }

                        return false;
                    }
                    
                    function onSelectionChange() {
                        const data = draw.getAll();
                        const visibleFeatures = map.queryRenderedFeatures({layers: ['shops-point']});
                        const pointsInside = [];

                        visibleFeatures.forEach((f) => {
                            if (isPointInsideMultiplePolygons(f, data.features)) {
                                pointsInside.push(f.point_id);
                            }
                        });

                        $http
                            .post('http://185.203.91.112:1023/api/get_data', {points: pointsInside})
                            .then(function (response) {
                                // В случае успешного выполнения запроса, вызывается эта функция
                                $scope.charts = response.data;
                            }, function (response) {
                                // В случае неудачного - эта
                                console.log(response);
                            })
                    }

                    const overlay = document.getElementById('map-overlay');
                    map.on('mousemove', 'shops-point', function(e) {
                        const feature = e.features[0];

                        $scope.$apply(function () {
                            $scope.overlay.currentNumberOfCheques = feature.properties.bill_count;
                            $scope.overlay.totalSum = feature.properties.total_sum;
                            $scope.overlay.totalDiscount = feature.properties.total_discount;
                            $scope.overlay.averageBillPrice = feature.properties.average_bill_price;
                        });

                        overlay.style.display = 'block';

                    });

                    map.on('mouseleave', 'shops-point', function() {
                        map.getCanvas().style.cursor = '';
                        overlay.style.display = 'none';
                    });

                    $scope.$watch('revenueFilter.value', function () {
                        const filters = ['>=', 'total_sum', $scope.revenueFilter.value];
                        map.setFilter('shops-point', filters);
                        map.setFilter('shops-heat', filters);
                    });
                });
            }
        };
    }]);
}());