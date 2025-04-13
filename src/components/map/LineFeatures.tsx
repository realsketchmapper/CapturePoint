import React, { useMemo } from 'react';
import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';

interface LineFeaturesProps {
  features: FeatureCollection;
}

const LineFeatures: React.FC<LineFeaturesProps> = React.memo(({ features }) => {
  const { getFeatureTypeByName } = useFeatureTypeContext();

  // Filter and categorize features in a single pass
  const categorizedFeatures = useMemo(() => {
    const result = {
      solidLines: { ...features, features: [] as typeof features.features },
      dashedLines: { ...features, features: [] as typeof features.features },
      solidPreviewLines: { ...features, features: [] as typeof features.features },
      dashedPreviewLines: { ...features, features: [] as typeof features.features }
    };

    features.features.forEach(feature => {
      if (feature.geometry.type !== 'LineString') return;

      const isPreview = feature.properties?.isPreview === true;
      const isSolid = !feature.properties?.dashPattern || 
        JSON.stringify(feature.properties.dashPattern) === JSON.stringify([1, 0]);

      if (isPreview) {
        if (isSolid) {
          result.solidPreviewLines.features.push(feature);
        } else {
          result.dashedPreviewLines.features.push(feature);
        }
      } else {
        if (isSolid) {
          result.solidLines.features.push(feature);
        } else {
          result.dashedLines.features.push(feature);
        }
      }
    });

    return result;
  }, [features]);

  return (
    <>
      {/* Render permanent solid lines */}
      <ShapeSource
        id="solidLineFeaturesSource"
        shape={categorizedFeatures.solidLines}
      >
        <LineLayer
          id="solidLineFeaturesLayer"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['get', 'lineWeight'],
            lineOpacity: 1
          }}
        />
      </ShapeSource>

      {/* Render permanent dashed lines */}
      <ShapeSource
        id="dashedLineFeaturesSource"
        shape={categorizedFeatures.dashedLines}
      >
        <LineLayer
          id="dashedLineFeaturesLayer"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['get', 'lineWeight'],
            lineOpacity: 1,
            lineDasharray: [2, 2]
          }}
        />
      </ShapeSource>

      {/* Render preview solid lines */}
      <ShapeSource
        id="solidPreviewLineFeaturesSource"
        shape={categorizedFeatures.solidPreviewLines}
      >
        <LineLayer
          id="solidPreviewLineFeaturesLayer"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['get', 'lineWeight'],
            lineOpacity: 0.8
          }}
        />
      </ShapeSource>

      {/* Render preview dashed lines */}
      <ShapeSource
        id="dashedPreviewLineFeaturesSource"
        shape={categorizedFeatures.dashedPreviewLines}
      >
        <LineLayer
          id="dashedPreviewLineFeaturesLayer"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['get', 'lineWeight'],
            lineOpacity: 0.8,
            lineDasharray: [2, 2]
          }}
        />
      </ShapeSource>
    </>
  );
});

export default LineFeatures; 