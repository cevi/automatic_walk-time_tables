/** The map layers the export can be printed on (value of the map_layers setting). */
export interface MapLayerOption {
  value: string;
  label: string;
}

export const MAP_LAYERS: MapLayerOption[] = [
  { value: 'ch.swisstopo.pixelkarte-farbe', label: 'Basiskarte Farbig' },
  { value: 'ch.swisstopo.pixelkarte-grau', label: 'Basiskarte S/W' },
  { value: 'ch.swisstopo.swissimage-product', label: 'Luftbild' },
  {
    value:
      'ch.swisstopo.pixelkarte-farbe,ch.bafu.wrz-wildruhezonen_portal,ch.bafu.bundesinventare-auen,ch.bafu.bundesinventare-hochmoore,ch.bafu.bundesinventare-flachmoore,ch.bafu.bundesinventare-jagdbanngebiete,ch.bafu.schutzgebiete-schweizerischer_nationalpark,ch.bafu.bundesinventare-trockenwiesen_trockenweiden',
    label: 'Wildruhezonen',
  },
  {
    value:
      'ch.swisstopo.vec200-miscellaneous,ch.swisstopo.vec200-names-namedlocation,ch.swisstopo.vec25-gebaeude,ch.swisstopo.swisstlm3d-eisenbahnnetz,ch.swisstopo.swisstlm3d-gewaessernetz,ch.swisstopo.swisstlm3d-uebrigerverkehr,ch.swisstopo.swisstlm3d-wald,ch.swisstopo.swisstlm3d-strassen,ch.swisstopo.swisstlm3d-wanderwege,ch.swisstopo.vec25-heckenbaeume,ch.swisstopo.geologie-geotope',
    label: 'Minimale Karte',
  },
];

/** These layers are only available as JPEG tiles, all others as (transparent) PNG tiles. */
const JPEG_LAYERS = [
  'ch.swisstopo.pixelkarte-farbe',
  'ch.swisstopo.pixelkarte-grau',
  'ch.swisstopo.swissimage-product',
];

/**
 * One swisstopo WMTS tile per layer, stacked on top of each other, as a preview of a map layer option.
 * The tile shows a section of the Glarus Alps (zoom level 13), with hiking trails and wildlife reserves.
 */
export function previewTiles(option: MapLayerOption): string[] {
  return option.value.split(',').map((layer) => {
    const ext = JPEG_LAYERS.includes(layer) ? 'jpeg' : 'png';
    return `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/13/4298/2878.${ext}`;
  });
}

export function mapLayerLabel(value: string): string {
  return MAP_LAYERS.find((o) => o.value === value)?.label ?? 'Eigene Karte';
}
