"use client";

import React from 'react';
import Map, { Layer, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapComponent() {
    const [bolsoesGeoJSON, setBolsoesGeoJSON] = React.useState(null);
    const [error, setError] = React.useState(null);

    const initialViewState = {
        longitude:  -43.211279,
        latitude: -22.970389,
        zoom: 12,
        pitch: 0, 
    };

    React.useEffect(() => {
        let cancelled = false;

        async function loadBolsoes() {
            try {
                const response = await fetch('/api/bolsoes', { cache: 'no-store' });

                if (!response.ok) {
                    throw new Error('Nao foi possivel carregar os bolsoes.');
                }

                const data = await response.json();

                if (!cancelled) {
                    setBolsoesGeoJSON(data);
                }
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Erro desconhecido ao carregar GeoJSON.';
                    setError(message);
                }
            }
        }

        loadBolsoes();

        return () => {
            cancelled = true;
        };
    }, []);

    const fillLayer = {
        id: 'bolsoes-fill',
        type: 'fill',
        paint: {
            'fill-color': ['coalesce', ['get', 'fill'], '#a52714'],
            'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.3],
        },
    };

    const outlineLayer = {
        id: 'bolsoes-outline',
        type: 'line',
        paint: {
            'line-color': ['coalesce', ['get', 'stroke'], '#a52714'],
            'line-opacity': ['coalesce', ['get', 'stroke-opacity'], 1],
            'line-width': ['coalesce', ['get', 'stroke-width'], 2],
        },
    };

    return (
        <div style={{ width: '100%', height: '500px', position: 'relative' }}>
            <Map
                initialViewState={initialViewState}
                mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" 
            >
                {bolsoesGeoJSON && (
                    <Source id="bolsoes" type="geojson" data={bolsoesGeoJSON}>
                        <Layer {...fillLayer} />
                        <Layer {...outlineLayer} />
                    </Source>
                )}
            </Map>
            {!bolsoesGeoJSON && !error && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(255, 255, 255, 0.75)'
                }}>
                    Carregando bolsões...
                </div>
            )}
            {error && (
                <div style={{
                    position: 'absolute',
                    left: 12,
                    right: 12,
                    bottom: 12,
                    background: '#fff0f0',
                    color: '#7f1d1d',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 14
                }}>
                    {error}
                </div>
            )}
        </div>
    );
}