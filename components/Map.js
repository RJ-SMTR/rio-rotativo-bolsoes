"use client";

import React from 'react';
import Map, { Layer, NavigationControl, Popup, Source } from 'react-map-gl/maplibre';
import Image from 'next/image';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapComponent() {
    const [bolsoesGeoJSON, setBolsoesGeoJSON] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [selectedBolsaoId, setSelectedBolsaoId] = React.useState(null);
    const [selectedPopupLngLat, setSelectedPopupLngLat] = React.useState(null);
    const mapRef = React.useRef(null);

    const bolsoesGeoJSONWithIds = React.useMemo(() => {
        const features = bolsoesGeoJSON?.features;
        if (!Array.isArray(features)) {
            return null;
        }

        return {
            ...bolsoesGeoJSON,
            features: features.map((feature, index) => {
                const bolsaoId = String(feature?.id ?? `${feature?.properties?.name ?? 'bolsao'}-${index}`);
                return {
                    ...feature,
                    properties: {
                        ...(feature?.properties ?? {}),
                        __bolsaoId: bolsaoId,
                    },
                };
            }),
        };
    }, [bolsoesGeoJSON]);

    const bolsoes = React.useMemo(() => {
        const features = bolsoesGeoJSONWithIds?.features;
        if (!Array.isArray(features)) {
            return [];
        }

        return features.map((feature, index) => ({
            id: feature?.properties?.__bolsaoId ?? `bolsao-${index}`,
            name: feature?.properties?.name ?? `Bolsao ${index + 1}`,
            description: feature?.properties?.description ?? null,
            feature,
        }));
    }, [bolsoesGeoJSONWithIds]);

    const selectedBolsao = React.useMemo(
        () => bolsoes.find((item) => item.id === selectedBolsaoId) ?? null,
        [bolsoes, selectedBolsaoId]
    );

    const totalVagas = React.useMemo(
        () => bolsoes.reduce((sum, item) => sum + (Number(item?.feature?.properties?.quantidade_vaga_total) || 0), 0),
        [bolsoes]
    );

    const initialViewState = {
        longitude: -43.20887685,
        latitude: -22.9724913,
        zoom: 15,
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

    const selectedFillLayer = {
        id: 'bolsao-selected-fill',
        type: 'fill',
        paint: {
            'fill-color': '#2563eb',
            'fill-opacity': 0.25,
        },
    };

    const selectedOutlineLayer = {
        id: 'bolsao-selected-outline',
        type: 'line',
        paint: {
            'line-color': '#1d4ed8',
            'line-width': 4,
            'line-opacity': 1,
        },
    };

    function getBoundsFromGeometry(geometry) {
        if (!geometry || !geometry.coordinates) {
            return null;
        }

        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;

        function walkCoordinates(value) {
            if (!Array.isArray(value) || value.length === 0) {
                return;
            }

            if (typeof value[0] === 'number' && typeof value[1] === 'number') {
                const lng = value[0];
                const lat = value[1];
                minLng = Math.min(minLng, lng);
                minLat = Math.min(minLat, lat);
                maxLng = Math.max(maxLng, lng);
                maxLat = Math.max(maxLat, lat);
                return;
            }

            value.forEach(walkCoordinates);
        }

        walkCoordinates(geometry.coordinates);

        if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
            return null;
        }

        return [[minLng, minLat], [maxLng, maxLat]];
    }

    function getBoundsFromFeatures(features) {
        if (!Array.isArray(features) || features.length === 0) {
            return null;
        }

        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;

        features.forEach((feature) => {
            const bounds = getBoundsFromGeometry(feature?.geometry);
            if (!bounds) {
                return;
            }

            minLng = Math.min(minLng, bounds[0][0]);
            minLat = Math.min(minLat, bounds[0][1]);
            maxLng = Math.max(maxLng, bounds[1][0]);
            maxLat = Math.max(maxLat, bounds[1][1]);
        });

        if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
            return null;
        }

        return [[minLng, minLat], [maxLng, maxLat]];
    }

    function goToInitialView() {
        const map = mapRef.current?.getMap?.();
        if (!map) {
            return;
        }

        map.easeTo({
            center: [initialViewState.longitude, initialViewState.latitude],
            zoom: initialViewState.zoom,
            pitch: initialViewState.pitch,
            bearing: 0,
            duration: 800,
        });
    }

    function fitAllBolsoes() {
        const map = mapRef.current?.getMap?.();
        if (!map) {
            return;
        }

        const bounds = getBoundsFromFeatures(bolsoes.map((item) => item.feature));
        if (!bounds) {
            return;
        }

        setSelectedBolsaoId(null);
        setSelectedPopupLngLat(null);
        map.fitBounds(bounds, {
            padding: { top: 60, right: 60, bottom: 60, left: 60 },
            duration: 800,
            maxZoom: 15,
        });
    }

    function handleSelectBolsao(bolsao) {
        const isSameBolsao = bolsao.id === selectedBolsaoId;
        const map = mapRef.current?.getMap?.();

        if (isSameBolsao) {
            setSelectedBolsaoId(null);
            setSelectedPopupLngLat(null);
            goToInitialView();

            return;
        }

        setSelectedBolsaoId(bolsao.id);

        const bounds = getBoundsFromGeometry(bolsao.feature?.geometry);
        if (!bounds) {
            return;
        }

        setSelectedPopupLngLat({
            lng: (bounds[0][0] + bounds[1][0]) / 2,
            lat: (bounds[0][1] + bounds[1][1]) / 2,
        });

        if (!map) {
            return;
        }

        map.fitBounds(bounds, {
            padding: { top: 60, right: 60, bottom: 60, left: 60 },
            duration: 800,
            maxZoom: 17,
        });
    }

    function handleMapClick(event) {
        const clickedFeature = event?.features?.[0];
        const clickedId = clickedFeature?.properties?.__bolsaoId;

        if (!clickedId) {
            return;
        }

        const bolsao = bolsoes.find((item) => String(item.id) === String(clickedId));
        if (!bolsao) {
            return;
        }

        handleSelectBolsao(bolsao);
    }

    function fieldReferencesName(field) {
        if (typeof field === 'string') {
            return field.includes('name');
        }

        if (Array.isArray(field)) {
            return field.some((item) => fieldReferencesName(item));
        }

        return false;
    }

    function forcePortugueseLabels() {
        const map = mapRef.current?.getMap?.();
        if (!map) {
            return;
        }

        const style = map.getStyle();
        const layers = style?.layers;

        if (!Array.isArray(layers)) {
            return;
        }

        layers.forEach((layer) => {
            if (layer.type !== 'symbol') {
                return;
            }

            const currentTextField = map.getLayoutProperty(layer.id, 'text-field');
            if (!currentTextField || !fieldReferencesName(currentTextField)) {
                return;
            }

            map.setLayoutProperty(layer.id, 'text-field', [
                'coalesce',
                ['get', 'name:pt'],
                ['get', 'name:pt-BR'],
                ['get', 'name_pt'],
                ['get', 'name'],
                currentTextField,
            ]);
        });
    }

    return (
        <div style={{
            width: '100vw',
            height: '100dvh',
            display: 'flex',
            background: '#f4f6f8',
            overflow: 'hidden'
        }}>
            <aside style={{
                width: 320,
                maxWidth: '80vw',
                borderRight: '1px solid #d9dee5',
                background: '#004a80',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
                    <Image
                        src="/image.png"
                        alt="Logo Rio Rotativo"
                        width={75}
                        height={75}
                        style={{ marginBottom: 12 }}
                    />
                    <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>
                        Estacionamentos Rio Rotativo
                    </h2>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: '#fff' }}>
                        {bolsoes.length} registrados · {totalVagas} vagas
                    </p>
                </div>

                <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
                    {!bolsoesGeoJSON && !error && (
                        <p style={{ margin: 0, color: '#Fff', fontSize: 14 }}>Carregando informações...</p>
                    )}

                    {error && (
                        <div style={{
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

                    {!error && bolsoesGeoJSON && bolsoes.length === 0 && (
                        <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Nenhum estacionamento encontrado.</p>
                    )}

                    {bolsoes.map((bolsao) => {
                        const isSelected = bolsao.id === selectedBolsaoId;

                        return (
                        <button
                            key={bolsao.id}
                            onClick={() => handleSelectBolsao(bolsao)}
                            style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 8,
                                background: isSelected ? '#0DB1E3' : '',
                            cursor: 'pointer'
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>
                                {bolsao.name}
                            </div>
                        </button>
                        );
                    })}
                </div>
            </aside>

            <div style={{ position: 'relative', flex: 1 }}>
                <Map
                    ref={mapRef}
                    initialViewState={initialViewState}
                    mapStyle="https://tiles.openfreemap.org/styles/bright"
                    style={{ width: '100%', height: '100%' }}
                    interactiveLayerIds={['bolsoes-fill', 'bolsoes-outline']}
                    onClick={handleMapClick}
                    onLoad={forcePortugueseLabels}
                >
                    <NavigationControl position="top-right" showCompass={false} />
                    {bolsoesGeoJSONWithIds && (
                        <Source id="bolsoes" type="geojson" data={bolsoesGeoJSONWithIds}>
                            <Layer {...fillLayer} />
                            <Layer {...outlineLayer} />
                        </Source>
                    )}
                    {selectedBolsao?.feature && (
                        <Source
                            id="selected-bolsao"
                            type="geojson"
                            data={{
                                type: 'FeatureCollection',
                                features: [selectedBolsao.feature],
                            }}
                        >
                            <Layer {...selectedFillLayer} />
                            <Layer {...selectedOutlineLayer} />
                        </Source>
                    )}
                    {selectedBolsao && selectedPopupLngLat && (
                        <Popup
                            longitude={selectedPopupLngLat.lng}
                            latitude={selectedPopupLngLat.lat}
                            closeButton
                            closeOnClick={false}
                            onClose={() => {
                                setSelectedBolsaoId(null);
                                setSelectedPopupLngLat(null);
                            }}
                            maxWidth="280px"
                        >
                            <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 700, marginBottom: 7 }}>{selectedBolsao.name}</div>
                                {Array.isArray(selectedBolsao.feature?.properties?.perfis_funcionamento) &&
                                    selectedBolsao.feature.properties.perfis_funcionamento.length > 0 && (
                                    <div style={{ fontWeight: 700, marginBottom: 7 }}>
                                        {selectedBolsao.feature.properties.perfis_funcionamento.join(', ')}
                                    </div>
                                )}
                                <div><strong>LOGRADOURO:</strong> {selectedBolsao.feature?.properties?.logradouro ?? 'N/A'}</div>
                                <div><strong>VAGAS DISPONÍVEIS:</strong> {selectedBolsao.feature?.properties?.quantidade_vaga_total ?? 'N/A'}</div>
                                <div><strong>VAGAS PARA MOTOS:</strong> {selectedBolsao.feature?.properties?.quantidade_vaga_moto ?? 'N/A'}</div>
                                <div><strong>VAGAS IDOSO (5%):</strong> {selectedBolsao.feature?.properties?.quantidade_vaga_idoso ?? 'N/A'}</div>
                                <div><strong>VAGA PCD (2%):</strong> {selectedBolsao.feature?.properties?.quantidade_vaga_pcd ?? 'N/A'}</div>
                                <div><strong>TEMPO DE PERMANÊNCIA:</strong> {selectedBolsao.feature?.properties?.tempo_permanencia_hora ?? 'N/A'}h</div>
                                {selectedBolsao.feature?.properties?.description && (
                                    <div style={{ marginTop: 8 }}>
                                        <a
                                            href={selectedBolsao.feature.properties.description}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}
                                        >
                                            Ver referência
                                        </a>
                                    </div>
                                )}
                            </div>
                        </Popup>
                    )}
                </Map>
                {!bolsoesGeoJSON && !error && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(255, 255, 255, 0.5)'
                    }}>
                        Carregando mapa...
                    </div>
                )}

                <div
                    role="group"
                    aria-label="Controles do mapa"
                    style={{
                        position: 'absolute',
                        top: 84,
                        right: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        zIndex: 10
                    }}
                >

                    <button
                        type="button"
                        aria-label="Enquadrar todos os bolsoes"
                        title="Enquadrar todos os bolsoes"
                        onClick={fitAllBolsoes}
                        style={{
                            width: 29,
                            height: 29,
                            padding: 0,
                            borderRadius: 4,
                            border: 'none',
                            background: '#ffffff',
                            color: '#333333',
                            fontSize: 18,
                            fontWeight: 600,
                            lineHeight: 1,
                            cursor: 'pointer',
                            boxShadow: '0 0 0 1px rgb(0 0 0 / 10%), 0 1px 2px rgb(0 0 0 / 10%)'
                        }}
                    >
                        ⦿
                    </button>
                </div>
            </div>
        </div>
    );
}