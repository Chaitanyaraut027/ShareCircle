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
    selectedLocation = null
}) => {
    const webViewRef = useRef(null);
    const lastRegionRef = useRef(region);
    const hasInitialFit = useRef(false);

    const mapHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                body { margin: 0; padding: 0; }
                #map { height: 100vh; width: 100vw; background: #F1F5F9; }
                
                .gift-marker {
                    width: 30px; height: 30px;
                    background: #2F7B5E;
                    border: 2px solid #FFF;
                    border-radius: 50%;
                    display: flex; justify-content: center; align-items: center;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                }

                .user-marker {
                    width: 16px; height: 16px;
                    background: #3B82F6;
                    border: 2px solid #FFF;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #3B82F6;
                }
                
                .selected-marker {
                    width: 20px; height: 20px;
                    background: #EF4444;
                    border: 2px solid #FFF;
                    border-radius: 50%;
                    box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4);
                }

                .leaflet-control-zoom {
                    border: none !important;
                    margin: 20px !important;
                }
                .leaflet-control-zoom a {
                    background-color: white !important;
                    color: #2F7B5E !important;
                    width: 36px !important; height: 36px !important;
                    line-height: 36px !important;
                    border-radius: 12px !important;
                    font-size: 22px !important;
                    margin-bottom: 5px !important;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.15) !important;
                }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map', {
                    zoomControl: true,
                    attributionControl: false
                }).setView([${region?.latitude || 20}, ${region?.longitude || 78}], 13);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

                var markersGroup = L.featureGroup().addTo(map);
                var userMarker = null;
                var polyLineLayer = null;
                var circleLayer = null;
                var selectedMarker = null;
                var isInteracting = false;

                map.on('movestart', () => { isInteracting = true; });
                map.on('moveend', () => { 
                    isInteracting = false; 
                    const center = map.getCenter();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'onRegionChangeComplete',
                        payload: { latitude: center.lat, longitude: center.lng }
                    }));
                });

                window.updateRegion = function(lat, lng) {
                    if (isInteracting) return;
                    map.setView([lat, lng], map.getZoom(), { animate: true });
                };

                window.updateMarkers = function(items, shouldFit) {
                    markersGroup.clearLayers();
                    if (!items || items.length === 0) return;

                    items.forEach(m => {
                        const icon = L.divIcon({
                            className: '',
                            html: '<div class="gift-marker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg></div>',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        });
                        L.marker([m.latitude, m.longitude], { icon: icon })
                         .addTo(markersGroup)
                         .on('click', () => {
                             window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'onMarkerPress', payload: m }));
                         });
                    });

                    if (shouldFit && items.length > 0) {
                        map.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
                    }
                };

                window.updateUserLocation = function(lat, lng) {
                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.marker([lat, lng], {
                        icon: L.divIcon({ className: '', html: '<div class="user-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8]})
                    }).addTo(map);
                };

                window.updateSelectedLocation = function(lat, lng) {
                    if (selectedMarker) map.removeLayer(selectedMarker);
                    selectedMarker = L.marker([lat, lng], {
                        icon: L.divIcon({ className: '', html: '<div class="selected-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10]})
                    }).addTo(map);
                };

                window.updateCircle = function(lat, lng, radius) {
                    if (circleLayer) map.removeLayer(circleLayer);
                    if (!lat || !lng) return;
                    circleLayer = L.circle([lat, lng], {
                        color: '#2F7B5E', fillColor: '#2F7B5E', fillOpacity: 0.15, weight: 2, radius: radius
                    }).addTo(map);
                };

                window.updatePolyline = function(coords) {
                    if (polyLineLayer) map.removeLayer(polyLineLayer);
                    if (!coords || coords.length < 2) return;
                    polyLineLayer = L.polyline(coords.map(c => [c.latitude, c.longitude]), {color: '#3B82F6', weight: 5}).addTo(map);
                };
            </script>
        </body>
        </html>
    `;

    useEffect(() => {
        if (webViewRef.current && region) {
            const dist = lastRegionRef.current 
                ? Math.abs(lastRegionRef.current.latitude - region.latitude) + Math.abs(lastRegionRef.current.longitude - region.longitude)
                : 1;
            
            if (dist > 0.0005) {
                webViewRef.current.injectJavaScript(`window.updateRegion(${region.latitude}, ${region.longitude});`);
                lastRegionRef.current = region;
            }
        }
    }, [region?.latitude, region?.longitude]);

    useEffect(() => {
        if (webViewRef.current) {
            const processedMarkers = markers.map((m, idx) => {
                // Add jitter to prevent overlap
                const jitter = (Math.random() - 0.5) * 0.0001;
                return {
                    id: m._id || m.id || idx,
                    latitude: (m.location?.coordinates ? m.location.coordinates[1] : m.latitude) + jitter,
                    longitude: (m.location?.coordinates ? m.location.coordinates[0] : m.longitude) + jitter,
                    ...m
                };
            });
            const script = `window.updateMarkers(${JSON.stringify(processedMarkers)}, ${!hasInitialFit.current});`;
            webViewRef.current.injectJavaScript(script);
            if (markers.length > 0) hasInitialFit.current = true;
        }
    }, [markers]);

    useEffect(() => {
        if (webViewRef.current && userLocation) {
            webViewRef.current.injectJavaScript(`window.updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});`);
            if (circle) {
                webViewRef.current.injectJavaScript(`window.updateCircle(${userLocation.latitude}, ${userLocation.longitude}, ${circle.radius});`);
            }
        }
    }, [userLocation, circle?.radius]);

    useEffect(() => {
        if (webViewRef.current && selectedLocation) {
            webViewRef.current.injectJavaScript(`window.updateSelectedLocation(${selectedLocation.latitude}, ${selectedLocation.longitude});`);
        }
    }, [selectedLocation]);

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'onMarkerPress') onMarkerPress?.(data.payload);
            else if (data.type === 'onRegionChangeComplete') onRegionChangeComplete?.(data.payload);
        } catch (e) {}
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
                renderLoading={() => (
                    <View style={styles.loading}><ActivityIndicator size="large" color="#2F7B5E" /></View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    webview: { flex: 1 },
    loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' }
});

export default FreeMap;
