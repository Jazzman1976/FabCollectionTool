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

    // Splitting the type line of card.csv ("Light, Illusionist, Action, Attack") into the
    // columns Metatype, Talent1/2, Class1/2, Type1/2 and Sub1-3, following the Comprehensive
    // Rules (rules.fabtcg.com, fetched 24.09.2026): a type line reads
    // "[metatypes] [supertypes] [type] - [subtypes]" (2.14.1); supertypes are classes
    // (2.11.6a) or talents (2.11.6b); the types are listed in 2.15.6a. "Generic" means no
    // supertypes (2.14.1a) and is kept as a display value. Metatypes have no fixed list in
    // the rules (2.6.6: hero monikers and set names); the known ones are listed so that new
    // words are reported; "Invocation Placeholder Card" is the type line of the helper card
    // UPR225 "Dragons of Legend" and no word of the rules. Hand sizes are written as in the
    // spreadsheet: "1H" -> "(1H)".
    talents: [
        'Chaos', 'Draconic', 'Earth', 'Elemental', 'Ice', 'Light', 'Lightning', 'Mystic',
        'Revered', 'Reviled', 'Royal', 'Shadow'
    ],
    classes: [
        'Generic', 'Adjudicator', 'Assassin', 'Bard', 'Brute', 'Guardian', 'Illusionist',
        'Mechanologist', 'Merchant', 'Necromancer', 'Ninja', 'Pirate', 'Ranger', 'Runeblade',
        'Shapeshifter', 'Thief', 'Warrior', 'Wizard'
    ],
    cardTypes: [
        'Action', 'Attack Reaction', 'Block', 'Companion', 'Defense Reaction', 'Demi-Hero',
        'Equipment', 'Hero', 'Instant', 'Macro', 'Mentor', 'Resource', 'Token', 'Weapon'
    ],
    metatypes: [
        'Arakni', 'Event', 'High Seas', 'Omens of the Third Age', 'Puffin', 'Rosetta', 'Scurv',
        'Invocation', 'Placeholder Card'
    ],
    handSubtypes: { '1H': '(1H)', '2H': '(2H)' },

    // Fabrary: one row per foiling; the quantity columns ST/RF/CF/GF map to these values.
    fabraryFoilings: { ST: '', RF: 'Rainbow', CF: 'Cold', GF: 'Gold' },

    // Fabrary knows no "Micro Text Box" and lists it as "Extended Art".
    fabraryTreatments: { 'Micro Text Box': 'Extended Art' },

    // Cards whose standard foiling is marked "Extended Art" here but listed as normal by Fabrary.
    fabraryExtendedArtAsNormal: ['ROS002', 'ROS008']
};
