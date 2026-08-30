/**
 * Provenance Drawer Logic and Metadata Extractor.
 *
 * Implements full data lineage reporting:
 * - Copernicus Product ID and Title
 * - Ingestion & Acquisition Timestamp
 * - Dataset Version and Processing History
 * - Source File SHA-256 and Storage Path
 * - Licence and Citation Notice conforming to E.U. Open Data directives
 */

import type { ProvenanceMetadataModel } from './types.ts';

export const COPERNICUS_THETAO_PROVENANCE_BASELINE: ProvenanceMetadataModel = {
  datasetId: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
  datasetVersion: '2025.04',
  variableId: 'sea_water_potential_temperature',
  productId: 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
  provider: 'Copernicus Marine Service (E.U. Copernicus Programme)',
  snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
  sourceFilename: 'copernicus_phy_thetao_20260824_20260830.nc',
  sourceSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
  canonicalStorePath: 'data/canonical/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087',
  acquisitionTimestampUtc: '2026-08-30T12:57:44.550082+00:00',
  licence: 'Copernicus Sentinel Data / E.U. Open Data Policy',
  attribution: 'E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00016',
  processingPipelineVersion: 'QuasarOS-v1.0.0-canonical-ingest',
  geographicBounds: {
    minLongitude: 80.0,
    maxLongitude: 88.0,
    minLatitude: -3.0,
    maxLatitude: 12.0,
  },
  verticalBounds: {
    minDepthM: 0.494,
    maxDepthM: 453.938,
    levelCount: 31,
  },
};

/**
 * Format complete provenance markdown record for export or drawer display.
 */
export function formatProvenanceMarkdown(provenance: ProvenanceMetadataModel = COPERNICUS_THETAO_PROVENANCE_BASELINE): string {
  return [
    `# QuasarOS Operational Data Lineage & Provenance Record`,
    ``,
    `## Dataset Identity`,
    `- **Product ID:** \`${provenance.productId}\``,
    `- **Dataset ID:** \`${provenance.datasetId}\``,
    `- **Canonical Variable:** \`${provenance.variableId}\``,
    `- **Dataset Version:** \`${provenance.datasetVersion}\``,
    `- **Provider:** ${provenance.provider}`,
    `- **Active Snapshot:** \`${provenance.snapshotId}\``,
    ``,
    `## Ingestion & Cryptographic Lineage`,
    `- **Source Filename:** \`${provenance.sourceFilename}\``,
    `- **Source SHA-256 Checksum:** \`${provenance.sourceSha256}\``,
    `- **Canonical Storage Path:** \`${provenance.canonicalStorePath}\``,
    `- **Acquisition Time (UTC):** \`${provenance.acquisitionTimestampUtc}\``,
    `- **Ingestion Pipeline:** \`${provenance.processingPipelineVersion ?? 'QuasarOS Ingestion Engine'}\``,
    ``,
    `## Spatiotemporal Domain`,
    provenance.geographicBounds
      ? `- **Spatial Bounds:** Longitude [${provenance.geographicBounds.minLongitude.toFixed(2)}°E, ${provenance.geographicBounds.maxLongitude.toFixed(2)}°E], Latitude [${provenance.geographicBounds.minLatitude.toFixed(2)}°N, ${provenance.geographicBounds.maxLatitude.toFixed(2)}°N]`
      : `- **Spatial Bounds:** N/A`,
    provenance.verticalBounds
      ? `- **Vertical Bounds:** Depth [${provenance.verticalBounds.minDepthM.toFixed(3)}m, ${provenance.verticalBounds.maxDepthM.toFixed(3)}m] across ${provenance.verticalBounds.levelCount} discrete levels`
      : `- **Vertical Bounds:** N/A`,
    ``,
    `## Legal & Attribution`,
    `- **Licence:** ${provenance.licence}`,
    `- **Mandatory Citation:** ${provenance.attribution}`,
  ].join('\n');
}
