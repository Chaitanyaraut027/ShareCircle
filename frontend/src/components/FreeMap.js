import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * FreeMap Component
 * Uses OpenStreetMap (OSM) and Leaflet.js inside a WebView.
 * Requires NO API Keys and is completely free.
 */
const FreeMap = ({ 
    region, 
    onRegionChangeComplete, 
    markers = [], 
    onMarkerPress,
    style,
    showUserLocation = false,
    userLocation = null,
    polyline = null,
    circle = null,
    selectedLocation = null // For adjustment mode
}) => {
    const webViewRef = useRef(null);

    // Initial HTML with Leaflet
    const mapHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                body { margin: 0; padding: 0; }
                #map { height: 100vh; width: 100vw; background: #F8FAFC; }
                .leaflet-div-icon {
                    background: #10B981;
                    border: 2px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                .user-icon {
                    background: #3B82F6;
                    border: 3px solid white;
                    border-radius: 50%;
                    width: 15px !important;
                    height: 15px !important;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
                }
                .selected-icon {
                    background: #EF4444;
                    border: 2px solid white;
                    border-radius: 50%;
                    width: 20px !important;
                    height: 20px !important;
                    box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);
                }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map', {
                    zoomControl: false,
                    attributionControl: false
                }).setView([${region?.latitude || 0}, ${region?.longitude || 0}], 14);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19
                }).addTo(map);

                var markersList = {};
                var userMarker = null;
                var polyLineLayer = null;
                var circleLayer = null;
                var selectedMarker = null;

                // Function to update markers
                window.updateMarkers = function(newMarkers) {
                    Object.values(markersList).forEach(m => map.removeLayer(m));
                    markersList = {};

                    newMarkers.forEach(m => {
                        const icon = L.divIcon({
                            className: 'leaflet-div-icon',
                            iconSize: [20, 20]
                        });
                        const marker = L.marker([m.latitude, m.longitude], { icon: icon })
                            .addTo(map)
                            .on('click', () => {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'onMarkerPress',
                                    payload: m
                                }));
                            });
                        markersList[m.id || m._id] = marker;
                    });
                };

                // Function to update user location
                window.updateUserLocation = function(lat, lng) {
                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.marker([lat, lng], {
                        icon: L.divIcon({ className: 'user-icon', iconSize: [15, 15] })
                    }).addTo(map);
                };

                // Function to update selected location (the dot in the center for adjusting)
                window.updateSelectedLocation = function(lat, lng) {
                    if (selectedMarker) map.removeLayer(selectedMarker);
                    selectedMarker = L.marker([lat, lng], {
                        icon: L.divIcon({ className: 'selected-icon', iconSize: [20, 20] })
                    }).addTo(map);
                };

                // Function for Polyline
                window.updatePolyline = function(coords) {
                    if (polyLineLayer) map.removeLayer(polyLineLayer);
                    if (!coords || coords.length === 0) return;
                    
                    const latlngs = coords.map(c => [c.latitude, c.longitude]);
                    polyLineLayer = L.polyline(latlngs, {color: '#3B82F6', weight: 4, opacity: 0.7}).addTo(map);
                    map.fitBounds(polyLineLayer.getBounds(), { padding: [50, 50] });
                };

                // Function for Circle
                window.updateCircle = function(lat, lng, radius) {
                    if (circleLayer) map.removeLayer(circleLayer);
                    if (!lat || !lng) return;
                    
                    circleLayer = L.circle([lat, lng], {
                        color: '#10B981',
                        fillColor: '#10B981',
                        fillOpacity: 0.1,
                        radius: radius
                    }).addTo(map);
                };

                window.updateRegion = function(lat, lng, zoom = 14) {
                    map.setView([lat, lng], zoom);
                };

                map.on('move', function() {
                    const center = map.getCenter();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'onRegionChange',
                        payload: {
                            latitude: center.lat,
                            longitude: center.lng
                        }
                    }));
                });

                map.on('moveend', function() {
                    const center = map.getCenter();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'onRegionChangeComplete',
                        payload: {
                            latitude: center.lat,
                            longitude: center.lng
                        }
                    }));
                });
            </script>
        </body>
        </html>
    `;

    // Inject data on changes
    useEffect(() => {
        if (webViewRef.current && region) {
            const script = `window.updateRegion(${region.latitude}, ${region.longitude});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [region?.latitude, region?.longitude]);

    useEffect(() => {
        if (webViewRef.current) {
            const script = `window.updateMarkers(${JSON.stringify(markers.map(m => ({
                id: m._id || m.id,
                latitude: m.location?.coordinates ? m.location.coordinates[1] : m.latitude,
                longitude: m.location?.coordinates ? m.location.coordinates[0] : m.longitude,
                ...m
            })))});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [markers]);

    useEffect(() => {
        if (webViewRef.current && polyline) {
            const script = `window.updatePolyline(${JSON.stringify(polyline)});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [polyline]);

    useEffect(() => {
        if (webViewRef.current && circle) {
            const script = `window.updateCircle(${circle.latitude}, ${circle.longitude}, ${circle.radius});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [circle]);

    useEffect(() => {
        if (webViewRef.current && selectedLocation) {
            const script = `window.updateSelectedLocation(${selectedLocation.latitude}, ${selectedLocation.longitude});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [selectedLocation]);

    useEffect(() => {
        if (webViewRef.current && userLocation) {
            const script = `window.updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [userLocation]);

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'onMarkerPress' && onMarkerPress) {
                onMarkerPress(data.payload);
            } else if (data.type === 'onRegionChangeComplete' && onRegionChangeComplete) {
                onRegionChangeComplete(data.payload);
            }
        } catch (e) {
            // console.warn("WebView Message Error", e);
        }
    };

    return (
        <View style={[styles.container, style]}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.webview}
                onMessage={handleMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scrollEnabled={false}
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#10B981" />
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default FreeMap;
