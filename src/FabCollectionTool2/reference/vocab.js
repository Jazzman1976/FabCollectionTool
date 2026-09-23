/*
 * vocab.js - vocabulary lists and code tables (maintained by hand, not generated).
 * Used for validating collection values, for converting the codes of the open card data set
 * (the-fab-cube) into readable labels and for mapping values to Fabrary.
 */
FCT.DATA.vocab = {

    // Allowed values in the collection. An empty string is always allowed as well.
    editions: ['Alpha', 'First', 'Unlimited', 'EN', 'DE', 'FR', 'ES', 'IT', 'JP'],
    languageEditions: ['EN', 'DE', 'FR', 'ES', 'IT', 'JP'],
    artTreatments: [
        'Alternate Art', 'Alternate Border', 'Alternate Text', 'Extended Art', 'Full Art',
        'Micro Text Box'
    ],
    rarities: [
        'Basic', 'Common', 'Fabled', 'Legendary', 'Majestic', 'Marvel', 'Pirate Booty',
        'Promo', 'Rare', 'Super Rare', 'Token'
    ],
    pitches: ['Red', 'Yellow', 'Blue', 'Purple'],
    peculiarities: ['Left Hand', 'Right Hand', 'Dual Card', 'Variant A', 'Variant B', 'CC Label'],

    // Code tables of the-fab-cube card-printing.csv / card.csv.
    editionCodes: { N: '', A: 'Alpha', F: 'First', U: 'Unlimited' },
    foilingCodes: { S: '', R: 'Rainbow', C: 'Cold', G: 'Gold' },
    artCodes: {
        EA: 'Extended Art', FA: 'Full Art', AA: 'Alternate Art', AB: 'Alternate Border',
        AT: 'Alternate Text'
    },
    rarityCodes: {
        B: 'Basic', C: 'Common', R: 'Rare', S: 'Super Rare', M: 'Majestic', L: 'Legendary',
        F: 'Fabled', T: 'Token', V: 'Marvel', P: 'Promo'
    },
    pitchCodes: { 1: 'Red', 2: 'Yellow', 3: 'Blue' },

    // Fabrary: one row per foiling; the quantity columns ST/RF/CF/GF map to these values.
    fabraryFoilings: { ST: '', RF: 'Rainbow', CF: 'Cold', GF: 'Gold' },

    // Fabrary knows no "Micro Text Box" and lists it as "Extended Art".
    fabraryTreatments: { 'Micro Text Box': 'Extended Art' },

    // Cards whose standard foiling is marked "Extended Art" here but listed as normal by Fabrary.
    fabraryExtendedArtAsNormal: ['ROS002', 'ROS008']
};
