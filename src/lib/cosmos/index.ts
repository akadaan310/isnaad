// ============================================================================
//  الكون — the cosmic layer.
//
//  `types`      the payload the WebGL field and the flight board both read.
//  `placement`  the constants that turn a computed quantity into a radius.
//  `locus`      the join between locus space (سورة:آية) and cosmic space.
//  `strands`    relationships the engine already computed, as drawable edges.
//  `coverage`   how much of the muṣḥaf a drawn relation stands for.
//
//  Everything here is pure: no filesystem, no React, no three.js. The ingest
//  script, the API routes and the renderer all sit on top of it.
// ============================================================================
export * from './types';
export * from './placement';
export * from './locus';
export * from './strands';
export * from './coverage';
export * from './wire';
